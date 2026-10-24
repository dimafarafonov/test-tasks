// Runs recon on every examples/*/ folder, or only the ones named:
//   node scripts/run-examples.ts [EXAMPLE_NAME ...] Reports go to out/<example>.json.
// Each report is compared with expected_report.json (PASS / FAIL). Exit 1 on any FAIL.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const root = join(import.meta.dirname, '..');
const examples = join(root, 'examples');
const outDir = join(root, 'out');
const bin = join(root, 'apps/cli/bin/recon.js');
mkdirSync(outDir, { recursive: true });

let failed = 0;
const all = readdirSync(examples, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !all.includes(name));
if (unknown.length > 0) {
  console.error(`unknown example(s): ${unknown.join(', ')}\navailable: ${all.join(', ')}`);
  process.exit(1);
}
const names = wanted.length > 0 ? wanted : all;

for (const name of names) {
  const dir = join(examples, name);
  const output = join(outDir, `${name}.json`);
  console.log(`== ${name}`);

  const run = spawnSync(process.execPath, [
    bin, 'run',
    '--ours', join(dir, 'ours.csv'),
    '--theirs', join(dir, 'theirs.csv'),
    '--manual', join(dir, 'manual.csv'),
    '--as-of', join(dir, 'as_of.txt'),
    '--output', output,
  ], { stdio: 'inherit' });
  if (run.status !== 0) {
    console.log(`FAIL (exit ${run.status})`);
    failed++;
    continue;
  }

  const actual = JSON.parse(readFileSync(output, 'utf8'));
  const expected = JSON.parse(readFileSync(join(dir, 'expected_report.json'), 'utf8'));
  if (isDeepStrictEqual(actual, expected)) {
    console.log('PASS');
  } else {
    console.log(`FAIL (diff out/${name}.json examples/${name}/expected_report.json)`);
    failed++;
  }
}

console.log(`\n${names.length - failed}/${names.length} passed`);
process.exitCode = failed > 0 ? 1 : 0;
