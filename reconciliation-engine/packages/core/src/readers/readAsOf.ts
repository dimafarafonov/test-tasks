import { Temporal } from 'temporal-polyfill';
import type { Exception } from '../exceptions.ts';

// A3: no fraction or 1–9 fraction digits, UTC "Z" only.
const AS_OF_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

// instant: full precision, for the filter. text: always .sssZ, for the report (X2).
export interface AsOf {
  instant: Temporal.Instant;
  text: string;
}

export type AsOfResult = ({ ok: true } & AsOf) | { ok: false; exception: Exception };

export function readAsOf(input: string): AsOfResult {
  const fail = (): AsOfResult => ({
    ok: false,
    exception: {
      code: 'C2',
      level: 'fatal',
      source: '--as-of',
      message: `invalid value "${input}"; expected YYYY-MM-DDTHH:MM:SS[.sss]Z`,
    },
  });
  if (!AS_OF_PATTERN.test(input)) return fail();
  try {
    const instant = Temporal.Instant.from(input);
    // Filter uses full precision; the report always shows .sssZ (X2).
    return { ok: true, instant, text: instant.toString({ fractionalSecondDigits: 3 }) };
  } catch {
    return fail(); // e.g. month 13
  }
}
