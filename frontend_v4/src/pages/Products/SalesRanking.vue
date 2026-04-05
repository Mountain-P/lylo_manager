<template>
  <div>
    <!-- 頁面標題 -->
    <v-row>
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between mb-4">
          <h1 class="text-h4">銷售排行榜</h1>
          <v-btn color="primary" prepend-icon="mdi-refresh" :loading="productsStore.salesRankingLoading"
            @click="refreshRanking">
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
                <v-text-field v-model="filters.startDate" label="開始日期" type="date" variant="outlined"
                  density="comfortable" clearable prepend-inner-icon="mdi-calendar-start" hide-details></v-text-field>
              </v-col>

              <v-col cols="12" md="3">
                <v-text-field v-model="filters.endDate" label="結束日期" type="date" variant="outlined"
                  density="comfortable" clearable prepend-inner-icon="mdi-calendar-end" hide-details></v-text-field>
              </v-col>

              <v-col cols="12" md="3">
                <v-select v-model="filters.sortBy" label="排序方式" :items="sortOptions" variant="outlined"
                  density="comfortable" prepend-inner-icon="mdi-sort" hide-details></v-select>
              </v-col>

              <v-col cols="12" md="3">
                <v-select v-model="filters.statuses" label="訂單狀態" :items="statusOptions" variant="outlined"
                  density="comfortable" multiple chips closable-chips prepend-inner-icon="mdi-filter"
                  hide-details></v-select>
              </v-col>
            </v-row>

            <v-row class="mt-2">
              <v-col cols="12" md="9">
                <div class="d-flex align-center">
                  <v-chip v-if="filters.startDate" size="small" closable
                    @click:close="filters.startDate = null; applyFilters()" class="mr-1">
                    開始: {{ filters.startDate }}
                  </v-chip>
                  <v-chip v-if="filters.endDate" size="small" closable
                    @click:close="filters.endDate = null; applyFilters()" class="mr-1">
                    結束: {{ filters.endDate }}
                  </v-chip>
                  <v-btn v-if="hasActiveFilters" size="small" variant="text" color="error" @click="clearFilters">
                    清除所有篩選
                  </v-btn>
                </div>
              </v-col>

              <v-col cols="12" md="3">
                <v-btn color="primary" block prepend-icon="mdi-magnify" @click="applyFilters"
                  :loading="productsStore.salesRankingLoading">
                  查詢
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 提示說明 -->
    <v-row>
      <v-col cols="12">
        <v-alert type="info" variant="tonal" icon="mdi-information" class="mb-4">
          <div class="text-subtitle-2 font-weight-bold mb-1">統計說明</div>
          <div class="text-body-2">
            • 預設統計最近 30 天的銷售數據<br>
            • 日期範圍越大，查詢時間越長（建議不超過 90 天）<br>
            • 數據來源：即時查詢 WooCommerce 訂單系統<br>
            • ⏱️ 查詢可能需要 30-60 秒，請耐心等候
          </div>
        </v-alert>
      </v-col>
    </v-row>

    <!-- 統計摘要卡片 -->
    <v-row v-if="productsStore.salesRanking.length > 0">
      <v-col cols="12" sm="6" md="3">
        <v-card color="primary" dark>
          <v-card-text>
            <div class="text-subtitle-1">熱銷商品數</div>
            <div class="text-h4">{{ productsStore.salesRankingSummary.totalProducts }}</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card color="success" dark>
          <v-card-text>
            <div class="text-subtitle-1">總銷售數量</div>
            <div class="text-h4">{{ productsStore.salesRankingSummary.totalSoldQuantity }}</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card color="info" dark>
          <v-card-text>
            <div class="text-subtitle-1">總營收</div>
            <div class="text-h4">${{ formatNumber(productsStore.salesRankingSummary.totalRevenue) }}</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card color="warning" dark>
          <v-card-text>
            <div class="text-subtitle-1">訂單總數</div>
            <div class="text-h4">{{ productsStore.salesRankingSummary.totalOrders }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 視覺化圖表 -->
    <v-row v-if="productsStore.salesRanking.length > 0">
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-title>銷售排行圖表（前 10 名）</v-card-title>
          <v-card-text>
            <Bar :data="chartData" :options="chartOptions" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 載入中狀態 -->
    <v-row v-if="productsStore.salesRankingLoading">
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center py-12">
            <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
            <div class="text-h6 mt-4">正在統計銷售排行...</div>
            <div class="text-body-2 text-grey mb-2">正在從 WooCommerce 獲取訂單資料並統計</div>
            <div class="text-caption text-grey">⏱️ 這可能需要 30-60 秒，請耐心等候</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 銷售排行表格 -->
    <v-row v-else-if="productsStore.salesRanking.length > 0">
      <v-col cols="12">
        <v-card>
          <v-card-title>
            銷售排行明細
          </v-card-title>

          <v-card-text>
            <v-data-table :headers="headers" :items="productsStore.salesRanking" :items-per-page="20"
              class="elevation-0">
              <!-- 排名 -->
              <template #item.rank="{ index }">
                <v-chip :color="getRankColor(index)" variant="flat" size="large" class="font-weight-bold">
                  {{ index + 1 }}
                </v-chip>
              </template>

              <!-- 商品資訊 -->
              <template #item.product="{ item }">
                <div class="d-flex align-center py-2 cursor-pointer hover-effect" @click="viewProductDetail(item)">
                  <v-avatar size="60" class="mr-3">
                    <v-img v-if="item.image" :src="item.image" :alt="item.name" cover></v-img>
                    <v-icon v-else size="40">mdi-image-off</v-icon>
                  </v-avatar>
                  <div>
                    <div class="font-weight-medium">
                      {{ item.parentName || item.name }}
                      <v-icon size="small" class="ml-1">mdi-open-in-new</v-icon>
                    </div>
                    <div class="text-caption text-grey">
                      SKU: {{ item.sku }}
                    </div>
                  </div>
                </div>
              </template>

              <!-- 變化類型 -->
              <template #item.attributes="{ item }">
                <v-chip v-for="attr in item.attributes" :key="attr.id" size="small" class="mr-1 mb-1">
                  {{ attr.name }}: {{ attr.option }}
                </v-chip>
                <span v-if="!item.attributes || item.attributes.length === 0" class="text-grey">
                  -
                </span>
              </template>

              <!-- 價格 -->
              <template #item.price="{ item }">
                <div>
                  <div v-if="item.salePrice" class="text-error font-weight-bold">
                    ${{ formatNumber(item.salePrice) }}
                  </div>
                  <div
                    :class="item.salePrice ? 'text-decoration-line-through text-grey text-caption' : 'font-weight-bold'">
                    ${{ formatNumber(item.price) }}
                  </div>
                </div>
              </template>

              <!-- 售出數量 -->
              <template #item.soldQuantity="{ item }">
                <v-chip color="success" variant="flat" size="large" class="font-weight-bold">
                  {{ item.soldQuantity }}
                </v-chip>
              </template>

              <!-- 當前庫存 -->
              <template #item.currentStock="{ item }">
                <v-chip :color="getStockColor(item.currentStock)" variant="flat">
                  {{ item.currentStock }}
                </v-chip>
              </template>

              <!-- 總營收 -->
              <template #item.totalRevenue="{ item }">
                <div class="font-weight-bold text-primary">
                  ${{ formatNumber(item.totalRevenue) }}
                </div>
              </template>

              <!-- 訂單筆數 -->
              <template #item.orderCount="{ item }">
                <v-chip size="small" variant="outlined">
                  {{ item.orderCount }} 筆
                </v-chip>
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
            <v-icon size="64" color="grey">mdi-chart-box-outline</v-icon>
            <div class="text-h6 mt-4">目前沒有銷售資料</div>
            <div class="text-body-2 text-grey">
              請調整日期範圍或訂單狀態篩選條件
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 商品詳細資料 Dialog -->
    <v-dialog v-model="productDetailDialog" max-width="900" scrollable>
      <v-card v-if="selectedProduct">
        <v-card-title class="d-flex align-center bg-primary">
          <v-icon class="mr-2">mdi-package-variant</v-icon>
          商品詳細資料
          <v-spacer></v-spacer>
          <v-chip :color="getRankColor(selectedProduct.rank - 1)" size="small" class="font-weight-bold">
            排名 #{{ selectedProduct.rank }}
          </v-chip>
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text style="max-height: 700px" class="pa-4">
          <!-- 商品基本資訊 -->
          <v-row>
            <v-col cols="12" md="5">
              <v-card variant="outlined">
                <v-img v-if="selectedProduct.image" :src="selectedProduct.image" :alt="selectedProduct.name"
                  height="300" cover></v-img>
                <v-card-text v-else class="text-center py-12">
                  <v-icon size="100" color="grey">mdi-image-off</v-icon>
                  <div class="text-grey mt-2">無商品圖片</div>
                </v-card-text>
              </v-card>
            </v-col>

            <v-col cols="12" md="7">
              <v-card variant="outlined">
                <v-card-title class="text-h5">
                  {{ selectedProduct.parentName || selectedProduct.name }}
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text>
                  <v-row dense>
                    <v-col cols="12">
                      <div class="mb-2">
                        <span class="font-weight-bold">SKU：</span>
                        <v-chip size="small" variant="outlined">{{ selectedProduct.sku }}</v-chip>
                      </div>
                    </v-col>

                    <v-col cols="12" v-if="selectedProduct.attributes && selectedProduct.attributes.length > 0">
                      <div class="mb-2">
                        <span class="font-weight-bold">變化類型：</span>
                        <v-chip v-for="attr in selectedProduct.attributes" :key="attr.id" size="small" class="mr-1"
                          color="primary" variant="tonal">
                          {{ attr.name }}: {{ attr.option }}
                        </v-chip>
                      </div>
                    </v-col>

                    <v-col cols="6">
                      <div class="mb-2">
                        <span class="font-weight-bold text-grey">售價：</span>
                        <div class="text-h6 text-primary mt-1">
                          <span v-if="selectedProduct.salePrice" class="text-error">
                            ${{ formatNumber(selectedProduct.salePrice) }}
                          </span>
                          <span v-else>
                            ${{ formatNumber(selectedProduct.price) }}
                          </span>
                        </div>
                        <div v-if="selectedProduct.salePrice"
                          class="text-caption text-decoration-line-through text-grey">
                          原價 ${{ formatNumber(selectedProduct.regularPrice) }}
                        </div>
                      </div>
                    </v-col>

                    <v-col cols="6">
                      <div class="mb-2">
                        <span class="font-weight-bold text-grey">當前庫存：</span>
                        <div class="text-h6 mt-1">
                          <v-chip :color="getStockColor(selectedProduct.currentStock)" variant="flat" size="large">
                            {{ selectedProduct.currentStock }}
                          </v-chip>
                        </div>
                      </div>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- 銷售統計 -->
          <v-row class="mt-4">
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1 bg-grey-lighten-4">
                  <v-icon class="mr-2" size="small">mdi-chart-line</v-icon>
                  銷售統計
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text>
                  <v-row>
                    <v-col cols="12" sm="6" md="3">
                      <v-card color="success" dark>
                        <v-card-text class="text-center">
                          <div class="text-caption">售出數量</div>
                          <div class="text-h4">{{ selectedProduct.soldQuantity }}</div>
                        </v-card-text>
                      </v-card>
                    </v-col>

                    <v-col cols="12" sm="6" md="3">
                      <v-card color="info" dark>
                        <v-card-text class="text-center">
                          <div class="text-caption">訂單筆數</div>
                          <div class="text-h4">{{ selectedProduct.orderCount }}</div>
                        </v-card-text>
                      </v-card>
                    </v-col>

                    <v-col cols="12" sm="6" md="3">
                      <v-card color="primary" dark>
                        <v-card-text class="text-center">
                          <div class="text-caption">總營收</div>
                          <div class="text-h5">${{ formatNumber(selectedProduct.totalRevenue) }}</div>
                        </v-card-text>
                      </v-card>
                    </v-col>

                    <v-col cols="12" sm="6" md="3">
                      <v-card color="warning" dark>
                        <v-card-text class="text-center">
                          <div class="text-caption">平均單價</div>
                          <div class="text-h5">
                            ${{ formatNumber(selectedProduct.totalRevenue / selectedProduct.soldQuantity) }}
                          </div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- 建議與提醒 -->
          <v-row class="mt-4">
            <v-col cols="12">
              <v-alert
                :type="selectedProduct.currentStock === 0 ? 'error' : selectedProduct.currentStock < 10 ? 'warning' : 'info'"
                variant="tonal" prominent>
                <template v-if="selectedProduct.currentStock === 0">
                  <div class="font-weight-bold">⚠️ 庫存不足警告</div>
                  <div>此商品已無庫存，建議立即補貨以滿足銷售需求。</div>
                </template>
                <template v-else-if="selectedProduct.currentStock < 10">
                  <div class="font-weight-bold">📦 低庫存提醒</div>
                  <div>此商品庫存偏低，建議考慮補貨。</div>
                </template>
                <template v-else>
                  <div class="font-weight-bold">✅ 庫存充足</div>
                  <div>此商品庫存充足，可以正常銷售。</div>
                </template>
              </v-alert>
            </v-col>
          </v-row>

          <!-- 訂單清單 -->
          <v-row class="mt-4" v-if="selectedProduct.orders && selectedProduct.orders.length > 0">
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1 bg-grey-lighten-4">
                  <v-icon class="mr-2" size="small">mdi-cart-variant</v-icon>
                  訂單清單
                  <v-chip size="small" class="ml-2" color="primary">
                    共 {{ selectedProduct.orders.length }} 筆訂單
                  </v-chip>
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text class="pa-0">
                  <v-data-table
                    :headers="orderHeaders"
                    :items="selectedProduct.orders"
                    :items-per-page="5"
                    density="compact"
                    class="elevation-0"
                  >
                    <!-- 訂單編號 -->
                    <template #item.orderNumber="{ item }">
                      <div class="font-weight-medium">
                        #{{ item.orderNumber }}
                      </div>
                    </template>

                    <!-- 訂單狀態 -->
                    <template #item.status="{ item }">
                      <v-chip
                        :color="getOrderStatusColor(item.status)"
                        size="small"
                        variant="flat"
                      >
                        {{ getOrderStatusText(item.status) }}
                      </v-chip>
                    </template>

                    <!-- 購買數量 -->
                    <template #item.quantity="{ item }">
                      <v-chip size="small" variant="outlined">
                        {{ item.quantity }}
                      </v-chip>
                    </template>

                    <!-- 單價 -->
                    <template #item.price="{ item }">
                      <div>${{ formatNumber(item.price) }}</div>
                    </template>

                    <!-- 小計 -->
                    <template #item.subtotal="{ item }">
                      <div class="font-weight-bold text-primary">
                        ${{ formatNumber(item.subtotal) }}
                      </div>
                    </template>

                    <!-- 客戶資訊 -->
                    <template #item.customerName="{ item }">
                      <div>
                        <div class="font-weight-medium">{{ item.customerName }}</div>
                        <div v-if="item.customerPhone" class="text-caption text-grey">
                          {{ item.customerPhone }}
                        </div>
                      </div>
                    </template>

                    <!-- 日期 -->
                    <template #item.dateCreated="{ item }">
                      <div class="text-caption">
                        {{ formatOrderDate(item.dateCreated) }}
                      </div>
                    </template>
                  </v-data-table>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="productDetailDialog = false">
            關閉
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useProductsStore } from '@/stores/products'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const productsStore = useProductsStore()

