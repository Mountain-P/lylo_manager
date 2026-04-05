# 盤點小助手

一個整合 WooCommerce API 的庫存盤點管理系統

## 功能特色

- **WooCommerce 同步**: 每10分鐘自動同步商品資料，記錄庫存變化歷史
- **角色管理**: 老闆與員工權限分離
- **條碼掃描**: 支援 VitePOS 條碼快速查找產品
- **智能比對**: 自動比對 `盤點數量 + 銷售數量 = 到貨數量`，異常時紅色警示
- **歷史追蹤**: 完整記錄所有盤點與庫存變化

## 技術架構

### 前端
- Vue 2
- Vuetify UI Framework
- QuaggaJS 條碼掃描

### 後端
- Node.js + Express
- MongoDB + Mongoose
- JWT 認證
- WooCommerce REST API 整合

## 快速開始

### 安裝依賴

```bash
# 安裝後端依賴
cd backend
npm install

# 安裝前端依賴
cd ../frontend
npm install
```

### 環境設定

在 `backend` 目錄建立 `.env` 檔案：

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/inventory_manager
JWT_SECRET=your-jwt-secret

# WooCommerce API 設定
WOO_URL=https://your-store.com
WOO_CONSUMER_KEY=ck_xxxxx
WOO_CONSUMER_SECRET=cs_xxxxx
```

### 啟動服務

```bash
# 啟動後端服務
cd backend
npm run dev

# 啟動前端服務  
cd frontend
npm run serve
```

## 資料庫結構

- **User**: 使用者管理（老闆/員工）
- **Product**: 商品資料（含 WooCommerce 同步資料）
- **InventoryLog**: 盤點記錄
- **StockHistory**: WooCommerce 庫存變化歷史

## API 文件

詳見 `backend/routes/` 目錄下的路由定義 