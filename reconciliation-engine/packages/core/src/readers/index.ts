import { csvReader } from './csv/index.ts';
import type { Reader } from './reader.ts';

// File extension → reader (DECISIONS S6). New format = one line.
export const READERS: Readonly<Record<string, Reader>> = Object.freeze({
  csv: csvReader,
});

// Reader for a source name. Unknown or no extension → csv, so any file name works as before (brief contract).
export function readerFor(name: string): Reader {
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  return READERS[extension] ?? csvReader;
}
