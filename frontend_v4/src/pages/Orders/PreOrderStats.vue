<template>
  <div>
    <!-- 頁面標題 -->
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between mb-4">
          <h1 class="text-h4">預購商品訂單統計</h1>
          <v-btn
            color="primary"
            prepend-icon="mdi-refresh"
            :loading="ordersStore.loading"
            @click="refreshStats"
          >
            重新整理
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- 篩選器 -->
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-text>
            <v-row>
              <v-col cols="12" md="3">
                <v-text-field
                  v-model="filters.startDate"
                  label="開始日期"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  clearable
                  prepend-inner-icon="mdi-calendar-start"
                  hide-details
                ></v-text-field>
              </v-col>

              <v-col cols="12" md="3">
                <v-text-field
                  v-model="filters.endDate"
                  label="結束日期"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  clearable
                  prepend-inner-icon="mdi-calendar-end"
                  hide-details
                ></v-text-field>
              </v-col>

              <v-col cols="12" md="4">
                <v-select
                  v-model="filters.statuses"
                  label="訂單狀態"
                  :items="statusOptions"
                  variant="outlined"
                  density="comfortable"
                  multiple
                  chips
                  closable-chips
                  prepend-inner-icon="mdi-filter"
                  hide-details
                ></v-select>
              </v-col>

        
            </v-row>

            <v-row class="mt-2">
              <v-col cols="12">
                <v-select
                  v-model="filters.excludeCategories"
                  label="排除商品分類"
                  :items="categories"
                  item-title="name"
                  item-value="id"
                  variant="outlined"
                  density="comfortable"
                  multiple
                  chips
                  closable-chips
                  prepend-inner-icon="mdi-folder-remove"
                  hint="選擇要排除的商品分類，這些分類的預購商品將不會出現在統計中"
                  persistent-hint
                  :loading="loadingCategories"
                >
                  <template #chip="{ item, props }">
                    <v-chip v-bind="props" size="small">
                      {{ item.title }}
                    </v-chip>
                  </template>
                </v-select>
              </v-col>
            </v-row>

            <v-row class="mt-2">
              <v-col cols="12">
                <v-text-field
                  v-model="filters.excludeProductNames"
                  label="排除商品名稱（關鍵字）"
                  variant="outlined"
                  density="comfortable"
                  clearable
                  prepend-inner-icon="mdi-text-box-remove"
                  hint="輸入要排除的商品名稱關鍵字，多個關鍵字用逗號分隔（例如：測試,樣品,贈品）"
                  persistent-hint
                  placeholder="例如：測試,樣品,贈品"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-row v-if="hasActiveFilters" class="mt-2">
              <v-col cols="12">
                <div class="d-flex align-center">
                  <span class="text-caption text-grey mr-2">已套用篩選條件：</span>
                  <v-chip
                    v-if="filters.startDate"
                    size="small"
                    closable
                    @click:close="filters.startDate = null; applyFilters()"
                    class="mr-1"
                  >
                    開始: {{ filters.startDate }}
                  </v-chip>
                  <v-chip
                    v-if="filters.endDate"
                    size="small"
                    closable
                    @click:close="filters.endDate = null; applyFilters()"
                    class="mr-1"
                  >
                    結束: {{ filters.endDate }}
                  </v-chip>
                  <v-chip
                    v-if="filters.statuses.length > 0 && filters.statuses.length < 3"
                    size="small"
                    closable
                    @click:close="filters.statuses = []; applyFilters()"
                    class="mr-1"
                  >
                    狀態: {{ filters.statuses.map(s => getStatusLabel(s)).join(', ') }}
                  </v-chip>
                  <v-chip
                    v-if="filters.excludeCategories.length > 0"
                    size="small"
                    closable
                    @click:close="filters.excludeCategories = []; applyFilters()"
                    class="mr-1"
                    color="warning"
                  >
                    排除 {{ filters.excludeCategories.length }} 個分類
                  </v-chip>
                  <v-chip
                    v-if="filters.excludeProductNames"
                    size="small"
                    closable
                    @click:close="filters.excludeProductNames = ''; applyFilters()"
                    class="mr-1"
                    color="error"
                  >
                    排除商品: {{ filters.excludeProductNames }}
                  </v-chip>
                  <v-btn
                    v-if="hasActiveFilters"
                    size="small"
                    variant="text"
                    color="error"
                    @click="clearFilters"
                  >
                    清除所有篩選
                  </v-btn>
                </div>
              </v-col>
              <v-col cols="12" md="2" class="d-flex align-center">
                <v-btn
                  color="primary"
                  block
                  prepend-icon="mdi-magnify"
                  @click="applyFilters"
                  :loading="ordersStore.loading"
                >
                  查詢
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 統計摘要卡片 -->
    <v-row v-if="ordersStore.hasPreOrderStats">
      <!-- <v-col cols="12" sm="6" md="3">
        <v-card color="primary" dark>
          <v-card-text>
            <div class="text-subtitle-1">預購商品總數</div>
            <div class="text-h4">{{ ordersStore.summary.totalPreOrderProducts }}</div>
          </v-card-text>
        </v-card>
      </v-col> -->

      <v-col cols="12" sm="6" md="3">
        <v-card color="info" dark>
          <v-card-text>
            <div class="text-subtitle-1">有訂單的商品</div>
            <div class="text-h4">{{ ordersStore.summary.productsWithOrders }}</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card color="success" dark>
          <v-card-text>
            <div class="text-subtitle-1">待處理訂單數</div>
            <div class="text-h4">{{ ordersStore.summary.totalOrders }}</div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- <v-col cols="12" sm="6" md="3">
        <v-card color="warning" dark>
          <v-card-text>
            <div class="text-subtitle-1">需要進貨數量</div>
            <div class="text-h4">{{ ordersStore.summary.totalNeedToPurchase }}</div>
          </v-card-text>
        </v-card>
      </v-col> -->
    </v-row>

    <!-- 提示說明 -->
    <v-row>
      <v-col cols="12">
        <v-alert
          type="info"
          variant="tonal"
          icon="mdi-information"
          class="mb-4"
        >
          <div class="text-subtitle-2 font-weight-bold mb-1">統計說明</div>
          <div class="text-body-2">
            • 預設只計算「處理中」、「保留中」狀態的訂單<br>
            • 實際缺貨 = 訂單數量 - 現有庫存 - 已訂購數量<br>
            • 可使用上方篩選器選擇日期範圍、訂單狀態、排除分類和商品名稱<br>
            • 資料來源：即時查詢 WooCommerce 訂單系統
          </div>
        </v-alert>
      </v-col>
    </v-row>

    <!-- 載入中狀態 -->
    <v-row v-if="ordersStore.loading">
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center py-12">
            <v-progress-circular
              indeterminate
              color="primary"
              size="64"
            ></v-progress-circular>
            <div class="text-h6 mt-4">正在統計預購商品訂單...</div>
            <div class="text-body-2 text-grey">這可能需要一些時間，請稍候</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 預購商品統計表格 -->
    <v-row v-else-if="ordersStore.hasPreOrderStats">
      <v-col cols="12">
        <v-card>
          <v-card-title>
            預購商品明細
          </v-card-title>
          
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="ordersStore.preOrderStats"
              :items-per-page="20"
              class="elevation-0"
            >
              <!-- 商品名稱 -->
              <template #item.name="{ item }">
                <div>
                  <div class="font-weight-medium">
                    {{ item.parentName || item.name }}
                  </div>
                  <!-- <div class="text-caption text-grey">
                    {{ getVariationText(item) }}
                  </div>
                  <div class="text-caption text-grey">{{ item.sku }}</div> -->
                </div>
              </template>

              <!-- 商品屬性 -->
              <template #item.attributes="{ item }">
                <v-chip
                  v-for="attr in item.attributes"
                  :key="attr.id"
                  size="small"
                  class="mr-1 mb-1"
                >
                  {{ attr.name }}: {{ attr.option }}
                </v-chip>
              </template>

              <!-- 訂單數量 -->
              <template #item.totalOrderQty="{ item }">
                <v-chip color="primary" variant="flat">
                  {{ item.totalOrderQty }}
                </v-chip>
              </template>

              <!-- 現有庫存 -->
              <template #item.currentStockQty="{ item }">
                <v-chip 
                  :color="item.currentStockQty > 0 ? 'success' : 'grey'"
                  variant="flat"
                >
                  {{ item.currentStockQty }}
                </v-chip>
              </template>

              <!-- 已訂購 -->
              <template #item.onOrderQty="{ item }">
                <v-chip 
                  :color="item.onOrderQty > 0 ? 'info' : 'grey'"
                  variant="flat"
                  class="cursor-pointer"
                  @click="editOnOrderQty(item)"
                >
                  <v-icon start size="small">mdi-pencil</v-icon>
                  {{ item.onOrderQty }}
                </v-chip>
                <div v-if="item.lastOrderDate" class="text-caption text-grey mt-1">
                  {{ formatDate(item.lastOrderDate) }}
                </div>
              </template>

              <!-- 實際缺貨 -->
              <template #item.actualShortage="{ item }">
                <v-chip 
                  :color="getShortageColor(item.actualShortage)"
                  variant="flat"
                  class="font-weight-bold"
                >
                  {{ item.actualShortage > 0 ? item.actualShortage : '✓' }}
                </v-chip>
              </template>

              <!-- 訂單筆數 -->
              <template #item.orderCount="{ item }">
                <div class="text-center">
                  <v-chip size="small" variant="outlined">
                    {{ item.orderCount }} 筆
                  </v-chip>
                </div>
              </template>

              <!-- 操作 -->
              <template #item.actions="{ item }">
                <v-btn
                  size="small"
                  variant="text"
                  color="primary"
                  prepend-icon="mdi-eye"
                  @click="viewOrderDetails(item)"
                >
                  查看訂單
                </v-btn>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 無資料狀態 -->
    <v-row v-else>
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center py-12">
            <v-icon size="64" color="grey">mdi-inbox</v-icon>
            <div class="text-h6 mt-4">目前沒有預購商品訂單</div>
            <div class="text-body-2 text-grey">
              當有客戶下單預購商品時，這裡會顯示統計資訊
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 訂單列表對話框 -->
    <v-dialog
      v-model="orderDetailsDialog"
      max-width="900"
      scrollable
    >
      <v-card v-if="selectedProduct">
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2">mdi-package-variant</v-icon>
          {{ selectedProduct.parentName || selectedProduct.name }} - 訂單明細
          <v-chip class="ml-2" size="small" color="primary">
            共 {{ selectedProduct.orders.length }} 筆訂單
          </v-chip>
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text style="max-height: 600px">
          <v-list>
            <v-list-item
              v-for="order in selectedProduct.orders"
              :key="order.orderId"
              class="mb-2"
            >
              <template #prepend>
                <v-avatar :color="getOrderStatusColor(order.status)">
                  <v-icon>mdi-cart</v-icon>
                </v-avatar>
              </template>

              <v-list-item-title>
                訂單編號: {{ order.orderNumber }}
              </v-list-item-title>

              <v-list-item-subtitle>
                <v-chip
                  :color="getOrderStatusColor(order.status)"
                  size="small"
                  class="mr-2"
                >
                  {{ getOrderStatusText(order.status) }}
                </v-chip>
                數量: {{ order.quantity }} | 
                {{ formatDate(order.dateCreated) }}
                <span v-if="order.customerName" class="ml-2">
                  | 客戶: {{ order.customerName }}
                </span>
              </v-list-item-subtitle>

              <template #append>
                <v-btn
                  color="primary"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-eye"
                  @click="viewOrderDetail(order.orderId)"
                  :loading="loadingOrderDetail && currentOrderId === order.orderId"
                >
                  查看詳情
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            variant="text"
            @click="orderDetailsDialog = false"
          >
            關閉
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 單筆訂單詳細資訊對話框 -->
    <v-dialog
      v-model="singleOrderDialog"
      max-width="1000"
      scrollable
    >
      <v-card v-if="currentOrderDetail">
        <v-card-title class="d-flex align-center bg-primary">
          <v-icon class="mr-2">mdi-receipt-text</v-icon>
          訂單詳情 #{{ currentOrderDetail.number }}
          <v-spacer></v-spacer>
          <v-chip
            :color="getOrderStatusColor(currentOrderDetail.status)"
            size="small"
            class="ml-2"
          >
            {{ getOrderStatusText(currentOrderDetail.status) }}
          </v-chip>
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text style="max-height: 700px" class="pa-4">
          <!-- 1. 客戶備註 -->
          <v-row>
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  <v-icon class="mr-2" size="small">mdi-note-text</v-icon>
                  客戶備註
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text>
                  <div v-if="currentOrderDetail.customer_note">
                    {{ currentOrderDetail.customer_note }}
                  </div>
                  <div v-else class="text-grey">
                    無備註
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- 2. 訂單商品列表 -->
          <v-row class="mt-4">
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  <v-icon class="mr-2" size="small">mdi-cart</v-icon>
                  訂單商品
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text>
                  <v-table>
                    <thead>
                      <tr>
                        <th>商品名稱</th>
                        <th class="text-center">數量</th>
                        <th class="text-right">單價</th>
                        <th class="text-right">小計</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in currentOrderDetail.line_items" :key="item.id">
                        <td>
                          <div class="font-weight-medium">{{ item.name }}</div>
                          <div v-if="item.sku" class="text-caption text-grey">
                            SKU: {{ item.sku }}
                          </div>
                          <div v-if="item.meta_data && item.meta_data.length > 0" class="text-caption">
                            <span v-for="meta in item.meta_data" :key="meta.id" class="mr-2">
                              {{ meta.display_key }}: {{ meta.display_value }}
                            </span>
                          </div>
                        </td>
                        <td class="text-center">{{ item.quantity }}</td>
                        <td class="text-right">${{ item.price }}</td>
                        <td class="text-right font-weight-bold">${{ item.total }}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="3" class="text-right font-weight-bold">運費：</td>
                        <td class="text-right">${{ currentOrderDetail.shipping_total || '0.00' }}</td>
                      </tr>
                      <tr v-if="currentOrderDetail.discount_total && parseFloat(currentOrderDetail.discount_total) > 0">
                        <td colspan="3" class="text-right font-weight-bold text-error">折扣：</td>
                        <td class="text-right text-error">-${{ currentOrderDetail.discount_total }}</td>
                      </tr>
                      <tr>
                        <td colspan="3" class="text-right font-weight-bold text-h6">總計：</td>
                        <td class="text-right text-h6 text-primary font-weight-bold">
                          ${{ currentOrderDetail.total }}
                        </td>
                      </tr>
                    </tfoot>
                  </v-table>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- 3. 客戶資訊 -->
          <v-row class="mt-4">
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  <v-icon class="mr-2" size="small">mdi-account</v-icon>
                  客戶資訊
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text>
                  <v-row>
                    <v-col cols="12" md="4">
                      <div class="mb-2">
                        <span class="font-weight-bold">姓名：</span>
                        {{ getBillingName(currentOrderDetail.billing) }}
                      </div>
                    </v-col>
                    <v-col cols="12" md="4">
                      <div class="mb-2">
                        <span class="font-weight-bold">Email：</span>
                        {{ currentOrderDetail.billing?.email || '無' }}
                      </div>
                    </v-col>
                    <v-col cols="12" md="4">
                      <div class="mb-2">
                        <span class="font-weight-bold">電話：</span>
                        {{ currentOrderDetail.billing?.phone || '無' }}
                      </div>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- 4. 訂單資訊 -->
          <v-row class="mt-4">
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  <v-icon class="mr-2" size="small">mdi-information</v-icon>
                  訂單資訊
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text>
                  <v-row>
                    <v-col cols="12" md="3">
                      <div class="mb-2">
                        <span class="font-weight-bold">訂單編號：</span>
                        {{ currentOrderDetail.number }}
                      </div>
                    </v-col>
                    <v-col cols="12" md="3">
                      <div class="mb-2">
                        <span class="font-weight-bold">下單時間：</span>
                        {{ formatDateTime(currentOrderDetail.date_created) }}
                      </div>
                    </v-col>
                    <v-col cols="12" md="3">
                      <div class="mb-2">
                        <span class="font-weight-bold">付款方式：</span>
                        {{ currentOrderDetail.payment_method_title || '未設定' }}
                      </div>
                    </v-col>
                    <v-col cols="12" md="3">
                      <div class="mb-2">
                        <span class="font-weight-bold">總金額：</span>
                        <span class="text-h6 text-primary">
                          ${{ currentOrderDetail.total }}
                        </span>
                      </div>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- 5. 收件地址 -->
          <v-row class="mt-4">
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  <v-icon class="mr-2" size="small">mdi-map-marker</v-icon>
                  收件地址
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text>
                  <div v-if="currentOrderDetail.shipping">
                    {{ getFullAddress(currentOrderDetail.shipping) }}
                  </div>
                  <div v-else class="text-grey">
                    無收件地址
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            variant="text"
            @click="singleOrderDialog = false"
          >
            關閉
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 編輯已訂購數量對話框 -->
    <v-dialog
      v-model="editDialog"
      max-width="500"
    >
      <v-card v-if="editingProduct">
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2">mdi-package</v-icon>
          更新已訂購數量
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text class="pt-4">
          <div class="mb-4">
            <div class="text-subtitle-1 font-weight-bold">
              {{ editingProduct.parentName || editingProduct.name }}
            </div>
            <div class="text-caption text-grey">
              {{ getVariationText(editingProduct) }}
            </div>
          </div>

          <v-row dense>
            <v-col cols="6">
              <div class="text-caption text-grey">訂單數量</div>
              <div class="text-h6">{{ editingProduct.totalOrderQty }}</div>
            </v-col>
            <v-col cols="6">
              <div class="text-caption text-grey">現有庫存</div>
              <div class="text-h6">{{ editingProduct.currentStockQty }}</div>
            </v-col>
          </v-row>

          <v-text-field
            v-model.number="editingOnOrderQty"
            label="已向廠商訂購數量"
            type="number"
            min="0"
            variant="outlined"
            class="mt-4"
            hint="輸入您已向廠商下單但尚未到貨的數量"
            persistent-hint
          >
            <template #prepend-inner>
              <v-icon>mdi-truck-delivery</v-icon>
            </template>
          </v-text-field>

          <v-alert
            v-if="editingOnOrderQty !== null"
            :color="getShortageAlertColor()"
            variant="tonal"
            class="mt-4"
          >
            <div class="text-subtitle-2">
              實際缺貨數量: 
              <strong>{{ calculateActualShortage() }}</strong>
            </div>
            <div class="text-caption">
              {{ getShortageMessage() }}
            </div>
          </v-alert>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="cancelEdit"
          >
            取消
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="saving"
            @click="saveOnOrderQty"
          >
            儲存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useOrdersStore } from '@/stores/orders'

