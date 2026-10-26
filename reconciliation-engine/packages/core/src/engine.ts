import { Temporal } from 'temporal-polyfill';
import { DEFAULT_COLUMNS, type ColumnSpec } from './settings/columns.ts';
import { DEFAULT_LIMITS, type Limits } from './settings/limits.ts';
import type { Exception } from './exceptions.ts';
import { matchManual } from './matching/manual.ts';
import { matchOrder } from './matching/matchOrder.ts';
import { matchColumns } from './matching/sameParty.ts';
import { buildReport } from './output/buildReport.ts';
import type { AsOf } from './readers/readAsOf.ts';
import type { Match, Pin, Report, Transaction } from './types.ts';

// DECISIONS S6. Records already read; the engine knows nothing about files or formats.
export interface EngineSide {
  name: string; // shown in exceptions
  records: Transaction[];
  columnNames: string[]; // extra columns the source has (I3)
}

export interface EngineInput {
  ours: EngineSide;
  theirs: EngineSide;
  manual: { name: string; pins: Pin[] };
  asOf: AsOf;
}

export interface EngineOptions {
  limits?: Limits;
  fuzzy?: boolean;
  columns?: readonly ColumnSpec[];
}

export interface EngineResult {
  report: Report;
  exceptions: Exception[];
}

// as_of filter → manual → other match kinds → report.
export function runEngine(input: EngineInput, options: EngineOptions = {}): EngineResult {
  const limits = options.limits ?? DEFAULT_LIMITS;
  const columns = options.columns ?? DEFAULT_COLUMNS;
  const exceptions: Exception[] = [];
  const { ours, theirs, asOf } = input;
  const compared = matchColumns(columns, ours, theirs, exceptions);

  // 1. as_of filter (Q4, A1): records after as_of do not exist in this run.
  const visible = (record: Transaction) => Temporal.Instant.compare(record.instant, asOf.instant) <= 0;
  let freeOurs = ours.records.filter(visible);
  let freeTheirs = theirs.records.filter(visible);

  // 2. Matching: each step takes only records no earlier step used (Q13).
  const matches: Match[] = [];
  const take = (stepMatches: Match[]) => {
    matches.push(...stepMatches);
    const usedOurs = new Set(stepMatches.map((m) => m.ours_id));
    const usedTheirs = new Set(stepMatches.map((m) => m.theirs_id));
    freeOurs = freeOurs.filter((r) => !usedOurs.has(r.id));
    freeTheirs = freeTheirs.filter((r) => !usedTheirs.has(r.id));
  };
  take(matchManual(input.manual.name, input.manual.pins, ours.records, theirs.records, freeOurs, freeTheirs, exceptions));
  for (const step of matchOrder(limits, compared, options.fuzzy !== false)) take(step(freeOurs, freeTheirs));

  // 3. Report
  return { report: buildReport(asOf.text, matches, freeOurs, freeTheirs), exceptions };
}
