#!/usr/bin/env bash
#
# PostToolUse formatter: run Biome on the single file an agent just edited.
#
# Reads the tool payload from stdin (Codex) or $CLAUDE_TOOL_INPUT (Claude
# Code) and formats only that file, so it stays fast as the repo grows.
# Uses Biome's native --no-errors-on-unmatched to skip files Biome doesn't
# handle (the previous --files-ignore-unknown is a Prettier/ESLint flag that
# Biome rejects, which silently made the whole hook a no-op).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

f="$(python3 -c '
import sys, json, os
raw = sys.stdin.read() if not sys.stdin.isatty() else ""
raw = raw or os.environ.get("CLAUDE_TOOL_INPUT", "{}")
try:
    d = json.loads(raw or "{}")
except Exception:
    d = {}
t = d.get("tool_input", d) if isinstance(d, dict) else {}
print((t.get("path") or t.get("file_path") or "") if isinstance(t, dict) else "")
')"

[ -n "$f" ] || exit 0

cd "$ROOT" && pnpm biome check --write --no-errors-on-unmatched "$f" 2>/dev/null || true
