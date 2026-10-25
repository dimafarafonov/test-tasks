import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  formatException,
  readAsOf,
  reconcile,
  writeJson,
  writePretty,
  type Exception,
  type Report,
  type Source,
} from '@recon/core';
import { readAsOfFile, type AsOfFileResult } from './asOfFile.ts';

const USAGE =
  'usage: recon run --ours OURS.csv --theirs THEIRS.csv --manual MANUAL.csv ' +
  '--as-of (YYYY-MM-DDTHH:MM:SS[.sss]Z | AS_OF.txt) --output REPORT.json [--view] [--all]\n' +
  '       recon run DIR   (DIR/ours.csv, theirs.csv, manual.csv, as_of.txt → DIR/report.json; flags override)\n' +
  '       recon view REPORT.json [--all]   (show a report as tables; --all: every row)';

// C4: file names inside DIR for `recon run DIR`.
const DIR_DEFAULTS = {
  ours: 'ours.csv',
  theirs: 'theirs.csv',
  manual: 'manual.csv',
  'as-of': 'as_of.txt',
  output: 'report.json',
} as const;

const FILE_OPTIONS = ['ours', 'theirs', 'manual'] as const;

const OPTIONS = {
  ours: { type: 'string' },
  theirs: { type: 'string' },
  manual: { type: 'string' },
  'as-of': { type: 'string' },
  output: { type: 'string' },
  view: { type: 'boolean' }, // C5: show the report as tables after the run
  all: { type: 'boolean' }, // C5: show every row (default: first 50 per table)
} as const;

type Values = ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>['values'];

// Exit 0 on success (skip exceptions allowed), 1 on any fatal exception (DECISIONS Exception model).
export async function main(argv: string[]): Promise<number> {
  let values: Values;
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: OPTIONS }));
  } catch (error) {
    return fail([cliException('args', error instanceof Error ? error.message : String(error))]);
  }
  const [command, ...rest] = positionals;
  if (command === 'view') return view(rest, values);
  return run(command, rest, values);
}

async function run(command: string | undefined, rest: string[], values: Values): Promise<number> {
  const started = performance.now();

  // C1, C2: check every input first, report all problems in one pass.
  const exceptions: Exception[] = [];
  const [dir, ...extra] = rest;
  if (command !== 'run' || extra.length > 0) {
    exceptions.push(cliException('args', `expected "run", "run DIR" or "view REPORT.json", got "${[command, ...rest].join(' ')}"`));
  }
  if (dir) {
    for (const [name, file] of Object.entries(DIR_DEFAULTS) as [keyof typeof DIR_DEFAULTS, string][]) values[name] ??= join(dir, file);
  }
  for (const name of [...FILE_OPTIONS, 'as-of', 'output'] as const) {
    if (!values[name]) exceptions.push(cliException(`--${name}`, 'missing'));
  }

  const sources: Partial<Record<(typeof FILE_OPTIONS)[number], Source>> = {};
  for (const name of FILE_OPTIONS) {
    const path = values[name];
    if (!path) continue;
    try {
      sources[name] = { name: basename(path), text: await readFile(path, 'utf8') };
    } catch (error) {
      exceptions.push(cliException(`--${name}`, `cannot read ${path}: ${errorCode(error)}`));
    }
  }

  let asOf: string | undefined;
  if (values['as-of']) {
    const resolved = await resolveAsOf(values['as-of']);
    if (resolved.ok) asOf = resolved.value;
    else exceptions.push(resolved.exception);
  }
  if (exceptions.length > 0 || !sources.ours || !sources.theirs || !sources.manual || !asOf || !values.output) {
    return fail(exceptions);
  }

  const result = reconcile({ ours: sources.ours, theirs: sources.theirs, manual: sources.manual, asOf });
  if (!result.report) return fail(result.exceptions);

  try {
    await writeFile(values.output, writeJson(result.report), 'utf8');
  } catch (error) {
    return fail([...result.exceptions, cliException('--output', `cannot write ${values.output}: ${errorCode(error)}`)]);
  }

  // C5: with --view, exceptions are shown in the tables, not on stderr.
  if (values.view) process.stdout.write(`${writePretty(result.report, { exceptions: result.exceptions, ...viewOptions(values) })}\n`);
  else printExceptions(result.exceptions);
  const ms = (performance.now() - started).toFixed(1);
  process.stdout.write(`${summaryLine(result.report)} → ${values.output} (${ms} ms)\n`);
  return 0;
}

// C5: recon view REPORT.json. Shows a report that already exists; exceptions are not in report.json.
async function view(rest: string[], values: Values): Promise<number> {
  const [path, ...extra] = rest;
  if (!path || extra.length > 0) return fail([cliException('args', `expected "view REPORT.json", got "view ${rest.join(' ')}"`)]);

  let report: unknown;
  try {
    report = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    return fail([cliException('view', `cannot read ${path}: ${error instanceof SyntaxError ? 'not JSON' : errorCode(error)}`)]);
  }
  if (!isReport(report)) return fail([cliException('view', `${path} is not a report.json (summary, matches or unmatched lists missing)`)]);
  process.stdout.write(writePretty(report, viewOptions(values)));
  return 0;
}

// Colors only on a terminal; NO_COLOR (no-color.org) turns them off.
function viewOptions(values: Values) {
  return { color: Boolean(process.stdout.isTTY) && !process.env.NO_COLOR, maxRows: values.all ? Infinity : undefined };
}

function isReport(value: unknown): value is Report {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.as_of === 'string' &&
    !!r.summary &&
    typeof r.summary === 'object' &&
    Array.isArray(r.matches) &&
    Array.isArray(r.unmatched_ours) &&
    Array.isArray(r.unmatched_theirs)
  );
}

// C3: --as-of is a value, or a path to a file with one value. A valid value wins.
async function resolveAsOf(arg: string): Promise<AsOfFileResult> {
  const parsed = readAsOf(arg);
  if (parsed.ok) return { ok: true, value: arg };

  let text: string;
  try {
    text = await readFile(arg, 'utf8');
  } catch (error) {
    return {
      ok: false,
      exception: { ...parsed.exception, message: `${parsed.exception.message}; also not a readable file (${errorCode(error)})` },
    };
  }
  return readAsOfFile(arg, text);
}

function cliException(source: string, message: string): Exception {
  return { code: 'C1', level: 'fatal', source, message };
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) return String(error.code);
  return error instanceof Error ? error.message : String(error);
}

function fail(exceptions: Exception[]): number {
  printExceptions(exceptions);
  process.stderr.write(`${USAGE}\n`);
  return 1;
}

function printExceptions(exceptions: Exception[]): void {
  for (const exception of exceptions) process.stderr.write(`${formatException(exception)}\n`);
}

function summaryLine({ summary: s }: Report): string {
  return (
    `matched: manual ${s.matched_manual}, exact ${s.matched_exact}, rule_based ${s.matched_rule_based}, ` +
    `fuzzy ${s.matched_fuzzy}; unmatched: ours ${s.unmatched_ours}, theirs ${s.unmatched_theirs}`
  );
}
