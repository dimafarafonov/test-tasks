import type { Exception } from '../exceptions.ts';
import type { ColumnSpec } from '../settings/columns.ts';
import type { Pin, Source, Transaction } from '../types.ts';

export interface TransactionsResult {
  records: Transaction[];
  exceptions: Exception[];
  columnNames: string[]; // extra columns found in the source (I2)
}

export interface ManualResult {
  pins: Pin[];
  exceptions: Exception[];
}

// DECISIONS S6. One input format. It turns a source into records and pins; the engine never sees the format.
// New format = new folder next to csv/ + one line in readers/index.ts.
export interface Reader {
  transactions(source: Source, columns: readonly ColumnSpec[]): TransactionsResult;
  manual(source: Source): ManualResult;
}
