# 盤點小助手 - 專案設置指南

## 專案概述

這是一個整合 WooCommerce API 的庫存盤點管理系統，支援條碼掃描、角色管理、異常警示等功能。

## 技術架構

### 後端
- **Node.js + Express**: Web 框架
- **MongoDB + Mongoose**: 資料庫
- **JWT**: 身份驗證
- **node-cron**: 定時任務（每10分鐘同步WooCommerce）
- **axios**: HTTP 客戶端
- **express-validator**: 資料驗證

### 前端
- **Vue 2**: 前端框架
- **Vuetify**: UI 組件庫
- **Vuex**: 狀態管理
- **Vue Router**: 路由管理
- **axios**: HTTP 客戶端
- **QuaggaJS**: 條碼掃描（待整合）
- **moment.js**: 日期處理

## 功能特色

### 🔄 WooCommerce 同步
- 每10分鐘自動同步商品資料
- 記錄庫存變化歷史
- 手動觸發同步功能

### 👥 角色管理
- **老闆**: 管理員工、查看所有記錄、系統設定
- **員工**: 商品盤點、查看自己的記錄

### 📱 條碼掃描
- 支援 VitePOS 條碼系統
- 快速定位商品進行盤點
- 手動輸入條碼備選方案

### 🔍 智能比對
- 自動比對：`盤點數量 + 銷售數量 = 到貨數量`
- 異常商品紅色警示
- 即時更新統計資料

### 📊 資料管理
- 完整的盤點記錄
- WooCommerce 同步歷史
- 統計圖表與報表

## 安裝與設置

### 1. 環境需求
- Node.js 16+
- MongoDB 4.4+
- npm 或 yarn

### 2. 後端設置

```bash
# 進入後端目錄
cd backend

# 安裝依賴
npm install

# 複製環境變數檔案
cp .env.example .env

# 編輯 .env 檔案，設置以下變數：
# PORT=3000
# MONGODB_URI=mongodb://localhost:27017/inventory_manager
# JWT_SECRET=your-jwt-secret-key
# WOO_URL=https://your-store.com
# WOO_CONSUMER_KEY=ck_xxxxx
# WOO_CONSUMER_SECRET=cs_xxxxx

# 啟動開發服務器
npm run dev
```

### 3. 前端設置

```bash
# 進入前端目錄
cd frontend

# 安裝依賴
npm install

# 複製環境變數檔案
cp .env.example .env

# 編輯 .env 檔案，設置：
# VUE_APP_API_BASE_URL=http://localhost:3000/api

# 啟動開發服務器
npm run serve
```

### 4. 初始數據

建議先建立一個老闆帳號：

```javascript
// 可以通過 MongoDB 直接插入或建立一個初始化腳本
{
  name: "管理員",
  email: "admin@example.com",
  passwordHash: "已加密的密碼",
  role: "boss",
  isActive: true
}
```

## 資料庫結構

### User (使用者)
- `name`: 姓名
- `email`: Email (唯一)
- `passwordHash`: 加密密碼
- `role`: 角色 (boss/employee)
- `isActive`: 是否啟用
- `lastLoginAt`: 最後登入時間
- `createdBy`: 建立者

### Product (商品)
- `name`: 商品名稱
- `sku`: SKU 碼
- `barcode`: VitePOS 條碼
- `expectedQty`: 到貨數量
- `stockQty`: 系統庫存 (從WooCommerce同步)
- `salesQty`: 銷售數量
- `countedQty`: 盤點數量
- `wooId`: WooCommerce 商品 ID
- `wooData`: WooCommerce 商品資料
- `lastSyncAt`: 最後同步時間
- `lastCountedAt`: 最後盤點時間
- `lastCountedBy`: 最後盤點人員

### InventoryLog (盤點記錄)
- `productId`: 商品 ID
- `userId`: 使用者 ID
- `countedQty`: 盤點數量
- `previousQty`: 盤點前數量
- `expectedQty`: 預期數量
- `salesQty`: 銷售數量
- `diffQty`: 差異數量
- `note`: 備註
- `method`: 盤點方式 (manual/barcode)
- `deviceInfo`: 設備資訊

