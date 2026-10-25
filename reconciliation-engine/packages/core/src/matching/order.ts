import type { Thresholds } from '../config/thresholds.ts';
import type { Match, TxRecord } from '../types.ts';
import { matchExact } from './exact.ts';
import { matchFuzzy } from './fuzzy.ts';
import type { MatchColumns } from './party.ts';
import { matchRuleBased } from './ruleBased.ts';

// One match kind as a step: takes the free records, returns its matches.
export type MatchStep = (ours: TxRecord[], theirs: TxRecord[]) => Match[];

// Match kinds after manual, in priority order (Q7). New kind = new line.
export function matchOrder(thresholds: Thresholds, columns: MatchColumns, fuzzy: boolean): MatchStep[] {
  const party = [...columns.equal, ...columns.similar];
  const steps: MatchStep[] = [
    (o, t) => matchExact(o, t, party),
    (o, t) => matchRuleBased(o, t, thresholds, party),
  ];
  if (fuzzy) steps.push((o, t) => matchFuzzy(o, t, thresholds, columns));
  return steps;
}
