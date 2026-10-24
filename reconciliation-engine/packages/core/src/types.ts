import type { Temporal } from 'temporal-polyfill';
import type { D } from './decimal.ts';

export type Side = 'ours' | 'theirs';

// Extended shape (Q6): all five fields or none. Texts are trimmed input, echoed as-is.
export interface ExtendedFields {
  currency: string;
  quantity: number;
  pricePerShare: string;
  fxRate: string;
  partyEmail: string;
}

export interface TxRecord {
  id: string;
  row: number;
  amountText: string;
  amount: D;
  timestampText: string;
  instant: Temporal.Instant;
  memo: string;
  ext?: ExtendedFields;
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

// Unmatched echo: input fields without memo (X3), quantity as number (X4).
export interface EchoRecord {
  id: string;
  amount: string;
  timestamp: string;
  currency?: string;
  quantity?: number;
  price_per_share?: string;
  fx_rate?: string;
  party_email?: string;
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
