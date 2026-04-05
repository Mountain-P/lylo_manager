# 盤點任務架構重新設計 - 業主回饋與修改分析

> 回饋日期：2026-04-05
> 回饋來源：頁主 Hsuan
> 範圍：盤點管理系統架構調整 — 以「盤點日期」為核心的任務制度

---

## 一、業主回饋原文

> 進入盤點管理或是開始盤點的時候，需要先選擇當下的盤點日期及盤點人員，才能開啟一份當下的盤點記錄及進行盤點動作。
>
> 其中，每次的系統庫存數量要鎖定在開啟一份新的盤點時當下的系統庫存數量，否則系統庫存數量會隨著POS系統售出而減少，導致盤點狀態從正常變成異常，或是異常變為正常。
>
> 也因為每次的盤點紀錄比對的當下庫存數量不同，所以所有的盤點報告及工作都要依照日期選擇是否開啟新的盤點任務，包括盤點進度、盤點結果…，全部都建立在「盤點日期上」，也就是每開啟一份新的盤點工作等同於開啟新的盤點任務。若當下未盤點完，重新盤點的時候可以選擇指定進入哪一份盤點任務 或是開啟一份新的盤點任務 並重新獲取當下的系統庫存數量

---

## 二、回饋核心要點拆解

| # | 要點 | 說明 |
|---|------|------|
| 1 | **盤點任務＝日期驅動** | 每開一份新的盤點工作就等於開一個新的盤點任務，以日期作為唯一識別依據 |
| 2 | **系統庫存快照鎖定** | 開啟新盤點時，必須將當下的 `stockQty` 鎖定（snapshot），後續 POS/WooCommerce 同步不影響該任務的比對基準 |
| 3 | **盤點進度/結果綁定任務** | 盤點進度、盤點結果、異常報告等全部歸屬到特定的盤點任務（日期） |
| 4 | **繼續盤點 vs 開新任務** | 未盤點完時，可選擇「進入某一份既有任務繼續盤」或「開新任務並重新快照庫存」 |

---

## 三、現狀系統問題分析

### 3.1 目前的 InventoryTask 模型缺乏庫存快照

現有 `InventoryTask` schema：

```
{
  date: Date,
  personnel: [ObjectId],
  status: 'in_progress' | 'completed',
  createdBy: ObjectId,
  completedAt: Date,
  note: String
}
```

**問題**：
- 沒有庫存快照機制，無法鎖定「開始盤點時的系統庫存」
- `InventoryLog.expectedQty` 在每次盤點時才從 `product.stockQty` 讀取，如果同一任務中 WooCommerce 同步了，前後盤點的 `expectedQty` 不一致
- 盤點進度和結果沒有真正綁定到 task，Dashboard 的統計是全域的而非任務維度

### 3.2 盤點比對基準會隨時間漂移

目前的流程：
1. 員工開始盤點 → 讀取 `product.stockQty`（當下值）寫入 `InventoryLog.expectedQty`
2. POS 賣出商品 → WooCommerce 同步 → `product.stockQty` 減少
3. 員工繼續盤點另一個商品 → 這時讀到的 `stockQty` 已經變了
4. 更嚴重的是：`Product.diffQty` 虛擬欄位永遠用「最新 stockQty」計算，所以商品列表顯示的狀態會在盤點期間動態變化

**結果**：原本盤點正常的商品，可能因為 WooCommerce 同步更新了 `stockQty` 而突然變成異常（或反之）。

### 3.3 無法區分不同批次的盤點結果

- `Product.countedQty` 只存最後一次值，無法知道是哪次盤點的結果
- 盤點進度（已盤/未盤/異常）是全域的，不是任務維度的
- 無法回顧「2026-04-01 那次盤點」的完整結果，只能從 InventoryLog 逐筆追溯

---

## 四、修改思路

### 4.1 架構核心改動：引入「庫存快照」機制

#### InventoryTask 模型擴充

