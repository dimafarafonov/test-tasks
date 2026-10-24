#!/usr/bin/env bash
# Runs recon on every examples/*/ folder. Reports go to out/<example>.json.
# Each report is compared with expected_report.json (PASS / FAIL).
set -u
cd "$(dirname "$0")/.."
mkdir -p out
fail=0

for dir in examples/*/; do
  name=$(basename "$dir")
  out="out/$name.json"
  echo "== $name"
  node apps/cli/bin/recon.js run \
    --ours "$dir/ours.csv" \
    --theirs "$dir/theirs.csv" \
    --manual "$dir/manual.csv" \
    --as-of "$(tr -d '[:space:]' < "$dir/as_of.txt")" \
    --output "$out" || { echo "FAIL (exit $?)"; fail=1; continue; }

  if node -e 'const [a, b] = process.argv.slice(1).map((f) => require("node:fs").readFileSync(f, "utf8"));
    process.exit(require("node:util").isDeepStrictEqual(JSON.parse(a), JSON.parse(b)) ? 0 : 1)' \
    "$out" "$dir/expected_report.json"; then
    echo "PASS"
  else
    echo "FAIL (diff $out $dir/expected_report.json)"
    fail=1
  fi
done

exit $fail
