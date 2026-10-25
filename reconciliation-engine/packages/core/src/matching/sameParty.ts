import type { ColumnSpec } from '../settings/columns.ts';
import type { Exception } from '../exceptions.ts';
import type { Transaction } from '../types.ts';

// Extra columns (settings/columns.ts) that both sides have, by match rule.
export interface MatchColumns {
  equal: string[];
  similar: string[];
}

// E1, E2, Q10: party-identity fields equal.
export function sameParty(ours: Transaction, theirs: Transaction, columns: readonly string[]): boolean {
  return columns.every((column) => ours.matchKeys[column] === theirs.matchKeys[column]);
}

// I3: match columns that both sides have. A match column on one side only is not compared; warn,
// because a renamed column would else turn the check off without notice.
export interface SideColumns {
  name: string; // file name, for the exception
  columnNames: string[];
}

export function matchColumns(columns: readonly ColumnSpec[], ours: SideColumns, theirs: SideColumns, exceptions: Exception[]): MatchColumns {
  const matched = columns.filter((spec) => spec.match !== 'none');
  const pairs: [SideColumns, SideColumns][] = [[ours, theirs], [theirs, ours]];
  for (const [mine, other] of pairs) {
    const missing = matched.filter((spec) => mine.columnNames.includes(spec.column) && !other.columnNames.includes(spec.column));
    if (missing.length > 0) {
      const list = missing.map((spec) => spec.column).join(', ');
      exceptions.push({ code: 'I3', level: 'skip', source: mine.name, message: `column(s) ${list} only in this file; not used in matching` });
    }
  }

  const common = matched.filter((spec) => ours.columnNames.includes(spec.column) && theirs.columnNames.includes(spec.column));
  return {
    equal: common.filter((spec) => spec.match === 'equal').map((spec) => spec.column),
    similar: common.filter((spec) => spec.match === 'similar').map((spec) => spec.column),
  };
}
