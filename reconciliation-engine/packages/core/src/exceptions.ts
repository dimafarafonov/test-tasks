// DECISIONS "Exception model". Core collects exceptions; it never prints or throws for bad input.
export type ExceptionLevel = 'fatal' | 'skip';

export interface Exception {
  code: string; // DECISIONS ID, e.g. "I7", "M1", "C1"
  level: ExceptionLevel;
  source: string; // "ours.csv", "--as-of", ...
  row?: number;
  id?: string;
  message: string;
}

// One line for people: "skip M1 manual.csv row 3: pin o-9,t-9 skipped: ours id o-9 not found".
export function formatException(exception: Exception): string {
  const where = [exception.source, exception.row !== undefined ? `row ${exception.row}` : '', exception.id ? `id ${exception.id}` : '']
    .filter(Boolean)
    .join(' ');
  return `${exception.level} ${exception.code} ${where}: ${exception.message}`;
}
