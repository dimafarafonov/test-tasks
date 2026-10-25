import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../helpers.ts';

test('diffs are ours minus theirs, never "-0.00", sub-millisecond rounds half away from zero (DECISIONS Q16, O1, O3)', () => {
  const r = run(['o1,-5.00,2026-05-01T10:00:00.0005Z,'], ['t1,-5.00,2026-05-01T10:00:00Z,']);
  assert.deepEqual(r.report!.matches[0], {
    kind: 'rule_based', ours_id: 'o1', theirs_id: 't1', amount_diff: '0.00', timestamp_diff_seconds: '0.001',
  });
  const back = run(['o1,-5.00,2026-05-01T10:00:00Z,'], ['t1,-5.00,2026-05-01T10:00:00.0005Z,']);
  assert.equal(back.report!.matches[0]!.timestamp_diff_seconds, '-0.001');
});
