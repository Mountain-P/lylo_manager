<template>
  <div>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">盤點管理</h1>
      </v-col>
    </v-row>

    <!-- 統計概覽 -->
    <v-row class="mb-4">
      <v-col cols="6" md="3">
        <v-card color="primary" variant="flat" theme="dark" class="stat-card" @click="$router.push('/products')">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between mb-2">
              <v-icon size="32" class="stat-icon">mdi-package-variant</v-icon>
              <v-icon size="18" class="stat-arrow">mdi-arrow-right</v-icon>
            </div>
            <div class="text-h4 font-weight-bold">{{ stats.totalProducts || 0 }}</div>
            <div class="text-body-2 mt-1" style="opacity: 0.85">總商品數</div>
          </v-card-text>
        </v-card>
      </v-col>
      
      <v-col cols="6" md="3">
        <v-card color="success" variant="flat" theme="dark" class="stat-card" @click="viewCountedProducts">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between mb-2">
              <v-icon size="32" class="stat-icon">mdi-check-circle</v-icon>
              <v-icon size="18" class="stat-arrow">mdi-arrow-right</v-icon>
            </div>
            <div class="text-h4 font-weight-bold">{{ stats.countedProducts || 0 }}</div>
            <div class="text-body-2 mt-1" style="opacity: 0.85">已盤點</div>
          </v-card-text>
        </v-card>
      </v-col>
      
      <v-col cols="6" md="3">
        <v-card color="warning" variant="flat" theme="dark" class="stat-card" @click="viewUnCountedProducts">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between mb-2">
              <v-icon size="32" class="stat-icon">mdi-clock-alert-outline</v-icon>
              <v-icon size="18" class="stat-arrow">mdi-arrow-right</v-icon>
            </div>
            <div class="text-h4 font-weight-bold">{{ (stats.totalProducts || 0) - (stats.countedProducts || 0) }}</div>
            <div class="text-body-2 mt-1" style="opacity: 0.85">未盤點</div>
          </v-card-text>
        </v-card>
      </v-col>
      
      <v-col cols="6" md="3">
        <v-card color="error" variant="flat" theme="dark" class="stat-card" @click="viewErrorProducts">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between mb-2">
              <v-icon size="32" class="stat-icon">mdi-alert-circle</v-icon>
              <v-icon size="18" class="stat-arrow">mdi-arrow-right</v-icon>
            </div>
            <div class="text-h4 font-weight-bold">{{ stats.errorProducts || 0 }}</div>
            <div class="text-body-2 mt-1" style="opacity: 0.85">異常商品</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 進度條 -->
    <v-row class="mb-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>盤點進度</v-card-title>
          <v-card-text>
            <div class="mb-2">
              <span>{{ completionRate }}% 完成</span>
              <span class="float-right">
                {{ stats.countedProducts || 0 }} / {{ stats.totalProducts || 0 }} 商品
              </span>
            </div>
            <v-progress-linear
              :model-value="completionRate"
              height="20"
              color="success"
              bg-color="grey-lighten-3"
              rounded
            >
              <template v-slot:default="{ value }">
                <strong>{{ Math.ceil(value) }}%</strong>
              </template>
            </v-progress-linear>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 進行中的盤點任務 -->
    <v-row v-if="taskStore.hasActiveTask" class="mb-4">
      <v-col cols="12">
        <v-card color="primary" variant="tonal">
          <v-card-text>
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="d-flex align-center mb-1">
                  <v-icon class="mr-2">mdi-clipboard-clock</v-icon>
                  <span class="text-h6 font-weight-bold">盤點任務進行中</span>
                </div>
                <div class="text-body-2">
                  盤點日期：{{ formatTaskDate(taskStore.activeTask.date) }} ·
                  人員：{{ taskStore.activeTask.personnel?.map(p => p.name).join('、') }}
                  <span v-if="taskStore.activeTask.note"> · 備註：{{ taskStore.activeTask.note }}</span>
                </div>
              </div>
              <v-btn color="success" variant="flat" @click="completeActiveTask">
                <v-icon start>mdi-check</v-icon>
                完成盤點
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 盤點功能選項 -->
    <v-row class="mb-4">
      <v-col cols="12">
        <h2 class="text-h5 mb-3">盤點方式</h2>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <v-card class="h-100" variant="outlined">
          <v-card-text class="text-center pa-6">
            <v-icon size="64" color="primary" class="mb-4">mdi-barcode-scan</v-icon>
            <h3 class="text-h6 mb-2">條碼掃描盤點</h3>
            <p class="text-body-2 mb-4">
              使用手機或條碼掃描器快速掃描商品條碼進行盤點。
              支援批量掃描和即時盤點。
            </p>
            <div class="mb-4">
              <v-chip color="primary" size="small" class="mr-2">快速</v-chip>
              <v-chip color="success" size="small" class="mr-2">準確</v-chip>
              <v-chip color="info" size="small">推薦</v-chip>
            </div>
          </v-card-text>
          <v-card-actions class="pa-6 pt-0">
            <v-btn 
              color="primary" 
              size="large" 
              block 
              @click="startInventory('scan')"
            >
              開始掃描盤點
              <v-icon end>mdi-camera</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <v-col cols="12" md="6">
        <v-card class="h-100" variant="outlined">
          <v-card-text class="text-center pa-6">
            <v-icon size="64" color="secondary" class="mb-4">mdi-clipboard-text</v-icon>
            <h3 class="text-h6 mb-2">手動盤點</h3>
            <p class="text-body-2 mb-4">
              從商品列表中選擇商品進行手動盤點。
              適合小批量商品或特殊情況下的盤點。
            </p>
            <div class="mb-4">
              <v-chip color="secondary" size="small" class="mr-2">彈性</v-chip>
              <v-chip color="warning" size="small" class="mr-2">精確</v-chip>
              <v-chip color="grey" size="small">傳統</v-chip>
            </div>
          </v-card-text>
          <v-card-actions class="pa-6 pt-0">
            <v-btn 
              color="secondary" 
              size="large" 
              block 
              @click="startInventory('manual')"
            >
              前往商品列表
              <v-icon end>mdi-format-list-bulleted</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- 開始盤點 Dialog -->
    <v-dialog v-model="startDialog.show" max-width="540" persistent>
      <v-card>
        <v-card-title class="d-flex align-center pa-6" style="background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-primary-darken-1))); color: white;">
          <v-icon class="mr-2">mdi-clipboard-play</v-icon>
          開始盤點
        </v-card-title>
        <v-card-text class="pa-6">
          <v-text-field
            v-model="startDialog.date"
            label="盤點日期"
            type="date"
            variant="outlined"
            class="mb-4"
            prepend-inner-icon="mdi-calendar"
          ></v-text-field>

          <v-select
            v-model="startDialog.personnel"
            :items="availableUsers"
            item-title="name"
            item-value="_id"
            label="盤點人員"
            variant="outlined"
            multiple
            chips
            closable-chips
            prepend-inner-icon="mdi-account-group"
            class="mb-4"
            :rules="[v => v.length > 0 || '至少選擇一位盤點人員']"
          >
            <template #chip="{ item, props }">
              <v-chip v-bind="props" size="small" color="primary">
                {{ item.title }}
              </v-chip>
            </template>
          </v-select>

          <v-text-field
            v-model="startDialog.note"
            label="備註（選填）"
            variant="outlined"
            prepend-inner-icon="mdi-note-text"
          ></v-text-field>
        </v-card-text>
        <v-card-actions class="pa-6 pt-0">
          <v-btn variant="outlined" @click="startDialog.show = false" class="flex-grow-1 mr-2">
            取消
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            class="flex-grow-1"
            :loading="taskStore.loading"
            :disabled="!startDialog.personnel.length"
            @click="confirmStartInventory"
          >
            <v-icon start>mdi-play</v-icon>
            開始盤點
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 快速功能 -->
    <v-row class="mt-4">
      <v-col cols="12">
        <h2 class="text-h5 mb-3">快速功能</h2>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" sm="6" md="4">
        <v-card variant="outlined">
          <v-card-text class="text-center">
            <v-icon size="48" color="info" class="mb-2">mdi-history</v-icon>
            <div class="text-h6">盤點記錄</div>
            <div class="text-body-2">查看所有盤點歷史記錄</div>
          </v-card-text>
          <v-card-actions>
            <v-btn color="info" block @click="$router.push('/inventory/logs')">
              查看記錄
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="4">
        <v-card variant="outlined">
          <v-card-text class="text-center">
            <v-icon size="48" color="warning" class="mb-2">mdi-alert-circle</v-icon>
            <div class="text-h6">異常報告</div>
            <div class="text-body-2">查看盤點異常的商品</div>
          </v-card-text>
          <v-card-actions>
            <v-btn color="warning" block @click="generateReport">
              生成報告
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="4">
        <v-card variant="outlined">
          <v-card-text class="text-center">
            <v-icon size="48" color="success" class="mb-2">mdi-download</v-icon>
            <div class="text-h6">匯出數據</div>
            <div class="text-body-2">匯出盤點結果到 Excel</div>
          </v-card-text>
          <v-card-actions>
            <v-btn color="success" block @click="exportData" :loading="exportLoading">
              匯出數據
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- 最近盤點活動 -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-row align="center">
              <v-col>
                <v-icon start>mdi-clock-outline</v-icon>
                最近盤點活動
              </v-col>
              <v-col cols="auto">
                <v-btn
                  variant="text"
                  size="small"
                  @click="$router.push('/inventory/logs')"
                >
                  查看全部
                </v-btn>
              </v-col>
            </v-row>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="recentLogHeaders"
              :items="recentLogs"
              :loading="logsLoading"
              hide-default-footer
              :items-per-page="5"
              density="compact"
            >
              <template #item.createdAt="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>
              
              <template #item.product="{ item }">
                <div class="d-flex align-center">
                  <v-avatar size="24" class="mr-2">
                    <img 
                      :src="item.product?.wooData?.images?.[0]?.src || '/placeholder.png'" 
                      :alt="item.product?.name"
                    >
                  </v-avatar>
                  <span>{{ item.product?.name || 'N/A' }}</span>
                </div>
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
            </v-data-table>
            
            <div v-if="recentLogs.length === 0" class="text-center py-8">
              <v-icon size="48" color="grey-lighten-1">mdi-inbox</v-icon>
              <p class="text-body-1 mt-2">暫無盤點記錄</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import moment from 'moment'
