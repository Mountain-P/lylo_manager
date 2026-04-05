<template>
  <div>
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between mb-4">
          <h1 class="text-h4">待處理訂單統計</h1>
          <v-btn color="primary" prepend-icon="mdi-refresh" :loading="loading" @click="refreshStats">
            重新整理
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Tab 切換 -->
    <v-row>
      <v-col cols="12">
        <v-tabs v-model="activeTab" color="primary" class="mb-4">
          <v-tab value="in-stock">
            <v-icon start>mdi-package-variant-closed</v-icon>
            現貨商品
            <v-chip v-if="inStockSummary.productsWithOrders" size="x-small" color="primary" class="ml-2">
              {{ inStockSummary.productsWithOrders }}
            </v-chip>
          </v-tab>
          <v-tab value="pre-order">
            <v-icon start>mdi-clock-outline</v-icon>
            預購商品
            <v-chip v-if="preOrderSummary.productsWithOrders" size="x-small" color="warning" class="ml-2">
              {{ preOrderSummary.productsWithOrders }}
            </v-chip>
          </v-tab>
        </v-tabs>
      </v-col>
    </v-row>

    <!-- 篩選器 -->
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-text>
            <v-row>
              <v-col cols="12" md="3">
                <v-text-field v-model="filters.startDate" label="開始日期" type="date" variant="outlined" density="comfortable" clearable prepend-inner-icon="mdi-calendar-start" hide-details></v-text-field>
              </v-col>
              <v-col cols="12" md="3">
                <v-text-field v-model="filters.endDate" label="結束日期" type="date" variant="outlined" density="comfortable" clearable prepend-inner-icon="mdi-calendar-end" hide-details></v-text-field>
              </v-col>
              <v-col cols="12" md="4">
                <v-select v-model="filters.statuses" label="訂單狀態" :items="statusOptions" variant="outlined" density="comfortable" multiple chips closable-chips prepend-inner-icon="mdi-filter" hide-details></v-select>
              </v-col>
              <v-col cols="12" md="2" class="d-flex align-center">
                <v-btn color="primary" block prepend-icon="mdi-magnify" @click="applyFilters" :loading="loading">查詢</v-btn>
              </v-col>
            </v-row>

            <!-- 排除包含指定商品的訂單 -->
            <v-row class="mt-2">
              <v-col cols="12">
                <v-autocomplete
                  v-model="filters.excludeProductIds"
                  :items="allProducts"
                  item-title="displayName"
                  item-value="_id"
                  label="排除包含指定商品的訂單"
                  variant="outlined"
                  density="comfortable"
                  multiple
                  chips
                  closable-chips
                  clearable
                  prepend-inner-icon="mdi-package-variant-remove"
                  hint="選擇商品後，包含這些商品的訂單將被排除（可用來篩選出能出貨的訂單）"
                  persistent-hint
                  :loading="loadingProducts"
                >
                  <template #chip="{ item, props }">
                    <v-chip v-bind="props" size="small" color="error" variant="tonal">
                      {{ item.title }}
                    </v-chip>
                  </template>
                </v-autocomplete>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 統計摘要卡片 -->
    <v-row v-if="currentStats.length > 0">
      <v-col cols="12" sm="6" md="3">
        <v-card color="info" dark>
          <v-card-text>
            <div class="text-subtitle-1">有訂單的商品</div>
            <div class="text-h4">{{ currentSummary.productsWithOrders }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card color="success" dark>
          <v-card-text>
            <div class="text-subtitle-1">待處理訂單數</div>
            <div class="text-h4">{{ currentSummary.totalOrders }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card color="primary" dark>
          <v-card-text>
            <div class="text-subtitle-1">訂單商品總量</div>
            <div class="text-h4">{{ currentSummary.totalOrderQty }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 載入中 -->
    <v-row v-if="loading">
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center py-12">
            <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
            <div class="text-h6 mt-4">正在統計{{ activeTab === 'in-stock' ? '現貨' : '預購' }}商品訂單...</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 商品統計表格 -->
    <v-row v-else-if="currentStats.length > 0">
      <v-col cols="12">
        <v-card>
          <v-card-title>{{ activeTab === 'in-stock' ? '現貨' : '預購' }}商品明細</v-card-title>
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="currentStats"
              :items-per-page="20"
              class="elevation-0"
            >
              <template #item.name="{ item }">
                <div>
                  <div class="font-weight-medium">{{ item.parentName || item.name }}</div>
                </div>
              </template>
              <template #item.attributes="{ item }">
                <v-chip v-for="attr in item.attributes" :key="attr.id" size="small" class="mr-1 mb-1">
                  {{ attr.name }}: {{ attr.option }}
                </v-chip>
              </template>
              <template #item.totalOrderQty="{ item }">
                <v-chip color="primary" variant="flat">{{ item.totalOrderQty }}</v-chip>
              </template>
              <template #item.currentStockQty="{ item }">
                <v-chip :color="item.currentStockQty > 0 ? 'success' : 'grey'" variant="flat">{{ item.currentStockQty }}</v-chip>
              </template>
              <template #item.orderCount="{ item }">
                <v-chip size="small" variant="outlined">{{ item.orderCount }} 筆</v-chip>
              </template>
              <template #item.actions="{ item }">
                <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-eye" @click="viewOrderDetails(item)">查看訂單</v-btn>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 無資料 -->
    <v-row v-else>
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center py-12">
            <v-icon size="64" color="grey">mdi-inbox</v-icon>
            <div class="text-h6 mt-4">目前沒有{{ activeTab === 'in-stock' ? '現貨' : '預購' }}商品的待處理訂單</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 訂單明細 Dialog -->
    <v-dialog v-model="orderDetailsDialog" max-width="900" scrollable>
      <v-card v-if="selectedProduct">
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2">mdi-package-variant</v-icon>
          {{ selectedProduct.parentName || selectedProduct.name }} - 訂單明細
          <v-chip class="ml-2" size="small" color="primary">共 {{ selectedProduct.orders.length }} 筆</v-chip>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text style="max-height: 600px">
          <v-list>
            <v-list-item v-for="order in selectedProduct.orders" :key="order.orderId" class="mb-2">
              <template #prepend>
                <v-avatar :color="getOrderStatusColor(order.status)"><v-icon>mdi-cart</v-icon></v-avatar>
              </template>
              <v-list-item-title>訂單編號: {{ order.orderNumber }}</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip :color="getOrderStatusColor(order.status)" size="small" class="mr-2">{{ getOrderStatusText(order.status) }}</v-chip>
                數量: {{ order.quantity }} | {{ formatDate(order.dateCreated) }}
                <span v-if="order.customerName" class="ml-2">| 客戶: {{ order.customerName }}</span>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="orderDetailsDialog = false">關閉</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import api from '@/plugins/axios'

const activeTab = ref('in-stock')
const loading = ref(false)
const loadingProducts = ref(false)
const allProducts = ref([])
const inStockStats = ref([])
const preOrderStats = ref([])
const inStockSummary = ref({ productsWithOrders: 0, totalOrders: 0, totalOrderQty: 0 })
const preOrderSummary = ref({ productsWithOrders: 0, totalOrders: 0, totalOrderQty: 0 })

const orderDetailsDialog = ref(false)
const selectedProduct = ref(null)

const filters = reactive({
  startDate: null,
  endDate: null,
  statuses: ['processing'],
  excludeProductIds: []
})

const statusOptions = [
  { title: '待處理', value: 'pending' },
  { title: '處理中', value: 'processing' },
  { title: '保留中', value: 'on-hold' }
]

const headers = [
  { title: '商品名稱', key: 'name', sortable: true },
  { title: '商品屬性', key: 'attributes', sortable: false },
  { title: '訂單數量', key: 'totalOrderQty', sortable: true, align: 'center' },
  { title: '現有庫存', key: 'currentStockQty', sortable: true, align: 'center' },
  { title: '訂單筆數', key: 'orderCount', sortable: true, align: 'center' },
  { title: '操作', key: 'actions', sortable: false, align: 'center' }
]

const currentStats = computed(() => activeTab.value === 'in-stock' ? inStockStats.value : preOrderStats.value)
const currentSummary = computed(() => activeTab.value === 'in-stock' ? inStockSummary.value : preOrderSummary.value)

const buildParams = () => {
  const params = {}
  if (filters.startDate) params.startDate = filters.startDate
  if (filters.endDate) params.endDate = filters.endDate
  if (filters.statuses.length > 0) params.statuses = filters.statuses.join(',')
  if (filters.excludeProductIds.length > 0) params.excludeProductIds = filters.excludeProductIds.join(',')
  return params
}

const fetchInStockStats = async () => {
  try {
    const response = await api.get('/orders/stats/in-stock', { params: buildParams() })
    inStockStats.value = response.data.stats || []
    inStockSummary.value = response.data.summary || {}
  } catch (error) {
    console.error('取得現貨統計失敗:', error)
  }
}

const fetchPreOrderStats = async () => {
  try {
    const response = await api.get('/orders/stats/pre-order', { params: buildParams() })
    preOrderStats.value = response.data.stats || []
    preOrderSummary.value = response.data.summary || {}
  } catch (error) {
    console.error('取得預購統計失敗:', error)
  }
}

const loadAllProducts = async () => {
  try {
    loadingProducts.value = true
    const response = await api.get('/products', { params: { limit: -1, hideDraft: 'true' } })
    const products = response.data.products || []
    allProducts.value = products.map(p => ({
      _id: p._id,
      displayName: `${p.name} (${p.sku || 'N/A'})`
    }))
  } catch (error) {
    console.error('取得商品列表失敗:', error)
  } finally {
    loadingProducts.value = false
  }
}

const applyFilters = async () => {
  loading.value = true
  try {
    await Promise.all([fetchInStockStats(), fetchPreOrderStats()])
  } finally {
    loading.value = false
  }
}

const refreshStats = () => applyFilters()

const viewOrderDetails = (product) => {
  selectedProduct.value = product
  orderDetailsDialog.value = true
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

const getOrderStatusColor = (status) => {
  const map = { pending: 'orange', processing: 'blue', 'on-hold': 'purple', completed: 'green', cancelled: 'red' }
  return map[status] || 'grey'
}

const getOrderStatusText = (status) => {
  const map = { pending: '待處理', processing: '處理中', 'on-hold': '保留中', completed: '已完成', cancelled: '已取消' }
  return map[status] || status
}

onMounted(async () => {
  loadAllProducts()
  await applyFilters()
})
</script>
