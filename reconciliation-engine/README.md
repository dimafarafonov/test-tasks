# Reconciliation engine

> Draft. Install / run / architecture / AI usage sections come later.

## How we decide

Use this order. Stop at the first source that gives an answer.

1. **Examples** (`examples/*/expected_report.json`) — the hidden tests use the same contract.
2. **Brief** (`ASSIGNMENT.md`) — exact wording.
3. **Default** — simplest behavior that is deterministic and easy to defend.

Exceptions: pick one option (max 3), write the reason in one line, set status `DECIDED`.

Status: `OPEN` → `DECIDED` → `TESTED`.

## 1. Requirements

Stated in the brief or shown in the examples. Not up for decision.

### From the brief

| # | Requirement |
|---|---|
| Q1 | CLI: `recon run --ours --theirs --manual --as-of --output`. Exit 0 on success. |
| Q2 | Runs in a fresh working directory per scenario. |
| Q3 | Read `ours.csv`, `theirs.csv`, `manual.csv` (`ours_id,theirs_id`). Header-only `manual.csv` = no pins. |
| Q4 | Only records with `timestamp <= as_of` take part. |
| Q5 | Record fields: `id` (unique per file, not shared between sides), `amount` (2 decimals, may be negative), `timestamp` (ISO 8601 UTC, sub-second allowed), `memo`. |
| Q6 | Extended shape: `currency, quantity, price_per_share, fx_rate, party_email` — all five or none. |
| Q7 | Tier priority: manual → exact → rule_based → fuzzy. |
| Q8 | Manual always wins, even when records would not match. |
| Q9 | Exact: amount and timestamp equal. |
| Q10 | Rule-based: amount and timestamp within thresholds; party-identity fields equal. |
| Q11 | Exact and rule-based ignore `memo`. |
| Q12 | Fuzzy is optional. Tolerates typos in `memo` and `party_email`. |
| Q13 | Each record matches at most once. |
| Q14 | Same inputs → same report. |
| Q15 | Report schema: `as_of`, `summary` (6 counts), `matches`, `unmatched_ours`, `unmatched_theirs`. |
| Q16 | `amount_diff` and `timestamp_diff_seconds` are signed `ours - theirs`. |
| Q17 | Sort: `matches` by (kind, ours_id), kind order manual/exact/rule_based/fuzzy; unmatched by `id`. |
| Q18 | Viewer: pretty-printed CLI minimum; web UI recommended. |
| Q19 | README: install/run, architecture decisions + why, next day plan, AI usage. |

### From the examples

| # | Requirement | Source |
|---|---|---|
| X1 | `amount_diff` format `0.00`; `timestamp_diff_seconds` format `0.000`, strings. | all |
| X2 | `as_of` echoed as `YYYY-MM-DDTHH:MM:SS.sssZ`. | all |
| X3 | Unmatched records echo input fields **without `memo`**. | ex 2, 3 |
| X4 | `quantity` is a number; `amount`, `price_per_share`, `fx_rate` are strings. | ex 3 |
| X5 | Rule-based accepts amount diff 0.01 and time diff 0.5 s. | ex 3, 4 |
| X6 | Same amount + timestamp but different `party_email` / `currency` → unmatched. | ex 3 (o-003/t-103) |
| X7 | Manual pin ignores amount, time, quantity, price differences. | ex 2, 3 |
| X8 | Fuzzy accepts memo typo (`Coffee` / `Cofee`) with amount diff 0.03. | ex 4 |

## 2. Exceptions

Not stated in the brief or examples. Reasoned. We decide.

### Input

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| I1 | `ours.csv` / `theirs.csv` is header-only | valid empty side / error | | | OPEN |
| I2 | Shape detection | by header | | | OPEN |
| I3 | One side simple, other side extended | compare common fields / error | | | OPEN |
| I4 | Timestamp precision varies (`.5Z`, no fraction, µs) | normalize to ms / keep full precision | keep full precision (`temporal-polyfill`, ns) | Brief allows sub-second; no precision loss; standard API, no own parser | DECIDED |
| I5 | Amount math | decimal type / integer cents | decimal type (`decimal.js`) | Exact; built-in parse, format, rounding; readable | DECIDED |
| I6 | Memo with comma / quotes / newline | standard CSV parser | | | OPEN |
| I7 | Duplicate ID in one file | error / keep first | keep first; skip later rows (`skip` issue) | Generic Issue model; run continues, exit 0 | DECIDED |
| I8 | Bad row (missing field, bad number) | error exit / skip + warn | skip row (`skip` issue) | Generic Issue model; run continues, exit 0 | DECIDED |
| I9 | Extra unknown columns | ignore / echo / error | | | OPEN |