const ordersStore = useOrdersStore()

// 表格標題
const headers = [
  { title: '商品名稱', key: 'name', sortable: true },
  { title: '商品屬性', key: 'attributes', sortable: false },
  { title: '訂單數量', key: 'totalOrderQty', sortable: true, align: 'center' },
  { title: '訂單筆數', key: 'orderCount', sortable: true, align: 'center' },
  { title: '操作', key: 'actions', sortable: false, align: 'center' }
]

// 訂單詳情對話框
const orderDetailsDialog = ref(false)
const selectedProduct = ref(null)

// 單筆訂單詳情對話框
const singleOrderDialog = ref(false)
const currentOrderDetail = ref(null)
const loadingOrderDetail = ref(false)
const currentOrderId = ref(null)

// 編輯已訂購數量對話框
const editDialog = ref(false)
const editingProduct = ref(null)
const editingOnOrderQty = ref(0)
const saving = ref(false)

// 篩選器
const filters = ref({
  startDate: null,
  endDate: null,
  statuses: ['processing', 'on-hold'],  // 預設只顯示處理中和保留中
  excludeCategories: [],  // 要排除的分類 ID 列表
  excludeProductNames: ''  // 要排除的商品名稱關鍵字（逗號分隔）
})

const statusOptions = [
  { title: '待處理', value: 'pending' },
  { title: '處理中', value: 'processing' },
  { title: '保留中', value: 'on-hold' }
]

