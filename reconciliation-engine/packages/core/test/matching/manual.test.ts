import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run, kinds, codes } from '../runEngine.ts';

test('manual pin wins over exact; unknown, late, reused and repeated pins are skipped with a warning (DECISIONS Q8, M1-M4)', () => {
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,', 'o2,9.00,2026-05-01T10:00:00Z,', 'o3,1.00,2026-06-01T00:00:00Z,'],
    ['t1,5.00,2026-05-01T10:00:00Z,', 't2,5.00,2026-05-01T10:00:00Z,'],
    { manual: ['o2,t1', 'o2,t1', 'o9,t2', 'o3,t2', 'o1,t1'] },
  );
  assert.deepEqual(kinds(r), ['manual:o2-t1', 'exact:o1-t2']);
  assert.deepEqual(codes(r), ['M4', 'M1', 'M2', 'M3']);
});
