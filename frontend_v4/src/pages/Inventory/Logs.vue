<template>
  <div>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">盤點記錄</h1>
      </v-col>
    </v-row>

    <!-- 統計卡片 -->
    <v-row class="mb-4">
      <v-col cols="6" md="3">
        <v-card variant="tonal" color="primary">
          <v-card-text class="text-center pa-4">
            <v-icon size="28" class="mb-1">mdi-clipboard-list</v-icon>
            <div class="text-h4 font-weight-bold">{{ inventoryStore.stats.totalLogs }}</div>
            <div class="text-body-2">總記錄數</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card variant="tonal" color="success">
          <v-card-text class="text-center pa-4">
            <v-icon size="28" class="mb-1">mdi-check-circle</v-icon>
            <div class="text-h4 font-weight-bold">
              {{ inventoryStore.stats.totalLogs - inventoryStore.stats.errorLogs }}
            </div>
            <div class="text-body-2">正常記錄</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card variant="tonal" color="error">
          <v-card-text class="text-center pa-4">
            <v-icon size="28" class="mb-1">mdi-alert-circle</v-icon>
            <div class="text-h4 font-weight-bold">{{ inventoryStore.stats.errorLogs }}</div>
            <div class="text-body-2">異常記錄</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card variant="tonal" color="info">
          <v-card-text class="text-center pa-4">
            <v-icon size="28" class="mb-1">mdi-calendar-today</v-icon>
            <div class="text-h4 font-weight-bold">{{ inventoryStore.stats.todayLogs }}</div>
            <div class="text-body-2">今日盤點</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card>
      <v-card-title>
        <v-row>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="search"
              append-inner-icon="mdi-magnify"
              label="搜尋商品名稱"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @input="debouncedSearch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.hasError"
              :items="statusOptions"
              label="狀態篩選"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @update:model-value="fetchData"
            ></v-select>
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.method"
              :items="methodOptions"
              label="盤點方式"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @update:model-value="fetchData"
            ></v-select>
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              v-model="filters.startDate"
              label="開始日期"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              @change="fetchData"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              v-model="filters.endDate"
              label="結束日期"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              @change="fetchData"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="1" class="d-flex justify-end ga-1">
            <v-tooltip text="匯出記錄" location="top">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="mdi-download" variant="text" size="small" @click="exportLogs"></v-btn>
              </template>
            </v-tooltip>
            <v-tooltip text="清除篩選" location="top">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="mdi-filter-remove" variant="text" size="small" @click="clearFilters"></v-btn>
              </template>
            </v-tooltip>
            <v-tooltip text="重新整理" location="top">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="mdi-refresh" variant="text" size="small" @click="refreshData"></v-btn>
              </template>
            </v-tooltip>
          </v-col>
        </v-row>
      </v-card-title>

      <v-data-table-server
        :headers="headers"
        :items="inventoryStore.logs"
        :loading="inventoryStore.loading"
        :items-length="inventoryStore.pagination.totalItems"
        :items-per-page="inventoryStore.pagination.itemsPerPage"
        :page="inventoryStore.pagination.currentPage"
        class="elevation-1"
        loading-text="正在載入盤點記錄..."
        no-data-text="找不到盤點記錄"
        @update:page="onPageChange"
        @update:items-per-page="onItemsPerPageChange"
      >
        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>
        
        <template #item.product="{ item }">
          <div class="d-flex align-center">
            <v-avatar size="32" class="mr-2">
              <img 
                :src="item.productId?.wooData?.images?.[0]?.src || '/placeholder.png'" 
                :alt="item.productId?.name"
              >
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ getProductDisplayName(item.productId) }}</div>
              <div class="text-caption text-grey" v-if="getVariationInfo(item.productId)">
                {{ getVariationInfo(item.productId) }}
              </div>
            </div>
          </div>
        </template>
        
        <template #item.user="{ item }">
          <div>
            <div>{{ item.userId?.name || 'N/A' }}</div>
            <div class="text-caption text-grey">
              {{ item.userId?.role === 'boss' ? '管理員' : '員工' }}
            </div>
          </div>
        </template>
        
        <template #item.countedQty="{ item }">
          <v-chip size="small" color="blue" variant="flat">
            {{ item.countedQty }}
          </v-chip>
        </template>
        
        <template #item.systemQty="{ item }">
          <v-chip size="small" color="grey" variant="flat">
            {{ item.expectedQty || 0 }}
          </v-chip>
        </template>
        
        <template #item.diffQty="{ item }">
          <span :class="item.diffQty !== 0 ? 'text-error font-weight-bold' : ''">
            {{ item.diffQty > 0 ? '+' : '' }}{{ item.diffQty }}
          </span>
        </template>
        
        <template #item.hasError="{ item }">
          <v-chip
            :color="item.diffQty !== 0 ? 'error' : 'success'"
            size="small"
            variant="flat"
          >
            {{ item.diffQty !== 0 ? '異常' : '正常' }}
          </v-chip>
        </template>
        
        <template #item.method="{ item }">
          <v-chip size="small" variant="outlined">
            {{ item.method === 'barcode' ? '條碼掃描' : '手動輸入' }}
          </v-chip>
        </template>
        
        <template #item.actions="{ item }">
          <v-btn
            icon="mdi-eye"
            size="small"
            variant="text"
            @click="viewLogDetail(item)"
          ></v-btn>
          <v-btn
            v-if="authStore.isBoss"
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            @click="deleteLog(item)"
          ></v-btn>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- 記錄詳情 Dialog -->
    <v-dialog v-model="detailDialog.show" max-width="600px">
      <v-card v-if="detailDialog.log">
        <v-card-title>盤點記錄詳情</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="4">
              <v-img
                :src="detailDialog.log.productId?.wooData?.images?.[0]?.src || '/placeholder.png'"
                :alt="detailDialog.log.productId?.name"
                aspect-ratio="1"
                class="rounded"
              ></v-img>
            </v-col>
            <v-col cols="8">
              <v-list density="compact">
                <v-list-item>
                  <v-list-item-title>商品名稱</v-list-item-title>
                  <v-list-item-subtitle>{{ getProductDisplayName(detailDialog.log.productId) }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item v-if="getVariationInfo(detailDialog.log.productId)">
                  <v-list-item-title>變體資訊</v-list-item-title>
                  <v-list-item-subtitle>{{ getVariationInfo(detailDialog.log.productId) }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>盤點時間</v-list-item-title>
                  <v-list-item-subtitle>{{ formatDate(detailDialog.log.createdAt) }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>盤點人員</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ detailDialog.log.userId?.name || 'N/A' }}
                    ({{ detailDialog.log.userId?.role === 'boss' ? '管理員' : '員工' }})
                  </v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>盤點方式</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ detailDialog.log.method === 'barcode' ? '條碼掃描' : '手動輸入' }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>
          
          <v-divider class="my-4"></v-divider>
          
          <v-row>
            <v-col cols="4">
              <div class="text-center">
                <div class="text-h4">{{ detailDialog.log.expectedQty }}</div>
                <div class="text-caption">系統庫存</div>
              </div>
            </v-col>
            <v-col cols="4">
              <div class="text-center">
                <div class="text-h4 text-primary font-weight-bold">{{ detailDialog.log.countedQty }}</div>
                <div class="text-caption">盤點數量</div>
              </div>
            </v-col>
            <v-col cols="4">
              <div class="text-center">
                <div 
                  class="text-h4"
                  :class="detailDialog.log.diffQty !== 0 ? 'text-error' : 'text-success'"
                >
                  {{ detailDialog.log.diffQty > 0 ? '+' : '' }}{{ detailDialog.log.diffQty }}
                </div>
                <div class="text-caption">差異（盤點 - 庫存）</div>
              </div>
            </v-col>
          </v-row>
          
          <div v-if="detailDialog.log.note" class="mt-4">
            <div class="text-subtitle-2 mb-2">備註</div>
            <v-alert variant="outlined" color="info">
              {{ detailDialog.log.note }}
            </v-alert>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="detailDialog.show = false">關閉</v-btn>
          <v-btn
            color="primary"
            @click="viewProduct(detailDialog.log.productId)"
            :disabled="!detailDialog.log.productId"
          >
            查看商品
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 刪除確認 Dialog -->
    <v-dialog v-model="deleteDialog.show" max-width="400px">
      <v-card>
        <v-card-title>確認刪除</v-card-title>
        <v-card-text>
          確定要刪除這筆盤點記錄嗎？此操作無法復原。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteDialog.show = false">取消</v-btn>
          <v-btn 
            color="error" 
            :loading="deleteDialog.loading"
            @click="confirmDelete"
          >
            刪除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import moment from 'moment'
