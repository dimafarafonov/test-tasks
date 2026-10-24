// README "Issue model". Core collects issues; it never prints or throws for bad input.
export type IssueLevel = 'fatal' | 'skip';

export interface Issue {
  code: string; // README ID, e.g. "I7", "M1", "C1"
  level: IssueLevel;
  source: string; // "ours.csv", "--as-of", ...
  row?: number;
  id?: string;
  message: string;
}
