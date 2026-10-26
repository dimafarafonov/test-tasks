import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SIMPLE, run, kinds, codes } from '../../runEngine.ts';

test('timestamps with different fraction digits are compared as the same moment (DECISIONS I4)', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,'], ['t1,5.00,2026-05-01T10:00:00.000000Z,']);
  assert.deepEqual(kinds(r), ['exact:o1-t1']);
});

test('duplicate id and bad rows are skipped with a warning; the run continues (DECISIONS I7, I8)', () => {
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,', 'o1,6.00,2026-05-01T10:00:00Z,', 'o2,abc,2026-05-01T10:00:00Z,', 'o3,1.00,not-a-date,', 'o4,1.00'],
    [],
  );
  assert.deepEqual(r.report!.unmatched_ours.map((e) => e.amount), ['5.00']);
  assert.deepEqual(codes(r), ['I7', 'I8', 'I8', 'I8']);
  assert.equal(r.exceptions[0]!.row, 3);
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

test('memo in quotes with comma, quotes and newline is read correctly (DECISIONS I6)', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,"a, ""b""\nc"'], ['t1,5.00,2026-05-01T10:00:00Z,x']);
  assert.deepEqual(kinds(r), ['exact:o1-t1']);
});