import _ from 'lodash'
import { useInventoryStore } from '@/stores/inventory'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

// Composables
const router = useRouter()

// Stores
const inventoryStore = useInventoryStore()
const authStore = useAuthStore()
const uiStore = useUIStore()

// Reactive data
const search = ref('')
const filters = reactive({
  hasError: null,
  method: null,
  startDate: '',
  endDate: ''
})

const detailDialog = reactive({
  show: false,
  log: null
})

const deleteDialog = reactive({
  show: false,
  loading: false,
  log: null
})

const headers = [
  { title: '盤點時間', key: 'createdAt', width: '140px' },
  { title: '商品', key: 'product', width: '200px' },
  { title: '盤點人員', key: 'user', width: '120px' },
  { title: '盤點數量', key: 'countedQty', width: '100px' },
  { title: '系統庫存', key: 'systemQty', width: '100px' },
  { title: '差異', key: 'diffQty', width: '80px' },
  { title: '狀態', key: 'hasError', width: '80px' },
  { title: '方式', key: 'method', width: '100px' },
  { title: '操作', key: 'actions', sortable: false, width: '100px' }
]

const statusOptions = [
  { title: '全部', value: null },
  { title: '正常', value: false },
  { title: '異常', value: true }
]

const methodOptions = [
  { title: '全部', value: null },
  { title: '條碼掃描', value: 'barcode' },
  { title: '手動輸入', value: 'manual' }
]