const categories = ref([])
const loadingCategories = ref(false)

const hasActiveFilters = computed(() => {
  return filters.value.startDate || 
         filters.value.endDate || 
         filters.value.statuses.length > 0 ||
         filters.value.excludeCategories.length > 0 ||
         filters.value.excludeProductNames
})

// 載入分類列表
const loadCategories = async () => {
  try {
    loadingCategories.value = true
    categories.value = await ordersStore.fetchCategories()
  } catch (error) {
    console.error('載入商品分類失敗:', error)
  } finally {
    loadingCategories.value = false
  }
}

// 載入統計資料
const loadStats = async () => {
  try {
    const filterParams = {}
    if (filters.value.startDate) filterParams.startDate = filters.value.startDate
    if (filters.value.endDate) filterParams.endDate = filters.value.endDate
    if (filters.value.statuses.length > 0) filterParams.statuses = filters.value.statuses
    if (filters.value.excludeCategories.length > 0) filterParams.excludeCategories = filters.value.excludeCategories
    if (filters.value.excludeProductNames) filterParams.excludeProductNames = filters.value.excludeProductNames
    
    await ordersStore.fetchPreOrderStats(filterParams)
  } catch (error) {
    console.error('載入預購商品統計失敗:', error)
  }
}

// 套用篩選
const applyFilters = async () => {
  ordersStore.clearPreOrderStats()
  await loadStats()
}

