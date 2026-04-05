# 🚀 Lylo Manager 部署說明

本文檔提供 Lylo Manager 庫存管理系統的完整生產環境部署指南。

## 📋 系統需求

### 最低配置
- **操作系統**: Ubuntu 20.04+ / CentOS 8+ / Debian 10+
- **CPU**: 2 核心
- **內存**: 4GB RAM
- **硬盤**: 20GB 可用空間
- **網絡**: 可訪問互聯網 (用於依賴安裝)

### 推薦配置
- **操作系統**: Ubuntu 22.04 LTS
- **CPU**: 4 核心
- **內存**: 8GB RAM
- **硬盤**: 50GB SSD
- **網絡**: 1Gbps 網絡連接

## 🛠️ 準備工作

### 1. 安裝系統依賴

```bash
# 更新系統包
sudo apt update && sudo apt upgrade -y

# 安裝基本工具
sudo apt install -y curl wget git build-essential

# 安裝 Nginx
sudo apt install -y nginx

# 安裝 Node.js (推薦使用 NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安裝 PM2
sudo npm install -g pm2

# 驗證安裝
nginx -v
node --version
npm --version
pm2 --version
```

### 2. 安裝數據庫 (MongoDB)

```bash
# 安裝 MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# 啟動 MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# 驗證安裝
mongod --version
```

### 3. 配置防火牆

```bash
# 開放必要端口
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS (如果使用)
sudo ufw enable
```

## 📦 部署步驟

### 方法一：一鍵自動部署 (推薦)

1. **下載並執行部署腳本**

```bash
# 進入項目根目錄
cd /root/lylo_manager

# 給腳本執行權限
chmod +x deploy.sh

# 執行部署
sudo ./deploy.sh
```

### 方法二：手動部署

1. **構建前端**

```bash
cd /root/lylo_manager/frontend_v4

# 安裝依賴
npm install

# 構建生產版本
npm run build
```

2. **配置 Nginx**

```bash
# 複製配置文件
sudo cp /root/lylo_manager/nginx/lylo-manager.conf /etc/nginx/sites-available/lylo-manager

# 啟用站點
sudo ln -s /etc/nginx/sites-available/lylo-manager /etc/nginx/sites-enabled/

# 移除默認站點
sudo rm -f /etc/nginx/sites-enabled/default

# 測試配置
sudo nginx -t

# 重啟 Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

3. **啟動後端服務**

```bash
cd /root/lylo_manager/backend

# 使用 PM2 啟動
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 設置開機自啟
pm2 startup systemd
```

## ⚙️ 環境變量配置

在後端目錄創建 `.env` 文件：

```bash
cd /root/lylo_manager/backend
cat > .env << 'EOF'
# 數據庫配置
MONGODB_URI=mongodb://localhost:27017/lylo_manager

# JWT 密鑰 (請修改為隨機字符串)
JWT_SECRET=your-super-secret-jwt-key-here

# 服務端口
PORT=3000

# 環境設定
NODE_ENV=production

# WooCommerce API (可選)
WOO_CONSUMER_KEY=your-woocommerce-consumer-key
WOO_CONSUMER_SECRET=your-woocommerce-consumer-secret
WOO_STORE_URL=https://your-store.com

# 郵件設定 (可選)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EOF
```

## 🔧 配置自定義

### 修改域名

編輯 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/lylo-manager
```

修改 `server_name` 行：
```nginx
server_name your-domain.com;  # 替換為您的域名
```

### SSL/HTTPS 配置

如果您有 SSL 證書，取消 Nginx 配置文件中的 HTTPS 部分註釋，並修改證書路徑。

### 端口配置

如果需要修改後端端口，請同時修改：
1. `.env` 文件中的 `PORT`
2. Nginx 配置中的 `upstream backend_api`

## 🚦 服務管理

### PM2 常用命令

```bash
# 查看服務狀態
pm2 list

# 查看日誌
pm2 logs inventory-manager-backend

# 重啟服務
pm2 restart inventory-manager-backend

# 停止服務
pm2 stop inventory-manager-backend

# 監控面板
pm2 monit
```

### Nginx 常用命令

```bash
# 檢查配置
sudo nginx -t

# 重啟服務
sudo systemctl restart nginx

# 查看狀態
sudo systemctl status nginx

# 查看訪問日誌
sudo tail -f /var/log/nginx/lylo-manager-access.log

# 查看錯誤日誌
sudo tail -f /var/log/nginx/lylo-manager-error.log
```

## 🔍 故障排除

### 常見問題

1. **502 Bad Gateway**
   - 檢查後端服務是否運行：`pm2 list`
   - 檢查端口配置是否正確
   - 查看 PM2 日誌：`pm2 logs`

2. **404 Not Found**
   - 檢查前端是否正確構建：確認 `dist` 目錄存在
   - 檢查 Nginx 配置中的 `root` 路徑

3. **數據庫連接失敗**
   - 檢查 MongoDB 是否運行：`sudo systemctl status mongod`
   - 檢查 `.env` 文件中的數據庫配置

4. **權限問題**
   - 確保 Nginx 用戶有權訪問前端文件：`sudo chown -R www-data:www-data /root/lylo_manager/frontend_v4/dist/`

### 日誌位置

- **PM2 日誌**: `~/.pm2/logs/`
- **Nginx 訪問日誌**: `/var/log/nginx/lylo-manager-access.log`
- **Nginx 錯誤日誌**: `/var/log/nginx/lylo-manager-error.log`
- **系統日誌**: `/var/log/syslog`

## 🔄 更新部署

當有新版本時：

```bash
# 拉取最新代碼
cd /root/lylo_manager
git pull origin main

# 重新執行部署腳本
sudo ./deploy.sh
```

## 🛡️ 安全建議

1. **定期更新系統**
```bash
sudo apt update && sudo apt upgrade -y
```

2. **配置防火牆**
```bash
sudo ufw status
sudo ufw enable
```

3. **設置 SSL 證書** (使用 Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

4. **備份數據庫**
```bash
mongodump --out /backup/$(date +%Y%m%d_%H%M%S)
```

5. **監控系統資源**
```bash
# 安裝監控工具
sudo apt install htop iotop
```

## 📞 支持

如果遇到問題，請檢查：

1. 系統日誌：`journalctl -u nginx -f`
2. PM2 狀態：`pm2 list`
3. 網絡連接：`curl -I http://localhost:3000/health`

---

**版本**: 1.0  
**最後更新**: 2024年7月29日  
**兼容**: Ubuntu 20.04+, Node.js 18+, Nginx 1.18+