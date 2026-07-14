import pymysql
c = pymysql.connect(host='172.16.10.99', port=3308, user='monitor', password='123456', database='platform', autocommit=True)
cur = c.cursor()
cur.execute("TRUNCATE silence_records")
cur.execute("ALTER TABLE silence_records MODIFY status TINYINT NOT NULL DEFAULT 1 COMMENT 'status: 1=active 0=expired'")
cur.execute('DESC silence_records')
for r in cur.fetchall(): print(r)
cur.close(); c.close()
print('done')
