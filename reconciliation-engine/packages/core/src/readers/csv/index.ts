import type { Reader } from '../reader.ts';
import { readManual } from './readManual.ts';
import { readTransactions } from './readTransactions.ts';

export const csvReader: Reader = {
  transactions: readTransactions,
  manual: readManual,
};
