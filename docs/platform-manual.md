# 统一监控门户平台手册

> 基于 feat/monitor-portal 分支最新代码 · 2026-07-16

---

## 1. 平台概览

### 1.1 项目架构

```
浏览器 → http://localhost:1009 (前端 Vite)
         → /api → http://localhost:8000 (后端 FastAPI)
         → /grafana → https://172.16.10.99 (Grafana 统一入口)
         → /pmm / /pmm-ui → 172.16.10.99 (PMM)
         → /prometheus / /vmselect / /loki / /glowroot / /backend → 各组件
         → /api/rules/* → MySQL + SSH → 172.16.10.27 (规则文件)
         → /api/alerts/* → MySQL (告警记录/静默/策略)
         → /api/auth/login → http://eip.longcheer.com:8009 (域控认证)
         → /api/webhook/* → http://172.16.10.27:8090 (webhook_redis.py)
```

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 8 + TypeScript 6 + Ant Design 6 + react-router 7 + zustand 5 + axios |
| 后端 | Python 3.8+ / FastAPI / uvicorn / httpx / PyJWT / PyYAML / paramiko / pymysql |
| 监控 | Prometheus (3节点) / VictoriaMetrics / Loki / PMM / Glowroot / Alertmanager / Grafana |
| 数据 | MySQL 8.0 (元数据库) / VictoriaMetrics (时序) |
| 认证 | 域控 EIP API + JWT Cookie / dev-mock 兜底 |

### 1.3 角色

| 角色 | 说明 | 菜单范围 |
|------|------|---------|
| ops (运维) | 全部菜单 | 总览/告警中心/系统监控/主机/数据库/APM/接口/作业/云服务/日志/看板 |
| dev (开发) | 部分菜单 | 总览/告警中心(Alerts+Rules)/APM/看板 |
| mgmt (管理) | 精简菜单 | 总览/看板 |

---

## 2. 部署配置

### 2.1 启动命令

```bash
# 后端 (FastAPI)
cd backend
.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000

# 前端 (Vite)
cd frontend
npm run dev    # http://localhost:1009
```

### 2.2 环境变量 (backend/.env)

```env
PORTAL_DEV_MOCK=true
PORTAL_JWT_SECRET=dev-secret-key-change-in-prod
PORTAL_EIP_URL=http://eip.longcheer.com:8009/api/v1/common/user/login
PORTAL_SSH_HOST=172.16.10.27
PORTAL_SSH_USER=lctadmin
PORTAL_SSH_PASSWORD=Lctioc@20260318
PORTAL_ALERTS_DIR=/data/software/prometheus/alerts
PORTAL_MYSQL_WRITE_HOST=172.16.10.99
PORTAL_MYSQL_WRITE_PORT=3308
PORTAL_MYSQL_READ_HOST=172.16.10.99
PORTAL_MYSQL_READ_PORT=3309
PORTAL_MYSQL_USER=monitor
PORTAL_MYSQL_PASSWORD=123456
PORTAL_MYSQL_DATABASE=platform
PORTAL_DORIS_HOST=10.206.5.212
PORTAL_DORIS_USER=root
PORTAL_DORIS_PASSWORD=Longcheer@2026
PORTAL_DORIS_DATABASE=sdi
```

### 2.3 服务器配置

| 服务 | 地址 |
|------|------|
| Grafana VIP | `https://172.16.10.99` (路径 `/grafana/`) |
| Prometheus (3节点) | `http://172.16.10.27:9090` / `.28:9090` / `.29:9090` |
| PMM | `https://172.16.10.99/pmm/` + `/pmm-ui/` |
| Glowroot | `https://172.16.10.99:4020` |
| Alertmanager | `http://172.16.10.27:9093` |
| 告警规则目录 | `172.16.10.27:/data/software/prometheus/alerts/` |
| 禁用规则目录 | `172.16.10.27:/data/software/prometheus/alerts_disabled/` |
| 删除规则目录 | `172.16.10.27:/data/software/prometheus/alerts_deleted/` |
| 告警历史 (原 Doris) | `10.206.5.212:9030` 库 `sdi` (已切换到 MySQL) |
| SSH | `lctadmin@172.16.10.27` 密码 `Lctioc@20260318` |
| Webhook (3节点) | `http://172.16.10.27:8090` / `.28:8090` / `.29:8090` |
| 域控 EIP | `http://eip.longcheer.com:8009/api/v1/common/user/login` |
| MySQL 元数据库(写) | `172.16.10.99:3308` 库 `platform` 用户 `monitor` |
| MySQL 元数据库(读) | `172.16.10.99:3309` 库 `platform` 用户 `monitor` |

---

## 3. 菜单结构 (运维角色)

