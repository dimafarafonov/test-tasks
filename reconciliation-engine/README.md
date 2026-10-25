# Reconciliation engine

Matches two transaction lists (`ours.csv`, `theirs.csv`) plus operator pins (`manual.csv`) and writes `report.json`.

Decision log (requirements, edge cases, why): [DECISIONS.md](DECISIONS.md).

## Install

Needs Node.js >= 24.

```bash
nvm use            # reads .nvmrc
npm install
npm link           # puts `recon` on PATH
```

Check the setup: `npm run doctor`.

## Run

```bash
recon run --ours ours.csv --theirs theirs.csv --manual manual.csv \
  --as-of 2026-04-01T23:59:59.999Z --output report.json
```

- `--as-of` takes a timestamp or a path to a file with one timestamp.
- Only records with `timestamp <= as_of` take part.

Short form for a folder:

```bash
recon run examples/example_2_with_manual
```

Reads `ours.csv`, `theirs.csv`, `manual.csv`, `as_of.txt` from the folder and writes `report.json` there. Any flag overrides its default.

Output on success:

```
matched: manual 1, exact 1, rule_based 0, fuzzy 0; unmatched: ours 1, theirs 1 → examples/example_2_with_manual/report.json (6.1 ms)
```

## View the result

```bash
recon view examples/example_3_multi_party_currency/report.json   # show a report that exists
recon run examples/example_3_multi_party_currency --view          # run, then show it
```

```
Reconciliation report · as of 2026-05-01T23:59:59.999Z

Summary
  manual       1
  exact        1
  rule_based   1
  fuzzy        0
  unmatched    ours 1 · theirs 1

Matches
  KIND         OURS    THEIRS   AMOUNT DIFF   TIME DIFF (s)
  manual       o-004   t-104           0.00           0.000
  exact        o-001   t-101           0.00           0.000
  rule_based   o-002   t-102          -0.01          -0.500

Unmatched ours
  ID      AMOUNT   TIMESTAMP                  CURRENCY   QUANTITY   PRICE PER SHARE   FX RATE    PARTY EMAIL
  o-003   500.00   2026-05-01T12:00:00.000Z   USD        10         50.00             1.000000   alice@acme.com
...
```

- Each table shows the first 50 rows; `--all` shows every row.
- Colors only on a terminal; set `NO_COLOR=1` to turn them off.
- With `--view`, skipped rows and pins are listed in an "Exceptions" table, not on stderr. `report.json` never holds them.

## Input files

`ours.csv`, `theirs.csv`:

```
id,amount,timestamp,memo
o-001,100.00,2026-04-01T10:00:00.000Z,coffee
```

Optional extra columns: `currency,quantity,price_per_share,fx_rate,party_email`. Each one is used when the file has it. To add or rename a column, edit the field schema: [packages/core/src/settings/columns.ts](packages/core/src/settings/columns.ts). All options with an example: [examples/columns.example.ts](examples/columns.example.ts).

`manual.csv` (pairs to force; may have no rows):

```
ours_id,theirs_id
o-002,t-102
```

## Matching

Each record matches at most once. Match kinds run in this order:

| Kind | Rule |
|---|---|
| `manual` | Pair from `manual.csv`. Always wins. |
| `exact` | Same amount and timestamp (and same `currency`, `party_email` when both sides have them). |
| `rule_based` | Amount diff ≤ 0.02, time diff ≤ 2 s, same party fields. |
| `fuzzy` | Similar memo (and `party_email`), amount diff ≤ 0.10, time diff ≤ 2 s, same currency. |

Limits: [packages/core/src/settings/limits.ts](packages/core/src/settings/limits.ts).

## Output

```json
{
  "as_of": "2026-04-01T23:59:59.999Z",
  "summary": { "matched_manual": 1, "matched_exact": 1, "matched_rule_based": 0,
               "matched_fuzzy": 0, "unmatched_ours": 1, "unmatched_theirs": 1 },
  "matches": [
    { "kind": "exact", "ours_id": "o-001", "theirs_id": "t-101",
      "amount_diff": "0.00", "timestamp_diff_seconds": "0.000" }
  ],
  "unmatched_ours": [ { "id": "o-003", "amount": "300.00", "timestamp": "2026-04-01T12:00:00.000Z" } ],
  "unmatched_theirs": [ { "id": "t-103", "amount": "75.00", "timestamp": "2026-04-01T16:00:00.000Z" } ]
}
```

