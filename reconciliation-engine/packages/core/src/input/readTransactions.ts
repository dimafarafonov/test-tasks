import { Temporal } from 'temporal-polyfill';
import type { ColumnSpec } from '../settings/columns.ts';
import type { Exception } from '../exceptions.ts';
import { D, decimalKey } from '../helpers/numbers.ts';
import type { ColumnValue, Transaction } from '../types.ts';
import { DECIMAL_PATTERN, INTEGER_PATTERN, readCsv, type CsvSource, type Row } from './readCsv.ts';

const CORE_COLUMNS = ['id', 'amount', 'timestamp', 'memo'] as const;

export interface TransactionsResult {
  records: Transaction[];
  exceptions: Exception[];
  columnNames: string[]; // schema columns found in the header (I2)
}

// A schema column and the header name it is read from (the column itself or an alias).
interface ColumnSource {
  spec: ColumnSpec;
  header: string;
}

export function readTransactions(source: CsvSource, specs: readonly ColumnSpec[]): TransactionsResult {
  const table = readCsv(source, CORE_COLUMNS);
  if (!table.ok) return { records: [], exceptions: [table.exception], columnNames: [] };

  // I2: each schema column counts on its own. The column name wins over an alias.
  const columns: ColumnSource[] = [];
  for (const spec of specs) {
    const header = [spec.column, ...(spec.aliases ?? [])].find((name) => table.header.includes(name));
    if (header !== undefined) columns.push({ spec, header });
  }

  const exceptions: Exception[] = [];
  const records: Transaction[] = [];
  const seen = new Set<string>();
  for (const row of table.rows) {
    const result = readRow(row, columns);
    if (typeof result === 'string') {
      const id = row.get('id')?.trim() || undefined;
      exceptions.push({ code: 'I8', level: 'skip', source: source.name, row: row.line, id, message: `row skipped: ${result}` });
      continue;
    }
    if (seen.has(result.id)) {
      exceptions.push({
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
  return { records, exceptions, columnNames: columns.map((c) => c.spec.column) };
}

// Returns the record, or the reason the row is bad (I8).
function readRow(row: Row, columns: readonly ColumnSource[]): Transaction | string {
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

  const record: Transaction = { id, row: row.line, amountText, amount: new D(amountText), timestampText, instant, memo, extra: {}, matchKeys: {} };
  for (const { spec, header } of columns) {
    const text = row.get(header)?.trim();
    if (text === undefined) return 'missing field(s)';
    const value = readValue(spec, text);
    if (value === undefined) return `bad ${spec.column} "${text}"`;
    record.extra[spec.column] = value.output;
    if (spec.match !== 'none') record.matchKeys[spec.column] = value.key;
  }
  return record;
}

// undefined when the text does not fit the type.
function readValue(spec: ColumnSpec, text: string): { output: ColumnValue; key: string } | undefined {
  switch (spec.type) {
    case 'text':
      return { output: text, key: text };
    case 'integer':
      return INTEGER_PATTERN.test(text) ? { output: Number(text), key: String(Number(text)) } : undefined;
    case 'decimal':
      return DECIMAL_PATTERN.test(text) ? { output: text, key: decimalKey(new D(text)) } : undefined;
  }
}
