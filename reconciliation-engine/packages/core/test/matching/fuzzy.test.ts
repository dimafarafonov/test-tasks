import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXT, run, kinds } from '../runEngine.ts';

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
