import { byId } from '../lib/compare.ts';
import { decimalKey } from '../lib/decimal.ts';
import { toMatch } from '../output/match.ts';
import type { Match, TxRecord } from '../types.ts';

// Exact (Q9, E1, I3, E3). Equal records get equal labels, so a Map finds the partner
// without comparing every pair. party: match columns both sides have (party.ts).
export function matchExact(ours: TxRecord[], theirs: TxRecord[], party: readonly string[]): Match[] {
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
