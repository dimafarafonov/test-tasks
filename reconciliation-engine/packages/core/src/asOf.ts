import { Temporal } from 'temporal-polyfill';
import type { Issue } from './issue.ts';

// A3: no fraction or 1–9 fraction digits, UTC "Z" only.
const AS_OF_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

export type AsOfResult =
  | { ok: true; instant: Temporal.Instant; text: string }
  | { ok: false; issue: Issue };

export function parseAsOf(input: string): AsOfResult {
  const fail = (): AsOfResult => ({
    ok: false,
    issue: {
      code: 'C2',
      level: 'fatal',
      source: '--as-of',
      message: `invalid value "${input}"; expected YYYY-MM-DDTHH:MM:SS[.sss]Z`,
    },
  });
  if (!AS_OF_PATTERN.test(input)) return fail();
  try {
    const instant = Temporal.Instant.from(input);
    // Filter uses full precision; echo is always .sssZ (X2).
    return { ok: true, instant, text: instant.toString({ fractionalSecondDigits: 3 }) };
  } catch {
    return fail(); // e.g. month 13
  }
}
