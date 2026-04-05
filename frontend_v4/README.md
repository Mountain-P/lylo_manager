# 盤點小助手 - 前端應用程式

基於 Vue 3 + Vuetify 3 + Pinia 的現代化庫存盤點管理系統前端應用程式。

## 🚀 技術棧

- **Vue 3.5** - 漸進式 JavaScript 框架
- **Vuetify 3.9** - Material Design 組件庫
- **Pinia 3.0** - 狀態管理
- **Vue Router 4.5** - 路由管理
- **Vite** - 現代化建構工具
- **Axios** - HTTP 客戶端
- **Moment.js** - 日期處理
- **html5-qrcode** - 條碼掃描
- **Chart.js** - 圖表展示

## 📋 功能特色

### 🔐 認證系統
- JWT Token 自動管理和刷新
- 角色權限控制 (管理員/一般員工)
- 登入狀態持久化

### 📦 商品管理
- 商品列表瀏覽和搜尋
- 多型號商品支援
- 商品詳情查看
- 條碼搜尋功能

### 📱 條碼盤點
- 手機相機條碼掃描
- 快速盤點模式
- 批量盤點支援
- 掃描歷史記錄

### 📊 盤點記錄
- 詳細盤點歷史
- 多條件篩選搜尋
- 異常商品標記
- 記錄匯出功能

### 👥 用戶管理
- 員工帳號管理 (僅管理員)
- 密碼修改功能
- 用戶活動統計

### 🔄 WooCommerce 同步
- 自動/手動同步
- 同步進度監控
- 同步記錄查看
- 靈活同步設定

### 📈 儀表板
- 實時統計數據
- 快速操作入口
- 最近活動展示
- 進度追蹤

## 🛠️ 安裝與設定

### 環境需求
- Node.js 18+ 
- npm 9+ 或 yarn 1.22+

### 安裝步驟

1. **克隆專案**
```bash
git clone <repository-url>
cd frontend_v4
```

2. **安裝依賴**
```bash
npm install
# 或
yarn install
```

3. **環境配置**
```bash
cp .env.example .env
```

編輯 `.env` 文件設定 API 後端地址：
```env
VITE_API_URL=http://localhost:3000/api
```

4. **啟動開發服務器**
```bash
npm run dev
# 或
yarn dev
```

5. **建置生產版本**
```bash
npm run build
# 或
yarn build
```

## 📁 專案結構

```
src/
├── components/          # 可重用組件
├── layouts/            # 布局組件
│   └── MainLayout.vue  # 主要布局
├── pages/              # 頁面組件
│   ├── Dashboard.vue   # 儀表板
│   ├── Login.vue       # 登入頁面
│   ├── Products/       # 商品管理
│   ├── Inventory/      # 盤點管理
│   ├── Users/          # 用戶管理
│   ├── Sync/           # 同步管理
│   └── Profile.vue     # 個人資料
├── stores/             # Pinia 狀態管理
│   ├── auth.js         # 認證狀態
│   ├── products.js     # 商品狀態
│   ├── inventory.js    # 盤點狀態
│   ├── users.js        # 用戶狀態
│   └── ui.js           # UI 狀態
├── plugins/            # 插件配置
│   ├── axios.js        # API 客戶端
│   └── vuetify.js      # Vuetify 設定
├── router/             # 路由配置
│   └── index.js        # 路由定義
└── main.js             # 應用程式入口
```

## 🔧 開發指引

### 代碼風格
- 使用 Composition API
- 遵循 Vue 3 最佳實踐
- 組件使用 `<script setup>` 語法
- 響應式資料使用 `ref` 和 `reactive`

### 狀態管理
使用 Pinia 進行狀態管理，每個功能模組有獨立的 store：
```javascript
import { useProductsStore } from '@/stores/products'

const productsStore = useProductsStore()
```

### API 調用
統一使用配置好的 axios 實例：
```javascript
import api from '@/plugins/axios'

const response = await api.get('/products')
```

### 路由權限
使用路由守衛進行權限控制：
```javascript
// 需要登入
meta: { requiresAuth: true }

// 僅管理員
meta: { requiresAuth: true, requiresBoss: true }
```

## 📱 響應式設計

應用程式完全響應式，支援：
- 桌面電腦 (1200px+)
- 平板電腦 (768px - 1199px)
- 手機裝置 (< 768px)

## 🔍 條碼掃描

支援多種條碼格式：
- Code 128
- Code 39
- EAN-13/8
- UPC-A/E
- QR Code

## 🌐 瀏覽器支援

- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

## 📝 開發筆記

### 從 Vue 2 升級重點
- Options API → Composition API
- Vuetify 2 → Vuetify 3 API 更新
- Vuex → Pinia 狀態管理
- Vue Router 3 → Vue Router 4

### 效能優化
- 路由懶載入
- 組件按需載入
- 圖片懶載入
- API 請求防抖

## 🚀 部署

### Nginx 配置範例
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://backend-server:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🤝 貢獻指引

1. Fork 專案
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📄 授權

本專案採用 MIT 授權條款。

## 📞 聯絡資訊

如有問題或建議，請聯絡開發團隊。

---

© 2024 盤點小助手. All rights reserved.
