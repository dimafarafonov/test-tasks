import type { EchoRecord, Transaction } from '../types.ts';

// X3: no memo. X4: schema columns follow in schema order (record.extra keeps it).
export function unmatchedEntry(record: Transaction): EchoRecord {
  return { id: record.id, amount: record.amountText, timestamp: record.timestampText, ...record.extra };
}
