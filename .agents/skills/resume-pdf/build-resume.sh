#!/usr/bin/env bash
#
# Build a styled PDF resume from a markdown source file.
#
# Usage:
#   build-resume.sh <input.md> [output.pdf]
#
# If output.pdf is omitted, it defaults to the input path with a .pdf extension.
# Set CHROME_BIN to override Chrome/Chromium auto-detection.
#
# Pipeline: markdown -> HTML (md_to_html.py + resume.css) -> PDF (headless Chrome).

set -euo pipefail

INPUT="${1:?Usage: build-resume.sh <input.md> [output.pdf]}"
OUTPUT="${2:-${INPUT%.md}.pdf}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$INPUT" ]]; then
  echo "Error: input file not found: $INPUT" >&2
  exit 1
fi

# Locate a Chrome/Chromium binary.
CHROME="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [[ ! -x "$CHROME" ]]; then
  for candidate in \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome 2>/dev/null || true)" \
    "$(command -v google-chrome-stable 2>/dev/null || true)" \
    "$(command -v chromium 2>/dev/null || true)"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      CHROME="$candidate"
      break
    fi
  done
fi
if [[ ! -x "$CHROME" ]]; then
  echo "Error: Chrome/Chromium not found. Set CHROME_BIN to its path." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
TMP_HTML="$TMP_DIR/resume.html"

python3 "$SCRIPT_DIR/md_to_html.py" "$INPUT" "$SCRIPT_DIR/resume.css" > "$TMP_HTML"

"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$OUTPUT" "file://$TMP_HTML" >/dev/null 2>&1

if [[ ! -f "$OUTPUT" ]]; then
  echo "Error: PDF was not produced." >&2
  exit 1
fi

echo "Built: $OUTPUT ($(wc -c < "$OUTPUT" | tr -d ' ') bytes)"
