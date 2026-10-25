import type { Exception } from '../exceptions.ts';
import type { Pin } from '../types.ts';
import { readCsv, type CsvSource } from './readCsv.ts';

const MANUAL_COLUMNS = ['ours_id', 'theirs_id'] as const;

export interface ManualResult {
  pins: Pin[];
  exceptions: Exception[];
}

// Syntax only. Pin checks against records (M1–M4) run in reconcile.
export function readManual(source: CsvSource): ManualResult {
  const table = readCsv(source, MANUAL_COLUMNS);
  if (!table.ok) return { pins: [], exceptions: [table.exception] };

  const pins: Pin[] = [];
  const exceptions: Exception[] = [];
  for (const row of table.rows) {
    const oursId = row.get('ours_id')?.trim();
    const theirsId = row.get('theirs_id')?.trim();
    if (!oursId || !theirsId) {
      exceptions.push({ code: 'I8', level: 'skip', source: source.name, row: row.line, message: 'pin skipped: empty or missing id' });
      continue;
    }
    pins.push({ oursId, theirsId, row: row.line });
  }
  return { pins, exceptions };
}