```
总览首页 (Overview)                        — 告警摘要+组件健康+常用看板
告警中心 (Alerts)
  ├── Alerts         — 活跃告警分类展示 (Prometheus API 实时)
  ├── Rules          — 告警规则 CRUD + 表达式预览 + 策略挂载
  ├── Silences       — 静默规则管理 (多条件匹配+创建/过期/重置)
  ├── 历史告警       — MySQL alert_records 分页查询
  └── 通知策略       — 分层分级通知策略 CRUD
系统监控 (System)
  ├── Prometheus     — Targets/Alerts 标签页
  ├── VictoriaMetrics
  └── Webhook        — 拓扑图+推送记录+集群节点
主机监控 (Host) → Linux/Windows Grafana
数据库监控 (Database) → PMM MySQL 看板
应用性能 (APM) → IOC 应用 / Java 应用 (Glowroot)
接口监控 (API) → HTTP Blackbox
作业监控 (Job) → DGC
云服务监控 (Cloud) → 华为云服务 (5个看板)
日志监控 (Logs) → Loki 日志
看板总览 (Boards) → Grafana 首页
```

---

## 4. 认证体系

### 4.1 登录流程

```
前端 POST /api/auth/login {username, password}
    │
    ├─ 调用域控 EIP API 验证
    │     ├─ 成功 → 提取 personName/personCode/deptName
    │     └─ 失败/不可达 → dev_mock 兜底 (admin/admin123)
    │
    ├─ 同步 users 表 (INSERT/UPDATE)
    ├─ 写入 login_logs (IP/UserAgent/结果)
    ├─ 签发 JWT Cookie (HS256, 24h TTL)
    └─ 返回 {username, role, displayName}
```

### 4.2 认证接口

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/auth/login` | 域控登录 (JSON body) |
| GET | `/api/auth/dev-login` | 开发 mock 登录 (query params) |
| GET | `/api/auth/login` | OIDC 跳转 (预埋) |
| GET | `/api/auth/callback` | OIDC 回调 (预埋) |
| POST | `/api/auth/logout` | 退出 |
| GET | `/api/auth/me` | 当前用户信息 |
| GET | `/api/auth/verify` | Nginx auth_request 校验 |

---

## 5. MySQL 元数据库

### 5.1 数据库连接

- 写库: `172.16.10.99:3308` (主)
- 读库: `172.16.10.99:3309` (从)
- 库名: `platform` / 用户: `monitor` / 密码: `123456`

### 5.2 表结构

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `alert_rules` | 告警规则元数据 | rule_name, category, expr, severity, duration, file_name, strategy_id, custom_notify(JSON), status(1/0/-1) |
| `alert_strategies` | 通知策略 | name(自动生成), label, config(JSON: {critical:{email:[],lark:[]}}), enabled(1/0/-1) |
| `alert_records` | 告警历史记录 | alert_name, instance, severity, status, department, project, env, service, region, recipients(JSON), starts_at, ends_at, fingerprint |
| `silence_records` | 静默规则 | silence_id, operator, matchers(JSON), starts_at, ends_at, comment, status(1/0/-1) |
| `webhook_push_log` | 推送记录 | alert_name, instance, channel, recipient, status, action(firing/resolved/repeat), summary |
| `users` | 用户档案 | username, person_code, display_name, email, department, role, status, last_login |
| `login_logs` | 登录日志 | user_id, username, display_name, person_code, department, login_time, ip_address, user_agent, result, failed_reason |
| `audit_log` | 操作审计 | operator, module, action, target, detail |
| `platform_config` | 平台配置 | config_key, config_value |

### 5.3 状态约定

| 模块 | status=1 | status=0 | status=-1 |
|------|----------|----------|-----------|
| alert_rules | 启用 | 禁用 | 已删除 |
| alert_strategies | 启用 | 禁用 | 已删除 |
| silence_records | 活跃 | 已过期 | 已删除 |

---

## 6. 告警规则管理

### 6.1 文件架构

```
/data/software/prometheus/
  ├── alerts/              ← 生效规则 (Prometheus 加载)
  │     ├── host_instancedown.yml
  │     ├── host_lowdiskspace.yml
  │     ├── db_mysqldown.yml
  │     └── platform_redisdown.yml
  ├── alerts_disabled/     ← 禁用规则 (保持原名)
  ├── alerts_deleted/      ← 删除规则 (带时间戳后缀)
  └── alerts_bak/          ← 原始备份
