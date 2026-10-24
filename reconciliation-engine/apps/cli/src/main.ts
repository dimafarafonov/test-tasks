import { DEFAULT_THRESHOLDS } from '@recon/core';

// Placeholder until the CLI step: args, file IO, Issue output.
export async function main(argv: string[]): Promise<number> {
  if (argv[0] !== 'run') {
    process.stderr.write('usage: recon run --ours F --theirs F --manual F --as-of T --output F\n');
    return 1;
  }
  process.stderr.write(`recon run: not implemented (thresholds ${JSON.stringify(DEFAULT_THRESHOLDS)})\n`);
  return 1;
}
