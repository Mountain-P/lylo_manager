# 盤點系統優化修改建議 - 技術分析與實作紀錄

> 分析日期：2026-03-27
> 對應需求來源：業主 Hsuan 提供之修改建議
> 範圍：盤點系統優化 + 預購商品訂單功能擴充

---

## 修改項目總覽與狀態

| # | 修改項目 | 狀態 | 備註 |
|---|---------|------|------|
| 1 | 盤點第一步：輸入盤點日期+盤點人員（任務制） | ✅ 已實作 | 新增 InventoryTask 模型 |
| 2 | 新增「隱藏草稿商品」+「隱藏預購商品」篩選 | ✅ 已實作 | 預設開啟 |
| 3 | 多型號商品盤點隱藏貨號，只顯示變化類型 | ✅ 已實作 | SKU 完全移除 |
| 4 | 商品分類篩選改為多選 | ✅ 已實作 | |
| 5 | 新增多種排序方式 | ✅ 已實作 | 含 WooCommerce 上架時間 |
| 6 | 搜尋商品部分字元即可搜尋到 | ✅ 已修復 | Bug fix |
| 7 | 三級狀態判定 + 差異公式調整 | ✅ 已實作 | 差異 = 盤點 - 庫存 |
| 8 | 待處理訂單統計頁（現貨+預購+排除商品） | ✅ 已實作 | 新頁面 |

---

## 業主確認內容與實作細節

### 項目 1：盤點任務制度

**業主確認**：
- 盤點日期自動帶入實際操作日期
- 盤點人員可多選（方案 C）
- 採用「盤點任務」概念
- 點擊「開始盤點」時彈出輸入 Dialog

**實作內容**：
- 新增 `backend/models/InventoryTask.js`（任務模型：date, personnel[], status, createdBy）
- 新增 `backend/routes/inventoryTask.js`（CRUD API）
- 新增 `frontend_v4/src/stores/inventoryTask.js`（前端 Store）
- 修改 `Inventory/Index.vue`：新增開始盤點 Dialog、進行中任務顯示、完成盤點按鈕
- 修改 `InventoryLog` 模型新增 `taskId` 欄位
- 修改盤點 API（`/count/:productId` 與 `/count/batch`）接受可選 `taskId`
- 新增 `GET /api/users/active-list` 端點供人員選擇用（employee 可用）
- `server.js` 新增 `inventory-tasks` 路由掛載

---

### 項目 2：隱藏草稿 + 隱藏預購商品

**業主確認**：
- 草稿：只保留 `publish`，隱藏 `draft` 和 `private`
- 預購：方案 A（母商品仍顯示，但展開/盤點時不列出 pre-order 變體，庫存只計算現貨）
- 統計數字也排除預購商品

**實作內容**：
- 後端 `products.js` 新增 `hideDraft` 和 `hidePreOrder` 查詢參數
- `hideDraft=true` 時加入 `wooData.status: 'publish'` 篩選
- `hidePreOrder=true` 時：
  - 可變商品的 variations 過濾掉 `attributes` 含 `{ name: '貨況', option: 'pre-order' }` 的變體
  - 庫存加總只計算非 pre-order 的變體
  - 全部變體都是 pre-order 的母商品從列表移除
- 前端新增兩個 v-switch（預設開啟），同步到 URL

---

### 項目 3：隱藏 SKU

**業主確認**：展開表格也隱藏，完全移除 SKU

**實作內容**：
- `Products/Index.vue` 展開行的變體表格：移除 SKU 欄位
- 多型號盤點 Dialog：移除 `variation-sku`，將屬性組合作為主要標識
- 屬性組合使用原本 SKU 的粗體樣式

---

### 項目 4：分類多選

**業主確認**：維持目前 UI，但分類下拉改多選

**實作內容**：
- 前端 `v-select` 加入 `multiple`、`chips`、`closable-chips`
- `selectedCategory` 改為陣列
- `buildFilters` 用逗號拼接多個分類
- 後端支援逗號分隔的 `category` 參數，使用 `$in` 查詢

---

### 項目 5：新增排序

**業主確認**：補上建議的三種排序 + WooCommerce 上架時間

**實作內容**：
新增排序選項：
| 排序 | 後端參數 | 說明 |
|------|---------|------|
| 上架時間（新→舊）| `wooCreatedAt_desc` | 使用 `wooData.dateCreated`（WooCommerce） |
| 上架時間（舊→新）| `wooCreatedAt_asc` | |
| 差異數量（大→小）| `absDiffQty_desc` | 差異絕對值最大的排前面 |
| 未盤點優先 | `uncountedFirst` | `lastCountedAt` 升序排列 |
| 商品價格（高→低）| `price_desc` | 依 `wooData.price` 排序 |

- `Product` 模型新增 `wooData.dateCreated` 欄位
- `wooSync.js` 同步時存入 `wooProduct.date_created`
- 後端聚合新增 `absDiffQty` 計算欄位

