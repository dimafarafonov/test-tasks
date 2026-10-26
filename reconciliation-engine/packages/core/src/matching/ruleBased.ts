import type { Limits } from '../settings/limits.ts';
import type { Match, Transaction } from '../types.ts';
import { absNanos, diff, withinLimits } from './difference.ts';
import { runMatchKind, type Score } from './pickBest.ts';
import { sameParty } from './sameParty.ts';

// Q10, R1, R2. R5: closest |amount diff|, then |time diff|, then ids.
export function scoreRuleBased(limits: Limits, party: readonly string[]): Score {
  return (o, t) => {
    const d = diff(o, t);
    if (!sameParty(o, t, party) || !withinLimits(d, limits.ruleAmount, limits.ruleTimeSeconds)) return null;
    return [d.amount.abs(), absNanos(d.nanos)];
  };
}

export function matchRuleBased(ours: Transaction[], theirs: Transaction[], limits: Limits, party: readonly string[]): Match[] {
  return runMatchKind('rule_based', ours, theirs, scoreRuleBased(limits, party), limits.ruleTimeSeconds);
}
