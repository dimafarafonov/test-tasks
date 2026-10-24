# CLAUDE.md

## Rules (MUST)

- Do NOT write implementation code until the user says so.
- The user decides. Claude does what the user says.
- Claude can suggest. Suggestions are chat text only (pseudo code, short notes). No file changes for suggestions.
- Read `conversation.md` before each reply. Follow it.
- Read `context.md` at chat start. Update it at the end of each session.
- `README.md` holds base usage only. `DECISIONS.md` holds Requirements and Exceptions (decision log).

## Task source

- Brief: `../../candidate/ASSIGNMENT.md`
- Examples: `../../candidate/examples/`
- Output code: this directory.

## Project spec

Reconciliation engine. Two CSV streams (`ours.csv`, `theirs.csv`) + `manual.csv` → `report.json`.

### CLI contract (tested by hidden suite)

```
recon run --ours OURS.csv --theirs THEIRS.csv --manual MANUAL.csv \
  --as-of YYYY-MM-DDTHH:MM:SS[.sss]Z --output REPORT.json
```

Exit 0 on success.

### Match kinds (priority order)

1. manual — pinned in `manual.csv`, always wins.
2. exact — amount and timestamp equal.
3. rule_based — amount and timestamp within thresholds; party-identity fields equal.
4. fuzzy — optional; tolerates typos in memo / party_email.

Each record matches at most once. Only records with `timestamp <= as_of`.

### TBD

- Viewer (CLI pretty-print / web UI): not decided. Next step.
- Backend / frontend stack: open. May differ from CLI stack.

### Decided (CLI only — see DECISIONS `Stack`)

- Language / stack: Node.js >= 24 + TypeScript. `temporal-polyfill` (timestamps), `decimal.js` (amounts).
- Architecture: monorepo in this folder. `packages/core` (pure engine), `apps/cli`. Later `apps/api`, `apps/web`.
- Currency: identity field. No FX conversion. `fx_rate` not used in matching (DECISIONS R3, E2).
- Thresholds (config, DECISIONS "Thresholds config"): rule amount ≤ 0.02, time ≤ 2 s; fuzzy similarity ≥ 0.75, amount ≤ 0.10, time ≤ 2 s.
- Extended shape: `party_email` + `currency` must be equal (exact, rule-based); `quantity`, `price_per_share` not used.
- Not-happy path: Issue model (`fatal` / `skip`), DECISIONS "Issue model".
- CLI extras: `--as-of` value or file (C3), `recon run DIR` (C4), run time printed. Scripts: `examples`, `generate:example`, `doctor` (README "Commands").
