# 统一监控门户平台手册

> 基于最新代码自动生成 · commit: `419c011` · 后续每次改动同步更新此文档

---

## 1. 平台概览

### 1.1 项目架构

```
浏览器 → http://localhost:1009 (前端)
        → /api → http://localhost:8000 (后端 FastAPI)
        → /grafana → https://172.16.10.99 (Grafana 统一入口)
        → /pmm / /pmm-ui → 172.16.10.99 (PMM)
        → /prometheus / /vmselect / /loki / /glowroot / /backend → 各组件
        → /api/rules/* (读取/写入告警规则) → 172.16.10.27 SSH (admin)
        → /api/alerts/history → 10.206.5.212:9030 Doris (sdi 库)
```

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 8 + TypeScript 6 + Ant Design 6 + react-router 7 + zustand 5 + axios |
| 后端 | Python 3.11+ / FastAPI / uvicorn / httpx / PyJWT / PyYAML / paramiko / pymysql |
| 监控 | Prometheus / VictoriaMetrics / Loki / PMM / Glowroot / Alertmanager / Grafana |
| 数据 | Doris (告警历史) |

### 1.3 角色

| 角色 | 说明 |
|------|------|
| ops (运维) | 全部菜单，账号 `admin / admin123` |
| dev (开发) | 总览/告警/应用性能/看板 |
| mgmt (管理) | 总览/看板 |

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
PORTAL_SSH_HOST=172.16.10.27
PORTAL_SSH_USER=lctadmin
PORTAL_SSH_PASSWORD=Lctioc@20260318
PORTAL_ALERTS_DIR=/data/software/prometheus/alerts
PORTAL_DORIS_HOST=10.206.5.212
PORTAL_DORIS_USER=root
PORTAL_DORIS_PASSWORD=Longcheer@2026
PORTAL_DORIS_DATABASE=sdi
```

### 2.3 服务器配置 (部署时)

| 服务 | 地址 |
|------|------|
| Grafana VIP | `https://172.16.10.99` (路径 `/grafana/`) |
| Prometheus VIP | `https://172.16.10.99/prometheus/` |
| PMM | `https://172.16.10.99/pmm/` (iframe) + `https://172.16.10.99/pmm-ui/` |
| Glowroot | `https://172.16.10.99:4020` |
| Alertmanager | `http://172.16.10.27:9093` |
| 告警规则目录 | `172.16.10.27:/data/software/prometheus/alerts` |
| 告警历史 Doris | `10.206.5.212:9030` 库 `sdi` 表 `s20_monitor_alertmanager_alert_records` |
| 代理服务器 | `lctadmin@172.16.10.27` 密码 `Lctioc@20260318` (只读+写入 `.yml`) |

---

## 3. 菜单结构 (运维角色)

```
总览首页 (Overview)
  └── 告警摘要 + 组件健康 + 常用看板
告警中心 (Alerts)
  ├── Alerts        — 当前活跃告警 (按分类聚合)
  ├── Rules         — 告警规则 (创建/编辑/删除/预览)
  ├── Silences      — 静默规则 (Alertmanager API)
  └── 历史告警      — Doris 实时查询
系统监控 (System)
  ├── Prometheus     — Targets/Rules/Alerts 标签
  └── VictoriaMetrics — VMUI
主机监控 (Host)
  ├── 服务器 Linux
  └── 服务器 Windows
数据库监控 (Database)
  ├── 总览
  ├── MySQL
  │   ├── Overview
  │   └── Summary
  └── Query Analytics (PMM)
应用性能 (APM)
  ├── IOC 应用
  └── Java 应用 (Glowroot)
      ├── Transactions
      ├── Errors
      ├── JVM
      ├── Configuration
      └── Administration
接口监控 (API)
  └── HTTP Blackbox
作业监控 (Job)
  └── DGC
云服务监控 (Cloud)
  └── 华为云服务
      ├── 云专线(DCASS)
      ├── 对象存储(OBS)
      ├── 弹性公网IP和带宽(VPC)
      ├── 数据集成(CDM)
      └── 数据仓库(DWS)
日志监控 (Logs)
  └── Loki 日志
看板总览 (Boards)
  └── Grafana 首页
```

---

## 4. 后端 API 接口

### 4.1 认证

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/auth/login` | OIDC 跳转 (生产) |
| GET | `/api/auth/dev-login?username=&password=` | 开发 mock 登录 (dev mock 模式) |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/me` | 获取当前用户 |
| GET | `/api/auth/verify` | Nginx auth_request 子请求 |

