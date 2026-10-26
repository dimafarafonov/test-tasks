import { writeJson } from './json.ts';
import { writePretty } from './pretty.ts';
import type { Writer } from './writer.ts';

// Output format name → writer (DECISIONS S6). New format = one line.
export const WRITERS: Readonly<Record<string, Writer>> = Object.freeze({
  json: writeJson,
  pretty: writePretty,
});
