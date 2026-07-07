# 部署说明

## 架构概览

监控组件均部署在预警服务器 172.16.10.99，通过已有 Nginx + VIP 统一暴露：
- Grafana: http://172.16.10.99/grafana
- Prometheus: http://172.16.10.99/prometheus
- PMM: http://172.16.10.99
- Glowroot: http://172.16.10.99:4020

门户前端（本目录）最终也将部署至同一台预警服务器上。

## 本地开发

```bash
cd frontend
npm install
npm run dev          # 启动开发服务器 http://localhost:5173
```

前端 iframe 直接指向 http://172.16.10.99 各服务地址，本地开发即可预览。

## 构建部署

```bash
cd frontend
npm run build        # 产出到 frontend/dist/
```

将 `dist/` 目录复制到预警服务器 Nginx 的 HTML 目录下。

## Nginx 配置

参考 `nginx/nginx.conf`：
- **当前阶段**：门户 Nginx 监听 8080 端口（避免与已有 Nginx 端口冲突），仅托管前端静态文件
- **后续整合**：若门户 Nginx 要接管 80/443 作为统一入口，可启用配置中注释部分，反向代理到本地各服务端口

## Grafana Auth Proxy 集成（后续对接 LDAP/OAuth）

参考 `grafana/grafana-auth-proxy.ini`，在 Grafana 服务器上：
1. 合并配置到 `/etc/grafana/grafana.ini`
2. 设置 `server.root_url = http://172.16.10.99/grafana`
3. 重启 `systemctl restart grafana-server`
4. 门户 Nginx 需透传 `X-Auth-User` 头完成免密登录

## iframe 跨域说明

各服务需在 Nginx 配置中添加跨域头以支持 iframe 嵌入：

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Content-Security-Policy "frame-ancestors 'self' http://172.16.10.99:*;" always;
```
