# context.md — project status between chats

Update at the end of each session.

## Status

- Phase: understanding + decisions. No code yet.
- Stack: not chosen.
- `README.md`: Requirements (Q1–Q19, X1–X8) + Exceptions (36, all `OPEN`).

## Key findings

- Sides share no ID. Pair by data: amount, timestamp, party fields (extended shape). Memo only in fuzzy.
- `as_of` = filter (`timestamp <= as_of`), not run date.
- `manual.csv` = operator-forced pairs. Run first; consumes both records.
- Unmatched echo omits `memo` (examples 2, 3).
- Example 3: o-003/t-103 same amount + time, different email + currency → unmatched. Not clear which field blocks it.
- Rule-based in examples: amount diff 0.01, time diff 0.5 s. Exact thresholds unknown.
- Fuzzy (optional): string distance on memo / party_email. Candidate: Damerau-Levenshtein, normalized by length.
- Hidden tests may show more exceptions than listed.

## User decisions

- Talk style: see `conversation.md`.
- No code until user says so.
- README split: Requirements vs Exceptions.

## Next step

- Decide Exceptions, group by group. Claude gives options (max 3), user picks.
