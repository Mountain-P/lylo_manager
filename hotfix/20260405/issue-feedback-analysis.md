# 盤點管理異常反饋分析報告

> 日期：2026-04-05
> 來源：業主反饋（5 項問題）

---

## 問題一覽

| # | 問題描述 | 可否直接修正 | 狀態 |
|---|---------|------------|------|
| 1 | 已盤點/未盤點/異常商品 點進去後顯示錯誤 | ✅ 可修正 | 待修 |
| 2 | 盤點進度是否可以扣除預購商品去計算 | ⚠️ 需確認規則 | 待確認 |
| 3 | 異常商品定義錯誤 → 異常報告內容也是錯 | ⚠️ 需確認定義 | 待確認 |
| 4 | 無法匯出盤點數據，功能目前無效 | ✅ 可修正 | 待修 |
| 5 | 最近盤點活動的商品無法正確顯示，盤點人員也沒有顯示出來 | ✅ 可修正 | 待修 |

---

## 問題 1：已盤點/未盤點/異常商品 點進去後顯示錯誤

### 分析
盤點管理頁 (`Inventory/Index.vue`) 在**進入某個任務後**，頁面上顯示四張統計卡片：
- 總商品數 / 已盤點 / 未盤點 / 異常商品

這四張卡片目前**僅為純顯示用途**，沒有綁定 `@click` 事件。點擊卡片不會導向任何頁面或開啟篩選。

**但業主期望的行為是**：點擊「已盤點」→ 只看已盤點的商品；點擊「異常商品」→ 只看異常的商品。

### 修正方案
在盤點工作台（有 active task 時）的四張統計卡片加上點擊行為：
- 點擊後開啟該任務的商品快照 Dialog（與歷史任務詳情相同的 Dialog）
- 自動帶入對應的 `statusFilter`：
  - 已盤點 → `statusFilter = 'normal'` + `'error'`（合併顯示所有已盤點的）
  - 未盤點 → `statusFilter = 'uncounted'`
  - 異常商品 → `statusFilter = 'error'`
  - 總商品數 → `statusFilter = ''`（全部）

### 工作量
前端修改 `Inventory/Index.vue`，約 30 分鐘。

---

## 問題 2：盤點進度是否可以扣除預購商品去計算

### 分析
目前建立盤點任務時，系統快照的商品範圍是：

```javascript
// backend/routes/inventoryTask.js → POST /
const productFilter = {
  isActive: true,
  type: { $in: ['simple', 'variation'] }
};
```

這會抓到**所有** variation，包含 `貨況 = pre-order`（預購）的商品。預購商品通常不需要盤點（因為尚未到貨），但目前被納入快照並計算進度百分比。

系統中**預購商品的識別方式**為：
```
product.attributes 中存在 { name: '貨況', option: 'pre-order' }
```

### 修正方案（需確認）

**方案 A — 建立任務時自動排除預購商品**
在建立快照時過濾掉 `pre-order` 的 variation：
```javascript
const products = await Product.find(productFilter).lean();
const filtered = products.filter(p => {
  const isPreOrder = p.attributes?.some(
    a => a.name === '貨況' && a.option === 'pre-order'
  );
  return !isPreOrder;
});
```
→ 盤點進度自動排除預購，總商品數也不包含預購。

**方案 B — 快照含預購但進度計算時排除**
快照仍包含所有商品，但 `summary.totalProducts` 和 `completionRate` 計算時排除 pre-order。
→ 預購商品仍會出現在清單中但不計入進度。

**方案 C — 建立任務時可選「排除預購」**
在建立任務的 Dialog 中加一個開關：「排除預購商品」（預設開啟）。

### ❓ 需要業主確認
1. 預購商品是否應該完全從盤點任務中排除？
2. 還是只從進度計算中排除，但仍可在清單中看到？
3. 是否需要手動選擇排除與否？

---

## 問題 3：異常商品定義錯誤 → 異常報告內容也是錯

### 分析
系統目前有**兩套「異常」定義**，容易造成混淆：

#### 盤點任務內（新系統）
```
異常 = 盤點數量 ≠ 快照庫存（snapshotStockQty）
即：diffQty = countedQty - snapshotStockQty，diffQty ≠ 0 → error
```
**比對基準**：建立任務時鎖定的系統庫存（快照）。這是正確的設計。

#### 全域商品層（舊系統）
```
異常 = 盤點數量 ≠ 當前系統庫存（stockQty）
即：diffQty = countedQty - stockQty，diffQty ≠ 0 → error
```
**比對基準**：Product 模型上的即時 `stockQty`。此數值會隨 POS 銷售即時變動。

#### 問題所在
- Dashboard 上的「異常商品」→ 使用 `/products/errors` API，走的是**舊定義**（countedQty vs 即時 stockQty）
- 盤點管理裡的「異常商品」→ 使用**新定義**（countedQty vs snapshotStockQty）
- 兩邊數字不一致，業主會覺得是「錯的」
- 「異常報告」CSV 匯出走的是 task snapshot，數據本身是對的，但如果業主是從 Dashboard 看到異常數字再去盤點報告比對，會發現數字對不上

### ❓ 需要業主確認
1. **異常的正確定義是什麼？**
   - A. 盤點數量 ≠ 盤點當下的系統庫存（快照值）→ 目前任務內的定義，推薦
   - B. 盤點數量 ≠ 現在的系統庫存（即時值）→ 目前 Dashboard/商品列表的定義
