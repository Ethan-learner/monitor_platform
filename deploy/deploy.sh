#!/bin/bash
# ============================================
# 统一监控告警平台 - 部署脚本
# 用法: bash deploy.sh [部署目录]
# 默认部署到 /data/software/monitor-portal
# ============================================
set -e

DEPLOY_DIR="${1:-/data/software/monitor-portal}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "===== 统一监控告警平台部署 ====="
echo "部署目录: $DEPLOY_DIR"
echo ""

# 1. 前端构建
echo "[1/6] 构建前端..."
cd "$PROJECT_DIR/frontend"
npm install --frozen-lockfile
npm run build
echo "  ✅ 前端构建完成: frontend/dist/"

# 2. 创建部署目录
echo "[2/6] 创建部署目录..."
mkdir -p "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/backend"
mkdir -p "$DEPLOY_DIR/frontend"
echo "  ✅ 目录已创建: $DEPLOY_DIR"

# 3. 复制后端代码
echo "[3/6] 复制后端代码..."
cp -r "$PROJECT_DIR/backend/app" "$DEPLOY_DIR/backend/"
cp "$PROJECT_DIR/backend/requirements.txt" "$DEPLOY_DIR/backend/"
cp "$SCRIPT_DIR/env.production" "$DEPLOY_DIR/backend/.env"
echo "  ✅ 后端代码已复制"

# 4. 复制前端构建产物
echo "[4/6] 复制前端构建产物..."
cp -r "$PROJECT_DIR/frontend/dist" "$DEPLOY_DIR/frontend/"
echo "  ✅ 前端构建产物已复制"

# 5. 安装后端依赖
echo "[5/6] 安装后端 Python 依赖..."
pip3 install -r "$DEPLOY_DIR/backend/requirements.txt"
echo "  ✅ 后端依赖已安装"

# 6. 安装 systemd 服务
echo "[6/6] 安装 systemd 服务..."
cp "$SCRIPT_DIR/portal.service" /etc/systemd/system/portal.service
systemctl daemon-reload
systemctl enable portal
systemctl restart portal
echo "  ✅ systemd 服务已安装并启动"

echo ""
echo "===== 部署完成 ====="
echo ""
echo "注意事项:"
echo "  1. 请编辑 $DEPLOY_DIR/backend/.env 填写实际配置"
echo "     - PORTAL_JWT_SECRET: 替换为随机密钥"
echo "     - PORTAL_SSH_HOST: 如后端不部署在 Prometheus 服务器上, 填 172.16.10.27"
echo "     - PORTAL_MYSQL_PASSWORD: 确认数据库密码"
echo "  2. 配置 Nginx: 将 deploy/portal-nginx.conf 添加到 Nginx 配置"
echo "  3. 重启 Nginx: systemctl reload nginx"
echo "  4. 检查服务状态: systemctl status portal"
echo "  5. 查看日志: journalctl -u portal -f"
