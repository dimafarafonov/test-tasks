import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_FIELDS, reconcile, type FieldSpec, type ReconcileInput } from '../src/index.ts';

const SIMPLE = 'id,amount,timestamp,memo';
const EXT = `${SIMPLE},currency,quantity,price_per_share,fx_rate,party_email`;
const AS_OF = '2026-05-01T23:59:59.999Z';

function run(
  ours: string[],
  theirs: string[],
  opts: { manual?: string[]; asOf?: string; header?: string; theirsHeader?: string; fields?: FieldSpec[] } = {},
) {
  const header = opts.header ?? SIMPLE;
  const input: ReconcileInput = {
    ours: { name: 'ours.csv', text: [header, ...ours].join('\n') },
    theirs: { name: 'theirs.csv', text: [opts.theirsHeader ?? header, ...theirs].join('\n') },
    manual: { name: 'manual.csv', text: ['ours_id,theirs_id', ...(opts.manual ?? [])].join('\n') },
    asOf: opts.asOf ?? AS_OF,
  };
  return reconcile(input, { fields: opts.fields });
}

const kinds = (r: ReturnType<typeof run>) => r.report!.matches.map((m) => `${m.kind}:${m.ours_id}-${m.theirs_id}`);
const codes = (r: ReturnType<typeof run>) => r.issues.map((i) => i.code);

test('records with timestamp after as_of are left out of the report (DECISIONS A1)', () => {
  const r = run(['o1,1.00,2026-05-02T00:00:00Z,x'], ['t1,1.00,2026-05-01T00:00:00Z,x']);
  assert.deepEqual(r.report!.unmatched_ours, []);
  assert.equal(r.report!.unmatched_theirs.length, 1);
});

test('as_of with nanoseconds filters at full precision; report shows it with milliseconds (DECISIONS A3)', () => {
  const r = run(['o1,1.00,2026-05-01T10:00:00.000000002Z,x'], [], { asOf: '2026-05-01T10:00:00.000000001Z' });
  assert.equal(r.report!.as_of, '2026-05-01T10:00:00.000Z');
  assert.deepEqual(r.report!.unmatched_ours, []);
});

test('as_of with a non-UTC offset stops the run (DECISIONS A3, C2)', () => {
  const r = run([], [], { asOf: '2026-05-01T10:00:00+02:00' });
  assert.equal(r.report, null);
  assert.deepEqual(codes(r), ['C2']);
});

test('rule-based: amount diff 0.02 and time diff 2 s still match; 0.03 does not (DECISIONS R1, R2)', () => {
  const r = run(
    ['o1,10.00,2026-05-01T10:00:00Z,a', 'o2,10.00,2026-05-01T11:00:00Z,a'],
    ['t1,10.02,2026-05-01T10:00:02Z,b', 't2,10.03,2026-05-01T11:00:00Z,zzz'],
  );
  assert.deepEqual(kinds(r), ['rule_based:o1-t1']);
});

test('rule-based: when one record has many candidates, the closest amount wins, then the closest time (DECISIONS R5)', () => {
  const r = run(['o1,10.00,2026-05-01T10:00:00Z,'], ['t1,10.02,2026-05-01T10:00:00Z,', 't2,10.01,2026-05-01T10:00:00Z,']);
  assert.deepEqual(kinds(r), ['rule_based:o1-t2']);
});

test('exact: when many records are equal, pairs are made in id order (DECISIONS E3)', () => {
  const r = run(
    ['o2,5.00,2026-05-01T10:00:00Z,', 'o1,5.00,2026-05-01T10:00:00Z,'],
    ['t2,5.00,2026-05-01T10:00:00Z,', 't1,5.00,2026-05-01T10:00:00Z,'],
  );
  assert.deepEqual(kinds(r), ['exact:o1-t1', 'exact:o2-t2']);
});

test('exact match is taken before a rule-based match for the same record (DECISIONS Q7)', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,'], ['t1,5.01,2026-05-01T10:00:00Z,', 't2,5.00,2026-05-01T10:00:00Z,']);
  assert.deepEqual(kinds(r), ['exact:o1-t2']);
  assert.equal(r.report!.unmatched_theirs[0]!.id, 't1');
});

test('timestamps with different fraction digits are compared as the same moment (DECISIONS I4)', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,'], ['t1,5.00,2026-05-01T10:00:00.000000Z,']);
  assert.deepEqual(kinds(r), ['exact:o1-t1']);
});

