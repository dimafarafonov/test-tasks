import type { Thresholds } from './config.ts';
import { D, decimalKey, nanosToSeconds, secondsToNanos, toFixed } from './decimal.ts';
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

// Schema columns (fields.ts) that both sides have, by match rule. I3: a column on one side only is not compared.
export interface MatchColumns {
  equal: string[];
  similar: string[];
}

// E1, E2, Q10: party-identity fields equal.
function sameParty(ours: TxRecord, theirs: TxRecord, columns: readonly string[]): boolean {
  return columns.every((column) => ours.keys[column] === theirs.keys[column]);
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

const byId = (a: TxRecord, b: TxRecord) => compareIds(a.id, b.id);

// Exact tier (Q9, E1, I3, E3). Equal records get equal labels, so a Map finds the partner
// without comparing every pair.
export function runExact(ours: TxRecord[], theirs: TxRecord[], party: readonly string[]): Match[] {
  const label = (r: TxRecord): string =>
    JSON.stringify([decimalKey(r.amount), r.instant.epochNanoseconds.toString(), ...party.map((column) => r.keys[column])]);

  // label → theirs records with that label, in id order.
  const boxes = new Map<string, TxRecord[]>();
  for (const t of [...theirs].sort(byId)) {
    const key = label(t);
    const box = boxes.get(key);
    if (box) box.push(t);
    else boxes.set(key, [t]);
  }

  // E3: ours in id order, each takes the smallest free theirs id.
  const matches: Match[] = [];
  for (const o of [...ours].sort(byId)) {
    const t = boxes.get(label(o))?.shift();
    if (t) matches.push(toMatch('exact', o, t));
  }
  return matches;
}

// One tier: score every free pair, best first, take greedily. Each record matches once (Q13).
// windowSeconds: score only pairs at most this far apart in time. Pairs outside the window
// must score null, so the result is the same as scoring every pair.
export function runTier(
  kind: MatchKind,
  ours: TxRecord[],
  theirs: TxRecord[],
  score: (o: TxRecord, t: TxRecord) => Candidate['keys'] | null,
  windowSeconds?: string,
): Match[] {
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

// Q10. R5: closest |amount diff|, then |time diff|, then ids.
export function scoreRuleBased(thresholds: Thresholds, party: readonly string[]) {
  return (o: TxRecord, t: TxRecord): Candidate['keys'] | null => {
    const d = diff(o, t);
    if (!sameParty(o, t, party) || !withinLimits(d, thresholds.ruleAmount, thresholds.ruleTimeSeconds)) return null;
    return [d.amount.abs(), absNanos(d.nanos)];
  };
}

// Q12, F3–F7. Memo must be similar (both non-empty). 'similar' columns similar too,
// 'equal' columns equal. Best text first (lowest similarity of the checked fields), then R5 order.
export function scoreFuzzy(thresholds: Thresholds, columns: MatchColumns) {
  const minSimilarity = Number(thresholds.fuzzySimilarity);
  return (o: TxRecord, t: TxRecord): Candidate['keys'] | null => {
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

// One matching step: takes the free records, returns its matches.
export type Tier = (ours: TxRecord[], theirs: TxRecord[]) => Match[];

// After manual, in priority order (Q7). New tier = new line.
export function buildTiers(thresholds: Thresholds, columns: MatchColumns, fuzzy: boolean): Tier[] {
  const party = [...columns.equal, ...columns.similar];
  return [
    (o, t) => runExact(o, t, party),
    (o, t) => runTier('rule_based', o, t, scoreRuleBased(thresholds, party), thresholds.ruleTimeSeconds),
    ...(fuzzy ? [(o: TxRecord[], t: TxRecord[]) => runTier('fuzzy', o, t, scoreFuzzy(thresholds, columns), thresholds.fuzzyTimeSeconds)] : []),
  ];
}
