# 盤點管理異常反饋 — 分析與修正報告

> 日期：2026-04-05
> 來源：業主反饋（5 項問題）
> 狀態：**全部修正完成**

---

## 問題一覽

| # | 問題描述 | 修正狀態 |
|---|---------|---------|
| 1 | 已盤點/未盤點/異常商品 點進去後顯示錯誤 | ✅ 已修正 |
| 2 | 盤點進度是否可以扣除預購商品去計算 | ✅ 已修正（確認：排除 pre-order） |
| 3 | 異常商品定義錯誤 → 異常報告內容也是錯 | ✅ 已修正（確認：統一使用快照基準） |
| 4 | 無法匯出盤點數據，功能目前無效 | ✅ 已修正 |
| 5 | 最近盤點活動的商品無法正確顯示，盤點人員也沒有顯示出來 | ✅ 已修正 |

---

## 問題 1：統計卡片點擊無反應

**原因**：盤點工作台的四張統計卡片（總商品數 / 已盤點 / 未盤點 / 異常商品）僅為純顯示，沒有綁定點擊事件。

**修正內容**：
- 四張卡片加上 `@click`，點擊後開啟商品快照 Dialog
- 自動帶入對應的狀態篩選：總商品數→全部、已盤點→counted、未盤點→uncounted、異常→error
- 篩選按鈕列新增「已盤」選項
- 後端 snapshot API 支援 `status=counted`（等同 normal + error）

**修改檔案**：
- `frontend_v4/src/pages/Inventory/Index.vue` — 卡片 @click + viewCurrentTaskSnapshot 方法 + CSS
- `backend/routes/inventoryTask.js` — snapshot 路由支援 `counted` 篩選

---

## 問題 2：盤點進度未扣除預購商品

**原因**：建立盤點任務時，快照抓取所有 `type=variation` 的商品，包含 `貨況=pre-order` 的預購商品。預購商品尚未到貨，不應納入盤點。

**業主確認**：選擇方案 A — 完全排除預購商品。

**修正內容**：
- 建立任務的商品查詢條件加入排除預購：
  ```
  $nor: [{ attributes: { $elemMatch: { name: '貨況', option: 'pre-order' } } }]
  ```
- 新建盤點任務時，快照自動排除所有預購商品
- 總商品數、完成率都不含預購

**修改檔案**：
- `backend/routes/inventoryTask.js` — POST / 建立任務的 productFilter

---

## 問題 3：異常商品定義不一致

**原因**：系統存在兩套異常定義：
- 盤點任務內（新）：`盤點數量 ≠ 快照庫存（snapshotStockQty）`
- Dashboard/商品列表（舊）：`盤點數量 ≠ 即時庫存（stockQty）`

即時庫存會隨 POS 銷售變動，導致 Dashboard 顯示的異常數字與盤點報告不一致。

**業主確認**：選擇方案 A — 統一使用快照基準。Dashboard 改為顯示最近一次盤點任務的結果。

**修正內容**：
- Dashboard「已盤點」卡片 → 改為顯示最近盤點任務的 countedProducts / totalProducts
- Dashboard「異常商品」卡片 → 改為顯示最近盤點任務的 errorProducts，標示盤點日期
- Dashboard「盤點異常 Top 5」→ 改為從最近任務快照取 error 狀態商品，顯示「當下庫存 vs 盤點數量」
- 異常商品卡片點擊導向 `/inventory`（盤點管理）而非 `/products?error=true`

**修改檔案**：
- `frontend_v4/src/pages/Dashboard.vue` — 統計卡片 + 異常 Top 5 數據源改為 inventory-tasks API

---

## 問題 4：匯出盤點數據功能失效

**原因**：盤點記錄頁的匯出按鈕呼叫 `GET /api/inventory/logs/export`，但後端**不存在此路由**，返回 404。

**修正內容**：
- 新增 `GET /api/inventory/logs/export` 路由
- 支援篩選參數：startDate、endDate、hasError、method、search
- 回傳 UTF-8 BOM CSV 格式（相容 Excel 繁體中文）
- 欄位：商品名稱、SKU、盤點人員、盤點方式、當下庫存、盤點數量、差異、狀態、盤點時間
- variation 商品使用父商品名稱，規格標註在括號中

**修改檔案**：
- `backend/routes/inventory.js` — 新增 /logs/export 路由

---

## 問題 5：Dashboard 最近盤點記錄顯示異常

**原因**：
1. 商品名稱：variation 顯示為 `available, TSA016` 而非父商品名稱
2. 商品圖片：fallback 到不存在的 `/placeholder.png`，顯示破圖
3. 規格標示：顯示 `貨況: available` 等無意義資訊
4. 後端 populate 未取得父商品圖片

**修正內容**：
- 商品圖片改用 `v-img` + `v-icon` placeholder，依序嘗試：本身圖片 → 父商品圖片 → 灰色圖示
- 規格標示過濾掉「貨況」屬性，只顯示尺寸、顏色等有意義規格
- 後端 logs API 的 parentId populate 加入 `wooData.images`

**業主確認**：Q3 選擇方案 A — Dashboard 顯示最近一次盤點任務的結果（已在問題 3 修正中一併處理）。

**修改檔案**：
- `frontend_v4/src/pages/Dashboard.vue` — 商品顯示邏輯 + 圖片處理
- `backend/routes/inventory.js` — logs populate 加入 parent images