### 4.2 告警

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/alerts?active=true/false` | Alertmanager 活跃告警 |
| GET | `/api/alerts/silences` | 静默列表 |
| GET | `/api/alerts/silences/{id}` | 静默详情 |
| POST | `/api/alerts/silences` | 创建静默 (body: matchers, startsAt, endsAt, createdBy, comment) |
| DELETE | `/api/alerts/silences/{id}` | 过期静默 |
| GET | `/api/alerts/history?limit=&offset=` | Doris 告警历史 (表 s20_monitor_alertmanager_alert_records) |

### 4.3 总览

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/overview/health` | 组件健康探活 (并发) |
| GET | `/api/overview/alerts-summary` | 告警计数 (按 severity, 去重 alertname+instance) |
| GET | `/api/healthz` | 后端存活探针 |

### 4.4 Prometheus 代理

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/prometheus/targets?state=active` | 采集目标 |
| GET | `/api/prometheus/alerts?active=true/false` | 活跃告警 |
| GET | `/api/prometheus/rules` | 告警规则 (按 group) |
| GET | `/api/prometheus/preview?query=<promql>` | 表达式预览 (执行查询) |

### 4.5 告警规则管理 (通过 SSH 写入服务器 YAML)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/rules/parsed` | 解析全部 .yml 文件的告警规则 (去服务器拉) |
| GET | `/api/rules/files` | 列出所有 .yml 文件 |
| GET | `/api/rules/files/{filename}` | 单文件内容 |
| POST | `/api/rules/files/{filename}` | 保存 (覆盖整个文件) |
| POST | `/api/rules/reload` | Prometheus 配置重载 (`-/-reload`) |
| POST | `/api/rules/preview?query=` | PromQL 查询预览 |
| POST | `/api/rules/create` | (前端 NewRules 自实现: 根据分类生成文件, 通过 SSH 写入) |
| POST | `/api/rules/update` | 修改单条规则 (filename, groupName, oldRuleName, newName, expr, for, severity, summary) |
| POST | `/api/rules/delete` | 软删除 (filename, ruleName, groupName, reason, deletedBy) — 从原文件移除, 追加到 `_disabled.yml` |

---

## 5. 前端页面

| 路径 | 组件 | 功能 |
|------|------|------|
| `/dashboard/overview` | Overview.tsx | 告警摘要 + 组件健康 + 常用看板 |
| `/dashboard/alertmanager-alerts` | RulesList.tsx | 活跃告警分类展示 |
| `/dashboard/rules` | NewRules.tsx | 告警规则 CRUD + 表达式预览 |
| `/dashboard/alertmanager-silences` | SilenceList.tsx | 静默 CRUD |
| `/dashboard/alert-history` | AlertHistory.tsx | Doris 历史告警 |
| `/dashboard/prometheus` | Prometheus.tsx | Targets/Rules/Alerts 标签 |
| `/{url}` | Dashboard.tsx | 通用 iframe 容器 (含缓存) |
| `/login` | Login.tsx | 登录页 (dev mock: admin/admin123) |

---

## 6. 关键设计

### 6.1 代理策略 (vite.config.ts)

Vite dev server 代理规则:
- `/api` → `http://localhost:8000` (后端)
- `/grafana` → `https://172.16.10.99` (Origin/Referer 重写, hideFrame)
- `/pmm`, `/pmm-ui` → `https://172.16.10.99` (重写路径, 重写 Location)
- `/glowroot`, `/backend`, `/static` → `https://172.16.10.99:4020`
- `/prometheus`, `/loki`, `/vmselect` → 直连或经 VIP

iframe 嵌入的页面统一通过 `/grafana` 代理, 加 `&kiosk` 隐藏 Grafana 顶部 UI。

### 6.2 SSH 远程规则管理

- 告警规则文件存放在服务器 `172.16.10.27:/data/software/prometheus/alerts/`
- 文件命名按分类前缀: `app_*.yml`, `db_*.yml`, `host_*.yml`, `component_*.yml`, `perf_*.yml`
- 删除的规则移至 `_disabled.yml`, 带元信息 (deleted_at, deleted_by, reason)
- 后端通过 paramiko SSH 读取/写入

### 6.3 iframe 缓存与降级

Dashboard 组件对每个 menuKey 保留最多 5 个 iframe 实例 (LRU), 切换不重载, 用 `display: none` 隐藏。

### 6.4 Doris 告警历史

通过 `pymysql` 连接 Doris (兼容 MySQL 协议), 查询 `s20_monitor_alertmanager_alert_records` 表, 按 `alert_time DESC` 倒序展示。

---

## 7. 已知限制

1. **PMM QAN 看板** - PMM 独立认证, iframe 嵌入需先在新标签页登录 PMM
2. **告警规则文件 SSH 写入** - 每次操作需 SSH 连接, 性能较低 (几十 ms 级)
3. **Doris 历史告警** - 仅展示已同步的告警, 同步延迟取决于 Flink job
4. **iframe X-Frame-Options** - 需后端代理层 strip 头, 已通过 `hideFrameHeaders` 处理
