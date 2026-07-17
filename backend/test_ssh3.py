import paramiko

base = '/data/software/prometheus/prometheus_targets'
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.16.10.27', port=22, username='lctadmin', password='Lctioc@20260318', timeout=10)

# Test 1: ls base no quotes
stdin, stdout, stderr = ssh.exec_command(f'ls -1 {base}')
out = stdout.read().decode('utf-8', errors='replace').strip()
err = stderr.read().decode('utf-8', errors='replace').strip()
print(f'ls base (no quotes): out={repr(out[:200])} err={repr(err[:200])}')
print(f'out is empty: {not out}')

ssh.close()
