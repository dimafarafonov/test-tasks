import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../runEngine.ts';

test('same input gives the same report (DECISIONS Q14)', () => {
  const a = run(['o1,5.00,2026-05-01T10:00:00Z,x', 'o2,5.01,2026-05-01T10:00:00Z,x'], ['t1,5.00,2026-05-01T10:00:01Z,x']);
  const b = run(['o1,5.00,2026-05-01T10:00:00Z,x', 'o2,5.01,2026-05-01T10:00:00Z,x'], ['t1,5.00,2026-05-01T10:00:01Z,x']);
  assert.deepEqual(a, b);
});
