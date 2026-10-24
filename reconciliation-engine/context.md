# context.md — project status between chats

Update at the end of each session.

## Status (2026-10-24)

- Phase: coding. Engine (manual, exact, rule_based, fuzzy) + CLI done. Nothing committed yet.
- All examples pass (4 given + generated `example_5_manual_1k`, `example_big` 10k). 30 tests green. Typecheck clean.
- Stack (CLI only): Node.js >= 24 + TypeScript, npm workspaces. `temporal-polyfill`, `decimal.js`, `csv-parse`. Backend / frontend stack open.
- `README.md`: Requirements (Q1–Q19, X1–X8) + Exceptions, all `DECIDED`. Thresholds in README "Thresholds config".
- Not-happy path: Issue model (`fatal` → exit 1 listing all; `skip` → item skipped, exit 0, printed to stderr).

## Next step

- Viewer (stack TBD): CLI pretty-print minimum, web UI recommended. User was offered `recon view REPORT.json`; not decided.
- Option: 1k example with rule_based + fuzzy rows too (offered, not decided).
- README final sections: install / run, architecture + why, next day, AI usage.
- Next day list so far: perf (index candidates by amount/time; now O(n·m), 10k rows ≈ 15 s — user said "not now"), FX conversion (R3).

## Key findings

- Sides share no ID. Pair by data: amount, timestamp, party fields (extended shape). Memo only in fuzzy.
- `as_of` = filter (`timestamp <= as_of`), not run date.
- `manual.csv` = operator-forced pairs. Run first; consumes both records.
- Unmatched echo omits `memo` (examples 2, 3).
- Example 3: o-003/t-103 same amount + time, different email + currency → unmatched (E1, E2).
- Example 3 data follows `amount = quantity × price_per_share × fx_rate`. t-102 "fx-drift" matched rule-based.
- Hidden tests may show more exceptions than listed.

## User decisions

- Talk style: see `conversation.md`. Very short answers.
- README split: Requirements vs Exceptions. New behavior → new README row.
- Stack + architecture: README `Stack` (S1–S5).
- R3: no FX conversion. Conversion → next day.
- C3: `--as-of` takes a value or a path to a file with one value (file parsed as a whole).
- C4: `recon run DIR` short form (DIR/ours.csv, theirs.csv, manual.csv, as_of.txt → DIR/report.json; flags override).
- CLI prints run time after each run (not in report.json).
- Test names: plain words + `(README code)`, readable without README or AI.
- `npm run doctor` for setup checks.

## Code layout

- Root `package.json`: workspaces, `engines >=24`, `bin recon → apps/cli/bin/recon.js`. Scripts: `test`, `typecheck`, `examples`, `generate:example`, `doctor`.
- `apps/cli/bin/recon.js`: plain JS, Node version check, then imports `src/main.ts`.
- `apps/cli/src/main.ts`: parseArgs, `run DIR` defaults, read files, collect C1/C2, call core, write JSON, issues → stderr, summary + time → stdout.
- `apps/cli/src/asOfFile.ts`: `parseAsOfFile` (BOM, blank lines, one value, C2).
- `packages/core/src`: `csv.ts` (I2/I6/I7/I8), `asOf.ts` (A3/C2), `match.ts` (generic `runTier`: score all free pairs, sort, greedy), `reconcile.ts` (pins M1–M4, tiers, report), `similarity.ts` (OSA Damerau-Levenshtein), `decimal.ts`, `config.ts`, `issue.ts`, `types.ts`.
- Tests: `packages/core/test/*.test.ts`, `apps/cli/test/examples.test.ts` (runs bin on every `examples/*/`).
- `scripts/run-examples.ts` (`npm run examples [-- NAME ...]`, output `out/`), `scripts/generate-example.ts` (`npm run generate:example -- ROWS [NAME]`; expected report from data design, fixed seed; as_of = end of last record's day), `scripts/doctor.js`.
- `.gitignore`: `node_modules/`, `out/`, `examples/*/report.json`, `.DS_Store`.

## Environment notes

- Node 24.22.1 via nvm; `recon` linked under it (`npm link`).
- New terminals in VS Code / Claude app showed Node 22: apps keep the PATH from their start; nvm keeps an nvm Node already on PATH. Fix: restart app (Cmd+Q) or `nvm use default --silent` in `~/.zshrc` after nvm loads. nvm default is now 24.