2. 確認後會統一所有頁面的異常定義
3. 如果選 A，Dashboard 上的「異常商品」應該改為顯示最近一次盤點任務的異常數量

---

## 問題 4：無法匯出盤點數據，功能目前無效

### 分析
有兩個匯出功能受影響：

#### 4-A. 盤點記錄頁 (`Inventory/Logs.vue`) 的「匯出記錄」
前端呼叫：
```javascript
api.get('/inventory/logs/export', { params, responseType: 'blob' })
```
但後端 `backend/routes/inventory.js` 中**不存在 `/logs/export` 路由**。
只有 `/logs`、`/logs/stats`、`/logs/daily`、`/logs/errors`，沒有 `/logs/export`。
→ **API 404，匯出失敗**。

#### 4-B. 盤點管理頁的「匯出數據」按鈕
```javascript
const exportData = async () => {
  if (!taskStore.hasCurrentTask) return  // ← 必須在任務工作台才能用
  ...
}
```
此按鈕只在「進入任務後」的工作台才能使用。如果業主沒有進入某個任務就想匯出，按鈕不會觸發。

### 修正方案

**4-A 修正**：在 `backend/routes/inventory.js` 新增 `GET /logs/export` 路由。
- 接收與 `/logs` 相同的篩選參數
- 查詢結果用 CSV 格式 streaming 回傳
- Content-Type: `text/csv`，Content-Disposition: `attachment`

**4-B 修正**：在歷史任務詳情 Dialog 中已有「匯出 CSV」按鈕（上次部署已加），功能正常。需確認業主是否指的是這個匯出還是記錄頁的匯出。

### 工作量
後端新增 export 路由：約 1 小時。

---

## 問題 5：最近盤點活動的商品無法正確顯示，盤點人員也沒有顯示出來

### 分析
Dashboard 頁 (`Dashboard.vue`) 的「最近盤點記錄」區塊：

```javascript
await inventoryStore.fetchLogs({ limit: 5 })
recentLogs.value = inventoryStore.logs
```

呼叫 `GET /api/inventory/logs?limit=5`，後端會 populate：
```javascript
.populate({
  path: 'productId',
  select: 'name sku barcode type parentId attributes wooData',
  populate: { path: 'parentId', select: 'name sku type' }
})
.populate('userId', 'name email')
```

#### 商品名稱顯示問題
Dashboard 使用 `getProductDisplayName(item.productId)` 來取得顯示名稱。
此函數對 variation 商品會取 `parentId.name`（父商品名）。
但 populate 只選了 `parentId: 'name sku type'`，如果 parentId 沒有被正確 populate（例如父商品已刪除），會顯示不正確。

同時 Dashboard 取圖片用：
```javascript
item.productId?.wooData?.images?.[0]?.src || '/placeholder.png'
```
許多商品沒有圖片，會 fallback 到 `/placeholder.png`，但此檔案可能不存在。

#### 盤點人員不顯示
template 中：
```html
<template #item.userId="{ item }">
  <span class="text-caption">{{ item.userId?.name || '-' }}</span>
</template>
```
如果 `userId` populate 失敗（使用者已刪除或欄位為 null），會顯示 `-`。
但更可能的問題是：**員工角色只能看自己的記錄**（後端限制）：
```javascript
if (req.user.role === 'employee' && !userId) {
  query.userId = req.user._id;
}
```
如果登入的是 employee，Dashboard 只會載入自己的記錄，人員欄永遠是同一個人。

### 修正方案
1. Dashboard 改為使用任務系統的數據：
   - 取最近一個已完成/進行中的盤點任務的 snapshot，而非直接查 InventoryLog
   - 或者 Dashboard fetchLogs 改用 boss 權限不受 userId 限制
2. 商品名稱：使用與盤點報告相同的 `displayName` 邏輯
3. 盤點人員：確保 populate userId 正確執行

### 工作量
前端修改 Dashboard.vue + 可能需要調整後端 logs query 權限：約 1.5 小時。

---

## 修正優先順序建議

| 優先 | 問題 | 原因 |
|------|------|------|
| P0 | #4-A 匯出功能（後端缺 API） | 功能完全壞掉，需新增路由 |
| P0 | #1 統計卡片可點擊 | 基本 UX，業主期望的核心功能 |
| P1 | #5 Dashboard 顯示修正 | 影響第一印象 |
| P1 | #2 預購商品扣除 | 需業主確認後再改，但改動明確 |
| P2 | #3 異常定義統一 | 需業主確認哪個定義才是「正確的」 |

---

## 待業主確認事項

### Q1 — 預購商品處理（問題 #2）
建立盤點任務時，是否自動排除 `貨況=pre-order` 的預購商品？
- A. 完全排除（推薦）：預購商品不出現在盤點任務中
- B. 出現但不計入進度
- C. 可選擇排除與否

### Q2 — 異常商品的正確定義（問題 #3）
- A.「盤點數量 ≠ 盤點當下鎖定的系統庫存（快照值）」→ 這是新任務系統的定義
- B.「盤點數量 ≠ 現在即時的系統庫存」→ 這是舊的全域定義
- 確認後系統會統一所有頁面（盤點管理 + Dashboard + 商品列表）的異常計算邏輯

### Q3 — Dashboard 最近盤點記錄的範圍
- A. 顯示最近一次盤點任務的結果
- B. 顯示所有人的最近盤點 log（目前員工只能看自己的）