test('amounts with different decimal digits are the same value: 100.0 and 100.00 match exact, -0.00 and 0 too', () => {
  const r = run(
    ['o1,100.0,2026-05-01T10:00:00Z,', 'o2,-0.00,2026-05-01T11:00:00Z,'],
    ['t1,100.00,2026-05-01T10:00:00Z,', 't2,0,2026-05-01T11:00:00Z,'],
  );
  assert.deepEqual(kinds(r), ['exact:o1-t1', 'exact:o2-t2']);
});

test('rule-based: theirs 2 s earlier or 2 s later both match; the time window includes both edges (DECISIONS R2)', () => {
  const r = run(
    ['o1,10.00,2026-05-01T10:00:00Z,', 'o2,10.00,2026-05-01T11:00:00Z,'],
    ['t1,10.01,2026-05-01T09:59:58Z,', 't2,10.01,2026-05-01T11:00:02Z,', 't3,10.01,2026-05-01T12:00:02.001Z,'],
  );
  assert.deepEqual(kinds(r), ['rule_based:o1-t1', 'rule_based:o2-t2']);
});

test('diffs are ours minus theirs, never "-0.00", sub-millisecond rounds half away from zero (DECISIONS Q16, O1, O3)', () => {
  const r = run(['o1,-5.00,2026-05-01T10:00:00.0005Z,'], ['t1,-5.00,2026-05-01T10:00:00Z,']);
  assert.deepEqual(r.report!.matches[0], {
    kind: 'rule_based', ours_id: 'o1', theirs_id: 't1', amount_diff: '0.00', timestamp_diff_seconds: '0.001',
  });
  const back = run(['o1,-5.00,2026-05-01T10:00:00Z,'], ['t1,-5.00,2026-05-01T10:00:00.0005Z,']);
  assert.equal(back.report!.matches[0]!.timestamp_diff_seconds, '-0.001');
});

test('extended shape: different currency or party_email blocks exact and rule-based match (DECISIONS E1, E2)', () => {
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,,USD,1,5.00,1.000000,a@x.com', 'o2,5.00,2026-05-01T11:00:00Z,,USD,1,5.00,1.000000,a@x.com'],
    ['t1,5.00,2026-05-01T10:00:00Z,,EUR,1,5.00,1.000000,a@x.com', 't2,5.01,2026-05-01T11:00:00Z,,USD,1,5.00,1.000000,b@x.com'],
    { header: EXT },
  );
  assert.deepEqual(kinds(r), []);
});

test('fuzzy: matches a memo typo and a party_email typo; different currency never matches (DECISIONS F3, F7)', () => {
  const r = run(
    [
      'o1,5.00,2026-05-01T10:00:00Z,Coffee Shop,USD,1,5.00,1.000000,alice@acme.com',
      'o2,7.00,2026-05-01T11:00:00Z,Coffee Shop,USD,1,7.00,1.000000,alice@acme.com',
    ],
    [
      't1,5.05,2026-05-01T10:00:01Z,cofee  shop,USD,1,5.00,1.000000,alcie@acme.com',
      't2,7.00,2026-05-01T11:00:00Z,Coffee Shop,EUR,1,7.00,1.000000,alice@acme.com',
    ],
    { header: EXT },
  );
  assert.deepEqual(kinds(r), ['fuzzy:o1-t1']);
});

test('fuzzy: an empty memo gives no fuzzy match (DECISIONS F6)', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,'], ['t1,5.05,2026-05-01T10:00:00Z,']);
  assert.deepEqual(kinds(r), []);
});

test('manual pin wins over exact; unknown, late, reused and repeated pins are skipped with a warning (DECISIONS Q8, M1-M4)', () => {
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,', 'o2,9.00,2026-05-01T10:00:00Z,', 'o3,1.00,2026-06-01T00:00:00Z,'],
    ['t1,5.00,2026-05-01T10:00:00Z,', 't2,5.00,2026-05-01T10:00:00Z,'],
    { manual: ['o2,t1', 'o2,t1', 'o9,t2', 'o3,t2', 'o1,t1'] },
  );
  assert.deepEqual(kinds(r), ['manual:o2-t1', 'exact:o1-t2']);
  assert.deepEqual(codes(r), ['M4', 'M1', 'M2', 'M3']);
});

test('duplicate id and bad rows are skipped with a warning; the run continues (DECISIONS I7, I8)', () => {
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,', 'o1,6.00,2026-05-01T10:00:00Z,', 'o2,abc,2026-05-01T10:00:00Z,', 'o3,1.00,not-a-date,', 'o4,1.00'],
    [],
  );
  assert.deepEqual(r.report!.unmatched_ours.map((e) => e.amount), ['5.00']);
  assert.deepEqual(codes(r), ['I7', 'I8', 'I8', 'I8']);
  assert.equal(r.issues[0]!.row, 3);
});

