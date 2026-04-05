#!/bin/bash

# Lylo Manager 庫存管理系統部署腳本
# 作者: AI Assistant
# 版本: 1.2 - 兼容性修復版本
# 執行方式: sudo bash ./deploy.sh

set -e  # 遇到錯誤時退出

# 檢查是否使用bash執行
if [ -z "$BASH_VERSION" ]; then
    echo "❌ 錯誤：此腳本需要使用 bash 執行"
    echo "✅ 請使用：sudo bash ./deploy.sh"
    echo "或者："
    echo "   chmod +x ./deploy.sh"
    echo "   sudo ./deploy.sh"
    exit 1
fi

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
BACKEND_DIR="$PROJECT_ROOT/backend"
NGINX_CONFIG_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"

# 應用名稱
APP_NAME="inventory-manager-backend"

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
        error "此腳本需要root權限運行，請使用 sudo bash ./deploy.sh"
    fi
}

# 檢查項目目錄
check_project_structure() {
    log "檢查項目結構..."
    
    if [ ! -d "$PROJECT_ROOT" ]; then
        error "項目根目錄不存在: $PROJECT_ROOT"
    fi
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        error "前端目錄不存在: $FRONTEND_DIR"
    fi
    
    if [ ! -d "$BACKEND_DIR" ]; then
        error "後端目錄不存在: $BACKEND_DIR"
    fi
    
    if [ ! -f "$BACKEND_DIR/package.json" ]; then
        error "後端package.json不存在"
    fi
    
    if [ ! -f "$FRONTEND_DIR/package.json" ]; then
        error "前端package.json不存在"
    fi
    
    log "項目結構檢查通過 ✓"
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
    
    # 檢查npm
    if ! command -v npm &> /dev/null; then
        error "npm 未安裝，請先安裝npm"
    fi
    
    # 檢查pm2
    if ! command -v pm2 &> /dev/null; then
        error "PM2 未安裝，請先安裝: npm install -g pm2"
    fi
    
    # 檢查curl（用於健康檢查）
    if ! command -v curl &> /dev/null; then
        warn "curl 未安裝，健康檢查可能無法進行"
    fi
    
    log "依賴檢查完成 ✓"
}

# 構建前端
build_frontend() {
    log "開始構建前端..."
    
    cd "$FRONTEND_DIR"
    
    # 檢查package.json
    if [ ! -f "package.json" ]; then
        error "前端package.json不存在"
    fi
    
    # 安裝依賴（如果需要）
    if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
        log "安裝前端依賴..."
        npm install || error "前端依賴安裝失敗"
    fi
    
    # 清理舊的構建文件
    if [ -d "dist" ]; then
        rm -rf dist
        log "清理舊的構建文件"
    fi
    
    # 構建前端
    log "構建生產版本..."
    npm run build || error "前端構建失敗"
    
    if [ ! -d "dist" ]; then
        error "前端構建失敗，dist 目錄不存在"
    fi
    
    # 檢查構建產物
    if [ ! -f "dist/index.html" ]; then
        error "前端構建不完整，index.html不存在"
    fi
    
    log "前端構建完成 ✓"
}

# 安裝後端依賴
install_backend_deps() {
    log "檢查後端依賴..."
    
    cd "$BACKEND_DIR"
    
    # 如果node_modules不存在或package-lock.json更新了，重新安裝
    if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
        log "安裝後端依賴..."
        npm install || error "後端依賴安裝失敗"
    fi
    
    log "後端依賴檢查完成 ✓"
}

