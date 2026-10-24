import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseAsOfFile } from '../src/asOfFile.ts';

const root = join(import.meta.dirname, '../../..');
const bin = join(root, 'apps/cli/bin/recon.js');
const examples = join(root, 'examples');

for (const name of readdirSync(examples, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
  test(`example ${name}`, () => {
    const dir = join(examples, name);
    const output = join(mkdtempSync(join(tmpdir(), 'recon-')), 'report.json');
    execFileSync(process.execPath, [
      bin, 'run',
      '--ours', join(dir, 'ours.csv'),
      '--theirs', join(dir, 'theirs.csv'),
      '--manual', join(dir, 'manual.csv'),
      '--as-of', join(dir, 'as_of.txt'), // C3: file path
      '--output', output,
    ], { stdio: 'pipe' });
    const actual = JSON.parse(readFileSync(output, 'utf8'));
    const expected = JSON.parse(readFileSync(join(dir, 'expected_report.json'), 'utf8'));
    assert.deepStrictEqual(actual, expected);
  });
}

test('fatal issues: all listed, exit 1', () => {
  try {
    execFileSync(process.execPath, [bin, 'run', '--ours', 'nope.csv', '--as-of', 'yesterday'], { stdio: 'pipe' });
    assert.fail('expected exit 1');
  } catch (error) {
    const { status, stderr } = error as { status: number; stderr: Buffer };
    assert.equal(status, 1);
    const text = stderr.toString();
    for (const part of ['--theirs: missing', '--manual: missing', '--output: missing', 'cannot read nope.csv', 'C2 --as-of']) {
      assert.ok(text.includes(part), `stderr lacks "${part}":\n${text}`);
    }
  }
});

test('as_of file: one value, else C2', () => {
  assert.deepEqual(parseAsOfFile('a', '\uFEFF\n 2026-05-01T23:59:59.999Z \r\n\n'), { ok: true, value: '2026-05-01T23:59:59.999Z' });
  for (const text of ['', '\n \n', '2026-05-01T00:00:00Z\n2026-05-02T00:00:00Z', '2026-05-01']) {
    const result = parseAsOfFile('a', text);
    assert.ok(!result.ok && result.issue.code === 'C2', JSON.stringify(text));
  }
});

test('C3: --as-of value and file give the same report', () => {
  const dir = join(examples, 'example_2_with_manual');
  const reports = [readFileSync(join(dir, 'as_of.txt'), 'utf8').trim(), join(dir, 'as_of.txt')].map((asOf) => {
    const output = join(mkdtempSync(join(tmpdir(), 'recon-')), 'report.json');
    execFileSync(process.execPath, [bin, 'run', '--ours', join(dir, 'ours.csv'), '--theirs', join(dir, 'theirs.csv'),
      '--manual', join(dir, 'manual.csv'), '--as-of', asOf, '--output', output], { stdio: 'pipe' });
    return readFileSync(output, 'utf8');
  });
  assert.equal(reports[0], reports[1]);
});
