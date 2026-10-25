import type { Issue } from '../issue.ts';
import type { Pin } from '../types.ts';
import { readTable, type CsvSource } from './table.ts';

const MANUAL_COLUMNS = ['ours_id', 'theirs_id'] as const;

export interface ManualResult {
  pins: Pin[];
  issues: Issue[];
}

// Syntax only. Pin checks against records (M1–M4) run in reconcile.
export function parseManual(source: CsvSource): ManualResult {
  const table = readTable(source, MANUAL_COLUMNS);
  if (!table.ok) return { pins: [], issues: [table.issue] };

  const pins: Pin[] = [];
  const issues: Issue[] = [];
  for (const row of table.rows) {
    const oursId = row.get('ours_id')?.trim();
    const theirsId = row.get('theirs_id')?.trim();
    if (!oursId || !theirsId) {
      issues.push({ code: 'I8', level: 'skip', source: source.name, row: row.line, message: 'pin skipped: empty or missing id' });
      continue;
    }
    pins.push({ oursId, theirsId, row: row.line });
  }
  return { pins, issues };
}
