import type { Limits } from '../settings/limits.ts';
import type { Match, Transaction } from '../types.ts';
import { matchExact } from './exact.ts';
import { matchFuzzy } from './fuzzy.ts';
import type { MatchColumns } from './sameParty.ts';
import { matchRuleBased } from './ruleBased.ts';

// One match kind as a step: takes the free records, returns its matches.
export type MatchStep = (ours: Transaction[], theirs: Transaction[]) => Match[];

// Match kinds after manual, in priority order (Q7). New kind = new line.
export function matchOrder(limits: Limits, columns: MatchColumns, fuzzy: boolean): MatchStep[] {
  const party = [...columns.equal, ...columns.similar];
  const steps: MatchStep[] = [
    (o, t) => matchExact(o, t, party),
    (o, t) => matchRuleBased(o, t, limits, party),
  ];
  if (fuzzy) steps.push((o, t) => matchFuzzy(o, t, limits, columns));
  return steps;
}
