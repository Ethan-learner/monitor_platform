# 统一监控门户 · AI Code 执行提示词

> **用途:** 把这份文档喂给 AI Code 工具(Claude Code / Cursor / Copilot CLI / Codex 等),让它按 `docs/superpowers/plans/2026-07-06-monitor-platform.md` 逐任务执行。
>
> **使用方式:**
> - **整包执行:** 复制「第 0 节 总指令」+「第 1-18 节 全部任务提示词」一次性发给 AI。
> - **逐任务执行:** 每次只发「第 0 节 总指令」+ 当前要做的那个任务提示词,做完确认后再发下一个。
> - **推荐:** 逐任务执行,每个任务完成后人工 review 再推进,避免错误累积。

---

## 第 0 节 · 总指令(每次会话开头都要带上)

```
你是一名资深全栈工程师,正在为一个「统一监控门户」项目实施功能。项目位于当前工作目录(一个 git 仓库)。

【项目背景】
- 已有初始版本:frontend/(React 19 + Vite 8 + TS 6 + Ant Design 6 + react-router 7 + zustand 5),用 iframe 聚合 Grafana/PMM/Glowroot 等监控组件。
- 后端待新建:backend/(Python FastAPI),做 OIDC 认证、告警代理、组件健康聚合。
- 部署:systemd + Nginx 同域反代,部署到预警服务器 172.16.10.99(VIP)。
- 既有监控组件(Prometheus/VictoriaMetrics/Grafana/PMM/Glowroot/Loki/Alertmanager)不动,只被反代。

【必读文档(执行前先读)】
1. docs/superpowers/specs/2026-07-06-monitor-platform-design.md — 技术架构与方案设计
2. docs/superpowers/plans/2026-07-06-monitor-platform.md — 详细实施计划(18 任务,每个任务有步骤、代码、命令、预期输出)

【执行规则(严格遵守)】
1. TDD 优先:每个功能任务先写失败测试,跑红,再写最小实现,跑绿,最后提交。
2. 一次只做一个任务(除非我明确要求批量)。做完一个任务的全部 step 后,停下来等我 review 或指令再继续下一个。
3. 每个任务的「提交」step 必须执行,commit message 用任务里给的原文,不要自行发挥。
4. 不要添加计划之外的功能、抽象、错误处理、配置项(YAGNI)。计划里没写的就不要做。
5. 不要跳过测试。任何一步的「Run test」都必须实际执行,并贴出输出。测试失败时不许假装通过,要先修。
6. 文件路径用绝对路径或相对仓库根的路径,完全按计划里给的来,不要自创路径。
7. 代码原样照抄计划里的实现代码,不要"优化"或改名(类型名、函数名、变量名必须前后一致)。
8. 遇到计划里没预料到的问题(依赖版本冲突、API 报错、环境缺工具),先停下来报告,不要自作主张大改方案。
9. Windows 环境:shell 是 bash(MSYS),路径用正斜杠,/dev/null 不是 NUL;Python venv 激活用 `. .venv/bin/activate`(若失败试 `.venv/Scripts/activate`)。
10. 提交时不要 push,不要创建 PR,除非我明确要求。不要修改 git config。不要 --no-verify。
11. 每个任务开始前,先 `git status` 确认工作区干净;结束后再 `git status` + `git log --oneline -1` 确认提交成功。
12. 完成一个任务后,用一句话总结:改了哪些文件、测试结果、commit hash。

【当前任务】
(把下面第 X 节的任务提示词粘到这里)
```

---

## 第 1 节 · 任务 1 提示词:后端项目骨架与依赖

