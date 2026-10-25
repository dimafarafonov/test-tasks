import type { Exception } from '../exceptions.ts';
import { matchEntry } from '../output/matchEntry.ts';
import type { Match, Pin, Transaction } from '../types.ts';

// Q8: pins win, no field checks. M1–M4 problems skip the pin.
// all*: every parsed record (M1 "not found"); free*: records within as_of (M2).
export function matchManual(
  source: string,
  pins: Pin[],
  allOurs: Transaction[],
  allTheirs: Transaction[],
  freeOurs: Transaction[],
  freeTheirs: Transaction[],
  exceptions: Exception[],
): Match[] {
  const index = (records: Transaction[]) => new Map(records.map((r) => [r.id, r]));
  const [allO, allT, freeO, freeT] = [index(allOurs), index(allTheirs), index(freeOurs), index(freeTheirs)];
  const seenPairs = new Set<string>();
  const pinnedOurs = new Set<string>();
  const pinnedTheirs = new Set<string>();
  const matches: Match[] = [];

  for (const pin of pins) {
    const skip = (code: string, message: string) =>
      exceptions.push({ code, level: 'skip', source, row: pin.row, message: `pin ${pin.oursId},${pin.theirsId} skipped: ${message}` });

    const pairKey = JSON.stringify([pin.oursId, pin.theirsId]);
    if (seenPairs.has(pairKey)) {
      skip('M4', 'duplicate pin');
      continue;
    }
    seenPairs.add(pairKey);

    const missing = [
      ...(allO.has(pin.oursId) ? [] : [`ours id ${pin.oursId}`]),
      ...(allT.has(pin.theirsId) ? [] : [`theirs id ${pin.theirsId}`]),
    ];
    if (missing.length > 0) {
      skip('M1', `${missing.join(' and ')} not found`);
      continue;
    }
    const o = freeO.get(pin.oursId);
    const t = freeT.get(pin.theirsId);
    if (!o || !t) {
      skip('M2', 'record after as_of');
      continue;
    }
    if (pinnedOurs.has(o.id) || pinnedTheirs.has(t.id)) {
      skip('M3', 'id already used by an earlier pin');
      continue;
    }
    pinnedOurs.add(o.id);
    pinnedTheirs.add(t.id);
    matches.push(matchEntry('manual', o, t));
  }
  return matches;
}
