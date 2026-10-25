import type { Exception } from '../exceptions.ts';
import type { Report } from '../types.ts';

export interface WriterOptions {
  exceptions?: Exception[]; // shown by writers for people (pretty); never part of report.json
  color?: boolean; // ANSI colors (terminal only)
  maxRows?: number; // rows per table; the rest is counted, not shown
}

// DECISIONS S6. One output format: report → text. New format = new file + one line in writers/index.ts.
export type Writer = (report: Report, options?: WriterOptions) => string;
