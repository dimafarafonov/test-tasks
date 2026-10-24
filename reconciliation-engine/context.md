# context.md — project status between chats

Update at the end of each session.

## Status

- Phase: coding. Scaffold done (2026-10-24).
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

- User installs Node 24 (local was 22.14; bin guard rejects it).
- Build order: ~~scaffold~~ → core (parse, as_of, manual, exact, rule-based) → CLI + Issue output → examples check → fuzzy → viewer.

## Code layout

- Root `package.json`: npm workspaces (S5), `engines >=24`, `bin recon → apps/cli/bin/recon.js`.
- `apps/cli/bin/recon.js`: plain JS, version check, then imports `src/main.ts` (stub).
- `packages/core/src`: `config.ts` (thresholds as decimal strings), `issue.ts`, `index.ts`. Deps: decimal.js, temporal-polyfill, csv-parse.
- `npm run typecheck` (TS, noEmit). `npm test` = `node --test`.
