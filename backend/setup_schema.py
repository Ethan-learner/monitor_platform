import pymysql

conn = pymysql.connect(host='172.16.10.99', port=3308, user='monitor', password='123456', database='platform', charset='utf8mb4', autocommit=True)
cur = conn.cursor()

# Execute each CREATE TABLE separately
statements = [
    # 1. Webhook 推送记录
    """CREATE TABLE IF NOT EXISTS webhook_push_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_name VARCHAR(255) NOT NULL,
    instance VARCHAR(255),
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    summary VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_alert_name (alert_name),
    INDEX idx_channel (channel),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    # 2. 审计日志
    """CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operator VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target VARCHAR(255),
    detail TEXT,
    ip VARCHAR(50),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_operator (operator),
    INDEX idx_module_action (module, action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    # 3. 用户表
    """CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    email VARCHAR(200),
    role ENUM('ops','dev','mgmt') NOT NULL DEFAULT 'dev',
    status TINYINT NOT NULL DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    # 4. 静默历史
    """CREATE TABLE IF NOT EXISTS silence_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    silence_id VARCHAR(100),
    operator VARCHAR(100) NOT NULL,
    action ENUM('create','expire') NOT NULL,
    matcher_name VARCHAR(255),
    matcher_value VARCHAR(255),
    starts_at DATETIME,
    ends_at DATETIME,
    comment VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_silence_id (silence_id),
    INDEX idx_operator (operator),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    # 5. 告警规则元数据
    """CREATE TABLE IF NOT EXISTS alert_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    expr TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning',
    duration VARCHAR(20),
    summary VARCHAR(500),
    file_name VARCHAR(255) NOT NULL,
    operator VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rule_name (rule_name),
    INDEX idx_category (category),
    INDEX idx_file_name (file_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    # 6. 平台配置
    """CREATE TABLE IF NOT EXISTS platform_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    description VARCHAR(255),
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
]

for stmt in statements:
    try:
        cur.execute(stmt)
        name = [l for l in stmt.split('\n') if 'CREATE TABLE' in l][0].split('(')[0].strip()
        print(f'OK: {name}')
    except Exception as e:
        print(f'FAIL: {e}')

cur.execute("SHOW TABLES")
print('\nTables:', ', '.join([r[0] for r in cur.fetchall()]))

cur.close(); conn.close()
print('\nStep 1.1 done')
