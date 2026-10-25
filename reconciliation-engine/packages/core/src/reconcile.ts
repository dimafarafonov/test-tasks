import { Temporal } from 'temporal-polyfill';
import { parseAsOf } from './asOf.ts';
import { DEFAULT_THRESHOLDS, type Thresholds } from './config.ts';
import { parseManual, parseSide, type CsvSource } from './csv.ts';
import type { Issue } from './issue.ts';
import { DEFAULT_FIELDS, type FieldSpec } from './fields.ts';
import { buildTiers, compareIds, toMatch, type MatchColumns } from './match.ts';
import type { EchoRecord, Match, MatchKind, Report, TxRecord } from './types.ts';

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

const KIND_ORDER: MatchKind[] = ['manual', 'exact', 'rule_based', 'fuzzy'];

export function reconcile(input: ReconcileInput, options: ReconcileOptions = {}): ReconcileResult {
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const fields = options.fields ?? DEFAULT_FIELDS;
  const asOf = parseAsOf(input.asOf);
  const ours = parseSide(input.ours, fields);
  const theirs = parseSide(input.theirs, fields);
  const manual = parseManual(input.manual);

  const issues = [...(asOf.ok ? [] : [asOf.issue]), ...ours.issues, ...theirs.issues, ...manual.issues];
  if (!asOf.ok || issues.some((issue) => issue.level === 'fatal')) return { report: null, issues };
  const columns = matchColumns(fields, input, ours.columns, theirs.columns, issues);

  // Q4, A1: records after as_of do not exist in this run.
  const visible = (record: TxRecord) => Temporal.Instant.compare(record.instant, asOf.instant) <= 0;
  let freeOurs = ours.records.filter(visible);
  let freeTheirs = theirs.records.filter(visible);

  const matches: Match[] = [];
  const consume = (tierMatches: Match[]) => {
    matches.push(...tierMatches);
    const usedOurs = new Set(tierMatches.map((m) => m.ours_id));
    const usedTheirs = new Set(tierMatches.map((m) => m.theirs_id));
    freeOurs = freeOurs.filter((r) => !usedOurs.has(r.id));
    freeTheirs = freeTheirs.filter((r) => !usedTheirs.has(r.id));
  };

  consume(applyPins(input.manual.name, manual.pins, ours.records, theirs.records, freeOurs, freeTheirs, issues));
  for (const tier of buildTiers(thresholds, columns, options.fuzzy !== false)) consume(tier(freeOurs, freeTheirs));

  // Q17
  matches.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || compareIds(a.ours_id, b.ours_id));
  const byId = (a: TxRecord, b: TxRecord) => compareIds(a.id, b.id);
  const unmatchedOurs = [...freeOurs].sort(byId).map(echo);
  const unmatchedTheirs = [...freeTheirs].sort(byId).map(echo);

  const count = (kind: MatchKind) => matches.filter((m) => m.kind === kind).length;
  const report: Report = {
    as_of: asOf.text,
    summary: {
      matched_manual: count('manual'),
      matched_exact: count('exact'),
      matched_rule_based: count('rule_based'),
      matched_fuzzy: count('fuzzy'),
      unmatched_ours: unmatchedOurs.length,
      unmatched_theirs: unmatchedTheirs.length,
    },
    matches,
    unmatched_ours: unmatchedOurs,
    unmatched_theirs: unmatchedTheirs,
  };
  return { report, issues };
}

// Q8: pins win, no field checks. M1–M4 problems skip the pin.
function applyPins(
  source: string,
  pins: { oursId: string; theirsId: string; row: number }[],
  allOurs: TxRecord[],
  allTheirs: TxRecord[],
  freeOurs: TxRecord[],
  freeTheirs: TxRecord[],
  issues: Issue[],
): Match[] {
  const index = (records: TxRecord[]) => new Map(records.map((r) => [r.id, r]));
  const [allO, allT, freeO, freeT] = [index(allOurs), index(allTheirs), index(freeOurs), index(freeTheirs)];
  const seenPairs = new Set<string>();
  const pinnedOurs = new Set<string>();
  const pinnedTheirs = new Set<string>();
  const matches: Match[] = [];

  for (const pin of pins) {
    const skip = (code: string, message: string) =>
      issues.push({ code, level: 'skip', source, row: pin.row, message: `pin ${pin.oursId},${pin.theirsId} skipped: ${message}` });

    const pairKey = JSON.stringify([pin.oursId, pin.theirsId]);
    if (seenPairs.has(pairKey)) {
      skip('M4', 'duplicate pin');
      continue;
    }
    seenPairs.add(pairKey);

    const missing = [
      ...(allO.has(pin.oursId) ? [] : [`ours id ${pin.oursId}`]),
      ...(allT.has(pin.theirsId) ? [] : [`theirs id ${pin.theirsId}`]),
    ];
    if (missing.length > 0) {
      skip('M1', `${missing.join(' and ')} not found`);
      continue;
    }
    const o = freeO.get(pin.oursId);
    const t = freeT.get(pin.theirsId);
    if (!o || !t) {
      skip('M2', 'record after as_of');
      continue;
    }
    if (pinnedOurs.has(o.id) || pinnedTheirs.has(t.id)) {
      skip('M3', 'id already used by an earlier pin');
      continue;
    }
    pinnedOurs.add(o.id);
    pinnedTheirs.add(t.id);
    matches.push(toMatch('manual', o, t));
  }
  return matches;
}

// I3: match columns that both sides have. A match column on one side only is not compared; warn,
// because a renamed column would else turn the check off without notice.
function matchColumns(
  fields: readonly FieldSpec[],
  input: ReconcileInput,
  oursColumns: string[],
  theirsColumns: string[],
  issues: Issue[],
): MatchColumns {
  const matched = fields.filter((spec) => spec.match !== 'none');
  const only = (source: string, mine: string[], other: string[]) => {
    const missing = matched.filter((spec) => mine.includes(spec.column) && !other.includes(spec.column)).map((spec) => spec.column);
    if (missing.length > 0) {
      issues.push({ code: 'I3', level: 'skip', source, message: `column(s) ${missing.join(', ')} only in this file; not used in matching` });
    }
  };
  only(input.ours.name, oursColumns, theirsColumns);
  only(input.theirs.name, theirsColumns, oursColumns);

  const common = matched.filter((spec) => oursColumns.includes(spec.column) && theirsColumns.includes(spec.column));
  return {
    equal: common.filter((spec) => spec.match === 'equal').map((spec) => spec.column),
    similar: common.filter((spec) => spec.match === 'similar').map((spec) => spec.column),
  };
}

// X3: no memo. Schema columns follow in schema order (fields keeps it).
function echo(record: TxRecord): EchoRecord {
  return { id: record.id, amount: record.amountText, timestamp: record.timestampText, ...record.fields };
}