// Methods
const formatDate = (date) => {
  return moment(date).format('YYYY/MM/DD HH:mm')
}

const debouncedSearch = _.debounce(() => {
  fetchData()
}, 500)

const fetchData = async () => {
  const params = {
    page: inventoryStore.pagination.currentPage,
    limit: inventoryStore.pagination.itemsPerPage,
    search: search.value || undefined,
    hasError: filters.hasError,
    method: filters.method || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined
  }

  try {
    await inventoryStore.fetchLogs(params)
  } catch (error) {
    uiStore.showError('獲取盤點記錄失敗')
  }
}

const refreshData = () => {
  fetchData()
}

const onPageChange = (page) => {
  inventoryStore.setPagination({ currentPage: page })
  fetchData()
}

const onItemsPerPageChange = (itemsPerPage) => {
  inventoryStore.setPagination({ 
    itemsPerPage, 
    currentPage: 1 
  })
  fetchData()
}

const clearFilters = () => {
  search.value = ''
  filters.hasError = null
  filters.method = null
  filters.startDate = ''
  filters.endDate = ''
  fetchData()
}

const viewLogDetail = (log) => {
  detailDialog.log = log
  detailDialog.show = true
}

const viewProduct = (product) => {
  if (product) {
    router.push(`/products/${product._id}`)
  }
}

const deleteLog = (log) => {
  deleteDialog.log = log
  deleteDialog.show = true
}

const confirmDelete = async () => {
  deleteDialog.loading = true
  try {
    await inventoryStore.deleteLog(deleteDialog.log._id)
    uiStore.showSuccess('盤點記錄已刪除')
    deleteDialog.show = false
    fetchData()
  } catch (error) {
    console.error('刪除記錄失敗:', error)
    uiStore.showError('刪除記錄失敗')
  } finally {
    deleteDialog.loading = false
  }
}

const exportLogs = async () => {
  try {
    const params = {
      search: search.value || undefined,
      hasError: filters.hasError,
      method: filters.method || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined
    }
    
    const blob = await inventoryStore.exportLogs(params)
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventory_logs_${moment().format('YYYY-MM-DD_HH-mm')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    uiStore.showSuccess('盤點記錄已匯出')
  } catch (error) {
    console.error('匯出記錄失敗:', error)
    uiStore.showError('匯出記錄失敗')
  }
}

// Helper functions for product display
const getProductDisplayName = (product) => {
  if (!product) return 'N/A'
  
  // 如果是變體商品且有主商品信息，優先使用主商品名稱
  if (product.type === 'variation' && product.parentId?.name) {
    return product.parentId.name
  }
  
  // 如果是主商品或簡單商品，直接使用名稱
  if (product.type === 'variable' || product.type === 'simple') {
    return product.name
  }
  
  // 嘗試從SKU解析主商品名稱（備用方案）
  if (product.sku) {
    const mainProductName = parseMainProductFromSKU(product.sku)
    if (mainProductName) {
      return mainProductName
    }
  }
  
  // 使用WooCommerce數據
  if (product.wooData?.name) {
    return product.wooData.name
  }
  
  // 最後使用原始名稱
  return product.name || 'N/A'
}

const getVariationInfo = (product) => {
  if (!product) return ''
  
  // 只有變體商品才顯示變體信息
  if (product.type !== 'variation') return ''
  
  // 如果有屬性信息，顯示屬性
  if (product.attributes && product.attributes.length > 0) {
    const attributes = product.attributes
      .map(attr => `${attr.name}: ${attr.option}`)
      .join(', ')
    return `變體: ${attributes}`
  }
  
  // 如果有WooCommerce屬性信息
  if (product.wooData?.attributes && product.wooData.attributes.length > 0) {
    const attributes = product.wooData.attributes
      .map(attr => `${attr.name}: ${attr.option}`)
      .join(', ')
    return `變體: ${attributes}`
  }
  
  // 顯示變體商品的基本信息
  if (product.name) {
    return `變體: ${product.name}`
  }
  
  return ''
}

// 從SKU解析主商品名稱的函數（備用方案，很少用到）
const parseMainProductFromSKU = (sku) => {
  if (!sku) return null
  
  // 簡化的SKU解析邏輯
  const skuParts = sku.split('-')
  if (skuParts.length >= 2) {
    const mainParts = skuParts.slice(0, 2)
    return mainParts.join(' ').replace(/[\d]+/g, '').trim()
  }
  
  return null
}

// 頁面載入時獲取數據
onMounted(() => {
  // 確保分頁設定為每頁10個項目
  inventoryStore.setPagination({ 
    itemsPerPage: 10, 
    currentPage: 1 
  })
  fetchData()
})
</script>

<style scoped>
.v-data-table th {
  white-space: nowrap;
}
</style> 