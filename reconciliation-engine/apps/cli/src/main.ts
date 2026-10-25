import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { readAsOf, reconcile, type CsvSource, type Exception, type Report } from '@recon/core';
import { readAsOfFile, type AsOfFileResult } from './asOfFile.ts';

const USAGE =
  'usage: recon run --ours OURS.csv --theirs THEIRS.csv --manual MANUAL.csv ' +
  '--as-of (YYYY-MM-DDTHH:MM:SS[.sss]Z | AS_OF.txt) --output REPORT.json\n' +
  '       recon run DIR   (DIR/ours.csv, theirs.csv, manual.csv, as_of.txt → DIR/report.json; flags override)';

// C4: file names inside DIR for `recon run DIR`.
const DIR_DEFAULTS = {
  ours: 'ours.csv',
  theirs: 'theirs.csv',
  manual: 'manual.csv',
  'as-of': 'as_of.txt',
  output: 'report.json',
} as const;

const FILE_OPTIONS = ['ours', 'theirs', 'manual'] as const;

// Exit 0 on success (skip exceptions allowed), 1 on any fatal exception (DECISIONS Exception model).
export async function main(argv: string[]): Promise<number> {
  const started = performance.now();
  let values: Record<string, string | undefined>;
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        ours: { type: 'string' },
        theirs: { type: 'string' },
        manual: { type: 'string' },
        'as-of': { type: 'string' },
        output: { type: 'string' },
      },
    }));
  } catch (error) {
    return fail([cliException('args', error instanceof Error ? error.message : String(error))]);
  }

  // C1, C2: check every input first, report all problems in one pass.
  const exceptions: Exception[] = [];
  const [command, dir, ...extra] = positionals;
  if (command !== 'run' || extra.length > 0) {
    exceptions.push(cliException('args', `expected "run" or "run DIR", got "${positionals.join(' ')}"`));
  }
  if (dir) {
    for (const [name, file] of Object.entries(DIR_DEFAULTS)) values[name] ??= join(dir, file);
  }
  for (const name of [...FILE_OPTIONS, 'as-of', 'output'] as const) {
    if (!values[name]) exceptions.push(cliException(`--${name}`, 'missing'));
  }

  const sources: Partial<Record<(typeof FILE_OPTIONS)[number], CsvSource>> = {};
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
    await writeFile(values.output, `${JSON.stringify(result.report, null, 2)}\n`, 'utf8');
  } catch (error) {
    return fail([...result.exceptions, cliException('--output', `cannot write ${values.output}: ${errorCode(error)}`)]);
  }

  printExceptions(result.exceptions);
  const ms = (performance.now() - started).toFixed(1);
  process.stdout.write(`${summaryLine(result.report)} → ${values.output} (${ms} ms)\n`);
  return 0;
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
  for (const exception of exceptions) {
    const where = [exception.source, exception.row !== undefined ? `row ${exception.row}` : '', exception.id ? `id ${exception.id}` : '']
      .filter(Boolean)
      .join(' ');
    process.stderr.write(`${exception.level} ${exception.code} ${where}: ${exception.message}\n`);
  }
}

function summaryLine({ summary: s }: Report): string {
  return (
    `matched: manual ${s.matched_manual}, exact ${s.matched_exact}, rule_based ${s.matched_rule_based}, ` +
    `fuzzy ${s.matched_fuzzy}; unmatched: ours ${s.unmatched_ours}, theirs ${s.unmatched_theirs}`
  );
}
