import { parse } from 'csv-parse/sync';
import { Temporal } from 'temporal-polyfill';
import { D, decimalKey } from './decimal.ts';
import type { Issue } from './issue.ts';
import type { FieldSpec } from './fields.ts';
import type { FieldValue, Pin, TxRecord } from './types.ts';

export interface CsvSource {
  name: string; // shown in issues, e.g. "ours.csv"
  text: string;
}

const CORE_COLUMNS = ['id', 'amount', 'timestamp', 'memo'] as const;
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
  columns: string[]; // schema columns found in the header (I2)
}

// A schema column and the header name it is read from (the column itself or an alias).
interface ColumnSource {
  spec: FieldSpec;
  header: string;
}

export function parseSide(source: CsvSource, specs: readonly FieldSpec[]): SideResult {
  const table = readTable(source, CORE_COLUMNS);
  if (!table.ok) return { records: [], issues: [table.issue], columns: [] };

  // I2: each schema column counts on its own. The column name wins over an alias.
  const columns: ColumnSource[] = [];
  for (const spec of specs) {
    const header = [spec.column, ...(spec.aliases ?? [])].find((name) => table.header.includes(name));
    if (header !== undefined) columns.push({ spec, header });
  }

  const issues: Issue[] = [];
  const records: TxRecord[] = [];
  const seen = new Set<string>();
  for (const row of table.rows) {
    const result = parseRecord(row, columns);
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
  return { records, issues, columns: columns.map((c) => c.spec.column) };
}

// Returns the record, or the reason the row is bad (I8).
function parseRecord(row: Row, columns: readonly ColumnSource[]): TxRecord | string {
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

  const record: TxRecord = { id, row: row.line, amountText, amount: new D(amountText), timestampText, instant, memo, fields: {}, keys: {} };
  for (const { spec, header } of columns) {
    const text = row.get(header)?.trim();
    if (text === undefined) return 'missing field(s)';
    const value = parseField(spec, text);
    if (value === undefined) return `bad ${spec.column} "${text}"`;
    record.fields[spec.column] = value.echo;
    if (spec.match !== 'none') record.keys[spec.column] = value.key;
  }
  return record;
}

// undefined when the text does not fit the type.
function parseField(spec: FieldSpec, text: string): { echo: FieldValue; key: string } | undefined {
  switch (spec.type) {
    case 'text':
      return { echo: text, key: text };
    case 'integer':
      return INTEGER_PATTERN.test(text) ? { echo: Number(text), key: String(Number(text)) } : undefined;
    case 'decimal':
      return DECIMAL_PATTERN.test(text) ? { echo: text, key: decimalKey(new D(text)) } : undefined;
  }
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
