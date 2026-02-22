import sys, json

d = json.load(sys.stdin)
f = d.get('file_path', '')
blocked = ['.env', '.secret']
match = next((b for b in blocked if b in f), None)

if match:
    print(f'Blocked: {f} matches sensitive pattern "{match}". Edit manually.')
    sys.exit(1)

print('OK')
