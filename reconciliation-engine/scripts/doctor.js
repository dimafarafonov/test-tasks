// Checks the local setup and prints what to fix. Plain JS on purpose: runs on any Node.
//   npm run doctor
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, sep } from 'node:path';

const REQUIRED_MAJOR = 24;
const root = join(import.meta.dirname, '..');
const bin = join(root, 'apps/cli/bin/recon.js');
let failed = 0;

function check(ok, label, fix) {
  console.log(`${ok ? '✔' : '✖'} ${label}`);
  if (!ok) {
    failed++;
    for (const line of [].concat(fix)) console.log(`    fix: ${line}`);
  }
}

// 1. Node that runs now
const version = process.versions.node;
check(Number(version.split('.')[0]) >= REQUIRED_MAJOR, `Node ${version} (need >= ${REQUIRED_MAJOR})`, [
  'nvm use            (this terminal; reads .nvmrc)',
  `nvm alias default ${REQUIRED_MAJOR}   (new terminals)`,
]);

// 2. nvm default: new terminals start with it
const aliasFile = join(process.env.NVM_DIR ?? join(homedir(), '.nvm'), 'alias', 'default');
if (existsSync(aliasFile)) {
  const alias = readFileSync(aliasFile, 'utf8').trim();
  const major = Number(alias.replace(/^v/, '').split('.')[0]);
  check(major >= REQUIRED_MAJOR, `nvm default is "${alias}"`, `nvm alias default ${REQUIRED_MAJOR}`);
}

// 3. Dependencies installed
check(existsSync(join(root, 'node_modules', '@recon', 'core')), 'dependencies installed', 'npm install');

// 4. recon on PATH. npm run adds node_modules/.bin to PATH; drop it to see the real shell PATH.
const shellPath = (process.env.PATH ?? '')
  .split(delimiter)
  .filter((dir) => !dir.includes(`${sep}node_modules${sep}.bin`))
  .join(delimiter);
const found = spawnSync('sh', ['-c', 'command -v recon'], { env: { ...process.env, PATH: shellPath }, encoding: 'utf8' })
  .stdout.trim();
check(found !== '', found ? `recon on PATH: ${found}` : 'recon on PATH', [
  'nvm use && npm link   (links recon for the active Node version)',
]);

// 5. recon points to this project
if (found) {
  let target = '';
  try {
    target = realpathSync(found);
  } catch {}
  check(target === realpathSync(bin), `recon points to this project`, [
    `now points to: ${target || 'unknown'}`,
    'npm link   (run in this folder)',
  ]);
}

console.log(failed === 0 ? '\nAll good.' : `\n${failed} problem(s) found.`);
process.exitCode = failed === 0 ? 0 : 1;
