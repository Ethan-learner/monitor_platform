import json
import yaml
from app.scrape.router import _ssh_exec, _ssh_read_file

base = '/data/software/prometheus/prometheus_targets'
result = {}

try:
    raw = _ssh_exec(f'ls -1 {base}')
    if not raw:
        print('raw is empty')
    else:
        for line in raw.split('\n'):
            dept = line.strip()
            if not dept:
                continue
            dept_path = f'{base}/{dept}'
            try:
                out = _ssh_exec(f"test -d '{dept_path}' && echo 1 || echo 0")
                if out != '1':
                    continue
                files_raw = _ssh_exec(f'ls -1 {dept_path}/*.yaml 2>/dev/null || true')
                if not files_raw:
                    continue
            except Exception as e:
                print(f'  SKIP {dept}: {e}')
                continue

            files_list = []
            for fname in files_raw.split('\n'):
                fname = fname.strip().rsplit('/', 1)[-1]
                if not fname or not fname.endswith('.yaml'):
                    continue
                category = fname[:-5]
                try:
                    content = _ssh_read_file(f'{dept_path}/{fname}')
                    parsed = yaml.safe_load(content) or []
                    targets = []
                    labels = {}
                    for item in parsed if isinstance(parsed, list) else [parsed]:
                        if isinstance(item, dict):
                            t = item.get('targets', [])
                            if isinstance(t, list):
                                targets.extend(t)
                            labels = item.get('labels', {}) or {}
                except Exception as e:
                    print(f'  PARSE ERROR {dept}/{fname}: {e}')
                    continue
                files_list.append({'category': category, 'targets': targets, 'labels': labels})
            if files_list:
                result[dept] = files_list
except Exception as e:
    print(f'TOP ERROR: {e}')

print(json.dumps(result, ensure_ascii=False, indent=2))
