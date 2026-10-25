import { Temporal } from 'temporal-polyfill';
import type { FieldSpec } from '../config/fields.ts';
import type { Issue } from '../issue.ts';
import { D, decimalKey } from '../lib/decimal.ts';
import type { FieldValue, TxRecord } from '../types.ts';
import { DECIMAL_PATTERN, INTEGER_PATTERN, readTable, type CsvSource, type Row } from './table.ts';

const CORE_COLUMNS = ['id', 'amount', 'timestamp', 'memo'] as const;

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