---

### 項目 6：搜尋 Bug 修復

**問題根因**：`stores/products.js` 第 122-127 行將純數字搜尋轉為條碼精確搜尋

**修復內容**：移除 `/^\d+$/.test()` 判定邏輯，統一走文字模糊搜尋

---

### 項目 7：三級狀態 + 差異公式

**業主確認**：
- 三級狀態：未盤點 / 正常 / 異常
- expectedQty = WooCommerce 同步的系統庫存量（stockQty）
- 差異公式 = `countedQty - stockQty`

**實作內容**：
- `Product.js` 虛擬欄位更新：
  - `countStatus`：`uncounted`（無 lastCountedAt）/ `normal`（diff=0）/ `error`（diff≠0）
  - `isCountError`：`lastCountedAt` 存在 且 `countedQty !== stockQty`
  - `diffQty`：`countedQty - stockQty`（未盤點時為 0）
- `products.js` 路由聚合公式全面更新
- 前端展開表格狀態顯示三級（未盤點灰、正常綠、有差異紅）
- `InventoryLog` 的 `expectedQty` 改存 `product.stockQty`
- `InventoryLog.pre('save')` 差異公式改為 `countedQty - expectedQty`

---

### 項目 8：待處理訂單統計（現貨+預購）

**業主確認**：
- 現貨 = 所有非 pre-order 的商品（方案 B）
- 訂單狀態可選（processing / processing + on-hold）
- UI 方案 C：獨立頁面，Tab 切換現貨/預購
- 新增「排除包含指定商品的訂單」功能
- 側邊欄新增「待處理訂單統計」

**實作內容**：
- 後端新增 `GET /api/orders/stats/in-stock`
  - 查詢條件：`type: 'variation'` 且 attributes 不含 `{ name: '貨況', option: 'pre-order' }` + `type: 'simple'`
  - 支援 `excludeProductIds` 參數：排除包含指定商品的訂單
- 新增 `frontend_v4/src/pages/Orders/PendingOrderStats.vue`
  - Tab 切換：現貨 / 預購
  - 統計摘要卡片
  - 篩選器：日期、訂單狀態、排除商品
  - 排除商品用 autocomplete 多選
  - 表格：商品名稱、屬性、訂單數量、現有庫存、訂單筆數、查看訂單
- 路由新增 `/orders/pending-stats`
- 側邊欄新增「待處理訂單統計」連結

---

## 修改檔案清單

### 新增檔案
| 檔案 | 說明 |
|------|------|
| `backend/models/InventoryTask.js` | 盤點任務模型 |
| `backend/routes/inventoryTask.js` | 盤點任務 API |
| `frontend_v4/src/stores/inventoryTask.js` | 盤點任務前端 Store |
| `frontend_v4/src/pages/Orders/PendingOrderStats.vue` | 待處理訂單統計頁 |

### 修改檔案
| 檔案 | 修改內容 |
|------|---------|
| `backend/models/Product.js` | 新增 wooData.dateCreated、更新虛擬欄位公式 |
| `backend/models/InventoryLog.js` | 新增 taskId 欄位、更新差異公式 |
| `backend/routes/products.js` | 多分類、新排序、隱藏草稿/預購、新差異公式 |
| `backend/routes/inventory.js` | 盤點支援 taskId、expectedQty 改用 stockQty |
| `backend/routes/orders.js` | 新增 in-stock 統計端點 |
| `backend/routes/users.js` | 新增 active-list 端點 |
| `backend/server.js` | 掛載 inventory-tasks 路由 |
| `backend/cron/wooSync.js` | 同步時存入 wooData.dateCreated |
| `frontend_v4/src/pages/Products/Index.vue` | 隱藏SKU、多分類、新排序、隱藏草稿/預購、三級狀態 |
| `frontend_v4/src/pages/Inventory/Index.vue` | 開始盤點 Dialog、任務管理 |
| `frontend_v4/src/stores/products.js` | 修復搜尋 Bug |
| `frontend_v4/src/router/index.js` | 新增 pending-stats 路由 |
| `frontend_v4/src/layouts/MainLayout.vue` | 側邊欄新增待處理訂單統計 |

---

## 注意事項

1. **WooCommerce 上架時間**：`wooData.dateCreated` 需要下次同步後才會有值。已存在的商品在同步前使用 `createdAt` 作為 fallback。

2. **盤點任務 taskId 為可選**：現有盤點流程不受影響，taskId 只在透過任務流程盤點時自動帶入。

3. **差異公式變更影響**：所有已存在的盤點紀錄（InventoryLog）中的 `diffQty` 是依舊公式計算的。新公式只影響之後新建的紀錄。如需更新歷史紀錄，需執行資料遷移腳本。

4. **排除商品訂單功能**：`excludeProductIds` 使用的是系統內部的 MongoDB `_id`，前端透過商品列表 autocomplete 選取。