```javascript
const inventoryTaskSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  personnel: [{ type: ObjectId, ref: 'User' }],
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'cancelled'],
    default: 'in_progress'
  },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  completedAt: Date,
  note: String,

  // === 新增欄位 ===
  stockSnapshot: [{
    productId: { type: ObjectId, ref: 'Product', required: true },
    snapshotStockQty: { type: Number, required: true },   // 開始盤點時鎖定的系統庫存
    countedQty: { type: Number, default: null },           // 該任務中的盤點數量（null = 未盤點）
    countedAt: Date,                                        // 盤點時間
    countedBy: { type: ObjectId, ref: 'User' },            // 盤點人員
    diffQty: { type: Number, default: null },              // 差異 = countedQty - snapshotStockQty
    status: {
      type: String,
      enum: ['uncounted', 'normal', 'error'],
      default: 'uncounted'
    }
  }],

  // 任務層級統計（快取，避免每次重算）
  summary: {
    totalProducts: { type: Number, default: 0 },
    countedProducts: { type: Number, default: 0 },
    errorProducts: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  }
}, { timestamps: true });
```

**關鍵設計**：
- `stockSnapshot` 在建立任務時一次性寫入所有需盤點的商品及其當下 `stockQty`
- 後續盤點對比一律使用 `snapshotStockQty`，不再受 WooCommerce 同步影響
- 每個商品的盤點狀態獨立存在任務中，不再依賴 `Product` 模型的全域欄位

#### 建立任務時的快照流程

```
POST /api/inventory-tasks
1. 讀取所有 active 的 variation / simple 商品
2. 對每個商品記錄 { productId, snapshotStockQty: product.stockQty }
3. 儲存為 task.stockSnapshot
4. 返回含快照的任務資料
```

#### 盤點時的流程變更

```
POST /api/inventory/count/:productId
- 必須帶 taskId
- 盤點結果更新到 task.stockSnapshot 中對應商品的 countedQty
- diffQty = countedQty - snapshotStockQty（使用快照值而非即時值）
- 同時仍寫入 InventoryLog 作為審計紀錄
- Product.countedQty 仍更新（向後相容），但 diffQty 計算改用任務中的快照
```

### 4.2 前端流程改動

#### 進入盤點管理時的選擇器

```
┌──────────────────────────────────────────────┐
│  盤點管理                                      │
│                                                │
│  ┌─────────────────────────────────────────┐  │
│  │ 選擇盤點任務                              │  │
│  │                                           │  │
│  │  ○ 繼續既有任務                            │  │
│  │    ┌──────────────────────────────────┐   │  │
│  │    │ 2026-04-05 盤點任務（進行中 42%） │   │  │
│  │    │ 2026-04-01 盤點任務（已完成 100%）│   │  │
│  │    └──────────────────────────────────┘   │  │
│  │                                           │  │
│  │  ○ 開啟新的盤點任務                        │  │
│  │    日期：[2026-04-05]                      │  │
│  │    人員：[多選下拉]                         │  │
│  │    ⚠️ 將重新擷取當下系統庫存作為比對基準    │  │
│  │                                           │  │
│  │           [取消]  [確認開始]                │  │
│  └─────────────────────────────────────────┘  │
│                                                │
│  ※ 盤點進度、結果僅顯示選定任務的資料            │
└──────────────────────────────────────────────┘
```

#### 盤點管理首頁統計改為任務維度

- 所有統計數字（已盤/未盤/異常/進度條）改為顯示「當前選定任務」的數據
- 從 `task.stockSnapshot` 計算，而非全域的 `Product` 集合
- 頂部顯示「當前任務：2026-04-05 盤點」的提示

#### 盤點結果與報告綁定任務

- 匯出 CSV 時以任務為單位
- 異常報告以任務為單位
- 盤點記錄頁新增任務篩選器

### 4.3 資料庫遷移考量

| 項目 | 說明 |
|------|------|
| 既有 InventoryTask | 無 stockSnapshot，可標記為 legacy 或刪除（資料量應很小） |
| 既有 InventoryLog | 不受影響，保留 `expectedQty` 欄位但明確它是「盤點當下的 stockQty」而非快照 |
| Product.countedQty | 仍保留並更新（向後相容），但前端以任務維度的資料為主 |
| Product.diffQty 虛擬欄位 | 保留但標註為「最新盤點 vs 最新庫存」的即時對比，與任務維度的快照對比區分 |

---

## 五、潛在問題與需確認事項

### 5.1 快照資料量

如果有 2000 個商品，每建立一個任務就要存 2000 筆 snapshot 記錄。

