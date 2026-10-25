import type { FieldSpec } from '../config/fields.ts';
import type { Issue } from '../issue.ts';
import type { TxRecord } from '../types.ts';

// Schema columns (config/fields.ts) that both sides have, by match rule.
export interface MatchColumns {
  equal: string[];
  similar: string[];
}

// E1, E2, Q10: party-identity fields equal.
export function sameParty(ours: TxRecord, theirs: TxRecord, columns: readonly string[]): boolean {
  return columns.every((column) => ours.keys[column] === theirs.keys[column]);
}

// I3: match columns that both sides have. A match column on one side only is not compared; warn,
// because a renamed column would else turn the check off without notice.
export interface SideColumns {
  name: string; // file name, for the issue
  columns: string[];
}

export function matchColumns(fields: readonly FieldSpec[], ours: SideColumns, theirs: SideColumns, issues: Issue[]): MatchColumns {
  const matched = fields.filter((spec) => spec.match !== 'none');
  const pairs: [SideColumns, SideColumns][] = [[ours, theirs], [theirs, ours]];
  for (const [mine, other] of pairs) {
    const missing = matched.filter((spec) => mine.columns.includes(spec.column) && !other.columns.includes(spec.column));
    if (missing.length > 0) {
      const list = missing.map((spec) => spec.column).join(', ');
      issues.push({ code: 'I3', level: 'skip', source: mine.name, message: `column(s) ${list} only in this file; not used in matching` });
    }
  }

  const common = matched.filter((spec) => ours.columns.includes(spec.column) && theirs.columns.includes(spec.column));
  return {
    equal: common.filter((spec) => spec.match === 'equal').map((spec) => spec.column),
    similar: common.filter((spec) => spec.match === 'similar').map((spec) => spec.column),
  };
}
