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

## Input files

`ours.csv`, `theirs.csv`:

```
id,amount,timestamp,memo
o-001,100.00,2026-04-01T10:00:00.000Z,coffee
```

Optional extended columns: `currency,quantity,price_per_share,fx_rate,party_email` (all five or none).

`manual.csv` (pairs to force; may have no rows):

```
ours_id,theirs_id
o-002,t-102
```

## Matching

Each record matches at most once. Tiers run in this order:

| Kind | Rule |
|---|---|
| `manual` | Pair from `manual.csv`. Always wins. |
| `exact` | Same amount and timestamp (and same `currency`, `party_email` when both sides have them). |
| `rule_based` | Amount diff ≤ 0.02, time diff ≤ 2 s, same party fields. |
| `fuzzy` | Similar memo (and `party_email`), amount diff ≤ 0.10, time diff ≤ 2 s, same currency. |

Limits: [packages/core/src/config.ts](packages/core/src/config.ts).

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

## Troubleshooting

- `recon: command not found` → run `npm run doctor`. Usual cause: an older Node is active. Run `nvm use`, then `npm link`.
- A new IDE terminal still uses an old Node → the IDE keeps the PATH from its start. Quit and reopen it, or add `nvm use default --silent` to `~/.zshrc` after nvm loads.
