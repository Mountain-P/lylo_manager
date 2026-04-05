# WooCommerce 同步問題診斷指南

## 問題分析

從您提供的資訊來看，WooCommerce API 連接是正常的，但同步仍然失敗。可能的原因：

## 解決步驟

### 1. 檢查環境變數格式

執行以下命令檢查 `.env` 文件：
```bash
cd backend
cat .env | grep WOO
```

確保格式正確（無前導空格）：
```
WOO_URL=https://lylolylo.com/
WOO_CONSUMER_KEY=ck_8b9a89cfcc985ad85a3686a58ceb63cec0cd6f1c
WOO_CONSUMER_SECRET=cs_8752e5b37e5f3867361dde5bab0640bee88c379d
```

### 2. 重新啟動後端服務

```bash
cd backend
# 停止現有服務
pkill -f nodemon
pkill -f "node server.js"

# 重新啟動
npm run dev
```

### 3. 測試 API 連接

在另一個終端窗口測試：
```bash
curl "https://lylolylo.com/wp-json/wc/v3/products?per_page=1" \
  -u "ck_8b9a89cfcc985ad85a3686a58ceb63cec0cd6f1c:cs_8752e5b37e5f3867361dde5bab0640bee88c379d"
```

### 4. 檢查後端日誌

當您在前端點擊「手動同步」時，觀察後端控制台的輸出，看看具體錯誤訊息。

### 5. 常見問題

**A. URL 格式問題**
- 確保 `WOO_URL` 以 `/` 結尾
- 確保使用 `https://`

**B. API 權限問題**
- 在 WooCommerce 後台檢查 API 金鑰權限是否為「讀取」
- 確認 API 金鑰仍然有效

**C. 網站訪問問題**
- 確保 `lylolylo.com` 可以正常訪問
- 檢查是否有防火牆或 CDN 阻擋

### 6. 手動測試同步

創建並運行測試文件：
```bash
cd backend
node -e "
require('dotenv').config();
console.log('WOO_URL:', process.env.WOO_URL);
console.log('API Key 已設定:', !!process.env.WOO_CONSUMER_KEY);
console.log('API Secret 已設定:', !!process.env.WOO_CONSUMER_SECRET);
"
```

## 下一步

1. 請先確認後端服務正常重啟
2. 登入前端管理介面
3. 再次嘗試手動同步
4. 如果仍有問題，請提供後端控制台的錯誤訊息

## 聯繫支援

如果問題持續，請提供：
- 後端控制台的完整錯誤訊息
- 瀏覽器開發者工具的網路請求錯誤
- `.env` 文件內容（隱藏敏感資訊） 