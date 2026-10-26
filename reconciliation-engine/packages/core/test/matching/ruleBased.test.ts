import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run, kinds } from '../runEngine.ts';

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

test('rule-based: theirs 2 s earlier or 2 s later both match; the time window includes both edges (DECISIONS R2)', () => {
  const r = run(
    ['o1,10.00,2026-05-01T10:00:00Z,', 'o2,10.00,2026-05-01T11:00:00Z,'],
    ['t1,10.01,2026-05-01T09:59:58Z,', 't2,10.01,2026-05-01T11:00:02Z,', 't3,10.01,2026-05-01T12:00:02.001Z,'],
  );
  assert.deepEqual(kinds(r), ['rule_based:o1-t1', 'rule_based:o2-t2']);
});