```
执行计划里的 Task 1:后端项目骨架与依赖。

先读 docs/superpowers/plans/2026-07-06-monitor-platform.md 里 "Task 1" 这一节,按它的 step 1-12 逐步执行:
- 创建 backend/requirements.txt、backend/.gitignore、backend/app/__init__.py、backend/app/config.py、backend/app/main.py、backend/tests/__init__.py、backend/tests/conftest.py、backend/README.md、backend/tests/test_health.py
- 建 venv、装依赖、跑 pytest 验证 healthz 测试通过
- 按 step 12 的命令提交

执行要求:
- 严格照抄计划里每个文件的内容,不要改名、不要"改进"。
- requirements.txt 的版本号原样照抄。
- config.py 的 Settings 类、所有字段、默认值原样照抄。
- 装 pip 依赖时若某个版本装不上,停下来报告,不要自动换版本。
- pytest 必须实际跑出 "1 passed" 再提交。
- 提交前 git add backend/(整体暂存),commit message 用:"feat(backend): scaffold FastAPI project with config and healthz"

完成后报告:创建了哪些文件、pytest 输出、commit hash。
```

---

## 第 2 节 · 任务 2 提示词:JWT 工具与依赖注入

```
执行计划里的 Task 2:JWT 工具与依赖注入。

读 plans 文档 "Task 2",按 step 1-7 执行:
- 创建 backend/app/auth/__init__.py(空)、backend/app/auth/jwt.py、backend/app/deps.py、backend/tests/test_jwt.py
- 先写失败测试 test_jwt.py(step 2 的代码原样照抄),跑红(step 3)
- 再写 jwt.py 实现(step 4),跑绿(step 5)
- 写 deps.py(step 6)
- 提交(step 7)

注意:
- jwt.py 用 PyJWT,jwt.encode/jwt.decode 的参数原样照抄(algorithm="HS256")。
- deps.py 的 current_user 依赖从 cookie 取 token,不要改成 Authorization header。
- test_jwt.py 的两个测试都必须通过。
- commit message:"feat(backend): add JWT utilities and auth dependency"

完成后报告:测试输出、commit hash。
```

---

## 第 3 节 · 任务 3 提示词:角色映射

```
执行计划里的 Task 3:角色映射。

读 plans 文档 "Task 3",按 step 1-5 执行:
- 创建 backend/app/auth/roles.py、backend/tests/test_roles.py
- 先写 test_roles.py(5 个测试,step 1 原样照抄),跑红
- 再写 roles.py 实现(step 3),跑绿
- 提交

注意:
- _PRECEDENCE = ("ops", "dev", "mgmt") 表示 ops 优先级最高,测试 test_ops_takes_precedence_over_dev 必须通过。
- map_role 默认返回 "dev"(当无已知 group 时)。
- commit message:"feat(backend): add IdP group to portal role mapping"

完成后报告:测试输出、commit hash。
```

---

## 第 4 节 · 任务 4 提示词:OIDC 适配层(可插拔)

```
执行计划里的 Task 4:OIDC 适配层(可插拔)。

读 plans 文档 "Task 4",按 step 1-5 执行:
- 创建 backend/app/auth/oidc.py、backend/tests/test_oidc.py
- 先写 test_oidc.py(3 个测试,用 respx mock,step 1 原样照抄),跑红
- 再写 oidc.py 实现(OIDCProvider 类 + oidc 单例,step 3),跑绿
- 提交

注意:
- OIDCProvider 三个方法 authorize_url / exchange_code / fetch_userinfo 的实现原样照抄,不要加缓存、加重试。
- authorize_url 用 urllib.parse.urlencode 拼 query string。
- 测试里的 mock URL 是 https://idp.example.com(对应 config.py 默认值),不要改。
- commit message:"feat(backend): add pluggable OIDC adapter (default standard OIDC)"

完成后报告:测试输出、commit hash。
```

---

## 第 5 节 · 任务 5 提示词:认证路由(login/callback/logout/me/verify)

