#!/bin/bash

# Lylo Manager 快速部署腳本
# 功能：重新構建前端 + 複製到nginx目錄 + 重啟PM2服務
# 執行方式: sudo bash ./quick-deploy.sh

set -e  # 遇到錯誤時退出

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 獲取腳本所在目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend_v4"
NGINX_WWW_DIR="/var/www/lylo-manager"

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
    if [ "$(id -u)" -ne 0 ]; then
        error "此腳本需要root權限運行，請使用 sudo bash ./quick-deploy.sh"
    fi
}

# 構建前端
build_frontend() {
    log "開始構建前端..."
    
    cd "$FRONTEND_DIR"
    
    # 檢查前端目錄
    if [ ! -f "package.json" ]; then
        error "前端目錄不存在或無效: $FRONTEND_DIR"
    fi
    
    # 清理舊的構建文件
    if [ -d "dist" ]; then
        log "清理舊的構建文件..."
        rm -rf dist
    fi
    
    # 安裝依賴（如果node_modules不存在）
    if [ ! -d "node_modules" ]; then
        log "安裝前端依賴..."
        npm install || error "前端依賴安裝失敗"
    fi
    
    # 構建前端
    log "執行前端構建..."
    npm run build || error "前端構建失敗"
    
    # 檢查構建結果
    if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
        error "前端構建失敗：找不到 dist/index.html"
    fi
    
    log "前端構建完成 ✓"
}

# 複製前端文件到nginx目錄
deploy_frontend() {
    log "部署前端文件到nginx目錄..."
    
    # 創建nginx web目錄
    mkdir -p "$NGINX_WWW_DIR"
    
    # 複製構建文件
    log "複製文件從 $FRONTEND_DIR/dist 到 $NGINX_WWW_DIR"
    cp -r "$FRONTEND_DIR/dist/"* "$NGINX_WWW_DIR/" || error "文件複製失敗"
    
    # 設置正確的權限
    chown -R www-data:www-data "$NGINX_WWW_DIR"
    chmod -R 755 "$NGINX_WWW_DIR"
    
    log "前端文件部署完成 ✓"
}

# 更新nginx配置
update_nginx_config() {
    log "更新nginx配置..."
    
    # 備份原配置
    if [ -f "/etc/nginx/sites-available/lylo-manager.conf" ]; then
        cp "/etc/nginx/sites-available/lylo-manager.conf" "/etc/nginx/sites-available/lylo-manager.conf.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # 更新配置中的root路徑
    sed -i "s|root /root/lylo_manager/frontend_v4/dist;|root $NGINX_WWW_DIR;|g" /etc/nginx/sites-available/lylo-manager.conf
    
    # 測試nginx配置
    nginx -t || error "Nginx配置測試失敗"
    
    # 重新載入nginx
    systemctl reload nginx || error "Nginx重新載入失敗"
    
    log "Nginx配置更新完成 ✓"
}

# 重啟PM2服務
restart_pm2() {
    log "重啟PM2服務..."
    
    # 檢查PM2是否安裝
    if ! command -v pm2 &> /dev/null; then
        error "PM2未安裝，請先安裝PM2: npm install -g pm2"
    fi
    
    # 重啟所有PM2進程
    pm2 restart all || warn "PM2重啟失敗，嘗試重新載入..."
    
    # 如果重啟失敗，嘗試重新載入
    pm2 reload all || warn "PM2重新載入也失敗"
    
    # 顯示PM2狀態
    log "當前PM2服務狀態："
    pm2 list
    
    log "PM2服務重啟完成 ✓"
}

# 健康檢查
health_check() {
    log "執行快速健康檢查..."
    
    # 等待服務啟動
    sleep 3
    
    # 檢查前端
    if curl -f -s http://localhost/ > /dev/null 2>&1; then
        log "前端服務健康檢查通過 ✓"
    else
        warn "前端服務可能有問題"
    fi
    
    # 檢查後端API
    if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
        log "後端API健康檢查通過 ✓"
    else
        warn "後端API可能有問題"
    fi
}

# 主函數
main() {
    echo -e "${BLUE}"
    echo "=================================="
    echo "   Lylo Manager 快速部署腳本"
    echo "=================================="
    echo -e "${NC}"
    
    check_root
    build_frontend
    deploy_frontend
    update_nginx_config
    restart_pm2
    health_check
    
    echo -e "${GREEN}"
    echo "🎉 快速部署完成！"
    echo "前端訪問: http://localhost"
    echo "後端API: http://localhost:3000"
    echo -e "${NC}"
}

# 執行主函數
main "$@"