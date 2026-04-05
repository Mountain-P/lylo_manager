<template>
  <div>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">系統儀表板</h1>
      </v-col>
    </v-row>

    <!-- 統計卡片 -->
    <v-row>
      <v-col cols="6" sm="6" md="3">
        <v-card color="primary" dark class="stat-card" @click="$router.push('/products')">
          <v-card-text>
            <v-icon size="28" class="mb-1">mdi-package-variant</v-icon>
            <div class="text-body-2">商品總數</div>
            <div class="text-h4 font-weight-bold">{{ stats.stats?.totalProducts || 0 }}</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="6" sm="6" md="3">
        <v-card color="success" dark class="stat-card" @click="$router.push('/inventory')">
          <v-card-text>
            <v-icon size="28" class="mb-1">mdi-check-circle</v-icon>
            <div class="text-body-2">已盤點</div>
            <div class="text-h4 font-weight-bold">{{ latestTaskSummary.countedProducts }}</div>
            <v-progress-linear
              v-if="latestTaskCompletionRate > 0"
              :model-value="latestTaskCompletionRate"
              color="white"
              bg-color="rgba(255,255,255,0.3)"
              height="4"
              rounded
              class="mt-2"
            ></v-progress-linear>
            <div class="text-caption mt-1" v-if="latestTaskSummary.totalProducts > 0">
              {{ latestTaskCompletionRate }}% · {{ latestTaskSummary.countedProducts }}/{{ latestTaskSummary.totalProducts }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="6" sm="6" md="3">
        <v-card color="error" dark class="stat-card" @click="$router.push('/inventory')">
          <v-card-text>
            <v-icon size="28" class="mb-1">mdi-alert-circle</v-icon>
            <div class="text-body-2">異常商品</div>
            <div class="text-h4 font-weight-bold">{{ latestTaskSummary.errorProducts }}</div>
            <div class="text-caption mt-1" v-if="latestTaskDate">最近盤點：{{ latestTaskDate }}</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="6" sm="6" md="3">
        <v-card color="info" dark class="stat-card" @click="$router.push('/inventory/logs')">
          <v-card-text>
            <v-icon size="28" class="mb-1">mdi-counter</v-icon>
            <div class="text-body-2">今日盤點</div>
            <div class="text-h4 font-weight-bold">{{ stats.overallStats?.todayLogs || 0 }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 快速操作 -->
    <v-row class="mt-2">
      <v-col cols="12" sm="6" md="4">
        <v-card variant="outlined" @click="$router.push('/inventory/scan')" class="action-card">
          <v-card-text class="text-center py-5">
            <v-icon size="48" color="primary" class="mb-2">mdi-barcode-scan</v-icon>
            <div class="text-h6">條碼盤點</div>
            <div class="text-body-2 text-grey">使用條碼掃描器快速盤點</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-card variant="outlined" @click="$router.push('/products')" class="action-card">
          <v-card-text class="text-center py-5">
            <v-icon size="48" color="success" class="mb-2">mdi-clipboard-list</v-icon>
            <div class="text-h6">商品清單</div>
            <div class="text-body-2 text-grey">查看和管理所有商品</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4" v-if="authStore.isBoss">
        <v-card variant="outlined" @click="$router.push('/sync')" class="action-card">
          <v-card-text class="text-center py-5">
            <v-icon size="48" color="warning" class="mb-2">mdi-sync</v-icon>
            <div class="text-h6">WooCommerce 同步</div>
            <div class="text-body-2 text-grey">管理商品同步設定</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 庫存警告 + 異常 Top 5 -->
    <v-row class="mt-2">
      <!-- 異常商品 Top 5（基於最近盤點任務快照） -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon start color="error">mdi-alert</v-icon>
            盤點異常 Top 5
            <v-chip v-if="topErrors.length" size="small" color="error" variant="tonal" class="ml-2">
              {{ latestTaskSummary.errorProducts }} 異常
            </v-chip>
            <v-chip v-if="latestTaskDate" size="x-small" variant="tonal" class="ml-1">
              {{ latestTaskDate }}
            </v-chip>
          </v-card-title>
          <v-card-text>
            <v-list v-if="topErrors.length" density="compact">
              <v-list-item
                v-for="(item, index) in topErrors"
                :key="item.productId"
                class="rounded mb-1"
              >
                <template #prepend>
                  <v-avatar size="32" :color="index < 3 ? 'error' : 'warning'" class="mr-3">
                    <span class="text-caption font-weight-bold white--text">{{ index + 1 }}</span>
                  </v-avatar>
                </template>
                <v-list-item-title class="text-body-2">
                  {{ item.product?.displayName || item.product?.name || '(未知商品)' }}
                  <span v-if="item.product?.variantLabel" class="text-caption text-grey ml-1">{{ item.product.variantLabel }}</span>
                </v-list-item-title>
                <v-list-item-subtitle>
                  當下庫存: {{ item.snapshotStockQty }} / 盤點: {{ item.countedQty }}
                </v-list-item-subtitle>
                <template #append>
                  <v-chip size="small" color="error" variant="flat">
                    差 {{ item.diffQty > 0 ? '+' : '' }}{{ item.diffQty }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center py-4 text-grey">
              <v-icon size="36" class="mb-2">mdi-check-circle-outline</v-icon>
              <div>目前沒有異常商品</div>
            </div>
          </v-card-text>
          <v-card-actions v-if="topErrors.length">
            <v-spacer></v-spacer>
            <v-btn variant="text" size="small" @click="$router.push('/inventory')">
              查看盤點管理
              <v-icon end>mdi-arrow-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- 低庫存警告 -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon start color="warning">mdi-package-variant-remove</v-icon>
            低庫存 / 零庫存商品
            <v-chip v-if="lowStockProducts.length" size="small" color="warning" variant="tonal" class="ml-2">
              {{ lowStockProducts.length }}
            </v-chip>
          </v-card-title>
          <v-card-text>
            <v-list v-if="lowStockProducts.length" density="compact">
              <v-list-item
                v-for="item in lowStockProducts.slice(0, 5)"
                :key="item._id"
                @click="$router.push(`/products/${item._id}`)"
                class="rounded mb-1"
              >
                <template #prepend>
                  <v-avatar size="32" class="mr-3">
                    <img
                      :src="item.wooData?.images?.[0]?.src || '/placeholder.png'"
                      :alt="item.name"
                    >
                  </v-avatar>
                </template>
                <v-list-item-title class="text-body-2">{{ item.name }}</v-list-item-title>
                <v-list-item-subtitle>SKU: {{ item.sku }}</v-list-item-subtitle>
                <template #append>
                  <v-chip
                    size="small"
                    :color="item.stockQty === 0 ? 'error' : 'warning'"
                    variant="flat"
                  >
                    庫存 {{ item.stockQty }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center py-4 text-grey">
              <v-icon size="36" class="mb-2">mdi-package-check</v-icon>
              <div>所有商品庫存充足</div>
            </div>
          </v-card-text>
          <v-card-actions v-if="lowStockProducts.length > 5">
            <v-spacer></v-spacer>
            <v-btn variant="text" size="small" @click="$router.push('/products?sort=stockQty_asc&inStock=false')">
              查看全部
              <v-icon end>mdi-arrow-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- 最近活動 + 同步狀態 -->
    <v-row class="mt-2">
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-history</v-icon>
            最近盤點記錄
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="logHeaders"
              :items="recentLogs"
              :loading="loading"
              hide-default-footer
              :items-per-page="5"
              density="compact"
            >
              <template #item.productName="{ item }">
                <div class="d-flex align-center">
                  <v-avatar size="28" rounded="lg" class="mr-2" color="grey-lighten-3">
                    <v-img
                      v-if="getProductImage(item.productId)"
                      :src="getProductImage(item.productId)"
                      cover
                    />
                    <v-icon v-else size="16" color="grey">mdi-package-variant-closed</v-icon>
                  </v-avatar>
                  <div style="min-width: 0;">
                    <div class="font-weight-medium text-truncate" style="max-width: 200px;">
                      {{ getProductDisplayName(item.productId) }}
                    </div>
                    <div class="text-caption text-grey" v-if="getVariationLabel(item.productId)">
                      {{ getVariationLabel(item.productId) }}
                    </div>
                  </div>
                </div>
              </template>

              <template #item.userId="{ item }">
                <span class="text-caption">{{ item.userId?.name || '-' }}</span>
              </template>

              <template #item.countedQty="{ item }">
                <v-chip size="small" color="blue" variant="flat">
                  {{ item.countedQty }}
                </v-chip>
              </template>

              <template #item.createdAt="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>

              <template #item.diffQty="{ item }">
                <v-chip
                  :color="item.diffQty === 0 ? 'success' : 'error'"
                  size="small"
                  variant="flat"
                >
                  {{ item.diffQty === 0 ? '正常' : `差異 ${item.diffQty}` }}
                </v-chip>
              </template>
            </v-data-table>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="$router.push('/inventory/logs')">
              查看所有記錄
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>
            <v-icon start>mdi-sync</v-icon>
            同步狀態
          </v-card-title>
          <v-card-text>
            <div class="mb-2">
              <strong>上次同步:</strong><br>
              {{ syncStatusData.lastSync ? formatDate(syncStatusData.lastSync) : '未同步' }}
            </div>
            <div class="mb-2">
              <strong>狀態:</strong>
              <v-chip
                :color="syncStatusData.isRunning ? 'warning' : 'success'"
                size="small"
                class="ml-2"
              >
                {{ syncStatusData.isRunning ? '同步中' : '正常' }}
              </v-chip>
            </div>
            <div class="mb-2">
              <strong>下次同步:</strong><br>
              {{ syncStatusData.nextSync ? formatDate(syncStatusData.nextSync) : '計算中' }}
            </div>
          </v-card-text>
          <v-card-actions v-if="authStore.isBoss">
            <v-btn
              color="primary"
              size="small"
              @click="triggerSync"
              :loading="syncLoading"
            >
              手動同步
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import moment from 'moment'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useProductsStore } from '@/stores/products'
import { useInventoryStore } from '@/stores/inventory'
import api from '@/plugins/axios'

// Stores
const authStore = useAuthStore()
const uiStore = useUIStore()
const productsStore = useProductsStore()
const inventoryStore = useInventoryStore()

// Reactive data
const loading = ref(false)
const syncLoading = ref(false)
const stats = ref({})
const recentLogs = ref([])
const syncStatusData = ref({
  lastSync: null,
  isRunning: false,
  nextSync: null
})
const topErrors = ref([])
const lowStockProducts = ref([])
const latestTask = ref(null)

const logHeaders = [
  { title: '商品名稱', key: 'productName' },
  { title: '盤點人', key: 'userId' },
  { title: '數量', key: 'countedQty' },
  { title: '狀態', key: 'diffQty' },
  { title: '時間', key: 'createdAt' }
]

// Computed
const latestTaskSummary = computed(() => latestTask.value?.summary || {
  totalProducts: 0, countedProducts: 0, errorProducts: 0, completionRate: 0
})
const latestTaskCompletionRate = computed(() => latestTaskSummary.value.completionRate || 0)
const latestTaskDate = computed(() => latestTask.value ? moment(latestTask.value.date).format('MM/DD') : '')

// Methods
const formatDate = (date) => {
  return moment(date).format('MM/DD HH:mm')
}

const getProductDisplayName = (product) => {
  if (!product) return 'N/A'
  if (product.type === 'variation' && product.parentId?.name) {
    return product.parentId.name
  }
  if (product.type === 'variable' || product.type === 'simple') {
    return product.name
  }
  return product.name || 'N/A'
}

const getVariationLabel = (product) => {
  if (!product || product.type !== 'variation') return ''
  const attrs = (product.attributes || [])
    .filter(a => a.option && a.name !== '貨況')
    .map(a => a.option)
  return attrs.length ? attrs.join(' / ') : ''
}

const getProductImage = (product) => {
  if (!product) return null
  if (product.wooData?.images?.[0]?.src) return product.wooData.images[0].src
  if (product.parentId?.wooData?.images?.[0]?.src) return product.parentId.wooData.images[0].src
  return null
}

const fetchDashboardData = async () => {
  loading.value = true
  try {
    const [productsStats, inventoryStats] = await Promise.all([
      api.get('/products/stats'),
      inventoryStore.getStats().catch(() => ({})),
      inventoryStore.fetchSyncStatus().catch(() => ({}))
    ])

    stats.value = {
      ...productsStats.data,
      ...inventoryStats
    }

    syncStatusData.value = inventoryStore.syncStatus

    // 取得最近盤點記錄
    await inventoryStore.fetchLogs({ limit: 5 })
    recentLogs.value = inventoryStore.logs

    // 取得最近盤點任務的統計與異常 Top 5（基於快照）
    try {
      const taskRes = await api.get('/inventory-tasks', { params: { limit: 1 } })
      const tasks = taskRes.data.tasks || []
      if (tasks.length > 0) {
        latestTask.value = tasks[0]
        const snapshotRes = await api.get(`/inventory-tasks/${tasks[0]._id}/snapshot`, {
          params: { status: 'error', limit: 100 }
        })
        const errorItems = snapshotRes.data.snapshot || []
        topErrors.value = errorItems
          .sort((a, b) => Math.abs(b.diffQty) - Math.abs(a.diffQty))
          .slice(0, 5)
      }
    } catch (e) {
      topErrors.value = []
    }

    // 取得低庫存商品（庫存 <= 5 的商品）
    try {
      const lowStockRes = await api.get('/products', {
        params: { sortBy: 'stockQty_asc', inStockOnly: false, limit: 10 }
      })
      lowStockProducts.value = (lowStockRes.data.products || [])
        .filter(p => p.stockQty <= 5 && p.type !== 'variable')
    } catch (e) {
      lowStockProducts.value = []
    }

  } catch (error) {
    console.error('Dashboard數據獲取失敗:', error)
  } finally {
    loading.value = false
  }
}

const triggerSync = async () => {
  try {
    syncLoading.value = true
    await inventoryStore.triggerManualSync()
    syncStatusData.value = inventoryStore.syncStatus
    uiStore.showSuccess('同步已觸發')
  } catch (error) {
    console.error('觸發同步失敗:', error)
    uiStore.showError('觸發同步失敗')
  } finally {
    syncLoading.value = false
  }
}

onMounted(async () => {
  await fetchDashboardData()
})
</script>

<style scoped>
.stat-card {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
}

.action-card {
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  height: 100%;
}

.action-card:hover {
  transform: translateY(-2px);
  border-color: rgb(var(--v-theme-primary)) !important;
}
</style>
