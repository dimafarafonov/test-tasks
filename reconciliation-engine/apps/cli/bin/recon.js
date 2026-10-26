#!/usr/bin/env node
// Plain JS on purpose: runs on any Node, so old versions get a clear message (DECISIONS S2).
const REQUIRED_MAJOR = 24;
const major = Number(process.versions.node.split('.')[0]);

if (major < REQUIRED_MAJOR) {
  process.stderr.write(
    `recon: Node.js >= ${REQUIRED_MAJOR} required, found ${process.versions.node}.\n`,
  );
  process.exit(1);
}

const { main } = await import('../src/main.ts');
process.exitCode = await main(process.argv.slice(2));
