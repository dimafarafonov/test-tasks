import type { Writer } from './writer.ts';

// report.json (brief I/O contract). Two-space indent, newline at the end.
export const writeJson: Writer = (report) => `${JSON.stringify(report, null, 2)}\n`;
