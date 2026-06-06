import sys, json, os, os.path


def edited_path() -> str:
    """Resolve the path of the file an agent tool is about to edit.

    Works across runtimes: Codex passes the hook payload as JSON on stdin
    (tool data under "tool_input"); Claude Code passes it via the
    CLAUDE_TOOL_INPUT env var (flat). Reading stdin directly in Python is
    not a shell-injection vector. Accept either "path" or "file_path".
    """
    raw = ""
    if not sys.stdin.isatty():
        try:
            raw = sys.stdin.read()
        except Exception:
            raw = ""
    if not raw.strip():
        raw = os.environ.get("CLAUDE_TOOL_INPUT", "{}")
    try:
        data = json.loads(raw or "{}")
    except (ValueError, TypeError):
        return ""
    if not isinstance(data, dict):
        return ""
    tool_input = data.get("tool_input", data)
    if not isinstance(tool_input, dict):
        return ""
    return tool_input.get("path") or tool_input.get("file_path") or ""


f = edited_path()

# Allow .example template files — they are safe to edit and commit
if f.endswith(".example"):
    print("OK")
    sys.exit(0)

# Block secret files by substring match on the basename, so variants like
# .env.local / .env.production / foo.secret are all caught.
basename = os.path.basename(f)
BLOCKED_PATTERNS = [".env", ".dev.vars", ".secret"]
match = next((p for p in BLOCKED_PATTERNS if p in basename), None)

if match:
    print(f'Blocked: {f} matches sensitive pattern "{match}". Edit manually.')
    sys.exit(1)

print("OK")