import { useInventoryStore } from '@/stores/inventory'
import { useInventoryTaskStore } from '@/stores/inventoryTask'
import { useProductsStore } from '@/stores/products'
import { useUIStore } from '@/stores/ui'
import api from '@/plugins/axios'

const router = useRouter()

const inventoryStore = useInventoryStore()
const taskStore = useInventoryTaskStore()
const productsStore = useProductsStore()
const uiStore = useUIStore()

const availableUsers = ref([])
const startDialog = reactive({
  show: false,
  date: new Date().toISOString().split('T')[0],
  personnel: [],
  note: '',
  targetRoute: ''
})

const stats = ref({
  totalProducts: 0,
  countedProducts: 0,
  errorProducts: 0
})
const recentLogs = ref([])
const logsLoading = ref(false)
const exportLoading = ref(false)

const recentLogHeaders = [
  { title: '時間', key: 'createdAt', width: '140px' },
  { title: '商品', key: 'product', width: '200px' },
  { title: '數量', key: 'countedQty', width: '80px' },
  { title: '人員', key: 'user.name', width: '100px' },
  { title: '狀態', key: 'hasError', width: '80px' }
]

// Computed
const completionRate = computed(() => {
  if (stats.value.totalProducts === 0) return 0
  return Math.round((stats.value.countedProducts / stats.value.totalProducts) * 100)
})