// 清除篩選
const clearFilters = async () => {
  filters.value.startDate = null
  filters.value.endDate = null
  filters.value.statuses = ['processing', 'on-hold']  // 重置為預設值
  filters.value.excludeCategories = []
  filters.value.excludeProductNames = ''
  await applyFilters()
}

// 重新整理統計
const refreshStats = async () => {
  ordersStore.clearPreOrderStats()
  await loadStats()
}

// 獲取狀態標籤
const getStatusLabel = (status) => {
  const option = statusOptions.find(opt => opt.value === status)
  return option ? option.title : status
}

// 查看訂單詳情
const viewOrderDetails = (product) => {
  selectedProduct.value = product
  orderDetailsDialog.value = true
}

// 獲取訂單狀態顏色
const getOrderStatusColor = (status) => {
  const colorMap = {
    pending: 'orange',
    processing: 'blue',
    'on-hold': 'purple',
    completed: 'green',
    cancelled: 'red',
    refunded: 'grey',
    failed: 'red'
  }
  return colorMap[status] || 'grey'
}

// 獲取訂單狀態文字
const getOrderStatusText = (status) => {
  const textMap = {
    pending: '待處理',
    processing: '處理中',
    'on-hold': '保留中',
    completed: '已完成',
    cancelled: '已取消',
    refunded: '已退款',
    failed: '失敗'
  }
  return textMap[status] || status
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 查看單筆訂單詳情
const viewOrderDetail = async (orderId) => {
  try {
    loadingOrderDetail.value = true
    currentOrderId.value = orderId
    
    console.log('📋 開始獲取訂單詳情:', orderId)
    const order = await ordersStore.fetchOrder(orderId)
    
    currentOrderDetail.value = order
    singleOrderDialog.value = true
    
    console.log('✅ 訂單詳情獲取成功:', order)
  } catch (error) {
    console.error('❌ 獲取訂單詳情失敗:', error)
    alert('獲取訂單詳情失敗，請稍後再試')
  } finally {
    loadingOrderDetail.value = false
    currentOrderId.value = null
  }
}

// 取得帳單姓名
const getBillingName = (billing) => {
  if (!billing) return '無'
  const firstName = billing.first_name || ''
  const lastName = billing.last_name || ''
  return `${lastName}${firstName}`.trim() || '無'
}

// 取得完整地址
const getFullAddress = (address) => {
  if (!address) return '無'
  
  const parts = [
    address.country || '',
    address.state || '',
    address.city || '',
    address.address_1 || '',
    address.address_2 || '',
    address.postcode ? `(${address.postcode})` : ''
  ].filter(part => part.trim())
  
  return parts.join(' ') || '無'
}

// 獲取變化屬性文字（排除貨況）
const getVariationText = (item) => {
  if (!item.attributes || item.attributes.length === 0) return ''
  
  // 過濾掉「貨況」屬性，只顯示其他屬性
  const variationAttrs = item.attributes
    .filter(attr => attr.name !== '貨況')
    .map(attr => `${attr.name}: ${attr.option}`)
    .join(' | ')
  
  return variationAttrs || '無其他屬性'
}

// 編輯已訂購數量
const editOnOrderQty = (product) => {
  editingProduct.value = product
  editingOnOrderQty.value = product.onOrderQty || 0
  editDialog.value = true
}

// 儲存已訂購數量
const saveOnOrderQty = async () => {
  try {
    saving.value = true
    await ordersStore.updateOnOrderQty(editingProduct.value.productId, editingOnOrderQty.value)
    editDialog.value = false
  } catch (error) {
    console.error('儲存失敗:', error)
    alert('儲存失敗，請稍後再試')
  } finally {
    saving.value = false
  }
}

// 取消編輯
const cancelEdit = () => {
  editDialog.value = false
  editingProduct.value = null
  editingOnOrderQty.value = 0
}

// 計算實際缺貨數量
const calculateActualShortage = () => {
  if (!editingProduct.value) return 0
  return Math.max(0, 
    editingProduct.value.totalOrderQty - 
    editingProduct.value.currentStockQty - 
    editingOnOrderQty.value
  )
}

// 獲取缺貨狀態顏色
const getShortageColor = (shortage) => {
  if (shortage === 0) return 'success'
  if (shortage <= 5) return 'warning'
  return 'error'
}

// 獲取缺貨提示顏色
const getShortageAlertColor = () => {
  const shortage = calculateActualShortage()
  if (shortage === 0) return 'success'
  if (shortage <= 5) return 'warning'
  return 'error'
}

// 獲取缺貨提示訊息
const getShortageMessage = () => {
  const shortage = calculateActualShortage()
  if (shortage === 0) return '✓ 已足夠，無需追加訂單'
  if (shortage <= 5) return '⚠️ 建議考慮追加訂單'
  return '❌ 需要追加訂單'
}

// 組件掛載時載入資料
onMounted(() => {
  loadCategories()
  loadStats()
})
</script>

<style scoped>
/* 自訂樣式 */
</style>

