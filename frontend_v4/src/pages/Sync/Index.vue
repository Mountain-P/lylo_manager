<template>
  <div>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">WooCommerce 同步管理</h1>
      </v-col>
    </v-row>

    <!-- 同步狀態卡片 -->
    <v-row class="mb-4">
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>
            <v-row align="center">
              <v-col>
                <v-icon start>mdi-sync</v-icon>
                同步狀態
              </v-col>
              <v-col cols="auto">
                <v-chip
                  :color="syncStatus.isRunning ? 'warning' : (syncStatus.status === 'success' ? 'success' : 'error')"
                  variant="flat"
                >
                  {{ getStatusText(syncStatus) }}
                </v-chip>
              </v-col>
            </v-row>
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6">
                <v-list density="compact">
                  <v-list-item>
                    <v-list-item-title>上次同步</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ syncStatus.lastSync ? formatDate(syncStatus.lastSync) : '尚未同步' }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  
                  <v-list-item>
                    <v-list-item-title>下次自動同步</v-list-item-title>
                    <v-list-item-subtitle>
                      {{ syncStatus.nextSync ? formatDate(syncStatus.nextSync) : '計算中...' }}
                    </v-list-item-subtitle>
                  </v-list-item>
                  
                  <v-list-item>
                    <v-list-item-title>同步週期</v-list-item-title>
                    <v-list-item-subtitle>每 {{ syncSettings.interval || 60 }} 分鐘</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-col cols="12" sm="6">
                <v-list density="compact">
                  <v-list-item>
                    <v-list-item-title>同步商品數</v-list-item-title>
                    <v-list-item-subtitle>{{ syncStatus.totalProducts || 0 }} 個</v-list-item-subtitle>
                  </v-list-item>
                  
                  <v-list-item>
                    <v-list-item-title>成功同步</v-list-item-title>
                    <v-list-item-subtitle>{{ syncStatus.successCount || 0 }} 個</v-list-item-subtitle>
                  </v-list-item>
                  
                  <v-list-item>
                    <v-list-item-title>同步失敗</v-list-item-title>
                    <v-list-item-subtitle>{{ syncStatus.errorCount || 0 }} 個</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>
            </v-row>
            
            <!-- 同步進度條 -->
            <div v-if="syncStatus.isRunning" class="mt-4">
              <div class="d-flex justify-space-between mb-2">
                <span class="text-body-2">同步進度</span>
                <span class="text-body-2">
                  {{ syncStatus.processedCount || 0 }} / {{ syncStatus.totalProducts || 0 }}
                </span>
              </div>
              <v-progress-linear
                :model-value="syncProgress"
                height="8"
                color="primary"
                rounded
              ></v-progress-linear>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="primary"
              :loading="syncLoading"
              :disabled="syncStatus.isRunning"
              @click="triggerSync"
            >
              <v-icon start>mdi-sync</v-icon>
              手動同步
            </v-btn>
            
            <v-btn
              variant="outlined"
              @click="refreshStatus"
              :loading="statusLoading"
            >
              <v-icon start>mdi-refresh</v-icon>
              重新整理
            </v-btn>
            
            <v-spacer></v-spacer>
            
            <v-btn
              variant="text"
              @click="openSettingsDialog"
            >
              <v-icon start>mdi-cog</v-icon>
              設定
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-chart-line</v-icon>
            同步統計
          </v-card-title>
          <v-card-text>
            <div class="text-center mb-4">
              <div class="text-h4 success--text">{{ syncStats.totalSyncs || 0 }}</div>
              <div class="text-caption">總同步次數</div>
            </div>
            
            <v-row>
              <v-col cols="6">
                <div class="text-center">
                  <div class="text-h6 primary--text">{{ syncStats.todaySyncs || 0 }}</div>
                  <div class="text-caption">今日同步</div>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="text-center">
                  <div class="text-h6 info--text">{{ syncStats.avgDuration || 0 }}s</div>
                  <div class="text-caption">平均耗時</div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 最近同步記錄 -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-row align="center">
              <v-col>
                <v-icon start>mdi-history</v-icon>
                同步記錄
              </v-col>
              <v-col cols="auto">
                <v-btn
                  variant="text"
                  size="small"
                  @click="exportSyncLogs"
                  :loading="exportLoading"
                >
                  <v-icon start>mdi-download</v-icon>
                  匯出記錄
                </v-btn>
              </v-col>
            </v-row>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="syncLogHeaders"
              :items="syncLogs"
              :loading="logsLoading"
              density="compact"
              :items-per-page="10"
            >
              <template #item.startedAt="{ item }">
                {{ formatDate(item.startedAt) }}
              </template>
              
              <template #item.status="{ item }">
                <v-chip
                  :color="getLogStatusColor(item.status)"
                  size="small"
                  variant="flat"
                >
                  {{ getLogStatusText(item.status) }}
                </v-chip>
              </template>
              
              <template #item.duration="{ item }">
                {{ item.duration ? `${item.duration}s` : '-' }}
              </template>
              
              <template #item.actions="{ item }">
                <v-btn
                  icon="mdi-eye"
                  size="small"
                  variant="text"
                  @click="viewSyncDetail(item)"
                ></v-btn>
              </template>
            </v-data-table>
            
            <div v-if="syncLogs.length === 0" class="text-center py-8">
              <v-icon size="48" color="grey-lighten-1">mdi-inbox</v-icon>
              <p class="text-body-1 mt-2">暫無同步記錄</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 同步設定 Dialog -->
    <v-dialog v-model="settingsDialog.show" max-width="500px">
      <v-card>
        <v-card-title>同步設定</v-card-title>
        <v-card-text>
          <v-form ref="settingsFormRef" v-model="settingsDialog.valid">
            <v-switch
              v-model="settingsDialog.settings.autoSync"
              label="啟用自動同步"
              color="primary"
              hide-details
              class="mb-4"
            ></v-switch>
            
            <v-text-field
              v-model.number="settingsDialog.settings.interval"
              :rules="intervalRules"
              label="同步間隔 (分鐘)"
              type="number"
              variant="outlined"
              :disabled="!settingsDialog.settings.autoSync"
            ></v-text-field>
            
            <v-switch
              v-model="settingsDialog.settings.syncImages"
              label="同步商品圖片"
              color="primary"
              hide-details
              class="mb-4"
            ></v-switch>
            
            <v-switch
              v-model="settingsDialog.settings.syncStock"
              label="同步庫存數量"
              color="primary"
              hide-details
              class="mb-4"
            ></v-switch>
            
            <v-switch
              v-model="settingsDialog.settings.syncPrice"
              label="同步價格資訊"
              color="primary"
              hide-details
              class="mb-4"
            ></v-switch>
            
            <v-text-field
              v-model="settingsDialog.settings.batchSize"
              :rules="batchSizeRules"
              label="批次處理大小"
              type="number"
              variant="outlined"
              hint="每次同步處理的商品數量"
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="settingsDialog.show = false">取消</v-btn>
          <v-btn 
            color="primary" 
            :loading="settingsDialog.loading"
            :disabled="!settingsDialog.valid"
            @click="saveSettings"
          >
            儲存設定
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 同步詳情 Dialog -->
    <v-dialog v-model="detailDialog.show" max-width="600px">
      <v-card v-if="detailDialog.log">
        <v-card-title>同步記錄詳情</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="6">
              <v-list density="compact">
                <v-list-item>
                  <v-list-item-title>開始時間</v-list-item-title>
                  <v-list-item-subtitle>{{ formatDate(detailDialog.log.startedAt) }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>結束時間</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ detailDialog.log.completedAt ? formatDate(detailDialog.log.completedAt) : '未完成' }}
                  </v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>耗時</v-list-item-title>
                  <v-list-item-subtitle>{{ detailDialog.log.duration || 0 }} 秒</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
            <v-col cols="6">
              <v-list density="compact">
                <v-list-item>
                  <v-list-item-title>同步類型</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ detailDialog.log.type === 'manual' ? '手動同步' : '自動同步' }}
                  </v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>處理商品</v-list-item-title>
                  <v-list-item-subtitle>{{ detailDialog.log.processedCount || 0 }} 個</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>成功/失敗</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ detailDialog.log.successCount || 0 }} / {{ detailDialog.log.errorCount || 0 }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>
          
          <v-divider class="my-4"></v-divider>
          
          <div v-if="detailDialog.log.errors && detailDialog.log.errors.length > 0">
            <div class="text-subtitle-2 mb-2">錯誤訊息</div>
            <v-alert
              v-for="(error, index) in detailDialog.log.errors"
              :key="index"
              type="error"
              variant="outlined"
              class="mb-2"
            >
              {{ error.message }}
              <div class="text-caption mt-1">商品: {{ error.productName }}</div>
            </v-alert>
          </div>
          
          <div v-if="detailDialog.log.summary">
            <div class="text-subtitle-2 mb-2">同步摘要</div>
            <v-card variant="outlined">
              <v-card-text>
                <v-row>
                  <v-col cols="6">
                    <div class="text-center">
                      <div class="text-h6 primary--text">{{ detailDialog.log.summary.newProducts || 0 }}</div>
                      <div class="text-caption">新增商品</div>
                    </div>
                  </v-col>
                  <v-col cols="6">
                    <div class="text-center">
                      <div class="text-h6 warning--text">{{ detailDialog.log.summary.updatedProducts || 0 }}</div>
                      <div class="text-caption">更新商品</div>
                    </div>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="detailDialog.show = false">關閉</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import moment from 'moment'
import { useUIStore } from '@/stores/ui'
import api from '@/plugins/axios'

// Stores
const uiStore = useUIStore()

// Reactive data
const syncStatus = ref({
  isRunning: false,
  lastSync: null,
  nextSync: null,
  status: 'idle',
  totalProducts: 0,
  processedCount: 0,
  successCount: 0,
  errorCount: 0
})

const syncStats = ref({
  totalSyncs: 0,
  todaySyncs: 0,
  avgDuration: 0
})

const syncSettings = ref({
  autoSync: true,
  interval: 60,
  syncImages: true,
  syncStock: true,
  syncPrice: true,
  batchSize: 50
})

const syncLogs = ref([])
const logsLoading = ref(false)
const syncLoading = ref(false)
const statusLoading = ref(false)
const exportLoading = ref(false)

let statusInterval = null

const settingsDialog = reactive({
  show: false,
  loading: false,
  valid: false,
  settings: {
    autoSync: true,
    interval: 60,
    syncImages: true,
    syncStock: true,
    syncPrice: true,
    batchSize: 50
  }
})

const detailDialog = reactive({
  show: false,
  log: null
})

const settingsFormRef = ref()

const syncLogHeaders = [
  { title: '開始時間', key: 'startedAt', width: '140px' },
  { title: '類型', key: 'type', width: '80px' },
  { title: '狀態', key: 'status', width: '100px' },
  { title: '處理數量', key: 'processedCount', width: '100px' },
  { title: '成功/失敗', key: 'results', width: '120px' },
  { title: '耗時', key: 'duration', width: '80px' },
  { title: '操作', key: 'actions', sortable: false, width: '80px' }
]

// Validation rules
const intervalRules = [
  v => !!v || '請輸入同步間隔',
  v => v >= 5 || '同步間隔不能少於5分鐘',
  v => v <= 1440 || '同步間隔不能超過24小時'
]

const batchSizeRules = [
  v => !!v || '請輸入批次大小',
  v => v >= 10 || '批次大小不能少於10',
  v => v <= 500 || '批次大小不能超過500'
]

// Computed
const syncProgress = computed(() => {
  if (!syncStatus.value.totalProducts || syncStatus.value.totalProducts === 0) return 0
  return Math.round((syncStatus.value.processedCount / syncStatus.value.totalProducts) * 100)
})

// Methods
const formatDate = (date) => {
  return moment(date).format('YYYY/MM/DD HH:mm:ss')
}

const getStatusText = (status) => {
  if (status.isRunning) return '同步中'
  
  switch (status.status) {
    case 'success': return '同步成功'
    case 'error': return '同步失敗'
    case 'partial': return '部分成功'
    default: return '待同步'
  }
}

const getLogStatusColor = (status) => {
  switch (status) {
    case 'running': return 'warning'
    case 'success': return 'success'
    case 'error': return 'error'
    case 'partial': return 'orange'
    default: return 'grey'
  }
}

const getLogStatusText = (status) => {
  switch (status) {
    case 'running': return '進行中'
    case 'success': return '成功'
    case 'error': return '失敗'
    case 'partial': return '部分成功'
    default: return '未知'
  }
}

const fetchSyncStatus = async () => {
  try {
    const response = await api.get('/sync/status')
    syncStatus.value = response.data
  } catch (error) {
    console.error('獲取同步狀態失敗:', error)
  }
}

const fetchSyncStats = async () => {
  try {
    const response = await api.get('/sync/stats')
    syncStats.value = response.data
  } catch (error) {
    console.error('獲取同步統計失敗:', error)
  }
}

const fetchSyncSettings = async () => {
  try {
    const response = await api.get('/sync/settings')
    syncSettings.value = response.data
  } catch (error) {
    console.error('獲取同步設定失敗:', error)
  }
}

const fetchSyncLogs = async () => {
  try {
    logsLoading.value = true
    const response = await api.get('/sync/logs', {
      params: { limit: 20 }
    })
    syncLogs.value = response.data.logs || []
  } catch (error) {
    console.error('獲取同步記錄失敗:', error)
    uiStore.showError('獲取同步記錄失敗')
  } finally {
    logsLoading.value = false
  }
}

const refreshStatus = async () => {
  statusLoading.value = true
  try {
    await Promise.all([
      fetchSyncStatus(),
      fetchSyncStats(),
      fetchSyncLogs()
    ])
  } finally {
    statusLoading.value = false
  }
}

const triggerSync = async () => {
  syncLoading.value = true
  try {
    await api.post('/sync/manual')
    uiStore.showSuccess('同步已開始，請稍候...')
    
    // 立即更新狀態
    await fetchSyncStatus()
  } catch (error) {
    console.error('觸發同步失敗:', error)
    uiStore.showError('觸發同步失敗')
  } finally {
    syncLoading.value = false
  }
}

const openSettingsDialog = () => {
  settingsDialog.settings = { ...syncSettings.value }
  settingsDialog.show = true
}

const saveSettings = async () => {
  const { valid } = await settingsFormRef.value.validate()
  if (!valid) return

  settingsDialog.loading = true
  try {
    await api.put('/sync/settings', settingsDialog.settings)
    syncSettings.value = { ...settingsDialog.settings }
    
    uiStore.showSuccess('同步設定已儲存')
    settingsDialog.show = false
    
    // 重新載入狀態
    await fetchSyncStatus()
  } catch (error) {
    console.error('儲存設定失敗:', error)
    uiStore.showError('儲存設定失敗')
  } finally {
    settingsDialog.loading = false
  }
}

const viewSyncDetail = (log) => {
  detailDialog.log = log
  detailDialog.show = true
}

const exportSyncLogs = async () => {
  try {
    exportLoading.value = true
    
    const response = await api.get('/sync/logs/export', {
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `sync_logs_${moment().format('YYYY-MM-DD_HH-mm')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    uiStore.showSuccess('同步記錄已匯出')
  } catch (error) {
    console.error('匯出記錄失敗:', error)
    uiStore.showError('匯出記錄失敗')
  } finally {
    exportLoading.value = false
  }
}

// 頁面載入時獲取數據並開始輪詢
onMounted(async () => {
  await Promise.all([
    fetchSyncStatus(),
    fetchSyncStats(),
    fetchSyncSettings(),
    fetchSyncLogs()
  ])
  
  // 如果正在同步，開始輪詢狀態更新
  if (syncStatus.value.isRunning) {
    statusInterval = setInterval(fetchSyncStatus, 3000)
  }
})

// 清理輪詢
onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})

// 監聽同步狀態變化來控制輪詢
const handleSyncStatusChange = () => {
  if (syncStatus.value.isRunning && !statusInterval) {
    statusInterval = setInterval(fetchSyncStatus, 3000)
  } else if (!syncStatus.value.isRunning && statusInterval) {
    clearInterval(statusInterval)
    statusInterval = null
    // 同步完成後重新載入相關數據
    fetchSyncStats()
    fetchSyncLogs()
  }
}

// 監聽同步狀態變化
const prevRunning = ref(syncStatus.value.isRunning)
const checkSyncStatusChange = () => {
  if (prevRunning.value !== syncStatus.value.isRunning) {
    handleSyncStatusChange()
    prevRunning.value = syncStatus.value.isRunning
  }
}

// 在每次狀態更新後檢查
const originalFetchSyncStatus = fetchSyncStatus
fetchSyncStatus = async () => {
  await originalFetchSyncStatus()
  checkSyncStatusChange()
}
</script>

<style scoped>
.v-progress-linear {
  border-radius: 4px;
}
</style> 