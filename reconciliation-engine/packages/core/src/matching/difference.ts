import { D, secondsToNanos } from '../helpers/numbers.ts';
import type { Transaction } from '../types.ts';

// Signed ours − theirs (Q16).
export interface PairDiff {
  amount: D;
  nanos: bigint;
}

export function diff(ours: Transaction, theirs: Transaction): PairDiff {
  return {
    amount: ours.amount.minus(theirs.amount),
    nanos: ours.instant.epochNanoseconds - theirs.instant.epochNanoseconds,
  };
}

export const absNanos = (nanos: bigint): bigint => (nanos < 0n ? -nanos : nanos);

// All limits inclusive (limits.ts).
export function withinLimits(d: PairDiff, maxAmount: string, maxSeconds: string): boolean {
  return d.amount.abs().lte(maxAmount) && new D(absNanos(d.nanos).toString()).lte(secondsToNanos(maxSeconds));
}