```
执行计划里的 Task 5:认证路由。

读 plans 文档 "Task 5",按 step 1-7 执行:
- 创建 backend/app/auth/router.py、backend/tests/test_auth.py
- 修改 backend/app/main.py(step 4,挂载 auth_router)
- 先写 test_auth.py(6 个测试,step 1 原样照抄),跑红
- 再写 router.py(step 3,5 个路由),改 main.py(step 4),跑绿(step 5)
- 跑全量后端测试(step 6)确认无回归
- 提交(step 7)

注意:
- /api/auth/callback 用 monkeypatch mock OIDCProvider.exchange_code 和 fetch_userinfo,不要真发 HTTP。
- callback 成功后重定向到 /dashboard,设置名为 portal_session 的 HttpOnly cookie。
- /api/auth/verify 是给 Nginx auth_request 用的,校验通过返回 200 + X-Auth-User 头,失败 401。
- /api/auth/me 未登录返回 401,登录返回 {username, role, displayName}。
- main.py 挂载路由的 import 和 include_router 顺序原样照抄。
- 全量测试(test_jwt + test_roles + test_oidc + test_auth + test_health)都要绿。
- commit message:"feat(backend): add auth routes (login/callback/logout/me/verify)"

完成后报告:全量测试输出、commit hash。
```

---

## 第 6 节 · 任务 6 提示词:告警接口(透传 Alertmanager)

```
执行计划里的 Task 6:告警接口(透传 Alertmanager)。

读 plans 文档 "Task 6",按 step 1-8 执行:
- 创建 backend/app/alerts/__init__.py(空)、backend/app/alerts/schemas.py、backend/app/alerts/router.py、backend/tests/test_alerts.py
- 修改 backend/app/main.py 挂载 alerts_router
- 先写 test_alerts.py(3 个测试,用 respx,step 2 原样照抄),跑红
- 再写 schemas.py(step 4)、router.py(step 5),改 main.py(step 6),跑绿(step 7)
- 提交(step 8)

注意:
- /api/alerts 默认 active=true,通过 Query 参数控制,转发到 {alertmanager_url}/api/v2/alerts。
- Alertmanager 不可达时返回 502 + detail="alertmanager_unreachable",不要改成别的状态码或文案。
- router.py 用 httpx.AsyncClient(timeout=5.0),每次请求 new 一个 client(不要全局共享,简单优先)。
- main.py 的 import 和 include_router 顺序:auth_router、alerts_router、healthz。
- commit message:"feat(backend): add alerts proxy to Alertmanager /api/v2/alerts"

完成后报告:测试输出、commit hash。
```

---

## 第 7 节 · 任务 7 提示词:总览接口(组件健康 + 告警摘要)

```
执行计划里的 Task 7:总览接口(组件健康 + 告警摘要)。

读 plans 文档 "Task 7",按 step 1-9 执行:
- 创建 backend/app/overview/__init__.py(空)、backend/app/overview/components.py、backend/app/overview/router.py、backend/tests/test_overview.py
- 修改 backend/app/main.py 挂载 overview_router
- 先写 test_overview.py(3 个测试,用 respx,step 2 原样照抄),跑红
- 再写 components.py(step 4)、router.py(step 5),改 main.py(step 6),跑绿(step 7)
- 跑全量后端测试(step 8)
- 提交(step 9)

注意:
- COMPONENTS 清单的 7 个组件及其 health_path 原样照抄:grafana(/api/health)、pmm(/-/healthy)、glowroot(根)、prometheus(/-/healthy)、loki(/ready)、vmselect(/health)、alertmanager(/-/healthy)。
- _probe 用 asyncio.gather 并发,单个超时(2s)或异常返回 {status:"down", latencyMs:null},不抛错、不阻塞其他组件。
- /api/overview/alerts-summary 按 severity 计数,返回 {critical, warning, info, other, total},非这四类的归到 other。
- Alertmanager 不可达时 alerts-summary 返回 502 + "alertmanager_unreachable"。
- 全量后端测试都要绿(7 个测试文件)。
- commit message:"feat(backend): add overview (component health + alerts summary)"

完成后报告:全量测试输出、commit hash。
```

---

## 第 8 节 · 任务 8 提示词:前端测试基础设施

