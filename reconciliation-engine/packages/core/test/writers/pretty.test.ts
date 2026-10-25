import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writePretty } from '../../src/index.ts';
import { EXT, run } from '../runEngine.ts';

const ROW = (i: number) => `o${i},${i}.00,2026-05-01T10:00:00Z,`;

test('pretty writer: summary, matches, unmatched with every input column, exceptions; no colors unless asked (DECISIONS C5)', () => {
  const r = run(['o1,5.00,2026-05-01T10:00:00Z,,USD,1,5.00,1.000000,a@x.com'], ['t1,5.00,2026-05-01T10:00:00Z,,EUR,1,5.00,1.000000,a@x.com'], {
    header: EXT,
    manual: ['o9,t9'],
  });
  const text = writePretty(r.report!, { exceptions: r.exceptions });
  for (const part of ['as of 2026-05-01T23:59:59.999Z', 'Summary', 'Matches', '(none)', 'Unmatched ours', 'PARTY EMAIL', 'a@x.com', 'Exceptions (1)', 'skip M1']) {
    assert.ok(text.includes(part), `missing "${part}":\n${text}`);
  }
  assert.ok(!text.includes('\x1b['));
  assert.ok(writePretty(r.report!, { color: true }).includes('\x1b['));
});

test('pretty writer: shows at most maxRows rows per table and counts the rest (DECISIONS C5)', () => {
  const r = run(Array.from({ length: 5 }, (_, i) => ROW(i + 1)), []);
  const text = writePretty(r.report!, { maxRows: 2 });
  assert.ok(text.includes('… 3 more (use --all)'));
  assert.ok(!writePretty(r.report!, { maxRows: Infinity }).includes('more (use --all)'));
});
