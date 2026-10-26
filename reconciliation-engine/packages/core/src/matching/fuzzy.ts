import type { Limits } from '../settings/limits.ts';
import { normalizeText, similarity } from '../helpers/textSimilarity.ts';
import type { Match, Transaction } from '../types.ts';
import { absNanos, diff, withinLimits } from './difference.ts';
import { runMatchKind, type Score } from './pickBest.ts';
import { sameParty, type MatchColumns } from './sameParty.ts';

// Q12, F3–F7. Memo must be similar (both non-empty). 'similar' columns similar too,
// 'equal' columns equal. Best text first (lowest similarity of the checked fields), then R5 order.
export function scoreFuzzy(limits: Limits, columns: MatchColumns): Score {
  const minSimilarity = Number(limits.fuzzySimilarity);
  return (o, t) => {
    const d = diff(o, t);
    if (!withinLimits(d, limits.fuzzyAmount, limits.fuzzyTimeSeconds)) return null;
    if (normalizeText(o.memo) === '' || normalizeText(t.memo) === '') return null;

    if (!sameParty(o, t, columns.equal)) return null;
    let textScore = similarity(o.memo, t.memo);
    for (const column of columns.similar) textScore = Math.min(textScore, similarity(o.matchKeys[column]!, t.matchKeys[column]!));
    if (textScore < minSimilarity) return null;
    return [-textScore, d.amount.abs(), absNanos(d.nanos)];
  };
}

export function matchFuzzy(ours: Transaction[], theirs: Transaction[], limits: Limits, columns: MatchColumns): Match[] {
  return runMatchKind('fuzzy', ours, theirs, scoreFuzzy(limits, columns), limits.fuzzyTimeSeconds);
}
