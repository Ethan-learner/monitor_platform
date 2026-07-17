import sys, json
sys.path.insert(0, '.')

# Import the exact function
from app.scrape.router import _ssh_exec, _ssh_read_file, settings
import os
import yaml

base = settings.prometheus_targets_dir
result = {}

try:
    raw = _ssh_exec(f"ls -1 {base}")
except Exception as e:
    print(f'ls error: {e}')
    sys.exit(1)

if not raw:
    print('raw empty')
    sys.exit(1)

print(f'raw lines: {raw.split(chr(10))}')
print(f'raw lines count: {len(raw.split(chr(10)))}')

for line in raw.split("\n"):
    dept = line.strip()
    if not dept:
        continue
    dept_path = f"{base}/{dept}"
    try:
        out = _ssh_exec(f"test -d '{dept_path}' && echo 1 || echo 0")
        print(f'  {dept}: test -d = {repr(out)}')
        if out != "1":
            continue
        files_raw = _ssh_exec(f"ls -1 {dept_path}/*.yaml 2>/dev/null || true")
        print(f'  {dept}: files_raw = {repr(files_raw[:100]) if files_raw else "empty"}')
        if not files_raw:
            continue
    except Exception as e:
        print(f'  {dept}: error = {e}')
        continue

    files_list = []
    for fname in files_raw.split("\n"):
        fname = fname.strip().rsplit("/", 1)[-1]
        if not fname or not fname.endswith(".yaml"):
            continue
        category = fname[:-5]
        try:
            content = _ssh_read_file(os.path.join(dept_path, fname))
            parsed = yaml.safe_load(content) or []
            targets = []
            labels = {}
            for item in parsed if isinstance(parsed, list) else [parsed]:
                if isinstance(item, dict):
                    t = item.get("targets", [])
                    if isinstance(t, list):
                        targets.extend(t)
                    labels = item.get("labels", {}) or {}
        except Exception as e:
            print(f'    {fname}: parse error {e}')
            continue
        files_list.append({"category": category, "targets": targets, "labels": labels})
    if files_list:
        result[dept] = files_list

print(f'\nresult keys: {list(result.keys())}')
print(f'result count: {len(result)}')
