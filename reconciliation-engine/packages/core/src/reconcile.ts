import { Temporal } from 'temporal-polyfill';
import { DEFAULT_FIELDS, type FieldSpec } from './config/fields.ts';
import { DEFAULT_THRESHOLDS, type Thresholds } from './config/thresholds.ts';
import { parseAsOf } from './input/asOf.ts';
import { parseManual } from './input/manual.ts';
import { parseSide } from './input/side.ts';
import type { CsvSource } from './input/table.ts';
import type { Issue } from './issue.ts';
import { matchManual } from './matching/manual.ts';
import { matchOrder } from './matching/order.ts';
import { matchColumns } from './matching/party.ts';
import { buildReport } from './output/report.ts';
import type { Match, Report, TxRecord } from './types.ts';

export interface ReconcileInput {
  ours: CsvSource;
  theirs: CsvSource;
  manual: CsvSource;
  asOf: string;
}

export interface ReconcileOptions {
  thresholds?: Thresholds;
  fuzzy?: boolean;
  fields?: readonly FieldSpec[];
}

// report is null when any issue is fatal.
export interface ReconcileResult {
  report: Report | null;
  issues: Issue[];
}

// Pipeline: input → as_of filter → manual → other match kinds → report.
export function reconcile(input: ReconcileInput, options: ReconcileOptions = {}): ReconcileResult {
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const fields = options.fields ?? DEFAULT_FIELDS;

  // 1. Input
  const asOf = parseAsOf(input.asOf);
  const ours = parseSide(input.ours, fields);
  const theirs = parseSide(input.theirs, fields);
  const manual = parseManual(input.manual);
  const issues = [...(asOf.ok ? [] : [asOf.issue]), ...ours.issues, ...theirs.issues, ...manual.issues];
  if (!asOf.ok || issues.some((issue) => issue.level === 'fatal')) return { report: null, issues };
  const columns = matchColumns(fields, { name: input.ours.name, columns: ours.columns }, { name: input.theirs.name, columns: theirs.columns }, issues);

  // 2. as_of filter (Q4, A1): records after as_of do not exist in this run.
  const visible = (record: TxRecord) => Temporal.Instant.compare(record.instant, asOf.instant) <= 0;
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
  take(matchManual(input.manual.name, manual.pins, ours.records, theirs.records, freeOurs, freeTheirs, issues));
  for (const step of matchOrder(thresholds, columns, options.fuzzy !== false)) take(step(freeOurs, freeTheirs));

  // 4. Report
  return { report: buildReport(asOf.text, matches, freeOurs, freeTheirs), issues };
}