# 配置nginx
setup_nginx() {
    log "配置Nginx..."
    
    # 檢查nginx配置文件
    local nginx_config_source=""
    if [ -f "$PROJECT_ROOT/nginx/lylo-manager.conf" ]; then
        nginx_config_source="$PROJECT_ROOT/nginx/lylo-manager.conf"
    elif [ -f "$PROJECT_ROOT/nginx.conf" ]; then
        nginx_config_source="$PROJECT_ROOT/nginx.conf"
    elif [ -f "$BACKEND_DIR/nginx.conf" ]; then
        nginx_config_source="$BACKEND_DIR/nginx.conf"
    elif [ -f "$BACKEND_DIR/nginx/lylo-manager.conf" ]; then
        nginx_config_source="$BACKEND_DIR/nginx/lylo-manager.conf"
    else
        error "找不到Nginx配置文件，請檢查以下位置之一是否存在配置文件：
        - $PROJECT_ROOT/nginx/lylo-manager.conf
        - $PROJECT_ROOT/nginx.conf  
        - $BACKEND_DIR/nginx.conf
        - $BACKEND_DIR/nginx/lylo-manager.conf"
    fi
    
    # 清理舊的nginx配置（避免重複）
    log "清理舊的nginx配置..."
    rm -f "$NGINX_ENABLED_DIR/lylo-manager"
    rm -f "$NGINX_ENABLED_DIR/lylo-manager.conf"
    
    # 複製nginx配置
    cp "$nginx_config_source" "$NGINX_CONFIG_DIR/lylo-manager.conf" || error "複製Nginx配置失敗"
    log "Nginx配置文件已複製"
    
    # 更新配置中的路徑（如果包含佔位符）
    sed -i "s|{PROJECT_ROOT}|$PROJECT_ROOT|g" "$NGINX_CONFIG_DIR/lylo-manager.conf"
    sed -i "s|{FRONTEND_DIR}|$FRONTEND_DIR|g" "$NGINX_CONFIG_DIR/lylo-manager.conf"
    sed -i "s|/root/lylo_manager|$PROJECT_ROOT|g" "$NGINX_CONFIG_DIR/lylo-manager.conf"
    
    # 啟用站點
    if [ ! -L "$NGINX_ENABLED_DIR/lylo-manager.conf" ]; then
        ln -s "$NGINX_CONFIG_DIR/lylo-manager.conf" "$NGINX_ENABLED_DIR/lylo-manager.conf" || error "啟用Nginx站點失敗"
        log "Nginx站點已啟用"
    else
        log "Nginx站點已存在，跳過創建"
    fi
    
    # 備份並移除默認站點（如果存在且用戶同意）
    if [ -L "$NGINX_ENABLED_DIR/default" ]; then
        warn "發現默認Nginx站點，建議移除以避免衝突"
        echo -n "是否移除默認站點？(y/N): "
        read -r REPLY
        if [ "$REPLY" = "y" ] || [ "$REPLY" = "Y" ]; then
            rm "$NGINX_ENABLED_DIR/default"
            log "默認站點已移除"
        fi
    fi
    
    # 測試nginx配置
    if nginx -t; then
        log "Nginx配置測試通過 ✓"
    else
        error "Nginx配置測試失敗，請檢查配置文件"
    fi
}

# 重啟後端服務
restart_backend() {
    log "重啟後端服務..."
    
    cd "$BACKEND_DIR"
    
    # 停止現有進程（如果存在）
    if pm2 list | grep -q "$APP_NAME"; then
        log "停止現有PM2進程..."
        pm2 stop "$APP_NAME" || warn "停止進程失敗，可能進程已停止"
        pm2 delete "$APP_NAME" || warn "刪除進程失敗"
    fi
    
    # 檢查是否有ecosystem.config.js
    if [ -f "ecosystem.config.js" ]; then
        log "使用ecosystem.config.js啟動服務..."
        pm2 start ecosystem.config.js || error "使用ecosystem.config.js啟動失敗"
    elif [ -f "server.js" ]; then
        log "使用server.js啟動服務..."
        pm2 start server.js --name "$APP_NAME" || error "啟動server.js失敗"
    elif [ -f "app.js" ]; then
        log "使用app.js啟動服務..."
        pm2 start app.js --name "$APP_NAME" || error "啟動app.js失敗"
    else
        error "找不到後端入口文件 (ecosystem.config.js, server.js, 或 app.js)"
    fi
    
    # 等待服務啟動
    sleep 10
    
    # 檢查服務狀態
    if pm2 list | grep -q "$APP_NAME.*online"; then
        log "後端服務啟動成功"
    else
        error "後端服務啟動失敗，請檢查PM2日誌: pm2 logs $APP_NAME"
    fi
    
    # 保存PM2配置
    pm2 save || warn "保存PM2配置失敗"
    
    log "後端服務重啟完成 ✓"
}

