# context.md — project status between chats

Update at the end of each session.

## Status

- Phase: understanding + decisions. No code yet.
- Stack (CLI only): Node.js >= 24 + TypeScript. Monorepo in this folder. `temporal-polyfill` (timestamps), `decimal.js` (amounts). Backend / frontend stack open, may differ.
- `README.md`: Requirements (Q1–Q19, X1–X8) + Exceptions. DECIDED: I4, I5, I7, I8, M1, M3, M4, E2, R3, S1–S4, C1, C2. Rest `OPEN`.
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

- Decide remaining Exceptions, group by group. Claude gives options (max 3), user picks.
