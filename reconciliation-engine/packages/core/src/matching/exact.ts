import { byId } from '../helpers/sortById.ts';
import { decimalKey } from '../helpers/numbers.ts';
import { matchEntry } from '../output/matchEntry.ts';
import type { Match, Transaction } from '../types.ts';

// Exact (Q9, E1, I3, E3). Equal records get equal labels, so a Map finds the partner
// without comparing every pair. party: match columns both sides have (sameParty.ts).
export function matchExact(ours: Transaction[], theirs: Transaction[], party: readonly string[]): Match[] {
  const label = (r: Transaction): string =>
    JSON.stringify([decimalKey(r.amount), r.instant.epochNanoseconds.toString(), ...party.map((column) => r.matchKeys[column])]);

  // label → theirs records with that label, in id order.
  const boxes = new Map<string, Transaction[]>();
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
    if (t) matches.push(matchEntry('exact', o, t));
  }
  return matches;
}