// Methods
const formatDate = (date) => {
  return moment(date).format('MM/DD HH:mm')
}

const fetchStats = async () => {
  try {
    const [productsStats, inventoryStats] = await Promise.all([
      api.get('/products/stats'),
      api.get('/inventory/logs/stats')
    ])
    
    const pStats = productsStats.data?.stats || productsStats.data || {}
    const iStats = inventoryStats.data?.stats || inventoryStats.data || {}
    stats.value = { ...pStats, ...iStats }
  } catch (error) {
    console.error('獲取統計資料失敗:', error)
    uiStore.showError('獲取統計資料失敗')
  }
}

const fetchRecentLogs = async () => {
  try {
    logsLoading.value = true
    const response = await inventoryStore.fetchLogs({ limit: 5 })
    recentLogs.value = response.logs || []
  } catch (error) {
    console.error('獲取最近盤點記錄失敗:', error)
  } finally {
    logsLoading.value = false
  }
}

const viewCountedProducts = () => {
  // 導向商品列表，僅顯示已盤點的商品
  router.push('/products?counted=true')
}

const viewUnCountedProducts = () => {
  // 導向商品列表，僅顯示未盤點的商品
  router.push('/products?counted=false')
}

const viewErrorProducts = () => {
  // 導向商品列表，僅顯示異常商品
  router.push('/products?error=true')
}

