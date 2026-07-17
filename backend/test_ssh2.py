import paramiko
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.16.10.27', port=22, username='lctadmin', password='Lctioc@20260318', timeout=10)

base = '/data/software/prometheus/prometheus_targets'

# Test: raw ls
stdin, stdout, stderr = ssh.exec_command(f'ls -1 {base}')
raw = stdout.read().decode().strip()
print(f'ls output: {repr(raw)}')

for line in raw.split('\n'):
    dept = line.strip()
    if not dept:
        continue
    dept_path = f'{base}/{dept}'
    print(f'\n--- {dept} ---')
    print(f'dept_path: {dept_path}')
    
    # Test dir check with quotes
    stdin, stdout, stderr = ssh.exec_command(f"test -d '{dept_path}' && echo 1 || echo 0")
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    print(f'test -d: out={repr(out)} err={repr(err)}')
    
    # Test yaml list
    stdin, stdout, stderr = ssh.exec_command(f"ls -1 '{dept_path}/*.yaml' 2>/dev/null || true")
    yaml_out = stdout.read().decode().strip()
    yaml_err = stderr.read().decode().strip()
    print(f'yaml ls: out={repr(yaml_out)} err={repr(yaml_err)}')

ssh.close()
