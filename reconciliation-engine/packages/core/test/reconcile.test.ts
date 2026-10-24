import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcile, type ReconcileInput } from '../src/index.ts';

const SIMPLE = 'id,amount,timestamp,memo';
const EXT = `${SIMPLE},currency,quantity,price_per_share,fx_rate,party_email`;
const AS_OF = '2026-05-01T23:59:59.999Z';

function run(ours: string[], theirs: string[], opts: { manual?: string[]; asOf?: string; header?: string } = {}) {
  const header = opts.header ?? SIMPLE;
  const input: ReconcileInput = {
    ours: { name: 'ours.csv', text: [header, ...ours].join('\n') },
    theirs: { name: 'theirs.csv', text: [header, ...theirs].join('\n') },
    manual: { name: 'manual.csv', text: ['ours_id,theirs_id', ...(opts.manual ?? [])].join('\n') },
    asOf: opts.asOf ?? AS_OF,
  };
  return reconcile(input);
}

const kinds = (r: ReturnType<typeof run>) => r.report!.matches.map((m) => `${m.kind}:${m.ours_id}-${m.theirs_id}`);
const codes = (r: ReturnType<typeof run>) => r.issues.map((i) => i.code);

test('A1: records after as_of are absent', () => {
  const r = run(['o1,1.00,2026-05-02T00:00:00Z,x'], ['t1,1.00,2026-05-01T00:00:00Z,x']);
  assert.deepEqual(r.report!.unmatched_ours, []);
  assert.equal(r.report!.unmatched_theirs.length, 1);
});

test('A3: as_of with ns precision filters at full precision, echoes .sss', () => {
  const r = run(['o1,1.00,2026-05-01T10:00:00.000000002Z,x'], [], { asOf: '2026-05-01T10:00:00.000000001Z' });
  assert.equal(r.report!.as_of, '2026-05-01T10:00:00.000Z');
  assert.deepEqual(r.report!.unmatched_ours, []);
});

test('A3/C2: bad as_of is fatal', () => {
  const r = run([], [], { asOf: '2026-05-01T10:00:00+02:00' });
  assert.equal(r.report, null);
  assert.deepEqual(codes(r), ['C2']);
});

test('rule_based limits are inclusive: 0.02 and 2 s', () => {
  const r = run(
    ['o1,10.00,2026-05-01T10:00:00Z,a', 'o2,10.00,2026-05-01T11:00:00Z,a'],
    ['t1,10.02,2026-05-01T10:00:02Z,b', 't2,10.03,2026-05-01T11:00:00Z,zzz'],
  );
  assert.deepEqual(kinds(r), ['rule_based:o1-t1']);
});

test('R5: closest pair wins over id order', () => {
  const r = run(['o1,10.00,2026-05-01T10:00:00Z,'], ['t1,10.02,2026-05-01T10:00:00Z,', 't2,10.01,2026-05-01T10:00:00Z,']);
  assert.deepEqual(kinds(r), ['rule_based:o1-t2']);
});

test('E3: exact ties pair by ids', () => {
  const r = run(
    ['o2,5.00,2026-05-01T10:00:00Z,', 'o1,5.00,2026-05-01T10:00:00Z,'],
    ['t2,5.00,2026-05-01T10:00:00Z,', 't1,5.00,2026-05-01T10:00:00Z,'],
  );
  assert.deepEqual(kinds(r), ['exact:o1-t1', 'exact:o2-t2']);
});

test('exact beats rule_based for the same record', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,'], ['t1,5.01,2026-05-01T10:00:00Z,', 't2,5.00,2026-05-01T10:00:00Z,']);
  assert.deepEqual(kinds(r), ['exact:o1-t2']);
  assert.equal(r.report!.unmatched_theirs[0]!.id, 't1');
});

test('timestamps with different precision compare as instants', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,'], ['t1,5.00,2026-05-01T10:00:00.000000Z,']);
  assert.deepEqual(kinds(r), ['exact:o1-t1']);
});

test('diffs: signed, no negative zero, sub-ms rounds half away from zero', () => {
  const r = run(['o1,-5.00,2026-05-01T10:00:00.0005Z,'], ['t1,-5.00,2026-05-01T10:00:00Z,']);
  assert.deepEqual(r.report!.matches[0], {
    kind: 'rule_based', ours_id: 'o1', theirs_id: 't1', amount_diff: '0.00', timestamp_diff_seconds: '0.001',
  });
  const back = run(['o1,-5.00,2026-05-01T10:00:00Z,'], ['t1,-5.00,2026-05-01T10:00:00.0005Z,']);
  assert.equal(back.report!.matches[0]!.timestamp_diff_seconds, '-0.001');
});

