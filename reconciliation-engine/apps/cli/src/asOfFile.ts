import { parseAsOf, type Issue } from '@recon/core';

export type AsOfFileResult = { ok: true; value: string } | { ok: false; issue: Issue };

// as_of.txt: one value. BOM, spaces and empty lines around it are ignored.
// The value itself is checked by core parseAsOf (A3).
export function parseAsOfFile(name: string, text: string): AsOfFileResult {
  const fail = (message: string): AsOfFileResult => ({
    ok: false,
    issue: { code: 'C2', level: 'fatal', source: name, message },
  });

  const lines = text.replace(/^﻿/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return fail('file is empty; expected one as_of value');
  if (lines.length > 1) return fail(`expected one as_of value, found ${lines.length} lines`);

  const value = lines[0]!;
  const parsed = parseAsOf(value);
  if (!parsed.ok) return fail(parsed.issue.message);
  return { ok: true, value };
}
