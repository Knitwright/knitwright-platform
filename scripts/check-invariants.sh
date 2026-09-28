#!/usr/bin/env bash
# Invariants I1 and I2 from plans/knitwright-mvp-blueprint.md.
# Run from the repository root. Exits non-zero on the first violation.
set -euo pipefail

fail=0

# I1: no environment file is tracked, except the example.
tracked_env=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' || true)
if [ -n "$tracked_env" ]; then
  echo "I1 violated: environment files are tracked:" >&2
  echo "$tracked_env" >&2
  fail=1
fi

# I2: no MCP connector is referenced by runtime code.
runtime_dirs=()
for dir in apps/web/app apps/web/lib apps/web/components; do
  [ -d "$dir" ] && runtime_dirs+=("$dir")
done
if [ ${#runtime_dirs[@]} -gt 0 ]; then
  mcp_hits=$(grep -rIil "mcp" "${runtime_dirs[@]}" || true)
  if [ -n "$mcp_hits" ]; then
    echo "I2 violated: runtime code mentions MCP:" >&2
    echo "$mcp_hits" >&2
    fail=1
  fi
fi

[ "$fail" -eq 0 ] && echo "Invariants I1 and I2 hold."
exit "$fail"