// 設定預設日期（最近 30 天）
const getDefaultStartDate = () => {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().split('T')[0]
}

const getDefaultEndDate = () => {
  return new Date().toISOString().split('T')[0]
}

// 篩選器
const filters = ref({
  startDate: getDefaultStartDate(),
  endDate: getDefaultEndDate(),
  sortBy: 'desc',
  statuses: ['completed'],
  limit: 50
})

const sortOptions = [
  { title: '銷售量：高到低', value: 'desc' },
  { title: '銷售量：低到高', value: 'asc' }
]

const statusOptions = [
  { title: '待處理', value: 'pending' },
  { title: '處理中', value: 'processing' },
  { title: '保留中', value: 'on-hold' },
  { title: '已完成', value: 'completed' }
]

const hasActiveFilters = computed(() => {
  return filters.value.startDate || filters.value.endDate
})

// 商品詳細資料 Dialog
const productDetailDialog = ref(false)
const selectedProduct = ref(null)

// 表格標題
const headers = [
  { title: '排名', key: 'rank', sortable: false, align: 'center', width: 80 },
  { title: '商品資訊', key: 'product', sortable: false, width: 250 },
  { title: '變化類型', key: 'attributes', sortable: false, width: 200 },
  { title: '價格', key: 'price', sortable: false, align: 'center' },
  { title: '售出數量', key: 'soldQuantity', sortable: false, align: 'center' },
  { title: '當前庫存', key: 'currentStock', sortable: false, align: 'center' },
  { title: '總營收', key: 'totalRevenue', sortable: false, align: 'center' },
  { title: '訂單筆數', key: 'orderCount', sortable: false, align: 'center' }
]

