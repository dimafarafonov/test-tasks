import { parse } from 'csv-parse/sync';
import { Temporal } from 'temporal-polyfill';
import { D } from './decimal.ts';
import type { Issue } from './issue.ts';
import type { ExtendedFields, Pin, TxRecord } from './types.ts';

export interface CsvSource {
  name: string; // shown in issues, e.g. "ours.csv"
  text: string;
}

const CORE_COLUMNS = ['id', 'amount', 'timestamp', 'memo'] as const;
const EXTENDED_COLUMNS = ['currency', 'quantity', 'price_per_share', 'fx_rate', 'party_email'] as const;
const MANUAL_COLUMNS = ['ours_id', 'theirs_id'] as const;

const DECIMAL_PATTERN = /^[+-]?\d+(\.\d+)?$/;
const INTEGER_PATTERN = /^[+-]?\d+$/;

interface Row {
  line: number;
  get(column: string): string | undefined;
}

type TableResult = { ok: true; header: string[]; rows: Row[] } | { ok: false; issue: Issue };

// I6: standard CSV parser. Header names trimmed; first column with a name wins.
function readTable(source: CsvSource, required: readonly string[]): TableResult {
  let parsed: { record: string[]; info: { lines: number } }[];
  try {
    parsed = parse(source.text, {
      bom: true,
      info: true,
      relax_column_count: true,
      skip_empty_lines: true,
    }) as unknown as typeof parsed;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, issue: { code: 'I6', level: 'fatal', source: source.name, message: `CSV syntax error: ${reason}` } };
  }

  const [first, ...data] = parsed;
  const header = (first?.record ?? []).map((name) => name.trim());
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return {
      ok: false,
      issue: { code: 'I2', level: 'fatal', source: source.name, message: `missing column(s): ${missing.join(', ')}` },
    };
  }

  const index = new Map<string, number>();
  header.forEach((name, i) => {
    if (!index.has(name)) index.set(name, i);
  });
  const rows = data.map(({ record, info }) => ({
    line: info.lines,
    get: (column: string) => {
      const i = index.get(column);
      return i === undefined ? undefined : record[i];
    },
  }));
  return { ok: true, header, rows };
}

export interface SideResult {
  records: TxRecord[];
  issues: Issue[];
}

export function parseSide(source: CsvSource): SideResult {
  const table = readTable(source, CORE_COLUMNS);
  if (!table.ok) return { records: [], issues: [table.issue] };

  const issues: Issue[] = [];
  const present = EXTENDED_COLUMNS.filter((column) => table.header.includes(column));
  const extended = present.length === EXTENDED_COLUMNS.length;
  if (present.length > 0 && !extended) {
    issues.push({
      code: 'I2',
      level: 'skip',
      source: source.name,
      message: `partial extended shape (${present.join(', ')}); extra columns ignored, simple shape used`,
    });
  }

  const records: TxRecord[] = [];
  const seen = new Set<string>();
  for (const row of table.rows) {
    const result = parseRecord(row, extended);
    if (typeof result === 'string') {
      const id = row.get('id')?.trim() || undefined;
      issues.push({ code: 'I8', level: 'skip', source: source.name, row: row.line, id, message: `row skipped: ${result}` });
      continue;
    }
    if (seen.has(result.id)) {
      issues.push({
        code: 'I7',
        level: 'skip',
        source: source.name,
        row: row.line,
        id: result.id,
        message: 'duplicate id; first row kept, this row skipped',
      });
      continue;
    }
    seen.add(result.id);
    records.push(result);
  }
  return { records, issues };
}

// Returns the record, or the reason the row is bad (I8).
function parseRecord(row: Row, extended: boolean): TxRecord | string {
  const id = row.get('id')?.trim();
  const amountText = row.get('amount')?.trim();
  const timestampText = row.get('timestamp')?.trim();
  const memo = row.get('memo');
  if (id === undefined || amountText === undefined || timestampText === undefined || memo === undefined) {
    return 'missing field(s)';
  }
  if (id === '') return 'empty id';
  if (!DECIMAL_PATTERN.test(amountText)) return `bad amount "${amountText}"`;

  let instant: Temporal.Instant;
  try {
    instant = Temporal.Instant.from(timestampText);
  } catch {
    return `bad timestamp "${timestampText}"`;
  }

  const record: TxRecord = { id, row: row.line, amountText, amount: new D(amountText), timestampText, instant, memo };
  if (!extended) return record;

  const ext = parseExtended(row);
  if (typeof ext === 'string') return ext;
  record.ext = ext;
  return record;
}

function parseExtended(row: Row): ExtendedFields | string {
  const [currency, quantityText, pricePerShare, fxRate, partyEmail] = EXTENDED_COLUMNS.map((column) => row.get(column)?.trim());
  if (
    currency === undefined ||
    quantityText === undefined ||
    pricePerShare === undefined ||
    fxRate === undefined ||
    partyEmail === undefined
  ) {
    return 'missing field(s)';
  }
  if (!INTEGER_PATTERN.test(quantityText)) return `bad quantity "${quantityText}"`;
  if (!DECIMAL_PATTERN.test(pricePerShare)) return `bad price_per_share "${pricePerShare}"`;
  if (!DECIMAL_PATTERN.test(fxRate)) return `bad fx_rate "${fxRate}"`;
  return { currency, quantity: Number(quantityText), pricePerShare, fxRate, partyEmail };
}

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
