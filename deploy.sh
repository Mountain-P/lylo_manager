#!/bin/bash

# Lylo Manager 庫存管理系統部署腳本
# 作者: AI Assistant
# 版本: 1.0

set -e  # 遇到錯誤時退出

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 項目路徑
PROJECT_ROOT="/root/lylo_manager"
FRONTEND_DIR="$PROJECT_ROOT/frontend_v4"
BACKEND_DIR="$PROJECT_ROOT/backend"
NGINX_CONFIG_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"

# 日誌函數
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# 檢查是否為root用戶
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "此腳本需要root權限運行，請使用 sudo"
    fi
}

# 檢查依賴
check_dependencies() {
    log "檢查系統依賴..."
    
    # 檢查nginx
    if ! command -v nginx &> /dev/null; then
        error "Nginx 未安裝，請先安裝: apt update && apt install nginx -y"
    fi
    
    # 檢查node
    if ! command -v node &> /dev/null; then
        error "Node.js 未安裝，請先安裝Node.js"
    fi
    
    # 檢查pm2
    if ! command -v pm2 &> /dev/null; then
        error "PM2 未安裝，請先安裝: npm install -g pm2"
    fi
    
    log "依賴檢查完成 ✓"
}

# 構建前端
build_frontend() {
    log "開始構建前端..."
    
    cd "$FRONTEND_DIR"
    
    # 安裝依賴（如果需要）
    if [ ! -d "node_modules" ]; then
        log "安裝前端依賴..."
        npm install
    fi
    
    # 構建前端
    log "構建生產版本..."
    npm run build
    
    if [ ! -d "dist" ]; then
        error "前端構建失敗，dist 目錄不存在"
    fi
    
    log "前端構建完成 ✓"
}

# 配置nginx
setup_nginx() {
    log "配置Nginx..."
    
    # 複製nginx配置
    if [ -f "$PROJECT_ROOT/nginx/lylo-manager.conf" ]; then
        cp "$PROJECT_ROOT/nginx/lylo-manager.conf" "$NGINX_CONFIG_DIR/lylo-manager"
        log "Nginx配置文件已複製"
    else
        error "Nginx配置文件不存在: $PROJECT_ROOT/nginx/lylo-manager.conf"
    fi
    
    # 啟用站點
    if [ ! -L "$NGINX_ENABLED_DIR/lylo-manager" ]; then
        ln -s "$NGINX_CONFIG_DIR/lylo-manager" "$NGINX_ENABLED_DIR/lylo-manager"
        log "Nginx站點已啟用"
    fi
    
    # 移除默認站點（如果存在）
    if [ -L "$NGINX_ENABLED_DIR/default" ]; then
        rm "$NGINX_ENABLED_DIR/default"
        log "默認站點已移除"
    fi
    
    # 測試nginx配置
    if nginx -t; then
        log "Nginx配置測試通過 ✓"
    else
        error "Nginx配置測試失敗"
    fi
}

# 重啟後端服務
restart_backend() {
    log "重啟後端服務..."
    
    cd "$BACKEND_DIR"
    
    # 檢查PM2是否有運行的進程
    if pm2 list | grep -q "inventory-manager-backend"; then
        log "重啟現有PM2進程..."
        pm2 restart inventory-manager-backend
    else
        log "啟動新的PM2進程..."
        pm2 start ecosystem.config.js
    fi
    
    # 保存PM2配置
    pm2 save
    
    # 設置PM2開機自啟
    pm2 startup systemd -u root --hp /root
    
    log "後端服務重啟完成 ✓"
}

# 重啟nginx
restart_nginx() {
    log "重啟Nginx..."
    
    systemctl restart nginx
    systemctl enable nginx
    
    if systemctl is-active --quiet nginx; then
        log "Nginx重啟成功 ✓"
    else
        error "Nginx重啟失敗"
    fi
}

# 健康檢查
health_check() {
    log "執行健康檢查..."
    
    # 檢查後端API
    sleep 5  # 等待服務啟動
    
    if curl -f -s http://localhost:3000/health > /dev/null; then
        log "後端API健康檢查通過 ✓"
    else
        warn "後端API健康檢查失敗，請檢查服務狀態"
    fi
    
    # 檢查nginx
    if curl -f -s http://localhost > /dev/null; then
        log "前端服務健康檢查通過 ✓"
    else
        warn "前端服務健康檢查失敗，請檢查Nginx配置"
    fi
}

# 顯示部署信息
show_deployment_info() {
    log "部署完成！"
    echo
    echo -e "${BLUE}=== 部署信息 ===${NC}"
    echo -e "前端訪問地址: ${GREEN}http://localhost${NC}"
    echo -e "API健康檢查: ${GREEN}http://localhost/health${NC}"
    echo -e "前端文件位置: ${GREEN}$FRONTEND_DIR/dist${NC}"
    echo -e "Nginx配置文件: ${GREEN}$NGINX_CONFIG_DIR/lylo-manager${NC}"
    echo
    echo -e "${BLUE}=== 常用命令 ===${NC}"
    echo -e "查看PM2狀態: ${GREEN}pm2 list${NC}"
    echo -e "查看PM2日誌: ${GREEN}pm2 logs inventory-manager-backend${NC}"
    echo -e "查看Nginx狀態: ${GREEN}systemctl status nginx${NC}"
    echo -e "查看Nginx日誌: ${GREEN}tail -f /var/log/nginx/lylo-manager-access.log${NC}"
    echo -e "重新部署: ${GREEN}./deploy.sh${NC}"
    echo
}

# 主函數
main() {
    echo -e "${BLUE}"
    echo "=================================="
    echo "   Lylo Manager 部署腳本"
    echo "=================================="
    echo -e "${NC}"
    
    check_root
    check_dependencies
    build_frontend
    setup_nginx
    restart_backend
    restart_nginx
    health_check
    show_deployment_info
}

# 執行主函數
main "$@"