import type { TxRecord } from '../types.ts';

// Plain code-unit order: same on every machine (no locale).
export const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const byId = (a: TxRecord, b: TxRecord): number => compareIds(a.id, b.id);
