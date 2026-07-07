# 统一监控门户 · 技术架构与方案设计

- **日期:** 2026-07-06
- **状态:** 设计阶段(已确认前 5 节,后续节待补)
- **作者:** Ethan-learner + Claude(协作设计)
- **关联部署文档:** `D:\Documents\down\预警中心部署.pdf`

---

## 1. 背景与目标

### 1.1 现状

预警服务器集群(3 节点 HA:172.16.10.27/28/29,Keepalived VIP 172.16.10.99)已部署一套监控生态,各组件独立运行、独立访问:

| 类别 | 组件 | 版本 | 端口/地址 |
|------|------|------|-----------|
| 指标采集 | Node_exporter | v1.10.2 | — |
| 指标短期 | Prometheus | v2.55.0 | 9090 |
| 指标长期 | VictoriaMetrics(vmstorage/vminsert/vmselect) | v1.139.0 | 8400/8401,vmselect 8481 |
| 看板 | Grafana | v12.2.2 | 3001(Docker) |
| 数据库监控 | PMM(Percona) | — | 30080(K8s NodePort) |
| APM | Glowroot Central + Cassandra | v0.14.2 / v4.1.4 | 4000 |
| 日志 | Loki + Promtail | v3.2.2 | 3100 |
| 告警 | Alertmanager | v0.27.0 | 9093,webhook → 172.16.10.x:8090/alerts |
| 入口 | Nginx | v1.18.0 | 80/443/8080 |
| 存储 | MySQL / Redis | v8.0.44 / v7.2.4 | 3308/3309,6379/2637 |

现有仓库 `monitor_platform/` 已有一个初始简单版本门户:
- `frontend/`(React + Vite + TypeScript + Ant Design):登录页(mock 账号)、Dashboard(iframe 容器按 menuKey 切换)、角色菜单(ops/dev/mgmt,写死在 `menus.ts`)、ProtectedRoute、IframeView。
- `grafana/grafana-auth-proxy.ini`(Grafana auth proxy 配置,预备对接 LDAP/OAuth 免密)。
- `nginx/nginx.conf`(门户 Nginx 监听 8080,反代 `/api/proxy/grafana`)。

### 1.2 目标

**第一原则:** 将 Grafana、PMM、Glowroot 等现成组件的展示页面**直接 iframe 嵌入**到门户对应分类下,做统一访问入口。门户不重画看板、不接管告警引擎、不重复造轮子。

围绕这个第一原则,门户额外提供两个轻量原生页:
- **告警中心** — 原生告警列表(直连 Alertmanager API)。
- **总览首页** — 告警摘要 + 组件健康状态 + 常用看板快捷入口。

### 1.3 设计原则

- **循序渐进** — 当前阶段只做"聚合 + 告警 + 总览",不堆功能。
- **YAGNI** — 告警只读列表(不做静默/确认);总览不上大屏图表;角色菜单继续写死;不写告警缓存/重试/熔断。
- **不动既有组件** — Prometheus/VictoriaMetrics/Grafana/PMM/Glowroot/Loki/Alertmanager 配置不变,只被 Nginx 反代。
- **可插拔认证** — OIDC 适配层默认实现标准 OIDC,后续接具体 IdP 只换适配层。

---

## 2. 已确认的设计选择(来自需求澄清)

| 维度 | 选择 | 说明 |
|------|------|------|
| 整体方向 | A — iframe 聚合门户 | 轻量演进现有 frontend,不重画 |
| 告警模块 | C — 原生告警列表页 | 后端直连 Alertmanager `/api/v2/alerts`,只读 |
| 认证 | D — OAuth/OIDC(可插拔) | 默认 OIDC,后续接公司 IdP 只换适配层 |
| 角色权限 | A — 三级角色 + 菜单级可见性 | ops/dev/mgmt,映射写死 `menus.ts` |
| 后端技术 | B — Python FastAPI | async,接 Alertmanager/Loki 顺手 |
| 部署形态 | A — systemd + Nginx | FastAPI 走 systemd service,前端 dist 丢 Nginx html,贴合现有部署文档风格 |
| 仓库结构 | A — 同级加 `backend/` | `frontend + backend + grafana + nginx` |
| iframe 嵌入 | A — 全部同域反代 | 门户 Nginx 给每个组件开反代 location,iframe src 用同域相对路径 |
| 总览首页 | B — 简单原生首页 | 告警摘要 + 组件健康 + 快捷入口,不上大屏图表 |

---

## 3. 整体架构

### 3.1 三层结构

