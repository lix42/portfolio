import sys, json, os, os.path, re

BLOCKED_PATTERNS = [".env", ".dev.vars", ".secret"]

# apply_patch envelope markers that name an affected file, e.g.
#   *** Add File: path        *** Update File: path
#   *** Delete File: path     *** Move to: path   (rename target)
_PATCH_FILE = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$", re.MULTILINE)
_PATCH_MOVE = re.compile(r"^\*\*\* Move to: (.+)$", re.MULTILINE)


def load_tool_input() -> dict:
    """Read the hook payload and return its tool_input object.

    Works across runtimes: Codex sends one JSON object on stdin (tool data
    under "tool_input"); Claude Code passes it via the CLAUDE_TOOL_INPUT env
    var (flat). Reading stdin directly in Python is not a shell-injection
    vector.
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
        return {}
    if not isinstance(data, dict):
        return {}
    tool_input = data.get("tool_input", data)
    return tool_input if isinstance(tool_input, dict) else {}


def edited_paths(tool_input: dict) -> list[str]:
    """All file paths the tool call would touch.

    Edit/Write expose "path"/"file_path"; apply_patch (and Bash) put the
    payload in "command", where apply_patch names files via *** markers.
    """
    paths = []
    for key in ("path", "file_path"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            paths.append(value)
    command = tool_input.get("command")
    if isinstance(command, str) and command:
        paths += _PATCH_FILE.findall(command)
        paths += _PATCH_MOVE.findall(command)
    return [p.strip() for p in paths if p.strip()]


def blocked_pattern(path: str):
    """The sensitive pattern this path matches, or None. .example is allowed."""
    basename = os.path.basename(path)
    if basename.endswith(".example"):
        return None
    return next((p for p in BLOCKED_PATTERNS if p in basename), None)


# Block via exit code 2 + stderr — the signal both Codex and Claude Code honor
# to deny a tool call (exit 1 / stdout does not block).
for path in edited_paths(load_tool_input()):
    pattern = blocked_pattern(path)
    if pattern:
        sys.stderr.write(
            f'Blocked: {path} matches sensitive pattern "{pattern}". Edit manually.\n'
        )
        sys.exit(2)

sys.exit(0)
