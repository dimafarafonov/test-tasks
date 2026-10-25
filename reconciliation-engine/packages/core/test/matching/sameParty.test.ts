import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcile, type ReconcileInput } from '../../src/index.ts';
import { SIMPLE, EXT, AS_OF, run, kinds } from '../runEngine.ts';

test('extended shape: different currency or party_email blocks exact and rule-based match (DECISIONS E1, E2)', () => {
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,,USD,1,5.00,1.000000,a@x.com', 'o2,5.00,2026-05-01T11:00:00Z,,USD,1,5.00,1.000000,a@x.com'],
    ['t1,5.00,2026-05-01T10:00:00Z,,EUR,1,5.00,1.000000,a@x.com', 't2,5.01,2026-05-01T11:00:00Z,,USD,1,5.00,1.000000,b@x.com'],
    { header: EXT },
  );
  assert.deepEqual(kinds(r), []);
});

test('a match column on one side only is not compared, with a warning; a renamed column is caught this way (DECISIONS I3)', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,,a@x.com'], ['t1,5.00,2026-05-01T10:00:00Z,,b@x.com'], {
    header: `${SIMPLE},party_email`,
    theirsHeader: `${SIMPLE},email`,
  });
  assert.deepEqual(kinds(r), ['exact:o1-t1']);
  assert.deepEqual(r.exceptions.map((i) => `${i.code} ${i.source}: ${i.message}`), [
    'I3 ours.csv: column(s) party_email only in this file; not used in matching',
  ]);
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
