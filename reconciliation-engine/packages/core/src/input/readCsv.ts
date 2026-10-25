import { parse } from 'csv-parse/sync';
import type { Exception } from '../exceptions.ts';

export interface CsvSource {
  name: string; // shown in exceptions, e.g. "ours.csv"
  text: string;
}

export const DECIMAL_PATTERN = /^[+-]?\d+(\.\d+)?$/;
export const INTEGER_PATTERN = /^[+-]?\d+$/;

export interface Row {
  line: number;
  get(column: string): string | undefined;
}

type CsvResult = { ok: true; header: string[]; rows: Row[] } | { ok: false; exception: Exception };

// I6: standard CSV parser. Header names trimmed; first column with a name wins.
export function readCsv(source: CsvSource, required: readonly string[]): CsvResult {
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
    return { ok: false, exception: { code: 'I6', level: 'fatal', source: source.name, message: `CSV syntax error: ${reason}` } };
  }

  const [first, ...data] = parsed;
  const header = (first?.record ?? []).map((name) => name.trim());
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return {
      ok: false,
      exception: { code: 'I2', level: 'fatal', source: source.name, message: `missing column(s): ${missing.join(', ')}` },
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