// 訂單表格標題
const orderHeaders = [
  { title: '訂單編號', key: 'orderNumber', sortable: false, width: 120 },
  { title: '狀態', key: 'status', sortable: false, align: 'center', width: 100 },
  { title: '數量', key: 'quantity', sortable: false, align: 'center', width: 80 },
  { title: '單價', key: 'price', sortable: false, align: 'right', width: 100 },
  { title: '小計', key: 'subtotal', sortable: false, align: 'right', width: 100 },
  { title: '客戶', key: 'customerName', sortable: false, width: 150 },
  { title: '訂單日期', key: 'dateCreated', sortable: false, width: 150 }
]

// 圖表數據
const chartData = computed(() => {
  const top10 = productsStore.salesRanking.slice(0, 10)

  return {
    labels: top10.map(item => item.parentName || item.name),
    datasets: [
      {
        label: '銷售數量',
        data: top10.map(item => item.soldQuantity),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: false
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1
      }
    }
  }
}

// 載入資料
const loadRanking = async () => {
  try {
    const filterParams = {
      startDate: filters.value.startDate,
      endDate: filters.value.endDate,
      sortBy: filters.value.sortBy,
      statuses: filters.value.statuses.join(','),
      limit: filters.value.limit
    }

    await productsStore.fetchSalesRanking(filterParams)
  } catch (error) {
    console.error('載入銷售排行失敗:', error)

    // 顯示友好的錯誤提示
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      alert('查詢時間過長，請嘗試縮小日期範圍或稍後再試。\n\n建議：\n• 將日期範圍縮小至 30 天以內\n• 選擇較少的訂單狀態篩選')
    } else {
      alert('載入銷售排行失敗，請稍後再試。\n\n錯誤：' + (error.message || '未知錯誤'))
    }
  }
}

