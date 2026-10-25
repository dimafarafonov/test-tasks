import { nanosToSeconds, toFixed } from '../lib/decimal.ts';
import { diff } from '../matching/diff.ts';
import type { Match, MatchKind, TxRecord } from '../types.ts';

// Q16: ours − theirs. O1: never "-0.00". O3: round half away from zero.
export function toMatch(kind: MatchKind, ours: TxRecord, theirs: TxRecord): Match {
  const { amount, nanos } = diff(ours, theirs);
  return {
    kind,
    ours_id: ours.id,
    theirs_id: theirs.id,
    amount_diff: toFixed(amount, 2),
    timestamp_diff_seconds: toFixed(nanosToSeconds(nanos), 3),
  };
}