### StockHistory (庫存歷史)
- `productId`: 商品 ID
- `wooStockQty`: WooCommerce 庫存數量
- `previousStockQty`: 變更前數量
- `changeQty`: 變化數量
- `changeType`: 變化類型
- `syncSource`: 同步來源
- `syncedAt`: 同步時間
- `syncDuration`: 同步耗時

## API 路由

### 認證 (`/api/auth`)
- `POST /login` - 登入
- `POST /register` - 註冊用戶 (僅老闆)
- `POST /refresh` - 刷新 token
- `GET /me` - 獲取當前用戶
- `PUT /profile` - 更新個人資料
- `POST /logout` - 登出

### 商品 (`/api/products`)
- `GET /` - 獲取商品列表
- `GET /stats` - 獲取商品統計
- `GET /errors` - 獲取異常商品
- `GET /:id` - 獲取商品詳情
- `PUT /:id` - 更新商品 (僅老闆)
- `POST /` - 新增商品 (僅老闆)
- `DELETE /:id` - 刪除商品 (僅老闆)

### 盤點 (`/api/inventory`)
- `POST /count/:productId` - 執行盤點
- `GET /logs` - 獲取盤點記錄
- `GET /logs/stats` - 獲取盤點統計
- `GET /sync/status` - 獲取同步狀態
- `POST /sync/manual` - 手動觸發同步 (僅老闆)

### 用戶 (`/api/users`)
- `GET /` - 獲取用戶列表 (僅老闆)
- `GET /:userId` - 獲取用戶詳情
- `PUT /:userId` - 更新用戶資料 (僅老闆)
- `DELETE /:userId` - 停用用戶 (僅老闆)

## 重要特性

### 🚨 紅色警示邏輯
當 `countedQty + salesQty ≠ expectedQty` 時，該商品會在表格中顯示紅色背景，幫助快速識別異常商品。

### 🔄 自動同步
- 每10分鐘自動執行 WooCommerce API 同步
- 只記錄有變化的庫存數量
- 錯誤處理與重試機制

### 📱 條碼掃描
- 支援 VitePOS 條碼格式
- 可擴展支援其他條碼格式
- 手動輸入備選方案

### 🔐 權限控制
- JWT Token 認證
- 自動 Token 刷新
- 角色基礎的路由守衛

## 開發注意事項

1. **記憶體中的規範**: 根據記憶體，Vuetify DataTable 應使用 `text` 和 `value` 屬性，而非 `title` 和 `key`

2. **UI 一致性**: 所有介面需嚴格按照設計規範實作，不可自行變更

3. **錯誤處理**: 前端已設置完整的錯誤攔截和用戶提示

4. **響應式設計**: 支援手機和平板設備

## 部署建議

### 開發環境
- 後端: `npm run dev` (使用 nodemon)
- 前端: `npm run serve` (熱重載)

### 生產環境
- 後端: `npm start`
- 前端: `npm run build` 然後部署到 Nginx 或 Apache
- 資料庫: MongoDB 叢集
- 反向代理: Nginx + SSL

## 故障排除

### 常見問題
1. **WooCommerce API 連接失敗**: 檢查 API 金鑰和網址設定
2. **條碼掃描不工作**: 確認攝像頭權限和 HTTPS 連接
3. **同步頻率過高**: 調整 cron 表達式
4. **記憶體使用過高**: 定期清理舊的歷史記錄

### 日誌查看
- 後端日誌: 控制台輸出
- 前端錯誤: 瀏覽器開發者工具
- 同步狀態: `/api/inventory/sync/status`

## 支援

如有問題請查看：
1. API 文件 (透過 `/health` 端點)
2. 前端錯誤訊息
3. 後端控制台日誌

## 版本記錄

- **v1.0.0**: 基礎功能完成
  - WooCommerce 同步
  - 條碼掃描
  - 角色管理
  - 盤點功能
  - 異常警示 