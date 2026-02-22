import sys, json, os

# Read tool input from env var (avoids shell injection via echo)
d = json.loads(os.environ.get('CLAUDE_TOOL_INPUT', '{}'))
f = d.get('file_path', '')

# Allow .example template files — they are safe to edit and commit
if f.endswith('.example'):
    print('OK')
    sys.exit(0)

# Block actual secret files by checking the basename
import os.path
basename = os.path.basename(f)
BLOCKED_PATTERNS = ['.env', '.dev.vars', '.secret']
match = next((p for p in BLOCKED_PATTERNS if basename == p or basename.endswith(p)), None)

if match:
    print(f'Blocked: {f} matches sensitive pattern "{match}". Edit manually.')
    sys.exit(1)

print('OK')
