import type { Temporal } from 'temporal-polyfill';
import type { D } from './lib/decimal.ts';

export type Side = 'ours' | 'theirs';

export type FieldValue = string | number;

export interface TxRecord {
  id: string;
  row: number;
  amountText: string;
  amount: D;
  timestampText: string;
  instant: Temporal.Instant;
  memo: string;
  // Schema columns in the file (config/fields.ts), in schema order. Values as echoed: trimmed text, integer as number.
  fields: Record<string, FieldValue>;
  // Same columns, match != 'none' only: one text per value, so equal values compare equal ("1.0" = "1.00").
  keys: Record<string, string>;
}

export interface Pin {
  oursId: string;
  theirsId: string;
  row: number;
}

export type MatchKind = 'manual' | 'exact' | 'rule_based' | 'fuzzy';

export interface Match {
  kind: MatchKind;
  ours_id: string;
  theirs_id: string;
  amount_diff: string;
  timestamp_diff_seconds: string;
}

// Unmatched echo: input fields without memo (X3), then schema columns in the file (X4).
export interface EchoRecord {
  id: string;
  amount: string;
  timestamp: string;
  [column: string]: FieldValue;
}

export interface Summary {
  matched_manual: number;
  matched_exact: number;
  matched_rule_based: number;
  matched_fuzzy: number;
  unmatched_ours: number;
  unmatched_theirs: number;
}

export interface Report {
  as_of: string;
  summary: Summary;
  matches: Match[];
  unmatched_ours: EchoRecord[];
  unmatched_theirs: EchoRecord[];
}