```
执行计划里的 Task 8:前端测试基础设施。

读 plans 文档 "Task 8",按 step 1-8 执行:
- 安装测试依赖:npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui
- 创建 frontend/vitest.config.ts、frontend/src/test/setup.ts、frontend/src/test/utils.tsx、frontend/src/test/smoke.test.tsx
- 修改 frontend/package.json 的 scripts(加 test、test:watch)
- 跑 npm test 验证 smoke 测试通过
- 提交

注意:
- vitest.config.ts 用 jsdom 环境,setupFiles 指向 ./src/test/setup.ts。
- setup.ts 引入 @testing-library/jest-dom/vitest,afterEach 调 cleanup。
- utils.tsx 的 renderWithRouter 用 BrowserRouter + ConfigProvider(zhCN),和 App.tsx 的 provider 一致。
- package.json scripts 不要破坏现有的 dev/build/lint/preview,只新增 test 和 test:watch。
- npm test 必须实际跑出 "1 passed" 再提交。
- commit message:"test(frontend): add Vitest + testing-library setup"

完成后报告:npm test 输出、commit hash。
```

---

## 第 9 节 · 任务 9 提示词:前端 API 层(axios + 封装)

```
执行计划里的 Task 9:前端 API 层(axios + 封装)。

读 plans 文档 "Task 9",按 step 1-5 执行:
- 创建 frontend/src/lib/api.ts、frontend/src/lib/auth.ts、frontend/src/lib/alerts.ts、frontend/src/lib/overview.ts
- 提交

注意:
- 先装 axios:在 frontend 目录跑 npm install axios(这是运行时依赖,不是 devDependency)。
- api.ts 的 axios 实例 baseURL='/api'、withCredentials=true,响应拦截器遇 401 且非 /login 路径时跳 /login。
- auth.ts 导出 PortalUser 接口、login(跳 /api/auth/login)、fetchMe、logout。
- alerts.ts 导出 AlertItem 接口、fetchAlerts。
- overview.ts 导出 ComponentHealth、AlertsSummary 接口、fetchHealth、fetchAlertsSummary。
- 接口字段名必须和后端返回完全一致(username/role/displayName;labels/annotations/startsAt/endsAt/status;name/status/latencyMs;critical/warning/info/other/total)。
- 这个任务不写测试(纯封装层),照抄计划代码即可。
- commit message:"feat(frontend): add API layer (axios + auth/alerts/overview)"

完成后报告:创建了哪些文件、commit hash。
```

---

## 第 10 节 · 任务 10 提示词:改造 authStore 与 ProtectedRoute(对接真实后端)

```
执行计划里的 Task 10:改造 authStore 与 ProtectedRoute。

读 plans 文档 "Task 10",按 step 1-8 执行:
- 创建 frontend/src/test/authStore.test.tsx
- 修改 frontend/src/store/authStore.ts、frontend/src/components/ProtectedRoute.tsx、frontend/src/pages/Login.tsx
- 先写 authStore.test.tsx(2 个测试,vi.mock '../lib/auth',step 1 原样照抄),跑红
- 重写 authStore.ts(step 3),跑绿(step 4)
- 重写 ProtectedRoute.tsx(step 5,加 loading 态 + init)
- 重写 Login.tsx(step 6,跳 OIDC,移除 mock 账号)
- 跑全量前端测试(step 7)
- 提交(step 8)

注意:
- authStore 重写后:初始 user=null、isAuthenticated=false、loading=true;新增 init()(调 fetchMe)、reset()。移除原来的 defaultUser 和 mock 默认已登录。
- ProtectedRoute 在 loading 时显示 Spin,init 完成后再判定跳转。
- Login.tsx 删除 mockUsers 数组和表单,改为一个按钮调 login()(即跳 /api/auth/login)。保留渐变背景和卡片样式。
- vi.mock 的路径是 '../lib/auth'(相对 test 文件),不要写错。
- 全量前端测试(smoke + authStore)都要绿。
- commit message:"feat(frontend): wire authStore to backend /auth/me and OIDC login"

完成后报告:测试输出、commit hash。
```

---

## 第 11 节 · 任务 11 提示词:菜单重组(按监控类型 + 同域反代路径)

