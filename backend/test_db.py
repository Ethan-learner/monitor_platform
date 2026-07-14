import pymysql

# test write
w = pymysql.connect(host='172.16.10.99', port=3308, user='monitor', password='123456', database='platform', autocommit=True)
wc = w.cursor(); wc.execute('SELECT COUNT(*) FROM webhook_push_log'); print(f'Write OK, webhook_push_log rows: {wc.fetchone()[0]}'); wc.close(); w.close()

# test read
r = pymysql.connect(host='172.16.10.99', port=3309, user='monitor', password='123456', database='platform', autocommit=True)
rc = r.cursor(); rc.execute('SELECT COUNT(*) FROM audit_log'); print(f'Read OK, audit_log rows: {rc.fetchone()[0]}'); rc.close(); r.close()

print('Step 1.2 done')