test('E1/E2: extended identity fields block exact and rule_based', () => {
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,,USD,1,5.00,1.000000,a@x.com', 'o2,5.00,2026-05-01T11:00:00Z,,USD,1,5.00,1.000000,a@x.com'],
    ['t1,5.00,2026-05-01T10:00:00Z,,EUR,1,5.00,1.000000,a@x.com', 't2,5.01,2026-05-01T11:00:00Z,,USD,1,5.00,1.000000,b@x.com'],
    { header: EXT },
  );
  assert.deepEqual(kinds(r), []);
});

test('fuzzy: memo typo, extended email typo, currency must match', () => {
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

test('F6: empty memo gives no fuzzy match', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,'], ['t1,5.05,2026-05-01T10:00:00Z,']);
  assert.deepEqual(kinds(r), []);
});

test('manual wins over exact; pin problems are skip issues', () => {
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,', 'o2,9.00,2026-05-01T10:00:00Z,', 'o3,1.00,2026-06-01T00:00:00Z,'],
    ['t1,5.00,2026-05-01T10:00:00Z,', 't2,5.00,2026-05-01T10:00:00Z,'],
    { manual: ['o2,t1', 'o2,t1', 'o9,t2', 'o3,t2', 'o1,t1'] },
  );
  assert.deepEqual(kinds(r), ['manual:o2-t1', 'exact:o1-t2']);
  assert.deepEqual(codes(r), ['M4', 'M1', 'M2', 'M3']);
});

test('I7, I8: duplicate and bad rows skipped, run continues', () => {
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,', 'o1,6.00,2026-05-01T10:00:00Z,', 'o2,abc,2026-05-01T10:00:00Z,', 'o3,1.00,not-a-date,', 'o4,1.00'],
    [],
  );
  assert.deepEqual(r.report!.unmatched_ours.map((e) => e.amount), ['5.00']);
  assert.deepEqual(codes(r), ['I7', 'I8', 'I8', 'I8']);
  assert.equal(r.issues[0]!.row, 3);
});

test('I2: missing core column is fatal; partial extended is skip', () => {
  const fatal = run([], [], { header: 'id,amount,timestamp' });
  assert.equal(fatal.report, null);
  assert.deepEqual(codes(fatal), ['I2', 'I2']);
  const partial = run(['o1,5.00,2026-05-01T10:00:00Z,,USD'], [], { header: `${SIMPLE},currency` });
  assert.deepEqual(partial.report!.unmatched_ours, [{ id: 'o1', amount: '5.00', timestamp: '2026-05-01T10:00:00Z' }]);
  assert.deepEqual(codes(partial), ['I2', 'I2']); // one per side
});

test('I6: quoted memo with comma and newline', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,"a, ""b""\nc"'], ['t1,5.00,2026-05-01T10:00:00Z,x']);
  assert.deepEqual(kinds(r), ['exact:o1-t1']);
});

test('I3: simple vs extended compares common fields', () => {
  const input: ReconcileInput = {
    ours: { name: 'ours.csv', text: `${SIMPLE}\no1,5.00,2026-05-01T10:00:00Z,` },
    theirs: { name: 'theirs.csv', text: `${EXT}\nt1,5.00,2026-05-01T10:00:00Z,,USD,1,5.00,1.000000,a@x.com` },
    manual: { name: 'manual.csv', text: 'ours_id,theirs_id' },
    asOf: AS_OF,
  };
  assert.deepEqual(reconcile(input).report!.matches.map((m) => m.kind), ['exact']);
});

test('Q14: same input, same report', () => {
  const a = run(['o1,5.00,2026-05-01T10:00:00Z,x', 'o2,5.01,2026-05-01T10:00:00Z,x'], ['t1,5.00,2026-05-01T10:00:01Z,x']);
  const b = run(['o1,5.00,2026-05-01T10:00:00Z,x', 'o2,5.01,2026-05-01T10:00:00Z,x'], ['t1,5.00,2026-05-01T10:00:01Z,x']);
  assert.deepEqual(a, b);
});
