# Decisions

Decision log: Requirements and Exceptions. Codes (Q9, E3, C4 ...) are used in code comments, test names and exception codes.

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
| I1 | `ours.csv` / `theirs.csv` is header-only | valid empty side / error | valid empty side (0 records) | Same rule the brief gives for header-only `manual.csv` | DECIDED |
| I2 | Shape detection | whole shape / each column | by header, each schema column (I11) on its own: found → parsed, used, echoed; core col missing → `fatal`. All 5 or none (Q6) works as before | New or partial columns work without code change | DECIDED |
| I3 | Column on one side only (simple vs extended, renamed column) | compare common fields / error | compare common fields only; match column on one side only → `skip` exception I3 (warning, run continues) | Simple; no crash. Warning shows a renamed column that would else turn a check off | DECIDED |
| I4 | Timestamp precision varies (`.5Z`, no fraction, µs) | normalize to ms / keep full precision | keep full precision (`temporal-polyfill`, ns) | Brief allows sub-second; no precision loss; standard API, no own parser | DECIDED |
| I5 | Amount math | decimal type / integer cents | decimal type (`decimal.js`) | Exact; built-in parse, format, rounding; readable | DECIDED |
| I6 | Memo with comma / quotes / newline | standard CSV parser | standard CSV parser (`csv-parse`) | Handles quotes, commas, newlines correctly | DECIDED |
| I7 | Duplicate ID in one file | error / keep first | keep first; skip later rows (`skip` exception) | Generic exception model; run continues, exit 0 | DECIDED |
| I8 | Bad row (missing field, bad number) | error exit / skip + warn | skip row (`skip` exception) | Generic exception model; run continues, exit 0 | DECIDED |
| I9 | Extra unknown columns | ignore / echo / error | ignore; not echoed | Brief defines the fields; extra columns are noise | DECIDED |
| I10 | Record timestamp with offset (`+02:00`) / empty `currency`, `party_email` | accept / skip row | accept (any ISO offset via Temporal; empty string is a value) | Not a broken row; matching still works on the parsed value | DECIDED |
| I11 | Adding / renaming extra columns | code per column / field schema | field schema `packages/core/src/settings/columns.ts`: one row per column (`type`: text / integer / decimal; `match`: equal / similar / none; `aliases`). Order = echo order | New column = one row; rename = alias. Match keys normalized (decimal by value) | DECIDED |

### as_of

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| A1 | Record after `as_of` | fully absent from report / listed somewhere | fully absent | Brief: run "only considers records whose timestamp <= T" | DECIDED |
| A2 | `as_of` before all records | empty report, exit 0 | empty report, exit 0 | Valid run with no data | DECIDED |
| A3 | `as_of` precision varies | accept, output `.000Z` | accept no fraction and 1–9 fraction digits + `Z`; output always `.sssZ` | Brief writes `[.sss]`; cover edge cases; examples echo `.sss` | DECIDED |

### Manual

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| M1 | Pin ID does not exist | ignore / error / skip + warn | skip pin (`skip` exception) | Generic exception model; run continues, exit 0 | DECIDED |
| M2 | Pinned record after `as_of` | ignore pin / keep pin | drop pin (`skip` exception) | `as_of` filter runs first; record does not exist in this run | DECIDED |
| M3 | Same ID in two different pins | first wins / error / skip both | first wins; skip later pins (`skip` exception) | Generic exception model; run continues, exit 0 | DECIDED |
| M4 | Identical pin row twice | dedupe / error | dedupe; skip duplicate (`skip` exception) | Generic exception model; run continues, exit 0 | DECIDED |

### Exact

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| E1 | Extended shape: party fields required for exact? | yes / no | yes (`party_email`, `currency` equal) | X6: o-003/t-103 same amount + time, unmatched | DECIDED |
| E2 | `currency` is a party-identity field? | yes / no | yes | Follows R3: different currency = different leg; operator can pin | DECIDED |
| E3 | Many candidates, same amount + timestamp | lowest id first / other | pair by `ours_id`, then `theirs_id` ascending | Deterministic; easy to explain | DECIDED |

### Rule-based

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| R1 | Amount threshold value, inclusive? | 0.01 / other | ≤ 0.02, inclusive (config) | Goal: more auto matches. Ex 3 accepts 0.01; ex 4 0.03 is fuzzy, not rule-based → 0.02 is max | DECIDED |
| R2 | Time threshold value, inclusive? | 0.5 s / 1 s / other | ≤ 2 s, inclusive (config) | Covers network + processing delay, clock drift, retries; below batch / settlement lag | DECIDED |
| R3 | Different currency, same value via `fx_rate` | convert / no convert | no convert; currency is identity field; `fx_rate` not used in matching | Trade recon matches in same currency; false match worse than unmatched; ex 3 t-102 (fx-drift) still matches via amount threshold. Conversion → next day | DECIDED |
| R4 | `quantity` / `price_per_share` used? | yes / no | no | Not party fields; `amount` already = quantity × price × fx_rate | DECIDED |
| R5 | Many candidates (tie-break) | closest diff first / id order / optimal assignment | closest first: \|amount diff\|, then \|time diff\|, then `ours_id`, `theirs_id` | Most likely pair wins; deterministic | DECIDED |