# 設置PM2開機自啟
setup_pm2_startup() {
    log "設置PM2開機自啟..."
    
    # 檢查是否已經設置了startup
    if ! pm2 startup systemd 2>/dev/null | grep -q "sudo"; then
        warn "PM2 startup 已經配置"
        return
    fi
    
    # 生成startup腳本
    local startup_cmd
    startup_cmd=$(pm2 startup systemd 2>/dev/null | grep "sudo" | head -1)
    
    if [ -n "$startup_cmd" ]; then
        log "執行PM2 startup命令..."
        eval "$startup_cmd" || warn "PM2 startup 設置失敗"
        pm2 save || warn "保存PM2配置失敗"
        log "PM2開機自啟設置完成 ✓"
    else
        warn "無法獲取PM2 startup命令"
    fi
}

# 重啟nginx
restart_nginx() {
    log "重啟Nginx..."
    
    # 重新載入配置
    systemctl reload nginx || error "重新載入Nginx配置失敗"
    
    # 確保nginx啟用
    systemctl enable nginx || warn "啟用Nginx開機自啟失敗"
    
    # 檢查nginx狀態
    if systemctl is-active --quiet nginx; then
        log "Nginx重啟成功 ✓"
    else
        error "Nginx未運行，請檢查配置"
    fi
}

# 健康檢查
health_check() {
    log "執行健康檢查..."
    
    # 等待服務完全啟動
    local max_attempts=12
    local attempt=1
    
    log "等待服務啟動..."
    sleep 5
    
    # 檢查後端API
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
            log "後端API健康檢查通過 ✓"
            break
        else
            if [ $attempt -eq $max_attempts ]; then
                warn "後端API健康檢查失敗，請檢查服務狀態: pm2 logs $APP_NAME"
                break
            fi
            log "等待後端服務啟動... (嘗試 $attempt/$max_attempts)"
            sleep 5
            attempt=$((attempt + 1))
        fi
    done
    
    # 檢查nginx/前端
    if curl -f -s http://localhost > /dev/null 2>&1; then
        log "前端服務健康檢查通過 ✓"
    else
        warn "前端服務健康檢查失敗，請檢查Nginx配置和前端構建"
    fi
    
    # 顯示服務狀態
    log "當前服務狀態："
    pm2 list | grep -E "(App name|$APP_NAME)" || warn "PM2進程信息獲取失敗"
}

# 顯示部署信息
show_deployment_info() {
    log "部署完成！"
    echo
    echo -e "${BLUE}=== 部署信息 ===${NC}"
    echo -e "項目路徑: ${GREEN}$PROJECT_ROOT${NC}"
    echo -e "前端訪問地址: ${GREEN}http://localhost${NC}"
    echo -e "API健康檢查: ${GREEN}http://localhost:3000/health${NC}"
    echo -e "前端文件位置: ${GREEN}$FRONTEND_DIR/dist${NC}"
    echo -e "Nginx配置文件: ${GREEN}$NGINX_CONFIG_DIR/lylo-manager.conf${NC}"
    echo
    echo -e "${BLUE}=== 常用命令 ===${NC}"
    echo -e "查看PM2狀態: ${GREEN}pm2 list${NC}"
    echo -e "查看PM2日誌: ${GREEN}pm2 logs $APP_NAME${NC}"
    echo -e "重啟後端服務: ${GREEN}pm2 restart $APP_NAME${NC}"
    echo -e "查看Nginx狀態: ${GREEN}systemctl status nginx${NC}"
    echo -e "查看Nginx錯誤日誌: ${GREEN}tail -f /var/log/nginx/error.log${NC}"
    echo -e "重新載入Nginx: ${GREEN}systemctl reload nginx${NC}"
    echo -e "重新部署: ${GREEN}cd $SCRIPT_DIR && sudo ./deploy.sh${NC}"
    echo
    echo -e "${YELLOW}注意事項：${NC}"
    echo -e "• 如果服務無法訪問，請檢查防火牆設置"
    echo -e "• 生產環境請設置域名和SSL證書"
    echo -e "• 定期備份數據庫和配置文件"
}

# 主函數
main() {
    echo -e "${BLUE}"
    echo "=================================="
    echo "   Lylo Manager 部署腳本 v1.2"
    echo "=================================="
    echo -e "${NC}"
    
    check_root
    check_project_structure
    check_dependencies
    build_frontend
    install_backend_deps
    setup_nginx
    restart_backend
    setup_pm2_startup
    restart_nginx
    health_check
    show_deployment_info
}

# 執行主函數
main "$@"