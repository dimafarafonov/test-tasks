import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run, kinds } from '../runEngine.ts';

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

test('amounts with different decimal digits are the same value: 100.0 and 100.00 match exact, -0.00 and 0 too (DECISIONS I5)', () => {
  const r = run(
    ['o1,100.0,2026-05-01T10:00:00Z,', 'o2,-0.00,2026-05-01T11:00:00Z,'],
    ['t1,100.00,2026-05-01T10:00:00Z,', 't2,0,2026-05-01T11:00:00Z,'],
  );
  assert.deepEqual(kinds(r), ['exact:o1-t1', 'exact:o2-t2']);
});
