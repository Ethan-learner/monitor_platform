# 统一监控门户平台手册

> 基于最新代码自动生成 · commit: `f9006cf` · 后续每次改动同步更新此文档

---

## 1. 平台概览

### 1.1 项目架构

```
浏览器 → http://localhost:1009 (前端)
        → /api → http://localhost:8000 (后端 FastAPI)
        → /grafana → https://172.16.10.99 (Grafana 统一入口)
        → /pmm / /pmm-ui → 172.16.10.99 (PMM)
        → /prometheus / /vmselect / /loki / /glowroot / /backend → 各组件
        → /api/rules/* (读取/写入告警规则) → 172.16.10.27 SSH
        → /api/alerts/history → 10.206.5.212:9030 Doris
        → /api/webhook/* → http://172.16.10.27:8090 (webhook_redis.py)
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
| PMM | `https://172.16.10.99/pmm/` + `https://172.16.10.99/pmm-ui/` |
| Glowroot | `https://172.16.10.99:4020` |
| Alertmanager | `http://172.16.10.27:9093` |
| 告警规则目录 | `172.16.10.27:/data/software/prometheus/alerts` |
| 告警历史 Doris | `10.206.5.212:9030` 库 `sdi` 表 `s20_monitor_alertmanager_alert_records` |
| 代理服务器 | `lctadmin@172.16.10.27` 密码 `Lctioc@20260318` (只读+写入 `.yml`) |
| Webhook 服务 | `http://172.16.10.27:8090` (webhook_redis.py 标准入口) |
| Glowroot 适配 | `http://172.16.10.27:8095` (glowroot_adapt.py) |

---

## 3. 菜单结构 (运维角色)

```
总览首页 (Overview)                        — 告警摘要+组件健康+常用看板
告警中心 (Alerts)
  ├── Alerts         — 活跃告警分类展示
  ├── Rules          — 告警规则 CRUD + 表达式预览
  ├── Silences       — 静默 CRUD
  ├── 历史告警       — Doris 实时查询
  └── Webhook 管理   — Webhook 状态监控+测试+重发
系统监控 (System)
  ├── Prometheus
  └── VictoriaMetrics
主机监控 (Host) → Linux/Windows Grafana
数据库监控 (Database)
  ├── 总览 / MySQL (Overview, Summary) / Query Analytics (PMM 标签页)
应用性能 (APM) → IOC 应用 / Java 应用 (Glowroot 5 个子页)
接口监控 (API) → HTTP Blackbox
作业监控 (Job) → DGC
云服务监控 (Cloud) → 华为云服务 (5 个 Grafana 看板)
日志监控 (Logs) → Loki 日志
看板总览 (Boards) → Grafana 首页
```

---

## 4. 后端 API 接口

### 4.1 认证

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/auth/login` | OIDC 跳转 (生产) |
| GET | `/api/auth/dev-login?username=&password=` | 开发 mock 登录 |
| POST | `/api/auth/logout` | 退出 |
| GET | `/api/auth/me` | 当前用户 |
| GET | `/api/auth/verify` | Nginx auth_request |

### 4.2 告警

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/alerts?active=true/false` | Alertmanager 活跃告警 |
| GET | `/api/alerts/silences` | 静默列表 |
| GET | `/api/alerts/silences/{id}` | 静默详情 |
| POST | `/api/alerts/silences` | 创建静默 |
| DELETE | `/api/alerts/silences/{id}` | 过期静默 |
| GET | `/api/alerts/history?limit=&offset=` | Doris 告警历史 |

### 4.3 总览

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/overview/health` | 组件健康探活 |
| GET | `/api/overview/alerts-summary` | 告警计数 (去重 alertname+instance) |
| GET | `/api/healthz` | 后端存活 |

### 4.4 Prometheus 代理

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/prometheus/targets` | 采集目标 |
| GET | `/api/prometheus/alerts` | 活跃告警 |
| GET | `/api/prometheus/rules` | 告警规则 |
| GET | `/api/prometheus/preview?query=` | 表达式预览 |

### 4.5 告警规则管理 (SSH)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/rules/parsed` | 解析全部 .yml 规则 |
| GET/POST | `/api/rules/files/{filename}` | 读取/保存文件 |
| POST | `/api/rules/reload` | Prometheus 重载 |
| POST | `/api/rules/update` | 修改单条规则 |
| POST | `/api/rules/delete` | 软删除 (移至 _disabled.yml) |

