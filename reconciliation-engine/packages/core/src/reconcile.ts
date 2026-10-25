import { Temporal } from 'temporal-polyfill';
import { DEFAULT_COLUMNS, type ColumnSpec } from './settings/columns.ts';
import { DEFAULT_LIMITS, type Limits } from './settings/limits.ts';
import { readAsOf } from './input/readAsOf.ts';
import { readManual } from './input/readManual.ts';
import { readTransactions } from './input/readTransactions.ts';
import type { CsvSource } from './input/readCsv.ts';
import type { Exception } from './exceptions.ts';
import { matchManual } from './matching/manual.ts';
import { matchOrder } from './matching/matchOrder.ts';
import { matchColumns } from './matching/sameParty.ts';
import { buildReport } from './output/buildReport.ts';
import type { Match, Report, Transaction } from './types.ts';

export interface ReconcileInput {
  ours: CsvSource;
  theirs: CsvSource;
  manual: CsvSource;
  asOf: string;
}

export interface ReconcileOptions {
  limits?: Limits;
  fuzzy?: boolean;
  columns?: readonly ColumnSpec[];
}

// report is null when any exception is fatal.
export interface ReconcileResult {
  report: Report | null;
  exceptions: Exception[];
}

// Pipeline: input → as_of filter → manual → other match kinds → report.
export function reconcile(input: ReconcileInput, options: ReconcileOptions = {}): ReconcileResult {
  const limits = options.limits ?? DEFAULT_LIMITS;
  const columns = options.columns ?? DEFAULT_COLUMNS;

  // 1. Input
  const asOf = readAsOf(input.asOf);
  const ours = readTransactions(input.ours, columns);
  const theirs = readTransactions(input.theirs, columns);
  const manual = readManual(input.manual);
  const exceptions = [...(asOf.ok ? [] : [asOf.exception]), ...ours.exceptions, ...theirs.exceptions, ...manual.exceptions];
  if (!asOf.ok || exceptions.some((exception) => exception.level === 'fatal')) return { report: null, exceptions };
  const compared = matchColumns(
    columns,
    { name: input.ours.name, columnNames: ours.columnNames },
    { name: input.theirs.name, columnNames: theirs.columnNames },
    exceptions,
  );

  // 2. as_of filter (Q4, A1): records after as_of do not exist in this run.
  const visible = (record: Transaction) => Temporal.Instant.compare(record.instant, asOf.instant) <= 0;
  let freeOurs = ours.records.filter(visible);
  let freeTheirs = theirs.records.filter(visible);

  // 3. Matching: each step takes only records no earlier step used (Q13).
  const matches: Match[] = [];
  const take = (stepMatches: Match[]) => {
    matches.push(...stepMatches);
    const usedOurs = new Set(stepMatches.map((m) => m.ours_id));
    const usedTheirs = new Set(stepMatches.map((m) => m.theirs_id));
    freeOurs = freeOurs.filter((r) => !usedOurs.has(r.id));
    freeTheirs = freeTheirs.filter((r) => !usedTheirs.has(r.id));
  };
  take(matchManual(input.manual.name, manual.pins, ours.records, theirs.records, freeOurs, freeTheirs, exceptions));
  for (const step of matchOrder(limits, compared, options.fuzzy !== false)) take(step(freeOurs, freeTheirs));

  // 4. Report
  return { report: buildReport(asOf.text, matches, freeOurs, freeTheirs), exceptions };
}