```

- **一规则一文件**，文件名 = `{category_prefix}_{rule_name_lower}.yml`
- Prometheus `rule_files: "alerts/*.yml"` 通配加载
- 禁用 → 移入 `alerts_disabled/`（保持原名，可恢复）
- 删除 → 移入 `alerts_deleted/`（加 `_YYYYMMDDHHmmss` 时间戳）
- 每次操作后自动三节点热加载 `POST /-/reload`

### 6.2 规则 CRUD 接口

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/rules/parsed` | 读取全部规则 (MySQL) |
| POST | `/api/rules/files/{filename}` | 创建规则 (MySQL + SSH写文件 + reload) |
| POST | `/api/rules/update` | 编辑规则 (MySQL + SSH重写 + reload) |
| POST | `/api/rules/delete` | 删除规则 (MySQL status=-1 + SSH移文件 + reload) |
| POST | `/api/rules/disable` | 禁用/启用 (MySQL status切换 + SSH移文件 + reload) |
| POST | `/api/rules/reload` | 三节点热加载 |
| GET | `/api/rules/preview?query=` | PromQL 表达式预览 |

### 6.3 唯一性校验

- 创建时检查 `rule_name` 在未删除记录中是否重复 → 409
- 编辑改名时同样检查
- 已删除(status=-1)的同名规则可以重建

---

## 7. 通知策略

### 7.1 策略结构

```json
{
  "critical": {"email": ["zhulei1@longcheer.com"], "lark": ["25171402"]},
  "warning": {"email": ["zhulei1@longcheer.com"]},
  "info": {}
}
```

- `name` 字段由后端自动生成 (`strat_` + UUID)
- `label` 为用户可见名称，唯一性校验仅对未删除记录
- 覆盖级别下拉：critical → 展开全部3级, warning → 2级, info → 1级
- 降级保存时清空隐藏级别数据

### 7.2 策略接口

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/alerts/strategies` | 策略列表 |
| POST | `/api/alerts/strategies` | 创建策略 (label唯一) |
| PUT | `/api/alerts/strategies/{id}` | 编辑策略 (同步关联规则severity) |
| DELETE | `/api/alerts/strategies/{id}` | 删除策略 (自动禁用关联规则) |
| PUT | `/api/alerts/strategies/{id}/disable` | 禁用/启用 |
| GET | `/api/alerts/strategies/{id}/refs` | 引用计数 |

### 7.3 规则与策略关联

- 规则创建/编辑时选择策略 → `strategy_id` 关联
- 选"自定义" → `custom_notify` JSON 直接存储，不关联策略
- 策略变更 → 自动同步关联规则的 severity
- 策略删除 → 关联规则自动禁用 (status=0)
- 重建同名策略 → 自动恢复关联规则 (status=1) 并同步 severity

---

## 8. 静默规则管理

### 8.1 架构

```
Alertmanager (源数据)           MySQL silence_records (元数据)
       │                              │
  POST/DELETE 创建/过期         INSERT/UPDATE status
       │                              │
       └──────── 平台 ────────────────┘
```

- 平台从 MySQL 读取静默列表（不直连 Alertmanager）
- 写操作同时写 Alertmanager + MySQL
- 结束时间 < 当前时间 → 自动标记 status=0

### 8.2 多条件匹配

```json
matchers: [
  {"name": "alertname", "value": "InstanceDown", "isRegex": false},
  {"name": "instance", "value": "10.0.0.1", "isRegex": false}
]
```

### 8.3 操作

| 操作 | 前端 | Alertmanager | MySQL |
|------|------|-------------|-------|
| 创建 | 多条件弹窗 | POST 创建 | INSERT status=1 |
| 过期 | Popconfirm | DELETE 过期 | UPDATE status=0 |
| 重置 | 弹窗编辑时间 | DELETE旧+POST新 | 旧→0, 新→1 |
| 删除 | Popconfirm | DELETE | UPDATE status=-1 |

---

## 9. 告警记录

### 9.1 数据来源

- Alerts 页面：实时从 Prometheus API `/api/v1/alerts` 拉取
- 同步写入 MySQL `alert_records`（firing → INSERT, resolved → UPDATE ends_at）
- 历史告警页面：从 MySQL `alert_records` 分页查询

### 9.2 alert_records 字段

| 字段 | 来源 |
|------|------|
| alert_name, instance, severity | Prometheus labels |
| department, project, env, service, region | Prometheus labels |
| status | firing / resolved |
| recipients (JSON) | 接收人快照 (webhook 写入) |
| starts_at, ends_at | Prometheus activeAt / resolved time |
| fingerprint | alert_name\|instance\|severity 组合去重 |

---

## 10. Webhook 集成

### 10.1 架构

```
Alertmanager → Webhook 服务 (webhook_redis.py:8090)
                    │
                    ├─ 查 MySQL alert_rules → strategy_id / custom_notify
                    ├─ 查 alert_strategies.config → 按 severity 分发
                    ├─ 发送邮件/飞书 (按策略配置)
                    ├─ 写 VM (alarm_info 时序指标)
                    ├─ 写 MySQL alert_records (告警落库)
                    └─ 写 webhook_push_log (推送日志)
