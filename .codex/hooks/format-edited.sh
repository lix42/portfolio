#!/usr/bin/env bash
#
# PostToolUse formatter: run Biome on the file(s) an agent just edited.
#
# Reads the tool payload from stdin (Codex) or $CLAUDE_TOOL_INPUT (Claude
# Code) and formats only the touched files, so it stays fast as the repo
# grows. Handles Edit/Write ("path"/"file_path") and apply_patch (files named
# via *** markers in "command"). Uses Biome's native --no-errors-on-unmatched
# to skip files Biome doesn't handle (the previous --files-ignore-unknown is a
# Prettier/ESLint flag that Biome rejects, which silently no-op'd the hook).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

mapfile -t files < <(python3 -c '
import sys, json, os, re
raw = sys.stdin.read() if not sys.stdin.isatty() else ""
raw = raw or os.environ.get("CLAUDE_TOOL_INPUT", "{}")
try:
    d = json.loads(raw or "{}")
except Exception:
    d = {}
t = d.get("tool_input", d) if isinstance(d, dict) else {}
t = t if isinstance(t, dict) else {}
paths = []
for k in ("path", "file_path"):
    v = t.get(k)
    if isinstance(v, str) and v:
        paths.append(v)
c = t.get("command")
if isinstance(c, str):
    paths += re.findall(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$", c, re.MULTILINE)
    paths += re.findall(r"^\*\*\* Move to: (.+)$", c, re.MULTILINE)
for p in paths:
    p = p.strip()
    if p:
        print(p)
')

[ "${#files[@]}" -gt 0 ] || exit 0

cd "$ROOT" && pnpm biome check --write --no-errors-on-unmatched "${files[@]}" 2>/dev/null || true
