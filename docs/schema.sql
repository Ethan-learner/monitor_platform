-- ============================================================
-- 统一监控门户 · MySQL 元数据库初始化脚本
-- 服务器: 172.16.10.99:3308 (写) / 172.16.10.99:3309 (读)
-- 执行前先创建数据库和用户:
--   CREATE DATABASE platform DEFAULT CHARSET utf8mb4;
--   CREATE USER 'monitor'@'%' IDENTIFIED BY '123456';
--   GRANT ALL ON platform.* TO 'monitor'@'%';
-- ============================================================

-- 1. Webhook 推送记录
CREATE TABLE IF NOT EXISTS webhook_push_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_name VARCHAR(255) NOT NULL COMMENT '告警名称',
    instance VARCHAR(255) COMMENT '实例',
    channel VARCHAR(50) NOT NULL COMMENT '推送通道: email/lark/kafka/vm',
    status VARCHAR(20) NOT NULL COMMENT '状态: success/failed',
    summary VARCHAR(500) COMMENT '推送摘要/错误信息',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '推送时间',
    INDEX idx_alert_name (alert_name),
    INDEX idx_channel (channel),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Webhook推送记录';

-- 2. 平台操作审计日志
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operator VARCHAR(100) NOT NULL COMMENT '操作人',
    module VARCHAR(50) NOT NULL COMMENT '模块: rules/silences/webhook/config',
    action VARCHAR(50) NOT NULL COMMENT '操作: create/update/delete/expire/test/reload',
    target VARCHAR(255) COMMENT '操作对象 (规则名/静默ID等)',
    detail TEXT COMMENT '操作详情 JSON',
    ip VARCHAR(50) COMMENT '客户端IP',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    INDEX idx_operator (operator),
    INDEX idx_module_action (module, action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作审计日志';

-- 3. 用户表 (预留给 OIDC 对接)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE COMMENT '用户名',
    display_name VARCHAR(100) COMMENT '显示名',
    email VARCHAR(200) COMMENT '邮箱',
    role ENUM('ops','dev','mgmt') NOT NULL DEFAULT 'dev' COMMENT '角色',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=禁用',
    last_login DATETIME COMMENT '最后登录时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 4. 静默操作历史
CREATE TABLE IF NOT EXISTS silence_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    silence_id VARCHAR(100) COMMENT 'Alertmanager 静默ID',
    operator VARCHAR(100) NOT NULL COMMENT '操作人',
    action ENUM('create','expire') NOT NULL COMMENT '操作',
    matcher_name VARCHAR(255) COMMENT '匹配标签名',
    matcher_value VARCHAR(255) COMMENT '匹配值',
    starts_at DATETIME COMMENT '开始时间',
    ends_at DATETIME COMMENT '结束时间',
    comment VARCHAR(500) COMMENT '备注/原因',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_silence_id (silence_id),
    INDEX idx_operator (operator),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='静默操作历史';

-- 5. 告警规则元数据
CREATE TABLE IF NOT EXISTS alert_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL COMMENT '规则名称',
    category VARCHAR(50) NOT NULL COMMENT '分类: app/db/host/component/perf',
    expr TEXT NOT NULL COMMENT 'PromQL 表达式',
    severity VARCHAR(20) DEFAULT 'warning' COMMENT '级别: info/warning/critical',
    duration VARCHAR(20) COMMENT '持续时间: 1m/5m 等',
    summary VARCHAR(500) COMMENT '描述',
    file_name VARCHAR(255) NOT NULL COMMENT '所属 YAML 文件名',
    operator VARCHAR(100) NOT NULL COMMENT '最后操作人',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rule_name (rule_name),
    INDEX idx_category (category),
    INDEX idx_file_name (file_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警规则元数据';

-- 6. 平台配置 (KV)
CREATE TABLE IF NOT EXISTS platform_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    description VARCHAR(255) COMMENT '说明',
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='平台配置';
