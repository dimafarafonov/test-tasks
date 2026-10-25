// DECISIONS I2, I3, I11. Extra columns besides id, amount, timestamp, memo. One row per column:
// parsing, matching and the unmatched echo all read this list. New column = new row.
//
// type:    text → trimmed string; integer → number in echo (X4); decimal → string in echo (X4).
// match:   equal   → must be equal in exact, rule_based and fuzzy (E1, E2).
//          similar → equal in exact and rule_based; similar text in fuzzy (F7).
//          none    → not used in matching, only echoed (R3: fx_rate).
// aliases: other header names for the same column (renamed column still read).
export type FieldType = 'text' | 'integer' | 'decimal';
export type FieldMatch = 'equal' | 'similar' | 'none';

export interface FieldSpec {
  column: string;
  type: FieldType;
  match: FieldMatch;
  aliases?: readonly string[];
}

// Order = echo order in the report (ex 3).
export const DEFAULT_FIELDS: readonly FieldSpec[] = Object.freeze([
  { column: 'currency', type: 'text', match: 'equal' },
  { column: 'quantity', type: 'integer', match: 'none' },
  { column: 'price_per_share', type: 'decimal', match: 'none' },
  { column: 'fx_rate', type: 'decimal', match: 'none' },
  { column: 'party_email', type: 'text', match: 'similar' },
]);
