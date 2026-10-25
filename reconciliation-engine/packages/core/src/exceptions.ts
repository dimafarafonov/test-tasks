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
