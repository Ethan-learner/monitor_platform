import pymysql, json
c = pymysql.connect(host='172.16.10.99', port=3308, user='monitor', password='123456', database='platform', autocommit=True)
cur = c.cursor()

# 1. 通知策略模板表
cur.execute("""
CREATE TABLE IF NOT EXISTS alert_strategies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT '策略名称',
    label VARCHAR(100) COMMENT '显示名: 运维紧急通知/开发通知',
    description VARCHAR(500) COMMENT '策略说明',
    config JSON NOT NULL COMMENT '{"critical":{"email":[],"lark":[]},"warning":{"email":[]}}',
    enabled TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警通知策略模板'
""")

# 2. 告警规则增加策略关联
try: cur.execute("ALTER TABLE alert_rules ADD COLUMN strategy_id BIGINT AFTER operator")
except: pass
try: cur.execute("ALTER TABLE alert_rules ADD COLUMN custom_notify JSON AFTER strategy_id COMMENT '自定义通知配置(覆盖策略)'")
except: pass

# 3. 插入默认策略
defaults = [
    ('ops_critical', '运维紧急通知', 'critical级别：邮件+飞书双通道', '{"critical":{"email":["zhulei1@longcheer.com"],"lark":["25171402"]},"warning":{},"info":{}}'),
    ('dev_warning', '开发通知', 'warning级别：仅邮件', '{"critical":{},"warning":{"email":["dev-team@longcheer.com"]},"info":{}}'),
]
for name, label, desc, cfg in defaults:
    cur.execute("INSERT IGNORE INTO alert_strategies (name, label, description, config) VALUES (%s,%s,%s,%s)", (name, label, desc, cfg))

cur.execute('SELECT id, name, label FROM alert_strategies')
for r in cur.fetchall(): print(r)
cur.close(); c.close()
print('done')
