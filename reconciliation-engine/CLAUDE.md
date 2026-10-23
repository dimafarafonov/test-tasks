# CLAUDE.md

## Rules (MUST)

- Do NOT write implementation code until the user says so.
- The user decides. Claude does what the user says.
- Claude can suggest. Suggestions are chat text only (pseudo code, short notes). No file changes for suggestions.
- Read `conversation.md` before each reply. Follow it.

## Task source

- Brief: `/Users/dimafarafonov/work/candidate/ASSIGNMENT.md`
- Examples: `/Users/dimafarafonov/work/candidate/examples/`
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

- Language / stack:
- Thresholds (amount, time):
- Extended shape handling (currency, quantity, price_per_share, fx_rate, party_email):
- Viewer (CLI pretty-print / web UI):
- Architecture:
