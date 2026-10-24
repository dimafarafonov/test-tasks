# context.md — project status between chats

Update at the end of each session.

## Status

- Phase: coding. Engine + CLI done, all 4 examples pass, 25 tests green (2026-10-24). Nothing committed yet.
- Stack (CLI only): Node.js >= 24 + TypeScript. Monorepo in this folder. `temporal-polyfill` (timestamps), `decimal.js` (amounts). Backend / frontend stack open, may differ.
- `README.md`: Requirements (Q1–Q19, X1–X8) + Exceptions. All Exceptions `DECIDED`. Thresholds in README "Thresholds config".
- Goal for thresholds: more automatic matches (loosest values the examples allow).
- Not-happy path: generic Issue model (`fatal` → exit 1 listing all; `skip` → item skipped, exit 0, shown in console). See README "Issue model".

## Key findings

- Sides share no ID. Pair by data: amount, timestamp, party fields (extended shape). Memo only in fuzzy.
- `as_of` = filter (`timestamp <= as_of`), not run date.
- `manual.csv` = operator-forced pairs. Run first; consumes both records.
- Unmatched echo omits `memo` (examples 2, 3).
- Example 3: o-003/t-103 same amount + time, different email + currency → unmatched. Both now blocking (E2 = currency is identity).
- Example 3 data follows `amount = quantity × price_per_share × fx_rate` (all 8 records). t-102 "fx-drift": fx 1.000001 → amount +0.01, matched rule-based.
- Examples use only ms timestamps (3 fraction digits).
- Rule-based in examples: amount diff 0.01, time diff 0.5 s. Exact thresholds unknown.
- Fuzzy (optional): string distance on memo / party_email. Candidate: Damerau-Levenshtein, normalized by length.
- Hidden tests may show more exceptions than listed.

## User decisions

- Talk style: see `conversation.md`. User wants fewer words.
- No code until user says so.
- README split: Requirements vs Exceptions.
- Stack + architecture: see README `Stack` (S1–S4).
- R3: no FX conversion. Different currency → no auto-match; operator can pin. Conversion → "next day" in README.

## Next step

- Node 24.22.1 via nvm; `recon` linked under it.
- Build order: ~~scaffold~~ → ~~core~~ → ~~CLI + Issue output~~ → ~~examples check~~ → ~~fuzzy~~ → viewer (stack TBD) → README install / architecture / next day / AI usage.

## Code layout

- Root `package.json`: npm workspaces (S5), `engines >=24`, `bin recon → apps/cli/bin/recon.js`.
- `apps/cli/bin/recon.js`: plain JS, version check, then imports `src/main.ts`.
- `apps/cli/src/main.ts`: parseArgs, read files, collect C1/C2, call core, write JSON, print issues to stderr + summary to stdout.
- `packages/core/src`: `csv.ts` (parse sides + manual, I2/I6/I7/I8), `asOf.ts` (A3/C2), `match.ts` (generic `runTier`: score all free pairs, sort, greedy; exact/rule/fuzzy scorers), `reconcile.ts` (pins M1–M4, tiers, report), `similarity.ts` (OSA Damerau-Levenshtein), `decimal.ts`, `config.ts`, `issue.ts`, `types.ts`.
- Tests: `packages/core/test/*.test.ts`, `apps/cli/test/examples.test.ts` (runs bin on `examples/`, copied from candidate folder).
- `npm run typecheck` (TS, noEmit). `npm test` = `node --test`.
- New README rows: I10, F7, F8, C3 (`--as-of` value or file), C4 (`recon run DIR`).
- CLI prints run time after each run. `npm run examples [-- NAME ...]` runs examples; `npm run generate:example -- ROWS [NAME]` builds big examples (expected report from data design).
- Test names: plain words + `(README code)`.
- Perf: matching compares every pair (O(n·m)). 10k rows/side ≈ 15 s. User: "not now" → next day item (index by amount/time).
