import pymysql
c = pymysql.connect(host='172.16.10.99', port=3308, user='monitor', password='123456', database='platform', autocommit=True)
cur = c.cursor()
# Add missing label columns
cols = [
    ("job", "VARCHAR(100)"),
    ("criticality", "VARCHAR(20)"),
    ("owner", "VARCHAR(100)"),
    ("resource_category", "VARCHAR(50)"),
    ("resource_type", "VARCHAR(50)"),
    ("region", "VARCHAR(50)"),
]
for name, dtype in cols:
    try:
        cur.execute(f"ALTER TABLE alert_records ADD COLUMN {name} {dtype} AFTER service")
        print(f"OK: {name}")
    except Exception as e:
        print(f"Skip {name}: {e}")
cur.execute('DESC alert_records')
for r in cur.fetchall(): print(r[0], r[1])
cur.close(); c.close()
print('done')