**影響**：
- 單一 MongoDB document 16MB 限制。2000 筆 snapshot（每筆約 200 bytes）≈ 400KB，遠低於限制
- 但如果商品數未來成長到 10,000+，建議將 snapshot 拆成獨立 collection（`TaskStockSnapshot`）

**建議**：目前商品數量下，嵌入式 snapshot 可行。先以嵌入式做，未來需要時再拆分。

### 5.2 同一天能否開多個任務？

業主說「由日期來判斷是不是新的盤點任務」，但同一天可能需要：
- 早上盤一次、下午 WooCommerce 同步後再盤一次
- 不同區域/品類分開盤點

**建議**：同一天允許多個任務，以 `date + 建立時間` 作為識別，而非僅 date 唯一。UI 上顯示為「2026-04-05 #1」、「2026-04-05 #2」。

### 5.3 盤點期間 WooCommerce 同步怎麼處理？

快照鎖定後，WooCommerce 同步更新的 `stockQty` 不會影響任務中的比對。但如果盤點持續多天：
- 快照是 D1 的庫存
- D2 又賣了很多，實際庫存已經和 D1 差很多
- 員工 D2 去數倉庫，數到的是 D2 的實際量，但比對基準是 D1 的 stockQty

**建議**：
- 任務建立後，在任務詳情顯示「⚠️ 庫存快照時間：2026-04-05 09:30，距今已過 X 小時」
- 超過 24 小時未完成的任務，提示建議建立新任務
- 提供「刷新快照」功能（主管權限），可在任務中重新擷取最新庫存

### 5.4 taskId 是否改為必填？

目前盤點 API 的 `taskId` 是選填。如果改為任務制度，所有盤點都應歸屬到任務。

**建議**：
- 改為必填，前端必須先選擇/建立任務才能開始盤點
- 取消「無任務的散裝盤點」模式
- 掃碼頁和商品列表頁都需要知道當前任務 context

### 5.5 快照範圍：全部商品 or 可選範圍？

目前每次盤點不一定盤所有商品。快照是存全部商品還是可選範圍？

**建議**：
- 預設快照全部 active 商品（排除草稿/預購）
- 未來可擴充為選擇特定品類快照，但初期簡化為全部

---

## 六、修改影響範圍

### 後端

| 檔案 | 修改內容 |
|------|---------|
| `models/InventoryTask.js` | 擴充 schema：新增 `stockSnapshot[]`、`summary` |
| `routes/inventoryTask.js` | 建立任務時產生庫存快照；新增任務維度統計 API |
| `routes/inventory.js` | 盤點時 `taskId` 改為必填；diffQty 改用任務快照值計算 |
| `models/InventoryLog.js` | `taskId` 改為必填；新增 `snapshotStockQty` 欄位 |
| `models/Product.js` | 虛擬欄位保留但加註說明；可考慮新增 `latestTaskId` 追蹤 |

### 前端

| 檔案 | 修改內容 |
|------|---------|
| `pages/Inventory/Index.vue` | 盤點首頁改為任務選擇器；統計改為任務維度 |
| `pages/Inventory/Scan.vue` | 掃碼頁需帶任務 context；比對改用快照值 |
| `pages/Products/Index.vue` | 商品列表盤點功能需帶任務 context |
| `stores/inventoryTask.js` | 擴充：快照管理、任務維度統計 |
| `stores/inventory.js` | 盤點 API 呼叫必帶 taskId |

---

## 七、實作優先順序建議

| 順序 | 項目 | 估計工時 |
|------|------|---------|
| 1 | InventoryTask schema 擴充 + 建立任務時生成快照 | 2-3 hr |
| 2 | 盤點 API 改用快照值比對 + taskId 必填 | 2-3 hr |
| 3 | 前端任務選擇器 UI（進入盤點前必選任務） | 3-4 hr |
| 4 | 盤點首頁統計改為任務維度 | 2 hr |
| 5 | 掃碼頁 + 商品列表頁帶任務 context | 2-3 hr |
| 6 | 盤點報告/匯出改為任務維度 | 1-2 hr |
| 7 | 測試 + 既有資料處理 | 2 hr |
| **合計** | | **~15-18 hr** |
