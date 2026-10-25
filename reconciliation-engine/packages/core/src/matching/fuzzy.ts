import type { Thresholds } from '../config/thresholds.ts';
import { normalizeText, similarity } from '../lib/similarity.ts';
import type { Match, TxRecord } from '../types.ts';
import { absNanos, diff, withinLimits } from './diff.ts';
import { runMatchKind, type Score } from './greedy.ts';
import { sameParty, type MatchColumns } from './party.ts';

// Q12, F3–F7. Memo must be similar (both non-empty). 'similar' columns similar too,
// 'equal' columns equal. Best text first (lowest similarity of the checked fields), then R5 order.
export function scoreFuzzy(thresholds: Thresholds, columns: MatchColumns): Score {
  const minSimilarity = Number(thresholds.fuzzySimilarity);
  return (o, t) => {
    const d = diff(o, t);
    if (!withinLimits(d, thresholds.fuzzyAmount, thresholds.fuzzyTimeSeconds)) return null;
    if (normalizeText(o.memo) === '' || normalizeText(t.memo) === '') return null;

    if (!sameParty(o, t, columns.equal)) return null;
    let textScore = similarity(o.memo, t.memo);
    for (const column of columns.similar) textScore = Math.min(textScore, similarity(o.keys[column]!, t.keys[column]!));
    if (textScore < minSimilarity) return null;
    return [-textScore, d.amount.abs(), absNanos(d.nanos)];
  };
}

export function matchFuzzy(ours: TxRecord[], theirs: TxRecord[], thresholds: Thresholds, columns: MatchColumns): Match[] {
  return runMatchKind('fuzzy', ours, theirs, scoreFuzzy(thresholds, columns), thresholds.fuzzyTimeSeconds);
}
