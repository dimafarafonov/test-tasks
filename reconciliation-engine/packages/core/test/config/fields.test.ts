import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_FIELDS, type FieldSpec } from '../../src/index.ts';
import { SIMPLE, run, kinds, codes } from '../helpers.ts';

test('field schema: an alias reads a renamed column; a new column is matched and echoed; decimals compare by value (DECISIONS I11)', () => {
  const fields: FieldSpec[] = [
    ...DEFAULT_FIELDS.map((spec) => (spec.column === 'party_email' ? { ...spec, aliases: ['email'] } : spec)),
    { column: 'account', type: 'text', match: 'equal' },
    { column: 'fee', type: 'decimal', match: 'equal' },
  ];
  const r = run(
    ['o1,5.00,2026-05-01T10:00:00Z,,a@x.com,A1,1.0', 'o2,6.00,2026-05-01T11:00:00Z,,a@x.com,A1,1.0'],
    ['t1,5.00,2026-05-01T10:00:00Z,,b@x.com,A1,1.00', 't2,6.00,2026-05-01T11:00:00Z,,a@x.com,A2,1.00'],
    { header: `${SIMPLE},party_email,account,fee`, theirsHeader: `${SIMPLE},email,account,fee`, fields },
  );
  assert.deepEqual(kinds(r), []); // o1/t1: email differs (alias read); o2/t2: account differs
  assert.deepEqual(codes(r), []);
  assert.deepEqual(r.report!.unmatched_theirs[0], {
    id: 't1', amount: '5.00', timestamp: '2026-05-01T10:00:00Z', party_email: 'b@x.com', account: 'A1', fee: '1.00',
  });
  const same = run(['o1,5.00,2026-05-01T10:00:00Z,,1.0'], ['t1,5.00,2026-05-01T10:00:00Z,,1.00'], { header: `${SIMPLE},fee`, fields });
  assert.deepEqual(kinds(same), ['exact:o1-t1']);
});
