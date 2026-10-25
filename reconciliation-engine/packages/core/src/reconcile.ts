import { runEngine, type EngineOptions } from './engine.ts';
import { DEFAULT_COLUMNS } from './settings/columns.ts';
import type { Exception } from './exceptions.ts';
import { readerFor } from './readers/index.ts';
import { readAsOf } from './readers/readAsOf.ts';
import type { Report, Source } from './types.ts';

export interface ReconcileInput {
  ours: Source;
  theirs: Source;
  manual: Source;
  asOf: string;
}

export type ReconcileOptions = EngineOptions;

// report is null when any exception is fatal.
export interface ReconcileResult {
  report: Report | null;
  exceptions: Exception[];
}

// Read the sources (reader by file extension), then run the engine.
export function reconcile(input: ReconcileInput, options: ReconcileOptions = {}): ReconcileResult {
  const columns = options.columns ?? DEFAULT_COLUMNS;
  const asOf = readAsOf(input.asOf);
  const ours = readerFor(input.ours.name).transactions(input.ours, columns);
  const theirs = readerFor(input.theirs.name).transactions(input.theirs, columns);
  const manual = readerFor(input.manual.name).manual(input.manual);

  const exceptions = [...(asOf.ok ? [] : [asOf.exception]), ...ours.exceptions, ...theirs.exceptions, ...manual.exceptions];
  if (!asOf.ok || exceptions.some((exception) => exception.level === 'fatal')) return { report: null, exceptions };

  const result = runEngine(
    {
      ours: { name: input.ours.name, records: ours.records, columnNames: ours.columnNames },
      theirs: { name: input.theirs.name, records: theirs.records, columnNames: theirs.columnNames },
      manual: { name: input.manual.name, pins: manual.pins },
      asOf,
    },
    { ...options, columns },
  );
  return { report: result.report, exceptions: [...exceptions, ...result.exceptions] };
}