const generateReport = async () => {
  try {
    uiStore.showInfo('正在生成異常報告...')
    
    // 獲取異常商品資料
    const response = await api.get('/products', {
      params: { errorOnly: true, limit: -1 }
    })
    
    if (response.data.products.length === 0) {
      uiStore.showInfo('目前沒有異常商品')
      return
    }
    
    // 生成 CSV 報告
    const csvContent = [
      ['商品名稱', 'SKU', '系統庫存', '盤點數量', '差異數量', '上次盤點時間'].join(','),
      ...response.data.products.map(product => [
        product.name,
        product.sku,
        product.stockQty,
        product.countedQty,
        product.diffQty,
        product.lastCountedAt ? moment(product.lastCountedAt).format('YYYY-MM-DD HH:mm:ss') : '未盤點'
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `inventory_error_report_${moment().format('YYYY-MM-DD_HH-mm')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    uiStore.showSuccess('異常報告已匯出')
  } catch (error) {
    console.error('生成報告失敗:', error)
    uiStore.showError('生成報告失敗')
  }
}

const exportData = async () => {
  try {
    exportLoading.value = true
    
    // 獲取所有商品資料
    const response = await api.get('/products', {
      params: { limit: 10000 }
    })
    
    // 生成 Excel 格式的 CSV
    const csvContent = [
      ['商品名稱', 'SKU', '商品類型', '系統庫存', '盤點數量', '差異數量', '狀態', '上次盤點時間', '盤點人員'].join(','),
      ...response.data.products.map(product => [
        product.name,
        product.sku,
        product.type === 'variable' ? '多型號' : '單一',
        product.stockQty,
        product.countedQty,
        product.diffQty,
        product.isCountError ? '異常' : '正常',
        product.lastCountedAt ? moment(product.lastCountedAt).format('YYYY-MM-DD HH:mm:ss') : '未盤點',
        product.lastCountedBy?.name || ''
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `inventory_data_${moment().format('YYYY-MM-DD_HH-mm')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    uiStore.showSuccess('盤點數據已匯出')
  } catch (error) {
    console.error('匯出數據失敗:', error)
    uiStore.showError('匯出數據失敗')
  } finally {
    exportLoading.value = false
  }
}

const formatTaskDate = (date) => {
  return moment(date).format('YYYY/MM/DD')
}

const startInventory = async (mode) => {
  if (taskStore.hasActiveTask) {
    router.push(mode === 'scan' ? '/inventory/scan' : '/products')
    return
  }
  startDialog.targetRoute = mode === 'scan' ? '/inventory/scan' : '/products'
  startDialog.date = new Date().toISOString().split('T')[0]
  startDialog.personnel = []
  startDialog.note = ''
  startDialog.show = true
}

const confirmStartInventory = async () => {
  try {
    await taskStore.createTask({
      date: startDialog.date,
      personnel: startDialog.personnel,
      note: startDialog.note
    })
    uiStore.showSuccess('盤點任務已建立')
    startDialog.show = false
    router.push(startDialog.targetRoute)
  } catch (error) {
    uiStore.showError('建立盤點任務失敗')
  }
}

const completeActiveTask = async () => {
  if (!taskStore.activeTask) return
  try {
    await taskStore.completeTask(taskStore.activeTask._id)
    uiStore.showSuccess('盤點任務已完成')
    await fetchStats()
  } catch (error) {
    uiStore.showError('完成盤點任務失敗')
  }
}

onMounted(async () => {
  const [, , users] = await Promise.all([
    fetchStats(),
    fetchRecentLogs(),
    taskStore.fetchActiveTask(),
    taskStore.fetchActiveUsers().then(u => { availableUsers.value = u })
  ])
})
</script>

<style scoped>
.h-100 {
  height: 100%;
}

.v-progress-linear {
  border-radius: 10px;
}

.stat-card {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-radius: 12px !important;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15) !important;
}

.stat-icon {
  opacity: 0.85;
}

.stat-arrow {
  opacity: 0.5;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.stat-card:hover .stat-arrow {
  opacity: 1;
  transform: translateX(2px);
}
</style> 