```
执行计划里的 Task 11:菜单重组。

读 plans 文档 "Task 11",按 step 1-2 执行:
- 重写 frontend/src/config/menus.ts
- 提交

注意:
- MenuItem 接口新增可选字段 native?: boolean。
- 新增 nativeMenuKeys 常量:{overview:'overview', alerts:'alerts'}。
- roleMenus 三角色(ops/dev/mgmt)的菜单结构完全照抄计划 step 1 的代码:
  - ops:总览首页(native)+ 告警中心(native)+ 系统监控(prometheus、vmselect)+ 主机监控(linux-server)+ 数据库监控(pmm)+ 应用性能(glowroot)+ 日志监控(loki)+ 看板总览(grafana)
  - dev:总览首页 + 告警中心 + 应用性能(glowroot)+ 看板总览(grafana-dev)
  - mgmt:总览首页 + 看板总览(grafana-mgmt)
- 所有 url 用同域相对路径(/prometheus/、/grafana/d/...?kiosk=tv、/pmm/、/glowroot/、/loki/、/vmselect/...、/grafana/?kiosk=tv),不要写内网 IP。
- Grafana 看板 url 带 kiosk=tv。
- 不写测试(纯配置),照抄即可。
- commit message:"feat(frontend): regroup menu by monitor type, add overview/alerts, switch to same-domain paths"

完成后报告:commit hash。
```

---

## 第 12 节 · 任务 12 提示词:告警列表组件与页面(原生)

```
执行计划里的 Task 12:告警列表组件与页面。

读 plans 文档 "Task 12",按 step 1-6 执行:
- 创建 frontend/src/components/AlertList.tsx、frontend/src/pages/Alerts.tsx、frontend/src/test/AlertList.test.tsx
- 先写 AlertList.test.tsx(3 个测试,step 1 原样照抄),跑红
- 再写 AlertList.tsx(step 3),跑绿(step 4)
- 写 Alerts.tsx 页面(step 5)
- 提交(step 6)

注意:
- AlertList 用 Ant Design Table,severity 用 Tag 着色(critical=red、warning=orange、info=blue),空数组显示 Empty("当前无活跃告警"),error 非空显示 Alert("告警服务暂不可用")。
- rowKey 用 `${alertname}-${instance}-${i}` 拼接,避免 key 冲突。
- Alerts.tsx 用 useEffect 调 fetchAlerts(true),带 loading 和 error 状态,顶部有刷新按钮(ReloadOutlined)。
- 测试里 error="alertmanager_unreachable" 时要匹配 /告警服务暂不可用/。
- commit message:"feat(frontend): add alert list component and alerts page"

完成后报告:测试输出、commit hash。
```

---

## 第 13 节 · 任务 13 提示词:总览首页组件与页面(原生)

```
执行计划里的 Task 13:总览首页组件与页面。

读 plans 文档 "Task 13",按 step 1-6 执行:
- 创建 frontend/src/components/OverviewHealth.tsx、frontend/src/pages/Overview.tsx、frontend/src/test/Overview.test.tsx
- 先写 Overview.test.tsx(1 个测试,step 1 原样照抄),跑红
- 再写 OverviewHealth.tsx(step 3),跑绿(step 4)
- 写 Overview.tsx 页面(step 5)
- 提交(step 6)

注意:
- OverviewHealth 用 Row/Col/Card 网格展示各组件,up=绿色 CheckCircleOutlined + "正常" Tag,down=红色 CloseCircleOutlined + "异常" Tag,显示 latencyMs。
- Overview.tsx 三块:告警摘要(Card + Statistic 五列:critical/warning/info/其他/合计)+ 组件健康(Card + OverviewHealth)+ 常用看板(Card + Button 快捷入口)。
- Overview 用 Promise.all 并发拉 fetchHealth + fetchAlertsSummary。
- 常用看板从 roleMenus[user.role] 里取有 children 且 children 有 url 的前 6 个,点击 navigate(`/dashboard/${b.key}`)。
- commit message:"feat(frontend): add overview page (alerts summary + health + quick boards)"

完成后报告:测试输出、commit hash。
```

---

## 第 14 节 · 任务 14 提示词:路由与 Dashboard 容器整合

