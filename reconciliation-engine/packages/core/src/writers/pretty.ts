import { formatException } from '../exceptions.ts';
import type { MatchKind, Report } from '../types.ts';
import type { Writer } from './writer.ts';

// DECISIONS C5. Report as text tables for a terminal (brief: "pretty-printed CLI").

const DEFAULT_MAX_ROWS = 50;

const ANSI = { bold: 1, red: 31, green: 32, yellow: 33, magenta: 35, cyan: 36, dim: 2 } as const;
type Style = keyof typeof ANSI;

const KIND_STYLE: Record<MatchKind, Style> = { manual: 'magenta', exact: 'green', rule_based: 'cyan', fuzzy: 'yellow' };

export const writePretty: Writer = (report, options = {}) => {
  const paint = (text: string, style: Style) => (options.color ? `\x1b[${ANSI[style]}m${text}\x1b[0m` : text);
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const s = report.summary;
  const lines: string[] = [];

  lines.push(paint(`Reconciliation report · as of ${report.as_of}`, 'bold'), '');

  lines.push(paint('Summary', 'bold'));
  lines.push(
    ...table(
      [
        [paint('manual', KIND_STYLE.manual), String(s.matched_manual)],
        [paint('exact', KIND_STYLE.exact), String(s.matched_exact)],
        [paint('rule_based', KIND_STYLE.rule_based), String(s.matched_rule_based)],
        [paint('fuzzy', KIND_STYLE.fuzzy), String(s.matched_fuzzy)],
        [paint('unmatched', 'red'), `ours ${s.unmatched_ours} · theirs ${s.unmatched_theirs}`],
      ],
      [],
    ),
    '',
  );

  lines.push(paint('Matches', 'bold'));
  lines.push(
    ...rows(
      ['KIND', 'OURS', 'THEIRS', 'AMOUNT DIFF', 'TIME DIFF (s)'],
      report.matches.map((m) => [paint(m.kind, KIND_STYLE[m.kind]), m.ours_id, m.theirs_id, m.amount_diff, m.timestamp_diff_seconds]),
      [3, 4],
      maxRows,
      paint,
    ),
    '',
  );

  for (const [title, entries] of [['Unmatched ours', report.unmatched_ours], ['Unmatched theirs', report.unmatched_theirs]] as const) {
    // Columns: every key the entries have, in first-seen order (simple and extended shapes).
    const keys = [...new Set(entries.flatMap((entry) => Object.keys(entry)))];
    lines.push(paint(title, 'bold'));
    lines.push(
      ...rows(
        keys.map((key) => key.toUpperCase().replace(/_/g, ' ')),
        entries.map((entry) => keys.map((key, i) => (i === 0 ? paint(String(entry[key] ?? ''), 'red') : String(entry[key] ?? '')))),
        keys.flatMap((key, i) => (key === 'amount' ? [i] : [])),
        maxRows,
        paint,
      ),
      '',
    );
  }

  if (options.exceptions && options.exceptions.length > 0) {
    lines.push(paint(`Exceptions (${options.exceptions.length})`, 'bold'));
    lines.push(...options.exceptions.map((exception) => `  ${paint(formatException(exception), 'yellow')}`), '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
};

// Table with a header, at most maxRows rows, then "… N more".
function rows(
  header: string[],
  body: string[][],
  rightAligned: number[],
  maxRows: number,
  paint: (text: string, style: Style) => string,
): string[] {
  if (body.length === 0) return [`  ${paint('(none)', 'dim')}`];
  const shown = body.slice(0, maxRows);
  const lines = table([header.map((h) => paint(h, 'dim')), ...shown], rightAligned);
  if (body.length > shown.length) lines.push(`  ${paint(`… ${body.length - shown.length} more (use --all)`, 'dim')}`);
  return lines;
}

// Pads cells to the widest visible text in each column (ANSI codes do not count).
function table(cells: string[][], rightAligned: number[]): string[] {
  const visible = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, '').length;
  const widths: number[] = [];
  for (const row of cells) row.forEach((cell, i) => (widths[i] = Math.max(widths[i] ?? 0, visible(cell))));
  return cells.map((row) => {
    const padded = row.map((cell, i) => {
      const gap = ' '.repeat(widths[i]! - visible(cell));
      return rightAligned.includes(i) ? gap + cell : cell + gap;
    });
    return `  ${padded.join('   ')}`.trimEnd();
  });
}
