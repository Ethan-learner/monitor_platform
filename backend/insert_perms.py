import pymysql

conn = pymysql.connect(host='172.16.10.99', port=3308, user='monitor', password='123456', database='platform', charset='utf8mb4', autocommit=True)
cur = conn.cursor()

# 先看现有记录
cur.execute("SELECT `key`, label FROM system_permissions ORDER BY `key`")
existing = {r[0] for r in cur.fetchall()}
print(f'Existing permissions: {len(existing)}')

# 功能权限 key 列表
perms = [
    ('scrape-configs:view', '查看目标', 'scrape'),
    ('scrape-configs:create', '新增目标', 'scrape'),
    ('scrape-configs:edit', '编辑目标', 'scrape'),
    ('scrape-configs:delete', '删除目标', 'scrape'),
    ('scrape-configs:toggle', '禁用/启用目标', 'scrape'),
    ('scrape-configs:folder:view', '查看文件夹', 'scrape'),
    ('scrape-configs:folder:create', '新建文件夹', 'scrape'),
    ('scrape-configs:folder:delete', '删除文件夹', 'scrape'),
    ('scrape-configs:file:view', '查看配置文件', 'scrape'),
    ('scrape-configs:file:create', '新建配置文件', 'scrape'),
    ('scrape-configs:file:delete', '删除配置文件', 'scrape'),
    ('rules:view', '查看规则', 'alert'),
    ('rules:create', '创建规则', 'alert'),
    ('rules:edit', '编辑规则', 'alert'),
    ('rules:delete', '删除规则', 'alert'),
    ('rules:toggle', '禁用/启用规则', 'alert'),
    ('silence:view', '查看静默', 'alert'),
    ('silence:create', '创建静默', 'alert'),
    ('silence:expire', '过期静默', 'alert'),
    ('silence:delete', '删除静默', 'alert'),
    ('strategy:view', '查看策略', 'alert'),
    ('strategy:create', '创建策略', 'alert'),
    ('strategy:edit', '编辑策略', 'alert'),
    ('strategy:delete', '删除策略', 'alert'),
    ('strategy:toggle', '禁用/启用策略', 'alert'),
    ('user:view', '查看用户', 'settings'),
    ('user:create', '新增用户', 'settings'),
    ('user:edit', '编辑用户', 'settings'),
    ('user:delete', '删除用户', 'settings'),
    ('user:toggle', '禁用/启用用户', 'settings'),
    ('user:role', '分配角色', 'settings'),
]

inserted = 0
for key, label, module in perms:
    if key not in existing:
        cur.execute("INSERT INTO system_permissions (`key`, label, module) VALUES (%s,%s,%s)", (key, label, module))
        inserted += 1

print(f'Inserted: {inserted} new permission keys')
cur.close()
conn.close()
