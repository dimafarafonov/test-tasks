import type { Thresholds } from '../config/thresholds.ts';
import type { Match, TxRecord } from '../types.ts';
import { absNanos, diff, withinLimits } from './diff.ts';
import { runMatchKind, type Score } from './greedy.ts';
import { sameParty } from './party.ts';

// Q10, R1, R2. R5: closest |amount diff|, then |time diff|, then ids.
export function scoreRuleBased(thresholds: Thresholds, party: readonly string[]): Score {
  return (o, t) => {
    const d = diff(o, t);
    if (!sameParty(o, t, party) || !withinLimits(d, thresholds.ruleAmount, thresholds.ruleTimeSeconds)) return null;
    return [d.amount.abs(), absNanos(d.nanos)];
  };
}

export function matchRuleBased(ours: TxRecord[], theirs: TxRecord[], thresholds: Thresholds, party: readonly string[]): Match[] {
  return runMatchKind('rule_based', ours, theirs, scoreRuleBased(thresholds, party), thresholds.ruleTimeSeconds);
}
