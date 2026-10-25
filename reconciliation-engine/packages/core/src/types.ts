import type { Temporal } from 'temporal-polyfill';
import type { D } from './helpers/numbers.ts';

export type Side = 'ours' | 'theirs';

export type ColumnValue = string | number;

export interface Transaction {
  id: string;
  row: number;
  amountText: string;
  amount: D;
  timestampText: string;
  instant: Temporal.Instant;
  memo: string;
  // Extra columns in the file (settings/columns.ts), in schema order. Values as in the report: trimmed text, integer as number.
  extra: Record<string, ColumnValue>;
  // Same columns, match != 'none' only: one text per value, so equal values compare equal ("1.0" = "1.00").
  matchKeys: Record<string, string>;
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

// Unmatched entry: input fields without memo (X3), then extra columns in the file (X4).
export interface EchoRecord {
  id: string;
  amount: string;
  timestamp: string;
  [column: string]: ColumnValue;
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