1. **门户 Nginx(统一入口)** — 所有流量同域入口,反代前端静态、FastAPI 后端、各监控组件。同域消除 iframe 跨域,并统一注入 `X-Auth-User` 给 Grafana auth proxy。
2. **门户前端(React + Vite + AntD,现有 frontend 演进)** — 登录页、总览首页(原生)、告警页(原生)、iframe 容器、角色菜单。
3. **门户后端(FastAPI,新增 `backend/` 目录)** — OIDC 认证、JWT 签发、Alertmanager 代理、组件健康聚合、给反代注入身份头。

既有监控组件(Prometheus/VM/Grafana/PMM/Glowroot/Loki/Alertmanager/MySQL/Redis)全部不动,只被 Nginx 反代。

### 3.2 数据流总览

- **浏览器 → VIP(.99) → 门户 Nginx →** 分流到:前端静态 / FastAPI / 各组件反代。
- **告警流:** Alertmanager → FastAPI `/api/alerts` → 前端告警页。
- **健康流:** FastAPI 并发调各组件 `/-/healthy` → `/api/overview/health` → 前端首页。
- **身份流:** OIDC 登录 → JWT(httpOnly cookie)→ Nginx `auth_request` 校验 → 注入 `X-Auth-User` → Grafana 免密。

---

## 4. 前端结构与菜单分类

### 4.1 菜单结构(ops 角色示例)

```
统一监控门户
├── 总览首页          ← 原生页(告警摘要 + 组件健康 + 快捷入口)
├── 告警中心          ← 原生页(Alertmanager 只读列表)
├── 系统监控
│   ├── Prometheus        → iframe /prometheus/
│   └── VictoriaMetrics   → iframe /vmselect/
├── 主机监控
│   ├── 服务器 Linux      → iframe /grafana/d/Bkl9bBYik/...?kiosk=tv
│   └── 主机概览          → iframe /grafana/d/xxx/...
├── 数据库监控
│   └── PMM               → iframe /pmm/
├── 应用性能 (APM)
│   └── Glowroot          → iframe /glowroot/
├── 日志监控
│   └── Loki              → iframe /loki/
└── 看板总览
    └── Grafana 首页      → iframe /grafana/
```

### 4.2 设计要点

- **叶子菜单 = 一个 iframe**,src 指向**同域反代路径**(`/grafana/...` `/pmm/` `/glowroot/` `/prometheus/` `/loki/` `/vmselect/`),不直连内网 IP。
- **Grafana kiosk 模式** — 看板 URL 带 `kiosk=tv`,隐藏 Grafana 顶栏侧栏,只留图表(现有 `menus.ts` 已在用)。
- **菜单按监控类型分一级目录** — 系统监控 / 主机监控 / 数据库监控 / 应用性能 / 日志监控 / 看板总览,叶子是具体页面。
- **角色分级** — ops 看全量;dev 看 APM + 开发看板;mgmt 只看看板总览。角色-菜单映射继续写死在 `menus.ts`。
- **`menus.ts` url 字段迁移** — 从现在的内网 IP / `/api/proxy/grafana` 统一改为同域反代路径。

### 4.3 前端页面清单(原生,非 iframe)

| 页面 | 状态 | 说明 |
|------|------|------|
| `Login.tsx` | 现有,改造 | 从 mock 账号改为 OIDC 跳转(调 `/api/auth/login`) |
| `Overview.tsx` | 新增 | 总览首页:告警计数 + 组件健康 + 快捷入口 |
| `Alerts.tsx` | 新增 | 告警列表:调 `/api/alerts`,按 severity 着色分组,点击跳转 Grafana |
| `Dashboard.tsx` | 现有,保留 | iframe 容器,按 menuKey 切换 |
| `NotFound.tsx` | 现有,保留 | 404 |

### 4.4 路由

```
/login              → Login
/dashboard          → MainLayout > Overview(总览首页,index)
/dashboard/alerts   → MainLayout > Alerts(告警)
/dashboard/:menuKey → MainLayout > Dashboard(iframe 容器)
*                   → NotFound
```

---

## 5. 后端结构与接口

### 5.1 模块划分(`backend/`)

