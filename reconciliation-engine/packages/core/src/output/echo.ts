import type { EchoRecord, TxRecord } from '../types.ts';

// X3: no memo. X4: schema columns follow in schema order (record.fields keeps it).
export function echo(record: TxRecord): EchoRecord {
  return { id: record.id, amount: record.amountText, timestamp: record.timestampText, ...record.fields };
}