```

### 10.2 推送记录展示

- 前端按 alertName+instance 分组合并 email/lark 通道
- 通道未触发（策略未配置）→ 灰色"未触发"
- 通道已触发 → 绿色"成功"/红色"失败"
- `action` 字段：firing / resolved / repeat

### 10.3 Webhook 接口

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/webhook/health` | 三节点健康探针 |
| GET | `/api/webhook/status` | 子服务状态 |
| POST | `/api/webhook/test` | 测试告警 |
| POST | `/api/webhook/resend` | 重发告警 |
| GET | `/api/webhook/push-log` | 推送记录 |

---

## 11. 前端页面

| 路径 | 组件 | 功能 |
|------|------|------|
| `/login` | Login.tsx | 登录 (域控 + mock 兜底) |
| `/dashboard/overview` | Overview.tsx | 告警摘要+组件健康+常用看板 |
| `/dashboard/alertmanager-alerts` | RulesList.tsx | 活跃告警分类展示 |
| `/dashboard/rules` | NewRules.tsx | 告警规则 CRUD + 展开行 + 策略挂载 |
| `/dashboard/alertmanager-silences` | SilenceList.tsx | 静默规则管理 |
| `/dashboard/alert-history` | AlertHistory.tsx | 历史告警 (MySQL) |
| `/dashboard/strategy-config` | StrategyConfig.tsx | 通知策略 CRUD |
| `/dashboard/webhook-events` | WebhookEvents.tsx | Webhook 拓扑+推送记录 |
| `/dashboard/prometheus` | Prometheus.tsx | Targets/Alerts 标签 |
| `/{url}` | Dashboard.tsx | 通用 iframe 容器 (LRU 缓存, max 5) |

---

## 12. 关键设计

### 12.1 代理策略 (vite.config.ts)

- `/api` → `http://localhost:8000` (后端)
- `/grafana` → `https://172.16.10.99` (Origin/Referer 重写, hideFrame)
- `/pmm` `/pmm-ui` → `https://172.16.10.99` (路径重写+Location 重写)
- `/glowroot` `/backend` `/static` → `https://172.16.10.99:4020`
- `/prometheus` `/loki` `/vmselect` → VIP 或直连

iframe 嵌入统一通过代理 + `&kiosk` 隐藏 Grafana 顶部 UI。

### 12.2 iframe 缓存

Dashboard 组件对每个 menuKey 保留最多 5 个 iframe (LRU), 切换不重载, `display: none` 隐藏。

### 12.3 告警规则同步

```
前端 CRUD → 后端 → MySQL (元数据) + SSH (YAML文件) + 三节点Reload
```

- MySQL 是元数据源（规则内容、策略关联、状态）
- SSH 写入 Prometheus YAML 文件（一规则一文件）
- 每次操作后自动三节点热加载
- 文件移动：禁用→`alerts_disabled/`，删除→`alerts_deleted/`（带时间戳）

### 12.4 告警风暴防护（待实施）

- 创建规则时校验表达式是否有标签过滤
- 预览匹配实例数，超阈值弹窗确认

---

## 13. 已知限制

1. **PMM QAN 看板** - PMM 独立认证, iframe 嵌入需先在新标签页登录 PMM
2. **多级别触发时间差** - 同告警不同 `for` 规则因独立评估存在时间差，前端已统一取最早值
3. **Webhook 策略分发** - webhook 服务需对接 MySQL 策略表实现分层通知（平台侧已完成接口）
4. **告警风暴防护** - 表达式校验和预览确认尚未实施

---

## 14. 后续优化项

| 序号 | 项目 | 描述 | 状态 |
|------|------|------|------|
| 1 | MySQL 元数据库 | 策略/规则/静默/告警记录/用户/登录日志 全部已集成 | ✅ 已完成 |
| 2 | 域控认证集成 | EIP API 登录 + users/login_logs 双表同步 | ✅ 已完成 |
| 3 | 告警规则同步 | MySQL → SSH YAML 文件 + 三节点热加载 | ✅ 已完成 |
| 4 | 通知策略管理 | 分层分级 CRUD + 规则关联 + 自动同步 severity | ✅ 已完成 |
| 5 | 静默规则管理 | 多条件匹配 + 创建/过期/重置/删除 + MySQL 元数据 | ✅ 已完成 |
| 6 | Webhook 推送记录 | 推送日志展示 + 通道未触发区分 | ✅ 已完成 |
| 7 | 飞书通讯录集成 | 策略配置选人时调用飞书 API 按工号/姓名检索 | 待实施 |
| 8 | 告警风暴防护 | 表达式校验 + 预览匹配实例数 + 确认弹窗 | 待实施 |
| 9 | OIDC 单点登录 | 对接公司统一身份平台 (域控已替代) | 低优先级 |
| 10 | 审计日志查询页 | audit_log 表已写入，前端查询页面待开发 | 待实施 |
