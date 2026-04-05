# WooCommerce API 設定指南

## 問題說明

您遇到的「手動同步失敗」錯誤是因為 WooCommerce API 尚未正確配置。

## 解決方案

### 1. 在 WooCommerce 中創建 API 金鑰

1. 登入您的 WordPress/WooCommerce 管理後台
2. 前往 **WooCommerce > 設定 > 進階 > REST API**
3. 點擊「**新增金鑰**」
4. 填寫以下資訊：
   - **描述**: 盤點小助手
   - **使用者**: 選擇管理員用戶
   - **權限**: **讀取**（因為我們只需要讀取商品資料）
5. 點擊「**產生 API 金鑰**」
6. **重要**: 複製並保存 Consumer Key 和 Consumer Secret

### 2. 設定環境變數

在 `backend/.env` 文件中設定以下變數：

```env
# WooCommerce API 設定
WOO_URL=https://your-store.com
WOO_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WOO_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**請替換為您的實際資訊：**
- `WOO_URL`: 您的 WooCommerce 網站網址（包含 https://）
- `WOO_CONSUMER_KEY`: 剛才創建的 Consumer Key
- `WOO_CONSUMER_SECRET`: 剛才創建的 Consumer Secret

### 3. 重新啟動後端服務

設定完成後，重新啟動後端服務：

```bash
cd backend
npm run dev
```

## 測試同步功能

1. 登入盤點小助手管理介面
2. 以管理員身份登入
3. 前往同步管理頁面
4. 點擊「手動同步」按鈕

## 注意事項

- 確保您的 WooCommerce 網站可以從外部訪問
- 如果使用 HTTPS，確保 SSL 憑證有效
- API 金鑰權限設為「讀取」就足夠了
- 每10分鐘會自動同步一次

## 如果仍有問題

1. 檢查 WooCommerce 網站是否正常運作
2. 確認 API 金鑰是否正確複製
3. 檢查防火牆設定是否阻擋了 API 請求
4. 查看後端服務的控制台輸出以獲得更多錯誤資訊 