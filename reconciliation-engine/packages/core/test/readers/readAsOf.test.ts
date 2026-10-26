import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run, codes } from '../runEngine.ts';

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
