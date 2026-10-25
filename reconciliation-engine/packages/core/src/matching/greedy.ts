import { compareIds } from '../lib/compare.ts';
import { D, secondsToNanos } from '../lib/decimal.ts';
import { toMatch } from '../output/match.ts';
import type { Match, MatchKind, TxRecord } from '../types.ts';

// Sort keys of one candidate pair, ascending: best first.
export type SortKeys = (number | bigint | string | D)[];

// Returns the sort keys of a pair that may match, or null when it may not.
export type Score = (ours: TxRecord, theirs: TxRecord) => SortKeys | null;

interface Candidate {
  ours: TxRecord;
  theirs: TxRecord;
  keys: SortKeys;
}

function compareKeys(a: SortKeys, b: SortKeys): number {
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    const order =
      typeof x === 'string' ? compareIds(x, y as string)
      : x instanceof D ? x.cmp(y as D)
      : x < (y as number | bigint) ? -1 : x > (y as number | bigint) ? 1 : 0;
    if (order !== 0) return order;
  }
  return 0;
}

// One match kind: score free pairs, best first, take greedily. Each record matches once (Q13).
// Ties go by ours_id, then theirs_id (E3). windowSeconds: score only pairs at most this far
// apart in time. Pairs outside the window must score null, so the result is the same as
// scoring every pair.
export function runMatchKind(kind: MatchKind, ours: TxRecord[], theirs: TxRecord[], score: Score, windowSeconds?: string): Match[] {
  const candidates: Candidate[] = [];
  const add = (o: TxRecord, t: TxRecord) => {
    const keys = score(o, t);
    if (keys) candidates.push({ ours: o, theirs: t, keys: [...keys, o.id, t.id] });
  };

  if (windowSeconds === undefined) {
    for (const o of ours) for (const t of theirs) add(o, t);
  } else {
    // Theirs sorted by time. For each ours: binary search to the window start, walk to its end.
    const windowNs = BigInt(secondsToNanos(windowSeconds).toFixed(0, D.ROUND_DOWN));
    const byTime = theirs
      .map((t) => ({ t, ns: t.instant.epochNanoseconds }))
      .sort((a, b) => (a.ns < b.ns ? -1 : a.ns > b.ns ? 1 : 0));
    for (const o of ours) {
      const ns = o.instant.epochNanoseconds;
      const start = ns - windowNs;
      let low = 0;
      let high = byTime.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (byTime[mid]!.ns < start) low = mid + 1;
        else high = mid;
      }
      for (let i = low; i < byTime.length && byTime[i]!.ns <= ns + windowNs; i++) add(o, byTime[i]!.t);
    }
  }
  candidates.sort((a, b) => compareKeys(a.keys, b.keys));

  const usedOurs = new Set<string>();
  const usedTheirs = new Set<string>();
  const matches: Match[] = [];
  for (const { ours: o, theirs: t } of candidates) {
    if (usedOurs.has(o.id) || usedTheirs.has(t.id)) continue;
    usedOurs.add(o.id);
    usedTheirs.add(t.id);
    matches.push(toMatch(kind, o, t));
  }
  return matches;
}
