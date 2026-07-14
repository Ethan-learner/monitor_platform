import pymysql
c = pymysql.connect(host='172.16.10.99', port=3308, user='monitor', password='123456', database='platform', autocommit=True)
cur = c.cursor()

# 接收人配置表
cur.execute("""
CREATE TABLE IF NOT EXISTS alert_recipients (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(100) COMMENT '规则名称: default/ops/dev',
    severity VARCHAR(20) COMMENT '告警级别: critical/warning/info',
    channel VARCHAR(20) NOT NULL COMMENT '通道: email/lark/phone',
    recipients JSON NOT NULL COMMENT '接收人列表',
    enabled TINYINT DEFAULT 1 COMMENT '1=启用 0=禁用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rule (rule_name, severity, channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警接收人配置'
""")

# 修改 push_log 的 recipient 字段为 TEXT（存 JSON）
cur.execute("ALTER TABLE webhook_push_log MODIFY recipient TEXT COMMENT '接收人JSON'")

# 插入默认配置
defaults = [
    ('default', 'critical', 'email', '["zhulei1@longcheer.com"]'),
    ('default', 'critical', 'lark', '["25171402"]'),
    ('default', 'warning', 'email', '["zhulei1@longcheer.com"]'),
    ('default', 'warning', 'lark', '["25171402"]'),
]
for rule, sev, ch, recips in defaults:
    cur.execute(
        "INSERT IGNORE INTO alert_recipients (rule_name, severity, channel, recipients) VALUES (%s,%s,%s,%s)",
        (rule, sev, ch, recips)
    )

cur.execute('SHOW TABLES')
print('Tables:', [r[0] for r in cur.fetchall()])
cur.close(); c.close()
print('done')
