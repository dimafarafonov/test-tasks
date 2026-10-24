// Builds a large example in the style of example 2 (manual + exact + unmatched).
// The expected report is built from the data design, not by the engine, so the engine is tested.
// Same input → same files (fixed seed).
//
// usage: node scripts/generate-example.ts [ROWS_PER_SIDE=1000] [NAME=example_5_manual_1k]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rows = Number(process.argv[2] ?? 1000);
const name = process.argv[3] ?? `example_5_manual_${rows >= 1000 ? `${rows / 1000}k` : rows}`;
if (!Number.isInteger(rows) || rows < 10) throw new Error('ROWS_PER_SIDE must be an integer >= 10');

// Per side: 80% exact pairs, 10% manual pins, 10% unmatched.
const pinCount = Math.floor(rows / 10);
const unmatchedCount = Math.floor(rows / 10);
const exactCount = rows - pinCount - unmatchedCount;

const BASE_MS = Date.parse('2026-04-01T00:00:00.000Z');
const AS_OF = '2026-04-01T23:59:59.999Z';
const MEMOS = ['coffee', 'book', 'lunch', 'gear', 'subscription', 'refund', 'taxi', 'hotel'];

// Amounts in cents and times in ms: plain integer math, no engine code.
interface Rec {
  id: string;
  cents: number;
  ms: number;
  memo: string;
}

const pad = (n: number) => String(n).padStart(String(rows).length, '0');
const money = (cents: number) => `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;
const iso = (ms: number) => new Date(ms).toISOString();
const seconds = (ms: number) => `${ms < 0 && ms > -1000 ? '-' : ''}${Math.trunc(ms / 1000)}.${String(Math.abs(ms) % 1000).padStart(3, '0')}`;

// mulberry32: small seeded PRNG, so theirs ids are shuffled the same way every run.
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = prng(42);
const theirsIds = Array.from({ length: rows }, (_, i) => `t-${pad(i + 1)}`);
for (let i = theirsIds.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [theirsIds[i], theirsIds[j]] = [theirsIds[j]!, theirsIds[i]!];
}
let nextTheirs = 0;
const takeTheirsId = () => theirsIds[nextTheirs++]!;

const ours: Rec[] = [];
const theirs: Rec[] = [];
const exact: [Rec, Rec][] = [];
const pins: [Rec, Rec][] = [];
let slot = 0; // each group gets its own 30 s slot, so no two groups are close in time
const nextMs = () => BASE_MS + slot++ * 30_000;

for (let i = 0; i < exactCount; i++) {
  const ms = nextMs();
  const cents = 100 + i * 137; // steps of 1.37: far above the 0.10 fuzzy limit
  const o = { id: `o-${pad(ours.length + 1)}`, cents, ms, memo: MEMOS[i % MEMOS.length]! };
  const t = { id: takeTheirsId(), cents, ms, memo: '' };
  ours.push(o);
  theirs.push(t);
  exact.push([o, t]);
}

// Pins: different amount and time, so only the manual tier can pair them (Q8).
for (let i = 0; i < pinCount; i++) {
  const ms = nextMs();
  const o = { id: `o-${pad(ours.length + 1)}`, cents: 2_000_000 + i * 111, ms, memo: 'refund' };
  const t = { id: takeTheirsId(), cents: 3_000_000 + i * 111, ms: ms + 4 * 3600_000, memo: 'settlement' };
  ours.push(o);
  theirs.push(t);
  pins.push([o, t]);
}

// Unmatched: own amount ranges far from all others, own time slots.
const unmatchedOurs: Rec[] = [];
const unmatchedTheirs: Rec[] = [];
for (let i = 0; i < unmatchedCount; i++) {
  const o = { id: `o-${pad(ours.length + 1)}`, cents: 5_000_000 + i * 113, ms: nextMs(), memo: 'gear' };
  const t = { id: takeTheirsId(), cents: 9_000_000 + i * 113, ms: nextMs(), memo: '' };
  ours.push(o);
  theirs.push(t);
  unmatchedOurs.push(o);
  unmatchedTheirs.push(t);
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const csv = (records: Rec[]) =>
  ['id,amount,timestamp,memo', ...[...records].sort(byId).map((r) => `${r.id},${money(r.cents)},${iso(r.ms)},${r.memo}`)].join('\n') + '\n';
const match = (kind: string, [o, t]: [Rec, Rec]) => ({
  kind,
  ours_id: o.id,
  theirs_id: t.id,
  amount_diff: money(o.cents - t.cents),
  timestamp_diff_seconds: seconds(o.ms - t.ms),
});
const echo = (r: Rec) => ({ id: r.id, amount: money(r.cents), timestamp: iso(r.ms) });
const byOurs = (a: [Rec, Rec], b: [Rec, Rec]) => byId(a[0], b[0]);

const expected = {
  as_of: AS_OF,
  summary: {
    matched_manual: pins.length,
    matched_exact: exact.length,
    matched_rule_based: 0,
    matched_fuzzy: 0,
    unmatched_ours: unmatchedOurs.length,
    unmatched_theirs: unmatchedTheirs.length,
  },
  matches: [...[...pins].sort(byOurs).map((p) => match('manual', p)), ...[...exact].sort(byOurs).map((p) => match('exact', p))],
  unmatched_ours: [...unmatchedOurs].sort(byId).map(echo),
  unmatched_theirs: [...unmatchedTheirs].sort(byId).map(echo),
};

const dir = join(import.meta.dirname, '..', 'examples', name);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'ours.csv'), csv(ours));
writeFileSync(join(dir, 'theirs.csv'), csv(theirs));
writeFileSync(join(dir, 'manual.csv'), ['ours_id,theirs_id', ...pins.map(([o, t]) => `${o.id},${t.id}`)].join('\n') + '\n');
writeFileSync(join(dir, 'as_of.txt'), `${AS_OF}\n`);
writeFileSync(join(dir, 'expected_report.json'), `${JSON.stringify(expected, null, 2)}\n`);
console.log(`examples/${name}: ${rows} rows per side (${exactCount} exact, ${pinCount} manual, ${unmatchedCount} unmatched)`);
