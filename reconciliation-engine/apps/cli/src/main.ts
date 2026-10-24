import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { parseAsOf, reconcile, type CsvSource, type Issue, type Report } from '@recon/core';

const USAGE =
  'usage: recon run --ours OURS.csv --theirs THEIRS.csv --manual MANUAL.csv ' +
  '--as-of YYYY-MM-DDTHH:MM:SS[.sss]Z --output REPORT.json';

const FILE_OPTIONS = ['ours', 'theirs', 'manual'] as const;

// Exit 0 on success (skip issues allowed), 1 on any fatal issue (README Issue model).
export async function main(argv: string[]): Promise<number> {
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
    return fail([cliIssue('args', error instanceof Error ? error.message : String(error))]);
  }

  // C1, C2: check every input first, report all problems in one pass.
  const issues: Issue[] = [];
  if (positionals.length !== 1 || positionals[0] !== 'run') {
    issues.push(cliIssue('args', `expected command "run", got "${positionals.join(' ')}"`));
  }
  for (const name of [...FILE_OPTIONS, 'as-of', 'output'] as const) {
    if (!values[name]) issues.push(cliIssue(`--${name}`, 'missing'));
  }

  const sources: Partial<Record<(typeof FILE_OPTIONS)[number], CsvSource>> = {};
  for (const name of FILE_OPTIONS) {
    const path = values[name];
    if (!path) continue;
    try {
      sources[name] = { name: basename(path), text: await readFile(path, 'utf8') };
    } catch (error) {
      issues.push(cliIssue(`--${name}`, `cannot read ${path}: ${errorCode(error)}`));
    }
  }

  const asOf = values['as-of'];
  if (asOf) {
    const parsed = parseAsOf(asOf);
    if (!parsed.ok) issues.push(parsed.issue);
  }
  if (issues.length > 0 || !sources.ours || !sources.theirs || !sources.manual || !asOf || !values.output) {
    return fail(issues);
  }

  const result = reconcile({ ours: sources.ours, theirs: sources.theirs, manual: sources.manual, asOf });
  if (!result.report) return fail(result.issues);

  try {
    await writeFile(values.output, `${JSON.stringify(result.report, null, 2)}\n`, 'utf8');
  } catch (error) {
    return fail([...result.issues, cliIssue('--output', `cannot write ${values.output}: ${errorCode(error)}`)]);
  }

  printIssues(result.issues);
  process.stdout.write(`${summaryLine(result.report)} → ${values.output}\n`);
  return 0;
}

function cliIssue(source: string, message: string): Issue {
  return { code: 'C1', level: 'fatal', source, message };
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) return String(error.code);
  return error instanceof Error ? error.message : String(error);
}

function fail(issues: Issue[]): number {
  printIssues(issues);
  process.stderr.write(`${USAGE}\n`);
  return 1;
}

function printIssues(issues: Issue[]): void {
  for (const issue of issues) {
    const where = [issue.source, issue.row !== undefined ? `row ${issue.row}` : '', issue.id ? `id ${issue.id}` : '']
      .filter(Boolean)
      .join(' ');
    process.stderr.write(`${issue.level} ${issue.code} ${where}: ${issue.message}\n`);
  }
}

function summaryLine({ summary: s }: Report): string {
  return (
    `matched: manual ${s.matched_manual}, exact ${s.matched_exact}, rule_based ${s.matched_rule_based}, ` +
    `fuzzy ${s.matched_fuzzy}; unmatched: ours ${s.unmatched_ours}, theirs ${s.unmatched_theirs}`
  );
}