```
执行计划里的 Task 14:路由与 Dashboard 容器整合。

读 plans 文档 "Task 14",按 step 1-9 执行:
- 创建 frontend/src/test/Dashboard.test.tsx
- 修改 frontend/src/App.tsx、frontend/src/pages/Dashboard.tsx、frontend/src/components/Layout/MainLayout.tsx
- 先写 Dashboard.test.tsx(2 个测试,step 1 原样照抄),跑红
- 重写 Dashboard.tsx 为纯 iframe 容器(接收 url/title prop,step 3),跑绿(step 4)
- 重写 App.tsx(step 5,DashboardRoute 内联组件根据 menuKey 渲染 Overview/Alerts/Dashboard)
- 改 MainLayout.tsx 的 handleMenuClick、handleLogout、iconMap、import(step 6)
- 跑全量前端测试(step 7)
- 跑 lint(step 8)
- 提交(step 9)

注意:
- Dashboard.tsx 改为接收 {url, title} props,不再是路由参数驱动。url 为空显示"暂无可用看板"。
- App.tsx 的 DashboardRoute:根据 menuKey 在 roleMenus 里找 item;item.native 则渲染 Overview/Alerts;否则渲染 <Dashboard url={item.url} title={item.label} />。找不到 item 渲染 <NotFound />。
- /dashboard 的 index 路由渲染 <Overview />。
- MainLayout:handleMenuClick 改为 navigate(`/dashboard/${key}`)(native 项也走这个,因为 App 里 DashboardRoute 会处理);handleLogout 改为 async 调后端 logout 再跳 /login;iconMap 加 AlertOutlined、FileTextOutlined;import 同步加这两个图标。
- 全量前端测试(smoke + authStore + AlertList + Overview + Dashboard)都要绿。lint 无错。
- commit message:"feat(frontend): wire routes for overview/alerts/native + iframe container"

完成后报告:全量测试 + lint 输出、commit hash。
```

---

## 第 15 节 · 任务 15 提示词:vite dev 代理对齐同域反代路径

```
执行计划里的 Task 15:vite dev 代理对齐同域反代路径。

读 plans 文档 "Task 15",按 step 1-3 执行:
- 重写 frontend/vite.config.ts
- 手动冒烟(step 2,启动 npm run dev,浏览器看登录页渲染、/api/auth/login 能跳转,Ctrl+C 停止)
- 提交(step 3)

注意:
- 完全用计划 step 1 的代码替换 vite.config.ts,移除旧的 /api/proxy/grafana、/api/proxy/pmm、/v1、/graph 代理。
- 新代理:/api(到 localhost:8000)、/grafana、/pmm、/glowroot、/prometheus、/loki、/vmselect。
- hideFrameHeaders helper 删除 x-frame-options、改写 content-security-policy 的 frame-ancestors。
- /pmm 用 rewrite 去掉 /pmm 前缀;其余按 target 直连。
- grafana/pmm 的 proxyReq 里设 origin 和 referer 头(把 localhost:port 替换为 172.16.10.99)。
- 冒烟步骤:启动 dev server,确认 http://localhost:1009 能打开登录页,/api/auth/login 跳转到 IdP(默认 idp.example.com,跳过去会 404 是预期的,说明跳转链路通)。把观察结果记下来。Ctrl+C 停止 dev server。
- commit message:"feat(frontend): align vite dev proxy to same-domain reverse-proxy paths"

完成后报告:冒烟观察、commit hash。
```

---

## 第 16 节 · 任务 16 提示词:部署文件(systemd + Nginx)

```
执行计划里的 Task 16:部署文件(systemd + Nginx)。

读 plans 文档 "Task 16",按 step 1-5 执行:
- 创建 deploy/portal-backend.service、deploy/nginx-portal.conf
- 用 deploy/nginx-portal.conf 内容替换 nginx/nginx.conf(step 3)
- 重写 DEPLOY.md(step 4)
- 提交(step 5)

注意:
- portal-backend.service 原样照抄:User=portal、WorkingDirectory=/data/software/portal-backend、ExecStart 用 .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000。
- nginx-portal.conf 原样照抄:listen 80、/api/ 反代到 127.0.0.1:8000、/grafana/ 带 auth_request /_auth、其余组件反代 + hide frame headers、/_auth 内部端点。
- nginx/nginx.conf 改为与 deploy/nginx-portal.conf 一致(旧的 8080 监听和 /api/proxy/grafana 废弃)。
- DEPLOY.md 用计划 step 4 的内容完整替换,包含后端 systemd 部署、前端构建、Nginx 配置、Grafana auth proxy、本地开发四块。
- 这个任务不跑测试(纯部署文件),照抄即可。
- commit message:"feat: add deployment files (systemd + nginx portal config) and update DEPLOY.md"

完成后报告:创建了哪些文件、commit hash。
```

