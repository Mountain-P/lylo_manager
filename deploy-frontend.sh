#!/bin/bash

# Lylo Manager 前端自動部署腳本
# 功能：Build前端並部署到nginx靜態文件目錄

set -e  # 遇到錯誤立即退出

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 項目路徑配置
FRONTEND_DIR="/root/lylo_manager/frontend_v4"
NGINX_WWW_DIR="/var/www/lylo-manager"
BACKUP_DIR="/root/lylo_manager/frontend_backup"

echo -e "${BLUE}=== Lylo Manager 前端部署腳本 ===${NC}"
echo -e "${YELLOW}開始時間: $(date)${NC}"
echo ""

# 檢查前端目錄是否存在
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}錯誤: 前端目錄不存在: $FRONTEND_DIR${NC}"
    exit 1
fi

# 進入前端目錄
cd "$FRONTEND_DIR"
echo -e "${BLUE}進入前端目錄: $FRONTEND_DIR${NC}"

# 檢查package.json是否存在
if [ ! -f "package.json" ]; then
    echo -e "${RED}錯誤: package.json 不存在${NC}"
    exit 1
fi

# 備份現有的dist目錄（如果存在）
if [ -d "dist" ]; then
    echo -e "${YELLOW}備份現有的dist目錄...${NC}"
    mkdir -p "$BACKUP_DIR"
    BACKUP_NAME="dist_backup_$(date +%Y%m%d_%H%M%S)"
    mv dist "$BACKUP_DIR/$BACKUP_NAME"
    echo -e "${GREEN}已備份到: $BACKUP_DIR/$BACKUP_NAME${NC}"
fi

# 安裝依賴（如果需要）
echo -e "${BLUE}檢查並安裝依賴...${NC}"
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo -e "${YELLOW}安裝/更新 npm 依賴...${NC}"
    npm install
else
    echo -e "${GREEN}依賴已是最新${NC}"
fi

# Build前端
echo -e "${BLUE}開始 Build 前端...${NC}"
npm run build

# 檢查build是否成功
if [ ! -d "dist" ]; then
    echo -e "${RED}錯誤: Build 失敗，dist 目錄不存在${NC}"
    
    # 如果有備份，恢復備份
    if [ -d "$BACKUP_DIR/$BACKUP_NAME" ]; then
        echo -e "${YELLOW}恢復備份...${NC}"
        mv "$BACKUP_DIR/$BACKUP_NAME" dist
        echo -e "${GREEN}已恢復備份${NC}"
    fi
    
    exit 1
fi

# 檢查nginx配置是否正確
echo -e "${BLUE}檢查nginx配置...${NC}"
if nginx -t; then
    echo -e "${GREEN}Nginx配置檢查通過${NC}"
else
    echo -e "${RED}錯誤: Nginx配置有誤${NC}"
    exit 1
fi

# 重新加載nginx配置
echo -e "${BLUE}重新加載nginx配置...${NC}"
systemctl reload nginx

# 檢查nginx狀態
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}Nginx運行正常${NC}"
else
    echo -e "${YELLOW}啟動nginx服務...${NC}"
    systemctl start nginx
    
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}Nginx已成功啟動${NC}"
    else
        echo -e "${RED}錯誤: Nginx啟動失敗${NC}"
        exit 1
    fi
fi

# 清理舊備份（保留最近5個）
echo -e "${BLUE}清理舊備份...${NC}"
if [ -d "$BACKUP_DIR" ]; then
    cd "$BACKUP_DIR"
    ls -1t | tail -n +6 | xargs -r rm -rf
    echo -e "${GREEN}已清理舊備份（保留最近5個）${NC}"
fi

# 複製到nginx目錄
echo -e "${BLUE}部署到nginx目錄...${NC}"
mkdir -p "$NGINX_WWW_DIR"
cp -r dist/* "$NGINX_WWW_DIR/"
chown -R www-data:www-data "$NGINX_WWW_DIR"

# 顯示部署信息
echo ""
echo -e "${GREEN}=== 部署完成 ===${NC}"
echo -e "${GREEN}前端文件位置: $NGINX_WWW_DIR${NC}"
echo -e "${GREEN}完成時間: $(date)${NC}"
echo ""
echo -e "${BLUE}你現在可以通過以下方式訪問：${NC}"
echo -e "${YELLOW}- 前端頁面: http://localhost/${NC}"
echo -e "${YELLOW}- API接口: http://localhost/api/${NC}"
echo -e "${YELLOW}- 健康檢查: http://localhost/health${NC}"
echo ""

# 顯示服務狀態
echo -e "${BLUE}=== 服務狀態 ===${NC}"
echo -e "${YELLOW}Nginx狀態:${NC}"
systemctl status nginx --no-pager -l

echo ""
echo -e "${GREEN}部署腳本執行完成！${NC}"