### Fuzzy (optional)

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| F1 | Implement at all | yes / cut | yes, last (after manual / exact / rule-based work) | Ex 4 tests it; brief: "expert solutions implement it" | DECIDED |
| F2 | Algorithm | Damerau-Levenshtein / Levenshtein / Jaro-Winkler | Damerau-Levenshtein | Also counts swapped letters, a common typo | DECIDED |
| F3 | Similarity threshold | normalized `dist / max_len` value? | `1 − dist / max_len ≥ 0.75` (config) | Allows 1 typo in 4 letters; "Cofee Shop" = 0.91 | DECIDED |
| F4 | Amount / time limits for fuzzy | value? | amount ≤ 0.10, time ≤ 2 s (config) | Ex 4 needs 0.03; covers small fees; text similarity guards false matches | DECIDED |
| F5 | Case / whitespace normalize | yes / no | yes: lowercase, trim, collapse spaces | Case and spaces are not real differences | DECIDED |
| F6 | Memo empty on one side | no fuzzy / use email only | empty memo = no memo signal | Empty value proves nothing | DECIDED |
| F7 | Fuzzy rule (exact form) | memo only / memo + email / email only | memo similar (both non-empty) **and**, when both sides extended, `party_email` similar + `currency` equal | Literal reading of F3 + "also accepts a `party_email` typo" | DECIDED |
| F8 | Many fuzzy candidates | best text first / R5 order | best text first (lowest similarity of checked fields), then R5 order | Text is the signal of this tier | DECIDED |

Extended shape: fuzzy also accepts a `party_email` typo (same F3 threshold). `currency` must be equal.

### Limits config

One config object in `core`. CLI uses defaults. Real values come from past confirmed pairs + finance policy (next day).

| Key | Default | Source |
|---|---|---|
| `ruleAmount` | 0.02 | R1 |
| `ruleTimeSeconds` | 2 | R2 |
| `fuzzySimilarity` | 0.75 | F3 |
| `fuzzyAmount` | 0.10 | F4 |
| `fuzzyTimeSeconds` | 2 | F4 |

### Output

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| O1 | Negative zero (`-0.00`) | never print | never; print `0.00` | Standard money format | DECIDED |
| O2 | Timestamp echo format in unmatched | input as-is / normalized `.sssZ` | input as-is | Brief: "echo each record's input fields" | DECIDED |
| O3 | Diff rounding for sub-ms timestamps | round / truncate | round half away from zero, 3 decimals | Standard; same for both signs | DECIDED |

### Stack

Scope: CLI only. Backend / frontend stack is open and may differ.

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| S1 | Language / runtime (CLI) | Node.js + TypeScript / other | Node.js >= 24 + TypeScript | Node 24 runs `.ts` without build; good CSV / CLI libs; can share types with a later TS backend / frontend | DECIDED |
| S2 | Node version guard | `engines` only / `engines` + startup check | `engines: >=24` + startup check | npm only warns; check gives clear error, exit 1 | DECIDED |
| S3 | Repo structure | monorepo / single package / separate repos | monorepo in this folder (`packages/core`, `apps/cli`, later `apps/api`, `apps/web`) | One pure engine reused by all entry points | DECIDED |
| S4 | CLI entry | `bin` field / wrapper script | `package.json` `bin: { recon }` | Puts `recon` on PATH via `npm link` / `npm i -g .` | DECIDED |
| S5 | Workspace tool | npm workspaces / pnpm | npm workspaces | Ships with Node; graders need no extra install | DECIDED |

### CLI

| # | Case | Options | Decision | Why | Status |
|---|---|---|---|---|---|
| C1 | Missing file / bad args | exit non-zero + message | `fatal` exception; check all inputs, list all problems, exit 1 | User fixes all in one pass | DECIDED |
| C2 | Bad `--as-of` format | exit non-zero | `fatal` exception; listed with C1, exit 1 | Same as C1 | DECIDED |
| C3 | `--as-of` given as a file | value only / value or file path | value or path to a file with one value (BOM, blank lines, spaces ignored; more lines → `fatal` C2). Valid value wins; else read as file | User wants both. Brief contract (value) still works | DECIDED |
| C4 | Short form for a folder | flags only / `recon run DIR` | `recon run DIR`: reads `DIR/ours.csv`, `theirs.csv`, `manual.csv`, `as_of.txt`, writes `DIR/report.json`; any flag overrides its default | User wants one short command per example. Brief contract (flags) still works | DECIDED |

### Exception model (not-happy path)

Generic. Code collects problems; it does not throw at the first one. Entry point (CLI now, backend later) shows them.

```
Exception { code: "I7" | "M1" | "C1" ..., level: "fatal" | "skip",
        source: "ours.csv" | "--as-of" | ..., row?, id?, message }
```

| Level | Meaning | Run | Exit |
|---|---|---|---|
| `fatal` | Input unusable (C1, C2) | stop after all checks | 1 |
| `skip` | One item bad (I3, I7, I8, M1, M3, M4) | continue without item | 0 |

- `code` = DECISIONS ID. New case = new code, no new path.
- Core returns `{ report, exceptions }`. Core never prints.
- CLI prints exceptions to console. Backend later returns them as JSON; frontend shows them.
- `report.json` schema unchanged (hidden suite compares it).
