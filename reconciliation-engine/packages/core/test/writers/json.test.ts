import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeJson } from '../../src/index.ts';
import { run } from '../runEngine.ts';

test('json writer: report.json is the report as JSON, two-space indent, newline at the end (brief I/O contract)', () => {
  const report = run(['o1,5.00,2026-05-01T10:00:00Z,'], ['t1,5.00,2026-05-01T10:00:00Z,']).report!;
  const text = writeJson(report);
  assert.ok(text.endsWith('}\n'));
  assert.deepStrictEqual(JSON.parse(text), report);
});