```
backend/
├── app/
│   ├── main.py            # FastAPI 入口,路由挂载,CORS
│   ├── config.py          # 配置(组件地址、OIDC 配置、JWT 密钥)
│   ├── deps.py            # 依赖注入(当前用户、JWT 校验)
│   ├── auth/
│   │   ├── router.py      # /api/auth/login /callback /logout /me /verify
│   │   ├── oidc.py        # OIDC 适配层(可插拔,默认实现)
│   │   └── roles.py       # IdP group → ops/dev/mgmt 映射
│   ├── alerts/
│   │   └── router.py      # /api/alerts → Alertmanager /api/v2/alerts
│   └── overview/
│       └── router.py      # /api/overview/health + /alerts-summary
├── requirements.txt
└── README.md
```

### 5.2 接口清单

| 方法 | 路径 | 作用 |
|------|------|------|
| GET | `/api/auth/login` | 跳转 IdP 授权页(authorization_code + PKCE) |
| GET | `/api/auth/callback` | OIDC 回调,换 token、拉 userinfo、按 group 映射角色、签 JWT 写 httpOnly cookie、跳回前端 |
| POST | `/api/auth/logout` | 清 cookie,跳登录 |
| GET | `/api/auth/me` | 返回当前用户(username、role、displayName) |
| GET | `/api/auth/verify` | 内部端点,供 Nginx `auth_request` 校验 JWT,返回 `X-Auth-User` 头 |
| GET | `/api/alerts` | 透传 Alertmanager `/api/v2/alerts?active=true`,原样返回 |
| GET | `/api/overview/health` | 并发探活各组件,返回 `[{name, status, latency}]` |
| GET | `/api/overview/alerts-summary` | 拉告警按 severity 计数 `{critical, warning, info}` |

### 5.3 认证流程(OIDC 可插拔)

1. 前端 `Login.tsx` 点登录 → 跳 `/api/auth/login`
2. 后端跳 IdP 授权页(authorization_code + PKCE)
3. IdP 回调 `/api/auth/callback` → 后端换 token、拉 userinfo、按 group 映射角色 → 签 JWT 写 httpOnly cookie → 跳回前端 `/dashboard`
4. 前端调 `/api/auth/me` 拿用户和角色,驱动菜单渲染
5. `oidc.py` 是适配层,默认实现标准 OIDC;后续接具体 IdP(企业微信/Keycloak/SAML)只换这一个文件,不动门户骨架

### 5.4 Grafana 免密(auth proxy)

Nginx 反代 `/grafana/` 时,通过 `auth_request` 子请求打到 FastAPI `/api/auth/verify`:
- FastAPI 校验 cookie 里的 JWT → 200 + 响应头 `X-Auth-User: <用户名>`
- Nginx 把该头透传给 Grafana → Grafana auth proxy 免密登录(对应 `grafana/grafana-auth-proxy.ini`)

其他组件(PMM/Glowroot/Prometheus/Loki)暂走各自原有登录,门户 iframe 内首次访问各登录一次,后续 cookie 保持。后续如需扩展免密,复制 Grafana 这套 `auth_request` 模式即可。

### 5.5 告警接口细节

- `/api/alerts` 后端转发 Alertmanager `GET /api/v2/alerts`,默认 `active=true` 只取活跃告警,原样透传 JSON 给前端。
- 不做缓存、不做静默、不做确认(最小可用)。

---

## 6. Nginx 反代与同域嵌入

### 6.1 门户 Nginx 配置(整合进现有 `nginx/nginx.conf`)

```nginx
server {
    listen 80;                      # 接管 80 作为统一入口(由 VIP .99 提供)
    server_name 172.16.10.99;

    root /usr/share/nginx/html;     # 前端 dist
    index index.html;

    # 前端 SPA
    location / { try_files $uri $uri/ /index.html; }

    # FastAPI 后端
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Grafana(auth proxy 免密)
    location /grafana/ {
        auth_request /_auth;
        proxy_set_header X-Auth-User $upstream_http_x_auth_user;
        proxy_pass http://172.16.10.99:3001/grafana/;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
        proxy_redirect /grafana/ /grafana/;
    }

    # 其余组件:统一 hide frame 头,走各自原有登录
    location /pmm/ {
        proxy_pass http://172.16.10.99:30080/;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
    }
    location /glowroot/    { proxy_pass http://172.16.10.27:4000/;  /* + hide frame headers */ }
    location /prometheus/  { proxy_pass http://172.16.10.27:9090/;  /* + hide frame headers */ }
    location /loki/        { proxy_pass http://172.16.10.27:3100/;  /* + hide frame headers */ }
    location /vmselect/    { proxy_pass http://172.16.10.27:8481/select/; /* + hide frame headers */ }

    # 内部 auth 子请求端点
    location = /_auth {
        internal;
        proxy_pass http://127.0.0.1:8000/api/auth/verify;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
    }
}
```

