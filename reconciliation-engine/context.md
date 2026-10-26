# context.md — project status between chats

Update at the end of each session.

## Status (2026-10-24)

- Phase: coding. Engine (manual, exact, rule_based, fuzzy) + CLI done. Perf change (A + B) committed. Field schema refactor committed. Folder layout (input / matching / output / config / lib) done, not committed.
- All 4 given examples pass (user removed the generated 1k / 10k examples; `npm run generate:example` rebuilds them). 39 tests green. Typecheck clean.
- Stack (CLI only): Node.js >= 24 + TypeScript, npm workspaces. `temporal-polyfill`, `decimal.js`, `csv-parse`. Backend / frontend stack open.
- `README.md`: base usage (install, run, inputs, matching, output, exit codes, commands).
- `DECISIONS.md`: Requirements (Q1–Q19, X1–X8) + Exceptions, all `DECIDED`. Limits in DECISIONS "Limits config".
- Not-happy path: Exception model (`fatal` → exit 1 listing all; `skip` → item skipped, exit 0, printed to stderr).

## Next step

- Viewer: pretty CLI done (C5: `recon view REPORT.json`, `recon run … --view`, `--all`). Web UI: later, with a backend (stack open).
- Engine / readers / writers split done (S6): `runEngine` takes records; `readers/` by extension (unknown → csv); `writers/` json + pretty. Not committed.
- Option offered, not decided: one config file (`recon.config.json`: file names, delimiter, encoding, core column aliases, formats, limits, columns).
- Option: 1k example with rule_based + fuzzy rows too (offered, not decided).
- README sections still to add (Q19): architecture + why, next day, AI usage.
- Perf done (A + B): exact = Map by label; rule_based / fuzzy = time window. example_big 15.1 s → 0.2 s. Checked: same results as old pair-by-pair code (900 random dense runs, 0 diffs).
- Column schema: `settings/columns.ts` (`DEFAULT_COLUMNS`; `ReconcileOptions.columns` overrides). New column = one row, rename = `aliases`. Match column on one side only → `skip` issue I3. Checked: same reports as previous commit (400 random runs, 0 diffs).
- Next day list so far: perf C (keep in mind, not now) (amount / time as bigint at parse; helps dense data in one time window), FX conversion (R3).

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
- README = usage only. DECISIONS split: Requirements vs Exceptions. New behavior → new DECISIONS row.
- Stack + architecture: DECISIONS `Stack` (S1–S5).
- R3: no FX conversion. Conversion → next day.
- C3: `--as-of` takes a value or a path to a file with one value (file parsed as a whole).
- C4: `recon run DIR` short form (DIR/ours.csv, theirs.csv, manual.csv, as_of.txt → DIR/report.json; flags override).
- CLI prints run time after each run (not in report.json).
- Test names: plain words + `(DECISIONS code)`, readable without DECISIONS or AI.
- `npm run doctor` for setup checks.

## Code layout

- Root `package.json`: workspaces, `engines >=24`, `bin recon → apps/cli/bin/recon.js`. Scripts: `test`, `typecheck`, `examples`, `generate:example`, `doctor`.
- `apps/cli/bin/recon.js`: plain JS, Node version check, then imports `src/main.ts`.
- `apps/cli/src/main.ts`: parseArgs; `run` (C1–C4, writeJson, `--view` → writePretty with exceptions, else exceptions → stderr; summary + time → stdout); `view REPORT.json` (C5, checks report shape).
- `apps/cli/src/asOfFile.ts`: `readAsOfFile` (BOM, blank lines, one value, C2).
- `packages/core/src` (README "Code layout" + "Where to fix"): `reconcile.ts` (CSV sources → reader → engine); `engine.ts` (`runEngine`: records in, report out); `exceptions.ts` (Exception model, `formatException`); `readers/` (`index.ts` `READERS` + `readerFor`, `reader.ts` interface, `readAsOf.ts` A3/C2, `csv/` `readCsv.ts` I6, `readTransactions.ts` I2/I7/I8, `readManual.ts`); `matching/` (`manual.ts` M1–M4, `exact.ts` Map label, `ruleBased.ts`, `fuzzy.ts`, `sameParty.ts` match columns + I3 warning, `pickBest.ts` `runMatchKind` sort + pick + time window, `matchOrder.ts`, `difference.ts`); `output/` (report object: `matchEntry.ts`, `unmatchedEntry.ts`, `buildReport.ts`); `writers/` (`json.ts`, `pretty.ts` C5, `index.ts` `WRITERS`); `settings/` (`limits.ts`, `columns.ts`); `helpers/` (`numbers.ts`, `textSimilarity.ts` OSA, `sortById.ts`); `types.ts` (`Source`, `Transaction`: `extra`, `matchKeys`). Names: plain words; "tier" → "match kind".
- Tests: `packages/core/test/` mirrors src (`runEngine.ts` = `run`, `kinds`, `codes`), `apps/cli/test/examples.test.ts` (runs bin on every `examples/*/`).
- `examples/columns.example.ts`: column schema showcase file only (all options, alias, new columns). Not used, not tested.
- `scripts/run-examples.ts` (`npm run examples [-- NAME ...]`, output `out/`), `scripts/generate-example.ts` (`npm run generate:example -- ROWS [NAME]`; expected report from data design, fixed seed; as_of = end of last record's day), `scripts/doctor.js`.
- `.gitignore`: `node_modules/`, `out/`, `examples/*/report.json`, `.DS_Store`.
