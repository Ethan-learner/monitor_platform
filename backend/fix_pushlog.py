import pymysql
c = pymysql.connect(host='172.16.10.99', port=3308, user='monitor', password='123456', database='platform', autocommit=True)
cur = c.cursor()
cur.execute("ALTER TABLE webhook_push_log ADD COLUMN recipient VARCHAR(200) AFTER channel")
cur.execute("ALTER TABLE webhook_push_log ADD COLUMN alert_reason VARCHAR(500) AFTER status")
cur.execute('DESC webhook_push_log')
for r in cur.fetchall(): print(r)
cur.close(); c.close()
print('done')
