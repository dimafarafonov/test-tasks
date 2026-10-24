import type { Thresholds } from './config.ts';
import { D, nanosToSeconds, secondsToNanos, toFixed } from './decimal.ts';
import { normalizeText, similarity } from './similarity.ts';
import type { Match, MatchKind, TxRecord } from './types.ts';

export const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// Signed ours − theirs (Q16).
export interface PairDiff {
  amount: D;
  nanos: bigint;
}

export function diff(ours: TxRecord, theirs: TxRecord): PairDiff {
  return {
    amount: ours.amount.minus(theirs.amount),
    nanos: ours.instant.epochNanoseconds - theirs.instant.epochNanoseconds,
  };
}

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

const absNanos = (nanos: bigint): bigint => (nanos < 0n ? -nanos : nanos);

// E1, E2, Q10: party-identity fields equal. I3: only when both sides carry them.
function sameParty(ours: TxRecord, theirs: TxRecord): boolean {
  if (!ours.ext || !theirs.ext) return true;
  return ours.ext.currency === theirs.ext.currency && ours.ext.partyEmail === theirs.ext.partyEmail;
}

function withinLimits(d: PairDiff, maxAmount: string, maxSeconds: string): boolean {
  return d.amount.abs().lte(maxAmount) && new D(absNanos(d.nanos).toString()).lte(secondsToNanos(maxSeconds));
}

interface Candidate {
  ours: TxRecord;
  theirs: TxRecord;
  keys: (number | bigint | string | D)[]; // sort keys, ascending
}

function compareKeys(a: Candidate['keys'], b: Candidate['keys']): number {
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

// One tier: score every free pair, best first, take greedily. Each record matches once (Q13).
export function runTier(
  kind: MatchKind,
  ours: TxRecord[],
  theirs: TxRecord[],
  score: (o: TxRecord, t: TxRecord) => Candidate['keys'] | null,
): Match[] {
  const candidates: Candidate[] = [];
  for (const o of ours) {
    for (const t of theirs) {
      const keys = score(o, t);
      if (keys) candidates.push({ ours: o, theirs: t, keys: [...keys, o.id, t.id] });
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

// Q9 + E1. E3: ties go by ours_id, then theirs_id (added by runTier).
export function scoreExact(o: TxRecord, t: TxRecord): Candidate['keys'] | null {
  const d = diff(o, t);
  return d.amount.isZero() && d.nanos === 0n && sameParty(o, t) ? [] : null;
}

// Q10. R5: closest |amount diff|, then |time diff|, then ids.
export function scoreRuleBased(thresholds: Thresholds) {
  return (o: TxRecord, t: TxRecord): Candidate['keys'] | null => {
    const d = diff(o, t);
    if (!sameParty(o, t) || !withinLimits(d, thresholds.ruleAmount, thresholds.ruleTimeSeconds)) return null;
    return [d.amount.abs(), absNanos(d.nanos)];
  };
}

// Q12, F3–F6. Memo must be similar (both non-empty). Extended on both sides:
// party_email similar too, currency equal. Best text first (lowest similarity of the
// checked fields), then R5 order.
export function scoreFuzzy(thresholds: Thresholds) {
  const minSimilarity = Number(thresholds.fuzzySimilarity);
  return (o: TxRecord, t: TxRecord): Candidate['keys'] | null => {
    const d = diff(o, t);
    if (!withinLimits(d, thresholds.fuzzyAmount, thresholds.fuzzyTimeSeconds)) return null;
    if (normalizeText(o.memo) === '' || normalizeText(t.memo) === '') return null;

    let textScore = similarity(o.memo, t.memo);
    if (o.ext && t.ext) {
      if (o.ext.currency !== t.ext.currency) return null;
      textScore = Math.min(textScore, similarity(o.ext.partyEmail, t.ext.partyEmail));
    }
    if (textScore < minSimilarity) return null;
    return [-textScore, d.amount.abs(), absNanos(d.nanos)];
  };
}