test('missing core column stops the run; only some extra columns: each one found is used and echoed (DECISIONS I2)', () => {
  const fatal = run([], [], { header: 'id,amount,timestamp' });
  assert.equal(fatal.report, null);
  assert.deepEqual(codes(fatal), ['I2', 'I2']);
  const partial = run(['o1,5.00,2026-05-01T10:00:00Z,,USD'], ['t1,5.00,2026-05-01T10:00:00Z,,EUR'], { header: `${SIMPLE},currency` });
  assert.deepEqual(kinds(partial), []); // currency differs
  assert.deepEqual(partial.report!.unmatched_ours, [{ id: 'o1', amount: '5.00', timestamp: '2026-05-01T10:00:00Z', currency: 'USD' }]);
  assert.deepEqual(codes(partial), []);
});

test('a match column on one side only is not compared, with a warning; a renamed column is caught this way (DECISIONS I3)', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,,a@x.com'], ['t1,5.00,2026-05-01T10:00:00Z,,b@x.com'], {
    header: `${SIMPLE},party_email`,
    theirsHeader: `${SIMPLE},email`,
  });
  assert.deepEqual(kinds(r), ['exact:o1-t1']);
  assert.deepEqual(r.issues.map((i) => `${i.code} ${i.source}: ${i.message}`), [
    'I3 ours.csv: column(s) party_email only in this file; not used in matching',
  ]);
});

test('field schema: an alias reads a renamed column; a new column is matched and echoed; decimals compare by value (DECISIONS I11)', () => {
  const fields: FieldSpec[] = [
    ...DEFAULT_FIELDS.map((spec) => (spec.column === 'party_email' ? { ...spec, aliases: ['email'] } : spec)),
    { column: 'account', type: 'text', match: 'equal' },
    { column: 'fee', type: 'decimal', match: 'equal' },
  ];
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,,a@x.com,A1,1.0', 'o2,6.00,2026-05-01T11:00:00Z,,a@x.com,A1,1.0'],
    ['t1,5.00,2026-05-01T10:00:00Z,,b@x.com,A1,1.00', 't2,6.00,2026-05-01T11:00:00Z,,a@x.com,A2,1.00'],
    { header: `${SIMPLE},party_email,account,fee`, theirsHeader: `${SIMPLE},email,account,fee`, fields },
  );
  assert.deepEqual(kinds(r), []); // o1/t1: email differs (alias read); o2/t2: account differs
  assert.deepEqual(codes(r), []);
  assert.deepEqual(r.report!.unmatched_theirs[0], {
    id: 't1', amount: '5.00', timestamp: '2026-05-01T10:00:00Z', party_email: 'b@x.com', account: 'A1', fee: '1.00',
  });
  const same = run(['o1,5.00,2026-05-01T10:00:00Z,,1.0'], ['t1,5.00,2026-05-01T10:00:00Z,,1.00'], { header: `${SIMPLE},fee`, fields });
  assert.deepEqual(kinds(same), ['exact:o1-t1']);
});

test('memo in quotes with comma, quotes and newline is read correctly (DECISIONS I6)', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,"a, ""b""\nc"'], ['t1,5.00,2026-05-01T10:00:00Z,x']);
  assert.deepEqual(kinds(r), ['exact:o1-t1']);
});

test('simple shape on one side, extended on the other: only common fields are compared (DECISIONS I3)', () => {
  const input: ReconcileInput = {
    ours: { name: 'ours.csv', text: `${SIMPLE}\no1,5.00,2026-05-01T10:00:00Z,` },
    theirs: { name: 'theirs.csv', text: `${EXT}\nt1,5.00,2026-05-01T10:00:00Z,,USD,1,5.00,1.000000,a@x.com` },
    manual: { name: 'manual.csv', text: 'ours_id,theirs_id' },
    asOf: AS_OF,
  };
  assert.deepEqual(reconcile(input).report!.matches.map((m) => m.kind), ['exact']);
});

test('same input gives the same report (DECISIONS Q14)', () => {
  const a = run(['o1,5.00,2026-05-01T10:00:00Z,x', 'o2,5.01,2026-05-01T10:00:00Z,x'], ['t1,5.00,2026-05-01T10:00:01Z,x']);
  const b = run(['o1,5.00,2026-05-01T10:00:00Z,x', 'o2,5.01,2026-05-01T10:00:00Z,x'], ['t1,5.00,2026-05-01T10:00:01Z,x']);
  assert.deepEqual(a, b);
});