// 套用篩選
const applyFilters = async () => {
  productsStore.clearSalesRanking()
  await loadRanking()
}

// 清除篩選
const clearFilters = async () => {
  filters.value.startDate = getDefaultStartDate()
  filters.value.endDate = getDefaultEndDate()
  filters.value.sortBy = 'desc'
  filters.value.statuses = ['completed']
  await applyFilters()
}

// 重新整理
const refreshRanking = async () => {
  productsStore.clearSalesRanking()
  await loadRanking()
}

// 格式化數字
const formatNumber = (num) => {
  return new Intl.NumberFormat('zh-TW').format(Math.round(num))
}

// 獲取排名顏色
const getRankColor = (index) => {
  if (index === 0) return 'amber'
  if (index === 1) return 'blue-grey-lighten-1'
  if (index === 2) return 'orange-lighten-1'
  return 'grey-lighten-2'
}

// 獲取庫存顏色
const getStockColor = (stock) => {
  if (stock === 0) return 'error'
  if (stock < 10) return 'warning'
  return 'success'
}

// 查看商品詳細資料
const viewProductDetail = (product) => {
  // 添加排名資訊
  const index = productsStore.salesRanking.findIndex(p => p.wooId === product.wooId)
  selectedProduct.value = {
    ...product,
    rank: index + 1
  }
  productDetailDialog.value = true
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

// 格式化訂單日期
const formatOrderDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 組件掛載時載入資料
onMounted(() => {
  loadRanking()
})
</script>

<style scoped>
.text-decoration-line-through {
  text-decoration: line-through;
}

.cursor-pointer {
  cursor: pointer;
}

.hover-effect {
  transition: background-color 0.2s;
}

.hover-effect:hover {
  background-color: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
}
</style>
