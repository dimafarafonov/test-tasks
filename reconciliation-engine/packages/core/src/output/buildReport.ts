import { byId, compareIds } from '../helpers/sortById.ts';
import type { Match, MatchKind, Report, Transaction } from '../types.ts';
import { unmatchedEntry } from './unmatchedEntry.ts';

const KIND_ORDER: MatchKind[] = ['manual', 'exact', 'rule_based', 'fuzzy'];

// Q17: matches by kind, then ours_id; unmatched by id.
export function buildReport(asOf: string, matches: Match[], unmatchedOurs: Transaction[], unmatchedTheirs: Transaction[]): Report {
  const sorted = [...matches].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || compareIds(a.ours_id, b.ours_id));
  const count = (kind: MatchKind) => sorted.filter((m) => m.kind === kind).length;
  return {
    as_of: asOf,
    summary: {
      matched_manual: count('manual'),
      matched_exact: count('exact'),
      matched_rule_based: count('rule_based'),
      matched_fuzzy: count('fuzzy'),
      unmatched_ours: unmatchedOurs.length,
      unmatched_theirs: unmatchedTheirs.length,
    },
    matches: sorted,
    unmatched_ours: [...unmatchedOurs].sort(byId).map(unmatchedEntry),
    unmatched_theirs: [...unmatchedTheirs].sort(byId).map(unmatchedEntry),
  };
}