### 6.2 关键设计点

1. **同域** — iframe src 全用相对路径(`/grafana/...`),浏览器认为同源,绕开 `X-Frame-Options`/CSP 跨域拦截(配合 `proxy_hide_header` 双保险)。
2. **身份注入** — 只给 Grafana 走 `auth_request` 免密(已有 `grafana-auth-proxy.ini`);其他组件走各自原有登录。
3. **组件地址** — 来自部署文档:Grafana 3001、PMM 30080、Glowroot 172.16.10.27:4000、Prometheus 9090、Loki 3100、vmselect 8481。
4. **端口冲突** — 现有门户 Nginx 监听 8080,既有业务 Nginx 在 80/443。整合时门户 Nginx 可接管 80,或保持 8080 单独跑(部署阶段再定),不与既有 Nginx 抢端口。

### 6.3 iframe 嵌入要点

- Grafana 看板 URL 加 `kiosk=tv` 隐藏顶栏侧栏(现有代码已用)。
- 各组件 `root_url`/`base_path` 调成反代路径(Grafana 已配 `root_url=http://172.16.10.99/grafana`;PMM/Glowroot 需确认子路径配置)。

---

## 7. 数据流与错误处理

### 7.1 核心数据流

1. **登录流:** 浏览器 → `/api/auth/login` → IdP → `/api/auth/callback` → JWT 写 httpOnly cookie → 跳 `/dashboard` → 前端调 `/api/auth/me` 拿角色 → 渲染菜单
2. **看板流(iframe):** 前端选菜单 → iframe src=`/grafana/d/xxx?kiosk=tv` → Nginx `auth_request /_auth` 校验 JWT → 注入 `X-Auth-User` → Grafana 返回看板
3. **告警流:** 前端告警页 → `/api/alerts` → FastAPI → Alertmanager `/api/v2/alerts?active=true` → 原样返回 → 前端按 severity 着色分组
4. **总览流:** 前端首页 → 并行调 `/api/overview/health` + `/api/overview/alerts-summary` → FastAPI 并发探活各组件 + 拉告警计数 → 聚合返回

### 7.2 错误处理策略(轻量,最小可用)

| 场景 | 处理 |
|------|------|
| JWT 失效/过期 | 前端 axios 拦截 401 → 跳登录;`/_auth` 返回 401 → Nginx 让 Grafana 走匿名或跳登录 |
| Alertmanager 不可达 | FastAPI 捕获超时,返回 `{error: "alertmanager_unreachable"}`,前端告警页显示"告警服务暂不可用"占位,不白屏 |
| 组件健康探活失败 | `/api/overview/health` 单个组件 2s 超时不阻塞其他,该组件标 `down`,其余正常返回 |
| OIDC IdP 不可达 | `/api/auth/callback` 捕获,前端登录页显示"身份服务暂不可用" |
| iframe 内组件自身报错 | 不接管,显示 iframe 浏览器原生错误页 |

### 7.3 超时配置

- FastAPI 调外部组件(Alertmanager / 各 `/-/healthy`):统一 2s 超时,并发请求(`asyncio.gather` + `return_exceptions=True`),单个失败不影响聚合。
- Nginx `auth_request` 超时 5s,失败默认放行(避免后端挂了整个门户不可用)——生产可调成失败拦截,视倾向而定。

### 7.4 不做的(YAGNI)

- 不做告警缓存/轮询(前端按需刷新或定时拉)
- 不做告警去重/合并(Alertmanager 已 `group_by`)
- 不做组件重试/熔断(规模小,简单超时足够)
- 不做前端全局错误边界之外的重试逻辑

---

## 8. 部署(概要,细节待补)

- **前端:** `npm run build` → `dist/` 复制到 Nginx html 目录。
- **后端:** FastAPI + uvicorn,systemd service(参考部署文档里 Alertmanager/VM 的 service 风格),Python 依赖走 venv。
- **Nginx:** 整合第 6 节配置,接管统一入口或保持 8080(部署阶段定)。
- **既有组件:** 不动。

> 第 8 节部署细节、第 9 节测试策略、第 10 节后续演进路线待后续补充。

---

## 9. 待补充章节

- [ ] 部署细节(systemd service 文件、venv、Nginx 整合步骤)
- [ ] 测试策略(前端组件测试、后端接口测试、联调验证)
- [ ] 后续演进路线(告警静默/确认、其他组件免密、大屏总览等,按需启用)
- [ ] 安全清单(cookie 属性、JWT 过期、IdP scope、CSP)