Diffs are ours minus theirs.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Report written. Skipped rows or pins (if any) are listed on stderr. |
| 1 | Input unusable (missing file, bad arguments, bad `--as-of`). All problems are listed on stderr. No report. |

## Commands

| Command | What it does |
|---|---|
| `npm test` | All tests, incl. every `examples/*/` |
| `npm run typecheck` | TypeScript check |
| `npm run examples [-- NAME ...]` | Run examples, compare with `expected_report.json`, show run time |
| `npm run generate:example -- ROWS [NAME]` | Build a large example (80% exact, 10% manual, 10% unmatched) |
| `npm run doctor` | Check Node version, nvm default, deps, `recon` on PATH |

## Code layout

The engine is `packages/core/src`. Folders follow the path of a record: read → match → build report → write.

```
reconcile.ts      read the files (reader by extension), then run the engine
engine.ts         records in, report out: as_of filter → manual → other match kinds → report.
                  Knows nothing about files or formats.
exceptions.ts     problems found in the input (fatal / skip), one-line format
types.ts          shared types: Source, Transaction, Match, Report

readers/          input formats → records. New format = new folder + 1 line in index.ts
  index.ts              extension → reader (unknown → csv)
  reader.ts             what a reader must return
  readAsOf.ts           the as_of value
  csv/
    readCsv.ts            any CSV file: header, rows
    readTransactions.ts   ours / theirs rows, extra columns
    readManual.ts         manual rows

matching/         one file per match kind
  manual.ts, exact.ts, ruleBased.ts, fuzzy.ts
  matchOrder.ts         the order the kinds run in
  sameParty.ts          columns that must be equal (currency, email ...)
  pickBest.ts           best pair first, time window
  difference.ts         amount / time difference, limit check

output/           the report object (what report.json holds)
  matchEntry.ts         one line in "matches" (diffs, rounding)
  unmatchedEntry.ts     one line in "unmatched_*"
  buildReport.ts        sorting and summary

writers/          report object → text. New format = new file + 1 line in index.ts
  json.ts               report.json (brief contract)
  pretty.ts             tables for the terminal (recon view, --view)

settings/
  limits.ts             0.02, 2 s, 0.75 ...
  columns.ts            extra columns (type, match rule, aliases)

helpers/          generic, no business rules
  numbers.ts, textSimilarity.ts, sortById.ts
```

Tests mirror it: `packages/core/test/matching/exact.test.ts` tests `src/matching/exact.ts`. Each test name ends with a DECISIONS code, for example `(DECISIONS R2)`.

## Where to fix

| Symptom | Look in |
|---|---|
| Row skipped, column not read, bad number accepted | `readers/csv/` |
| Wrong `as_of` filter | `readers/readAsOf.ts`, `engine.ts` step 1 |
| Pin ignored or wrong | `matching/manual.ts` |
| Wrong kind, or a pair should match but does not | `matching/<kind>.ts`, then `settings/limits.ts` |
| Pair blocked by currency / email / other column | `matching/sameParty.ts`, `settings/columns.ts` |
| Wrong pair picked among many candidates | `matching/pickBest.ts` (sort keys), `matching/<kind>.ts` (score) |
| Wrong diff, rounding, `-0.00` | `output/matchEntry.ts`, `helpers/numbers.ts` |
| Wrong order, summary or unmatched fields | `output/buildReport.ts`, `output/unmatchedEntry.ts` |
| Wrong file format written, or the view looks wrong | `writers/json.ts`, `writers/pretty.ts` |

Steps: test name → DECISIONS code (what the rule is) → file from the table.

## Troubleshooting

- `recon: command not found` → run `npm run doctor`. Usual cause: an older Node is active. Run `nvm use`, then `npm link`.
- A new IDE terminal still uses an old Node → the IDE keeps the PATH from its start. Quit and reopen it, or add `nvm use default --silent` to `~/.zshrc` after nvm loads.
