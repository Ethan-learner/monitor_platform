import pymysql

conn = pymysql.connect(host='172.16.10.99', port=3308, user='root', password='Lctioc@20260318', charset='utf8mb4', autocommit=True)
cur = conn.cursor()

cur.execute('CREATE DATABASE IF NOT EXISTS platform DEFAULT CHARSET utf8mb4')
print('DB created')

try:
    cur.execute("CREATE USER 'monitor'@'%' IDENTIFIED BY '123456'")
    print('User created')
except Exception as e:
    print('User may exist:', e)

cur.execute("GRANT ALL ON platform.* TO 'monitor'@'%'")
print('Privileges granted')
cur.close(); conn.close()
print('Step 1.1a done')