### 4.6 Webhook 告警分发

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/webhook/health` | 服务存活探针 (返回 status/latencyMs/code) |
| GET | `/api/webhook/status` | 子服务状态 (Redis/Kafka/线程池等) |
| POST | `/api/webhook/test` | 发送测试告警 (body: receiver, severity, summary) |
| POST | `/api/webhook/resend` | 重发告警 (body: fingerprint, receiver) |

依赖 webhook 服务提供的接口 (假设):
- `GET /health` - 健康检查
- `GET /status` - 返回 `{services: [...], stats: {...}}` 或类似结构
- `POST /test` - 接收测试告警
- `POST /resend` - 接收重发请求

---

## 5. 前端页面

| 路径 | 组件 | 功能 |
|------|------|------|
| `/dashboard/overview` | Overview.tsx | 告警摘要+组件健康+常用看板 |
| `/dashboard/alertmanager-alerts` | RulesList.tsx | 活跃告警分类展示 |
| `/dashboard/rules` | NewRules.tsx | 告警规则 CRUD + 表达式预览 (弹窗) |
| `/dashboard/alertmanager-silences` | SilenceList.tsx | 静默 CRUD + 过滤器 (创建人/状态) |
| `/dashboard/alert-history` | AlertHistory.tsx | Doris 历史告警 (分页+排序) |
| `/dashboard/webhook-manage` | WebhookManage.tsx | Webhook 状态+测试+重发 |
| `/dashboard/prometheus` | Prometheus.tsx | Targets/Rules/Alerts 标签 |
| `/{url}` | Dashboard.tsx | 通用 iframe 容器 (LRU 缓存, max 5) |
| `/login` | Login.tsx | 登录 (dev mock) |

---

## 6. 关键设计

### 6.1 代理策略 (vite.config.ts)

- `/api` → `http://localhost:8000` (后端)
- `/grafana` → `https://172.16.10.99` (Origin/Referer 重写, hideFrame)
- `/pmm` `/pmm-ui` → `https://172.16.10.99` (路径重写+Location 重写)
- `/glowroot` `/backend` `/static` → `https://172.16.10.99:4020`
- `/prometheus` `/loki` `/vmselect` → VIP 或直连

iframe 嵌入统一通过 `/grafana` 代理 + `&kiosk` 隐藏 Grafana 顶部 UI。

### 6.2 SSH 远程规则管理

- 告警规则目录 `172.16.10.27:/data/software/prometheus/alerts/`
- 文件按分类前缀命名: `app_*.yml` `db_*.yml` `host_*.yml` `component_*.yml` `perf_*.yml`
- 删除的规则移至 `_disabled.yml`, 带元信息 (deleted_at, deleted_by, reason)
- paramiko SSH 读写

### 6.3 iframe 缓存与降级

Dashboard 组件对每个 menuKey 保留最多 5 个 iframe (LRU), 切换不重载, `display: none` 隐藏。

### 6.4 Doris 告警历史

`pymysql` 连接 Doris, 查询 `s20_monitor_alertmanager_alert_records` 表, 按 `alert_time DESC` 排序, 分页。

### 6.5 Webhook 集成架构

```
用户操作 (Web UI) → 后端 /api/webhook/* → httpx → 172.16.10.27:8090
                                                    ↓
                              webhook_redis.py /alerts
                                                    ↓
              ┌─────────────┬──────────────┬─────────────┬────────┐
              ▼             ▼              ▼              ▼        ▼
        Redis Sentinel  异步线程池     VictoriaMetrics  Kafka     Exchange/飞书
        (状态/防抖)   (5 workers)    (alarm_info)   Producer  (邮件/卡片)
```

Webhook 服务 (单独部署) 接收:
- `webhook_redis.py:8090` - Alertmanager webhooks + Redis 状态
- `glowroot_adapt.py:8095` - Glowroot Slack attachment 适配

平台仅做查看/触发/重发, 不替代 webhook。

---

## 7. 已知限制

1. **PMM QAN 看板** - PMM 独立认证, iframe 嵌入需先在新标签页登录 PMM
2. **告警规则文件 SSH 写入** - 每次操作 SSH 连接, 性能较低
3. **Doris 历史告警** - 仅展示已同步的告警, 延迟取决于 Flink job
4. **iframe X-Frame-Options** - 后端代理层 strip, 已通过 `hideFrameHeaders` 处理
5. **WebHook 接口契约** - 平台假设 webhook 服务提供 `/health` `/status` `/test` `/resend` 端点

## 8. 后续优化项

| 序号 | 项目 | 描述 | 状态 |
|------|------|------|------|
| 1 | 元数据库集成 | 构建 MySQL/PostgreSQL 行为日志表，记录告警推送明细（邮件/飞书/Voice） | 待实施 |
| 2 | 推送记录明细 | Webhook 事件的"告警推送记录"卡片下方展示逐条推送明细（时间/通道/告警/状态） | 预留 UI |
| 3 | 告警通知渠道扩展 | 在"…"分支处集成电话/短信等新通知渠道 | 待实施 |
| 4 | Webhook 节点探活告警 | 节点宕机时自动发出平台告警通知 | 待实施 |
| 5 | OIDC 单点登录 | 对接公司统一身份平台, 替换 dev mock 登录 | 待实施 |
| 6 | 仪表板首页大屏 | 将总览、告警、拓扑整合为一个全屏大屏展示 | 待讨论 |
| 7 | 国际化 i18n | 支持中英文切换 | 待讨论 |, 实际需与 `webhook_redis.py` 对齐