---

## 第 17 节 · 任务 17 提示词:端到端联调验证

```
执行计划里的 Task 17:端到端联调验证(手动清单)。

读 plans 文档 "Task 17",按 step 1-6 执行:
- 跑后端全量 pytest(step 1)
- 跑前端全量 vitest(step 2)
- 跑前端构建 npm run build(step 3)
- 本地联调(step 4,启动后端 + 前端 dev,浏览器走完整流程)
- 记录联调结果(step 5)
- 如有联调修复则提交(step 6)

注意:
- 后端 pytest 和前端 vitest 必须全绿,贴出输出。
- npm run build 必须无 TypeScript 错误,产出 dist/。
- 联调 step 4:若 IdP 未就绪,可在 backend/app/auth/oidc.py 临时注入 mock(让 fetch_userinfo 直接返回一个固定 claims)走通登录流程,验证后回退该 mock(不要提交 mock)。
- 联调要验证:登录跳转 → 总览首页(告警摘要+组件健康+快捷入口)→ 告警中心(列表或空占位)→ Grafana iframe → 切换角色菜单不同。
- 把每项观察(通过/异常)记下来报告给我。如果有 bug 需要修,修完单独提交,commit message:"fix: end-to-end integration adjustments"。
- 这一步不创建 PR。

完成后报告:后端测试、前端测试、构建、联调各项结果;如有修复,附 commit hash。
```

---

## 第 18 节 · 任务 18 提示词:合并到 main

```
执行计划里的 Task 18:合并到 main(创建 PR)。

【重要:这一步涉及推送到远程和创建 PR,属于影响共享状态的操作。执行前必须先向我确认,不要自动执行。】

读 plans 文档 "Task 18",确认步骤后,先向我汇报:
- 当前分支名(应为 feat/monitor-portal)
- 后端 pytest 是否全绿
- 前端 vitest 是否全绿
- 前端 build 是否通过
- git log 最近几条 commit

等我明确说「可以推送并创建 PR」后,再执行:
- git push -u origin feat/monitor-portal
- gh pr create(用计划 step 3 的 title 和 body)

不要在没得到我确认前执行 push 或 gh pr create。
```

---

## 附录 · 执行节奏建议

**给执行者的建议:**
1. **逐任务执行,不要一次发全部。** 每次发「第 0 节总指令」+「当前任务提示词」,做完确认再发下一个。
2. **后端先行:** Task 1-7 全是后端,做完后端再开始前端(Task 8),这样前端联调时有真实 API 可调。
3. **遇到卡点就停:** 依赖装不上、测试跑不通、API 报错、计划里没写的情况——停下来报告,不要硬改方案。
4. **每个任务结束贴三件事:** 改了哪些文件、测试结果(贴输出)、commit hash。
5. **不要跳测试:** 「Run test」步骤必须实际执行,不许靠看代码判断"应该能过"。
6. **Windows 环境:** bash 是 MSYS,路径用正斜杠;Python venv 激活 `. .venv/bin/activate`(失败试 `.venv/Scripts/activate`);npm 命令在 frontend 目录下跑。

**给 review 者的检查清单(每个任务做完后过一遍):**
- [ ] 测试是否真的跑过(有输出截图/粘贴)?
- [ ] 是否照抄了计划代码(没有自创优化或改名)?
- [ ] commit message 是否和计划里一致?
- [ ] git status 是否干净?
- [ ] 是否动了计划之外的文件?