### as_of

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| A1 | Record after `as_of` | fully absent from report / listed somewhere | | | OPEN |
| A2 | `as_of` before all records | empty report, exit 0 | | | OPEN |
| A3 | `as_of` without milliseconds | accept, output `.000Z` | | | OPEN |

### Manual

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| M1 | Pin ID does not exist | ignore / error / skip + warn | skip pin (`skip` issue) | Generic Issue model; run continues, exit 0 | DECIDED |
| M2 | Pinned record after `as_of` | ignore pin / keep pin | | | OPEN |
| M3 | Same ID in two different pins | first wins / error / skip both | first wins; skip later pins (`skip` issue) | Generic Issue model; run continues, exit 0 | DECIDED |
| M4 | Identical pin row twice | dedupe / error | dedupe; skip duplicate (`skip` issue) | Generic Issue model; run continues, exit 0 | DECIDED |

### Exact

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| E1 | Extended shape: party fields required for exact? | yes / no | | X6 suggests yes | OPEN |
| E2 | `currency` is a party-identity field? | yes / no | yes | Follows R3: different currency = different leg; operator can pin | DECIDED |
| E3 | Many candidates, same amount + timestamp | lowest id first / other | | | OPEN |

### Rule-based

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| R1 | Amount threshold value, inclusive? | 0.01 / other | | X5 | OPEN |
| R2 | Time threshold value, inclusive? | 0.5 s / 1 s / other | | X5 | OPEN |
| R3 | Different currency, same value via `fx_rate` | convert / no convert | no convert; currency is identity field; `fx_rate` not used in matching | Trade recon matches in same currency; false match worse than unmatched; ex 3 t-102 (fx-drift) still matches via amount threshold. Conversion → next day | DECIDED |
| R4 | `quantity` / `price_per_share` used? | yes / no | | | OPEN |
| R5 | Many candidates (tie-break) | closest diff first / id order / optimal assignment | | | OPEN |

### Fuzzy (optional)

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| F1 | Implement at all | yes / cut | | | OPEN |
| F2 | Algorithm | Damerau-Levenshtein / Levenshtein / Jaro-Winkler | | | OPEN |
| F3 | Similarity threshold | normalized `dist / max_len` value? | | | OPEN |
| F4 | Amount / time limits for fuzzy | value? | | X8: 0.03 | OPEN |
| F5 | Case / whitespace normalize | yes / no | | | OPEN |
| F6 | Memo empty on one side | no fuzzy / use email only | | | OPEN |

### Output

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| O1 | Negative zero (`-0.00`) | never print | | | OPEN |
| O2 | Timestamp echo format in unmatched | input as-is / normalized `.sssZ` | | | OPEN |
| O3 | Diff rounding for sub-ms timestamps | round / truncate | | | OPEN |

### Stack

Scope: CLI only. Backend / frontend stack is open and may differ.

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| S1 | Language / runtime (CLI) | Node.js + TypeScript / other | Node.js >= 24 + TypeScript | Node 24 runs `.ts` without build; good CSV / CLI libs; can share types with a later TS backend / frontend | DECIDED |
| S2 | Node version guard | `engines` only / `engines` + startup check | `engines: >=24` + startup check | npm only warns; check gives clear error, exit 1 | DECIDED |
| S3 | Repo structure | monorepo / single package / separate repos | monorepo in this folder (`packages/core`, `apps/cli`, later `apps/api`, `apps/web`) | One pure engine reused by all entry points | DECIDED |
| S4 | CLI entry | `bin` field / wrapper script | `package.json` `bin: { recon }` | Puts `recon` on PATH via `npm link` / `npm i -g .` | DECIDED |

### CLI

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| C1 | Missing file / bad args | exit non-zero + message | `fatal` issue; check all inputs, list all problems, exit 1 | User fixes all in one pass | DECIDED |
| C2 | Bad `--as-of` format | exit non-zero | `fatal` issue; listed with C1, exit 1 | Same as C1 | DECIDED |

### Issue model (not-happy path)

Generic. Code collects problems; it does not throw at the first one. Entry point (CLI now, backend later) shows them.

```
Issue { code: "I7" | "M1" | "C1" ..., level: "fatal" | "skip",
        source: "ours.csv" | "--as-of" | ..., row?, id?, message }
```

| Level | Meaning | Run | Exit |
|---|---|---|---|
| `fatal` | Input unusable (C1, C2) | stop after all checks | 1 |
| `skip` | One item bad (I7, I8, M1, M3, M4) | continue without item | 0 |

- `code` = README ID. New case = new code, no new path.
- Core returns `{ report, issues }`. Core never prints.
- CLI prints issues to console. Backend later returns them as JSON; frontend shows them.
- `report.json` schema unchanged (hidden suite compares it).
