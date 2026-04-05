<template>
  <div>
    <v-row align="center" class="mb-2">
      <v-col>
        <h1 class="text-h4">商品管理</h1>
      </v-col>
      <v-col cols="auto" v-if="productsStore.pagination.totalItems > 0">
        <v-chip variant="tonal" color="primary" size="small">
          共 {{ productsStore.pagination.totalItems }} 件商品
        </v-chip>
      </v-col>
    </v-row>

    <v-card>
      <v-card-title class="pb-0">
        <v-row align="center">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="search"
              append-inner-icon="mdi-magnify"
              label="搜尋商品 (名稱, SKU, 條碼)"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @input="debouncedSearch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="8" class="text-right">
            <v-btn 
              color="primary" 
              @click="router.push('/inventory/scan')"
              class="mr-2"
            >
              <v-icon start>mdi-barcode-scan</v-icon>
              掃碼盤點
            </v-btn>
            <v-btn 
              color="success" 
              @click="refreshData" 
              :loading="loading"
            >
              <v-icon start>mdi-refresh</v-icon>
              重新整理
            </v-btn>
          </v-col>
        </v-row>
      </v-card-title>

      <v-card-text class="pt-2 pb-0">
        <v-row align="center" dense>
          <v-col cols="6" sm="4" md="3" lg="2">
            <v-switch
              v-model="hideDraft"
              label="隱藏草稿商品"
              :color="hideDraft ? 'warning' : 'grey'"
              density="compact"
              hide-details
              @change="onFilterChange"
            ></v-switch>
          </v-col>
          <v-col cols="6" sm="4" md="3" lg="2">
            <v-switch
              v-model="hidePreOrder"
              label="隱藏預購商品"
              :color="hidePreOrder ? 'orange' : 'grey'"
              density="compact"
              hide-details
              @change="onFilterChange"
            ></v-switch>
          </v-col>
          <v-col cols="6" sm="4" md="3" lg="2">
            <v-switch
              v-model="errorOnly"
              label="只顯示異常商品"
              :color="errorOnly ? 'error' : 'grey'"
              density="compact"
              hide-details
              @change="onFilterChange"
            ></v-switch>
          </v-col>
          <v-col cols="6" sm="4" md="3" lg="2">
            <v-switch
              v-model="inStockOnly"
              label="只顯示有庫存"
              :color="inStockOnly ? 'success' : 'grey'"
              density="compact"
              hide-details
              @change="onFilterChange"
            ></v-switch>
          </v-col>
          <v-col cols="12" sm="4" md="3" lg="3">
            <v-select
              v-model="selectedCategory"
              :items="categoryOptions"
              label="商品分類"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              multiple
              chips
              closable-chips
              @update:model-value="onFilterChange"
            >
              <template #prepend-inner>
                <v-icon size="small">mdi-tag-outline</v-icon>
              </template>
            </v-select>
          </v-col>
          <v-col cols="12" sm="6" md="3" lg="3">
            <v-select
              v-model="sortBy"
              :items="sortOptions"
              label="排序方式"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="onFilterChange"
            >
              <template #prepend-inner>
                <v-icon size="small">mdi-sort</v-icon>
              </template>
            </v-select>
          </v-col>
          <v-col v-if="hasActiveFilters" cols="auto">
            <v-chip
              color="primary"
              variant="tonal"
              size="small"
              closable
              @click:close="clearAllFilters"
            >
              <v-icon start size="small">mdi-filter</v-icon>
              {{ activeFilterCount }} 個篩選
            </v-chip>
          </v-col>
        </v-row>
      </v-card-text>

      <v-data-table-server
        :headers="headers"
        :items="productsStore.products"
        :loading="productsStore.loading"
        :items-length="productsStore.pagination.totalItems"
        :items-per-page="productsStore.pagination.itemsPerPage"
        :page="productsStore.pagination.currentPage"
        :item-class="getRowClass"
        v-model:expanded="expanded"
        item-value="_id"
        show-expand
        @update:page="handlePageChange"
        @update:items-per-page="handleItemsPerPageChange"
        @update:expanded="handleExpandChange"
        class="elevation-1"
        loading-text="正在載入商品資料..."
        no-data-text="找不到商品"
      >
        <template #item.image="{ item }">
          <v-avatar size="40" class="my-2">
            <img 
              :src="item.wooData?.images?.[0]?.src || '/placeholder.png'" 
              :alt="item.name"
            >
          </v-avatar>
        </template>
        
        <template #item.name="{ item }">
          <div style="min-width: 200px; max-width: 300px;">
            <div class="d-flex align-center">
              <div class="flex-grow-1">
                <div class="font-weight-bold text-truncate">{{ item.name }}</div>
                <div class="text-caption text-grey">{{ item.sku }}</div>
                <v-chip
                  v-if="item.type === 'variable'"
                  size="x-small"
                  color="info"
                  class="ml-1"
                >
                  多型號
                </v-chip>
                <v-chip
                  v-if="item.type === 'variable' && getVisibleVariations(item.variations).length"
                  size="x-small"
                  :color="getVariationProgress(item).color"
                  variant="tonal"
                  class="ml-1"
                >
                  已盤 {{ getVariationProgress(item).counted }}/{{ getVisibleVariations(item.variations).length }}
                </v-chip>
              </div>
            </div>
          </div>
        </template>
        
        <template #item.stockQty="{ item }">
          <v-chip size="small" color="blue" variant="flat">
            {{ item.stockQty }}
          </v-chip>
        </template>
        
        <template #item.countedQty="{ item }">
          <v-chip 
            size="small" 
            :color="item.lastCountedAt ? 'green' : 'grey'" 
            variant="flat"
          >
            {{ item.countedQty }}
          </v-chip>
        </template>
        
        <template #item.diffQty="{ item }">
          <v-chip
            v-if="item.isCountError"
            size="small"
            color="error"
            variant="flat"
          >
            {{ item.diffQty > 0 ? '+' : '' }}{{ item.diffQty }}
          </v-chip>
          <v-chip
            v-else
            size="small"
            color="success"
            variant="tonal"
          >
            0
          </v-chip>
        </template>

        <template #item.lastCountedAt="{ item }">
          <div v-if="item.lastCountedAt">
            <div class="text-body-2">{{ formatDate(item.lastCountedAt) }}</div>
            <div class="text-caption text-medium-emphasis">{{ item.lastCountedBy?.name || 'N/A' }}</div>
          </div>
          <v-chip v-else size="small" color="warning" variant="tonal">
            <v-icon start size="small">mdi-clock-alert-outline</v-icon>
            未盤點
          </v-chip>
        </template>
        
        <!-- 展開行模板 - 佔用整個表格寬度 -->
        <template #expanded-row="{ item }">
          <tr>
            <td :colspan="headers.length" class="pa-0">
              <v-expand-transition>
                <div class="expanded-content pa-4">
                  <!-- 載入中狀態 -->
                  <div v-if="loadingVariations[item._id]" class="text-center py-4">
                    <v-progress-circular indeterminate size="24" class="mr-2"></v-progress-circular>
                    正在載入商品型號...
                  </div>
                  
                  <!-- 沒有變體資料 -->
                  <div v-else-if="getVisibleVariations(item.variations).length === 0" class="text-center py-4 text-grey">
                    沒有找到型號資料
                  </div>
                  
                  <!-- 變體列表 -->
                  <div v-else>
                    <div class="d-flex justify-space-between align-center mb-3">
                      <h4 class="text-h6">商品型號清單 ({{ getVisibleVariations(item.variations).length }}個)</h4>
                      <v-btn 
                        icon="mdi-close" 
                        size="small" 
                        variant="text"
                        @click.stop="toggleItemExpansion(item)"
                      >
                      </v-btn>
                    </div>
                    
                    <v-table class="variation-table">
                      <thead>
                        <tr>
                          <th class="text-left">屬性組合</th>
                          <th class="text-left">系統庫存</th>
                          <th class="text-left">盤點數量</th>
                          <th class="text-left">差異數量</th>
                          <th class="text-left">狀態</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="variation in getVisibleVariations(item.variations)" :key="variation._id">
                          <td class="font-weight-medium">{{ formatAttributes(variation.attributes) }}</td>
                          <td>{{ variation.stockQty }}</td>
                          <td>{{ variation.countedQty }}</td>
                          <td :class="!variation.lastCountedAt ? 'text-grey' : ((variation.countedQty - variation.stockQty) !== 0 ? 'text-error font-weight-bold' : 'text-success')">
                            {{ !variation.lastCountedAt ? '-' : (((variation.countedQty - variation.stockQty) > 0 ? '+' : '') + (variation.countedQty - variation.stockQty)) }}
                          </td>
                          <td>
                            <v-chip 
                              :color="!variation.lastCountedAt ? 'grey' : (variation.countedQty !== variation.stockQty ? 'error' : 'success')" 
                              size="small"
                              variant="flat"
                            >
                              {{ !variation.lastCountedAt ? '未盤點' : (variation.countedQty !== variation.stockQty ? '有差異' : '正常') }}
                            </v-chip>
                          </td>
                        </tr>
                      </tbody>
                    </v-table>
                  </div>
                </div>
              </v-expand-transition>
            </td>
          </tr>
        </template>

        <!-- 操作按鈕模板 -->
        <template #item.actions="{ item }">
          <v-tooltip text="盤點" location="top">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-clipboard-check"
                size="small"
                variant="text"
                color="primary"
                @click.stop="openCountDialog(item)"
              ></v-btn>
            </template>
          </v-tooltip>
          <v-tooltip text="查看詳情" location="top">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-eye"
                size="small"
                variant="text"
                @click.stop="viewProduct(item)"
              ></v-btn>
            </template>
          </v-tooltip>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- 單一商品盤點 Dialog -->
    <v-dialog v-model="countDialog.show" max-width="480px">
      <v-card class="counting-dialog">
        <!-- 標題區域 -->
        <v-card-title class="dialog-header">
          <div class="text-center w-100">
            <v-icon color="primary" size="28" class="mb-2">mdi-clipboard-check</v-icon>
            <div class="text-h5 font-weight-bold">商品盤點</div>
          </div>
        </v-card-title>

        <v-card-text class="pa-6">
          <!-- 商品信息區域 -->
          <div class="product-info-section">
            <div class="text-center mb-4">
              <h3 class="product-name">{{ countDialog.product.name }}</h3>
              <v-chip size="small" color="info" class="mt-2">
                SKU: {{ countDialog.product.sku }}
              </v-chip>
            </div>

            <!-- 庫存信息 -->
            <div class="stock-info">
              <v-row class="text-center mb-4">
                <v-col cols="6">
                  <div class="info-card">
                    <div class="info-label">系統庫存</div>
                    <div class="info-value">{{ countDialog.product.stockQty || 0 }}</div>
                  </div>
                </v-col>
                <v-col cols="6">
                  <div class="info-card">
                    <div class="info-label">上次盤點</div>
                    <div class="info-value">{{ countDialog.product.countedQty || 0 }}</div>
                  </div>
                </v-col>
              </v-row>
            </div>

            <!-- 盤點數量控制區域 -->
            <div class="count-control-section">
              <div class="text-center mb-3">
                <div class="count-label">盤點數量</div>
              </div>
              
              <div class="count-control">
                <v-btn
                  icon
                  size="large"
                  color="error"
                  variant="outlined"
                  class="count-btn"
                  :disabled="countDialog.quantity <= 0"
                  @click="decreaseCount"
                >
                  <v-icon size="24">mdi-minus</v-icon>
                </v-btn>

                <div class="count-display">
                  <input
                    v-model="countDialog.quantity"
                    type="number"
                    min="0"
                    class="count-input"
                    @keyup.enter="submitCount"
                    @focus="$event.target.select()"
                  />
                </div>

                <v-btn
                  icon
                  size="large"
                  color="success"
                  variant="outlined"
                  class="count-btn"
                  @click="increaseCount"
                >
                  <v-icon size="24">mdi-plus</v-icon>
                </v-btn>
              </div>

              <!-- 快速數量按鈕 -->
              <div class="quick-buttons mt-4">
                <v-btn
                  v-for="num in [5, 10, 20, 50]"
                  :key="num"
                  size="small"
                  variant="tonal"
                  class="mr-2 mb-2"
                  @click="setQuickCount(num)"
                >
                  +{{ num }}
                </v-btn>
                <v-btn
                  size="small"
                  variant="tonal"
                  color="warning"
                  class="mb-2"
                  @click="setQuickCount(0)"
                >
                  清零
                </v-btn>
              </div>
            </div>
          </div>
        </v-card-text>

        <!-- 動作按鈕 -->
        <v-card-actions class="dialog-actions">
          <v-btn
            variant="outlined"
            size="large"
            class="flex-grow-1 mr-2"
            @click="closeCountDialog"
          >
            <v-icon left>mdi-close</v-icon>
            取消
          </v-btn>
          <v-btn 
            color="primary"
            size="large"
            class="flex-grow-1"
            :loading="countDialog.loading" 
            @click="submitCount"
          >
            <v-icon left>mdi-content-save</v-icon>
            確認盤點
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 多型號商品盤點 Dialog -->
    <v-dialog v-model="variationCountDialog.show" max-width="640px" scrollable>
      <v-card class="variation-counting-dialog">
        <!-- 標題區域 -->
        <v-card-title class="dialog-header">
          <div class="d-flex align-center w-100">
            <div class="flex-grow-1">
              <div class="text-h6 font-weight-bold">多型號商品盤點</div>
              <div class="text-body-2 mt-1" style="opacity: 0.85">{{ variationCountDialog.product.name }}</div>
            </div>
            <v-chip variant="elevated" color="white" text-color="primary" size="small">
              {{ variationCountDialog.variations.length }} 個型號
            </v-chip>
          </div>
        </v-card-title>

        <!-- 批量操作區域 -->
        <div class="batch-bar">
          <v-btn size="small" variant="tonal" color="default" @click="setBatchCount(0)">
            全部清零
          </v-btn>
          <v-btn size="small" variant="tonal" color="default" @click="setBatchCount(1)">
            全設為 1
          </v-btn>
          <v-btn size="small" variant="tonal" color="primary" @click="copyFromStock">
            <v-icon start size="16">mdi-content-copy</v-icon>
            複製庫存
          </v-btn>
          <v-btn size="small" variant="tonal" color="primary" @click="copyFromLastCount">
            <v-icon start size="16">mdi-history</v-icon>
            複製上次
          </v-btn>
        </div>

        <!-- 變體列表 -->
        <v-card-text class="pa-0 variation-scroll-area">
          <div
            v-for="(variation, index) in variationCountDialog.variations"
            :key="variation._id"
            class="variation-row"
          >
            <!-- 左側：型號資訊 -->
            <div class="variation-left">
              <div class="variation-sku">{{ formatAttributes(variation.attributes) }}</div>
              <div class="variation-meta">
                <span class="meta-tag meta-stock">庫存 {{ variation.stockQty || 0 }}</span>
                <span class="meta-tag meta-prev">上次 {{ variation.countedQty || 0 }}</span>
              </div>
            </div>

            <!-- 右側：數量控制 -->
            <div class="variation-right">
              <div class="var-counter">
                <v-btn
                  icon
                  size="36"
                  color="error"
                  variant="flat"
                  :disabled="(variation.newCountedQty || 0) <= 0"
                  @click="decreaseVariationCount(index)"
                >
                  <v-icon size="20">mdi-minus</v-icon>
                </v-btn>

                <input
                  v-model="variation.newCountedQty"
                  type="number"
                  min="0"
                  class="var-count-input"
                  @focus="$event.target.select()"
                />

                <v-btn
                  icon
                  size="36"
                  color="success"
                  variant="flat"
                  @click="increaseVariationCount(index)"
                >
                  <v-icon size="20">mdi-plus</v-icon>
                </v-btn>
              </div>
              <div class="var-quick-btns">
                <button
                  v-for="num in [0, 1, 5, 10, 20]"
                  :key="num"
                  class="quick-num-btn"
                  @click="setVariationCount(index, num)"
                >
                  {{ num === 0 ? '0' : num }}
                </button>
              </div>
            </div>
          </div>
        </v-card-text>

        <!-- 動作按鈕 -->
        <v-card-actions class="dialog-actions">
          <v-btn
            variant="outlined"
            size="large"
            class="flex-grow-1 mr-2"
            @click="closeVariationCountDialog"
          >
            取消
          </v-btn>
          <v-btn 
            color="primary"
            size="large"
            class="flex-grow-1"
            :loading="variationCountDialog.loading" 
            @click="submitVariationCount"
          >
            <v-icon start>mdi-content-save-all</v-icon>
            儲存全部 ({{ variationCountDialog.variations.length }})
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import moment from 'moment'
import _ from 'lodash'
import { useProductsStore } from '@/stores/products'
import { useInventoryStore } from '@/stores/inventory'
import { useUIStore } from '@/stores/ui'

// Composables
const router = useRouter()
const route = useRoute()

// Stores
const productsStore = useProductsStore()
const inventoryStore = useInventoryStore()
const uiStore = useUIStore()

// Reactive data
const search = ref('')
const errorOnly = ref(false)
const inStockOnly = ref(false)
const hideDraft = ref(true)
const hidePreOrder = ref(true)
const selectedCategory = ref([])
const sortBy = ref('wooCreatedAt_desc')
const expanded = ref([])
const loadingVariations = ref({})
const loading = computed(() => productsStore.loading)

const sortOptions = [
  { title: '更新時間（新→舊）', value: 'updatedAt_desc' },
  { title: '上架時間（新→舊）', value: 'wooCreatedAt_desc' },
  { title: '上架時間（舊→新）', value: 'wooCreatedAt_asc' },
  { title: '商品名稱（A→Z）', value: 'name_asc' },
  { title: '商品名稱（Z→A）', value: 'name_desc' },
  { title: '庫存數量（多→少）', value: 'stockQty_desc' },
  { title: '庫存數量（少→多）', value: 'stockQty_asc' },
  { title: '盤點時間（新→舊）', value: 'lastCountedAt_desc' },
  { title: '盤點時間（舊→新）', value: 'lastCountedAt_asc' },
  { title: '差異數量（大→小）', value: 'absDiffQty_desc' },
  { title: '未盤點優先', value: 'uncountedFirst' },
  { title: '商品價格（高→低）', value: 'price_desc' }
]

const categoryOptions = computed(() =>
  productsStore.categories.map(c => ({
    title: `${c.name} (${c.count})`,
    value: c.name
  }))
)

const activeFilterCount = computed(() => {
  let count = 0
  if (errorOnly.value) count++
  if (inStockOnly.value) count++
  if (!hideDraft.value) count++
  if (!hidePreOrder.value) count++
  if (selectedCategory.value?.length) count++
  if (sortBy.value !== 'wooCreatedAt_desc') count++
  return count
})

const hasActiveFilters = computed(() => activeFilterCount.value > 0)

const countDialog = reactive({
  show: false,
  loading: false,
  product: {},
  quantity: 0
})

const variationCountDialog = reactive({
  show: false,
  loading: false,
  product: {},
  variations: []
})


const headers = [
  { title: '圖片', key: 'image', sortable: false },
  { title: '商品名稱', key: 'name' },
  { title: '系統庫存', key: 'stockQty' },
  { title: '盤點數量', key: 'countedQty' },
  { title: '差異', key: 'diffQty' },
  { title: '上次盤點', key: 'lastCountedAt' },
  { title: '操作', key: 'actions', sortable: false }
]

// Methods
const formatDate = (date) => {
  return moment(date).format('YYYY/MM/DD HH:mm')
}

const formatAttributes = (attributes) => {
  if (!attributes || attributes.length === 0) return 'N/A'
  return attributes.map(attr => attr.option).join(', ')
}

const getRowClass = (item) => {
  return item.isCountError ? 'count-error-row' : ''
}

const isPreOrderVariation = (v) => {
  return v.attributes?.some(attr => attr.name === '貨況' && attr.option === 'pre-order')
}

const getVisibleVariations = (variations) => {
  if (!variations?.length) return []
  if (!hidePreOrder.value) return variations
  return variations.filter(v => !isPreOrderVariation(v))
}

const getVariationProgress = (item) => {
  const visible = getVisibleVariations(item.variations)
  if (!visible.length) return { counted: 0, color: 'grey' }
  const counted = visible.filter(v => v.lastCountedAt).length
  const total = visible.length
  if (counted === total) return { counted, color: 'success' }
  if (counted > 0) return { counted, color: 'warning' }
  return { counted, color: 'grey' }
}

const buildFilters = () => ({
  search: search.value,
  errorOnly: errorOnly.value,
  inStockOnly: inStockOnly.value,
  hideDraft: hideDraft.value,
  hidePreOrder: hidePreOrder.value,
  category: selectedCategory.value?.length ? selectedCategory.value.join(',') : '',
  sortBy: sortBy.value
})

// 將篩選條件同步到 URL
const syncFiltersToURL = () => {
  const query = {}
  if (search.value) query.search = search.value
  if (errorOnly.value) query.error = 'true'
  if (inStockOnly.value) query.inStock = 'true'
  if (!hideDraft.value) query.hideDraft = 'false'
  if (!hidePreOrder.value) query.hidePreOrder = 'false'
  if (selectedCategory.value?.length) query.category = selectedCategory.value.join(',')
  if (sortBy.value && sortBy.value !== 'wooCreatedAt_desc') query.sort = sortBy.value
  router.replace({ query }).catch(() => {})
}

// 從 URL 還原篩選條件
const restoreFiltersFromURL = () => {
  const q = route.query
  if (q.search) search.value = q.search
  if (q.error === 'true') errorOnly.value = true
  if (q.inStock === 'true') inStockOnly.value = true
  if (q.hideDraft === 'false') hideDraft.value = false
  if (q.hidePreOrder === 'false') hidePreOrder.value = false
  if (q.category) selectedCategory.value = q.category.split(',')
  if (q.sort) sortBy.value = q.sort
}

const debouncedSearch = _.debounce(async () => {
  syncFiltersToURL()
  await productsStore.changeFilters(buildFilters())
}, 500)

const onFilterChange = async () => {
  syncFiltersToURL()
  // Clear cached variations so they re-fetch with new hidePreOrder setting
  productsStore.products.forEach(p => {
    if (p.type === 'variable' && p.variations) {
      p.variations = null
    }
  })
  expanded.value = []
  await productsStore.changeFilters(buildFilters())
}

const clearAllFilters = async () => {
  errorOnly.value = false
  inStockOnly.value = false
  hideDraft.value = true
  hidePreOrder.value = true
  selectedCategory.value = []
  sortBy.value = 'wooCreatedAt_desc'
  syncFiltersToURL()
  await productsStore.changeFilters(buildFilters())
}

const fetchData = async () => {
  try {
    await productsStore.fetchProducts()
  } catch (error) {
    uiStore.showError('獲取商品列表失敗')
  }
}

const refreshData = async () => {
  await productsStore.refreshProducts()
}



// 盤點功能
const openCountDialog = async (product) => {
  if (product.type === 'variable') {
    // 如果是多型號商品
    if (!product.variations || product.variations.length === 0) {
      await productsStore.fetchVariations(product._id, { hidePreOrder: hidePreOrder.value })
    }
    
    const freshProduct = productsStore.products.find(p => p._id === product._id)
    variationCountDialog.product = freshProduct
    variationCountDialog.variations = _.cloneDeep(getVisibleVariations(freshProduct.variations)).map(v => ({
      ...v, 
      newCountedQty: v.countedQty
    }))
    variationCountDialog.show = true
  } else {
    // 如果是單一商品
    countDialog.product = product
    countDialog.quantity = product.countedQty
    countDialog.show = true
  }
}

const closeCountDialog = () => {
  countDialog.show = false
  countDialog.product = {}
}

const closeVariationCountDialog = () => {
  variationCountDialog.show = false
  variationCountDialog.product = {}
  variationCountDialog.variations = []
}

const submitCount = async () => {
  countDialog.loading = true
  try {
    await inventoryStore.countProduct({
      productId: countDialog.product._id,
      countedQty: countDialog.quantity,
    })
    
    uiStore.showSuccess('盤點完成')
    closeCountDialog()
    await refreshData() // Refresh data
  } catch (error) {
    console.error('盤點失敗:', error)
    uiStore.showError('盤點失敗')
  } finally {
    countDialog.loading = false
  }
}

// 新增的盤點數量控制函數
const increaseCount = () => {
  countDialog.quantity = parseInt(countDialog.quantity || 0) + 1
}

const decreaseCount = () => {
  const current = parseInt(countDialog.quantity || 0)
  if (current > 0) {
    countDialog.quantity = current - 1
  }
}

const setQuickCount = (num) => {
  if (num === 0) {
    countDialog.quantity = 0
  } else {
    countDialog.quantity = parseInt(countDialog.quantity || 0) + num
  }
}

const submitVariationCount = async () => {
  variationCountDialog.loading = true
  try {
    const counts = variationCountDialog.variations.map(v => ({
      productId: v._id,
      countedQty: parseInt(v.newCountedQty || 0, 10)
    }))
    
    await inventoryStore.batchCountProducts(counts)
    
    uiStore.showSuccess('批量盤點完成')
    closeVariationCountDialog()
    await refreshData()
  } catch (error) {
    console.error('批量盤點失敗:', error)
    uiStore.showError('批量盤點失敗')
  } finally {
    variationCountDialog.loading = false
  }
}

// 多型號商品盤點控制函數
const increaseVariationCount = (index) => {
  const current = parseInt(variationCountDialog.variations[index].newCountedQty || 0)
  variationCountDialog.variations[index].newCountedQty = current + 1
}

const decreaseVariationCount = (index) => {
  const current = parseInt(variationCountDialog.variations[index].newCountedQty || 0)
  if (current > 0) {
    variationCountDialog.variations[index].newCountedQty = current - 1
  }
}

const setVariationCount = (index, value) => {
  variationCountDialog.variations[index].newCountedQty = value
}

// 批量操作函數
const setBatchCount = (value) => {
  variationCountDialog.variations.forEach(variation => {
    variation.newCountedQty = value
  })
}

const copyFromStock = () => {
  variationCountDialog.variations.forEach(variation => {
    variation.newCountedQty = variation.stockQty || 0
  })
}

const copyFromLastCount = () => {
  variationCountDialog.variations.forEach(variation => {
    variation.newCountedQty = variation.countedQty || 0
  })
}

const viewProduct = (product) => {
  router.push(`/products/${product._id}`)
}

// 手動展開控制
const isItemExpanded = (item) => {
  return expanded.value.some(expandedItem => 
    (typeof expandedItem === 'string' ? expandedItem : expandedItem._id) === item._id
  )
}

const toggleItemExpansion = async (item) => {
  const isCurrentlyExpanded = isItemExpanded(item)
  
  if (isCurrentlyExpanded) {
    // 收合 - 從展開列表中移除
    expanded.value = expanded.value.filter(expandedItem => 
      (typeof expandedItem === 'string' ? expandedItem : expandedItem._id) !== item._id
    )
  } else {
    // 展開 - 添加到展開列表並觸發資料載入
    expanded.value.push(item)
  }
}

// 分頁事件處理
const handlePageChange = async (page) => {
  await productsStore.changePage(page)
}

const handleItemsPerPageChange = async (itemsPerPage) => {
  await productsStore.changeItemsPerPage(itemsPerPage)
}

const handleExpandChange = async (newExpanded) => {
  // 更新展開狀態
  expanded.value = newExpanded
  
  // 為所有展開的多型號商品載入變體資料（如果還沒載入）
  for (const item of newExpanded) {
    const productId = typeof item === 'string' ? item : item._id
    const product = productsStore.products.find(p => p._id === productId)
    
    if (product && product.type === 'variable' && (!product.variations || product.variations.length === 0)) {
      loadingVariations.value[product._id] = true
      
      try {
        const variations = await productsStore.fetchVariations(product._id, { hidePreOrder: hidePreOrder.value })
        
        if (variations && variations.length > 0) {
          product.variations = variations
        }
      } catch (error) {
        console.error('載入變體失敗:', error)
        uiStore.showError(`載入商品變體失敗: ${error.message}`)
      } finally {
        loadingVariations.value[product._id] = false
      }
    }
  }
}

// 初始化時從 URL 還原篩選條件
onMounted(async () => {
  restoreFiltersFromURL()

  productsStore.fetchCategories()

  await productsStore.changeFilters(buildFilters())
})
</script>

<style scoped>
.count-error-row {
  background-color: rgba(var(--v-theme-error), 0.1) !important;
}

.count-error-row:hover {
  background-color: rgba(var(--v-theme-error), 0.2) !important;
}

.v-table {
  background: transparent;
}

/* 展開內容樣式 - 適應主題 */
.expanded-content {
  background-color: rgb(var(--v-theme-surface));
  border-left: 4px solid rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-surface));
}

/* 變體表格樣式 - 適應主題 */
.variation-table {
  background-color: rgb(var(--v-theme-surface));
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgb(var(--v-theme-outline));
}

.variation-table th {
  background-color: rgb(var(--v-theme-surface-variant));
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-variant)) !important;
}

.variation-table td {
  color: rgb(var(--v-theme-on-surface)) !important;
  border-bottom: 1px solid rgb(var(--v-theme-outline));
}

.variation-table tbody tr:hover {
  background-color: rgb(var(--v-theme-surface-variant));
}

.variation-table tbody tr:hover td {
  color: rgb(var(--v-theme-on-surface-variant)) !important;
}

/* 商品名稱欄位固定寬度 */
.v-data-table .v-data-table__td:nth-child(2) {
  width: 280px;
  min-width: 280px;
  max-width: 280px;
}

/* 確保按鈕可以被點擊 */
.v-data-table .v-data-table__td:nth-child(2) .v-btn {
  z-index: 1001;
  pointer-events: all;
}

/* 盤點對話框樣式 */
.counting-dialog {
  border-radius: 16px !important;
  overflow: hidden;
}

.dialog-header {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-primary-darken-1)));
  color: white !important;
  padding: 24px !important;
}

.dialog-header .v-icon {
  color: white !important;
}

.product-name {
  color: rgb(var(--v-theme-on-surface));
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.3;
  margin: 0;
  word-break: break-word;
}

.info-card {
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgb(var(--v-theme-outline));
}

.info-label {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-variant));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.info-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

.count-label {
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 16px;
}

.count-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

.count-btn {
  min-width: 56px;
  height: 56px;
  border-width: 2px !important;
  border-radius: 50% !important;
}

.count-display {
  flex: 0 0 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.count-input {
  width: 100%;
  height: 60px;
  border: 3px solid rgb(var(--v-theme-primary));
  border-radius: 16px;
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-surface));
  outline: none;
  transition: all 0.3s ease;
}

.count-input:focus {
  border-color: rgb(var(--v-theme-primary-darken-1));
  box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), 0.2);
  transform: scale(1.02);
}

.quick-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.dialog-actions {
  padding: 20px 24px !important;
  background: rgb(var(--v-theme-surface-variant));
}

.dialog-actions .v-btn {
  height: 48px;
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
}

/* 響應式調整 */
@media (max-width: 480px) {
  .count-control {
    gap: 12px;
  }
  
  .count-display {
    flex: 0 0 100px;
  }
  
  .count-input {
    height: 50px;
    font-size: 1.5rem;
  }
  
  .count-btn {
    min-width: 48px;
    height: 48px;
  }
}

/* 多型號商品盤點對話框樣式 */
.variation-counting-dialog {
  border-radius: 16px !important;
  overflow: hidden;
}

.batch-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 20px;
  background: rgb(var(--v-theme-surface-variant));
  border-bottom: 1px solid rgb(var(--v-theme-outline));
}

.variation-scroll-area {
  max-height: 55vh;
  overflow-y: auto;
}

.variation-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--v-theme-outline));
  transition: background-color 0.15s ease;
}

.variation-row:last-child {
  border-bottom: none;
}

.variation-row:hover {
  background: rgba(var(--v-theme-primary), 0.03);
}

.variation-left {
  flex: 1;
  min-width: 0;
}

.variation-left .variation-sku {
  font-size: 0.9rem;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  letter-spacing: 0.3px;
}

.variation-left .variation-attr {
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.6;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.variation-meta {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.meta-tag {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
}

.meta-stock {
  background: rgba(var(--v-theme-info), 0.12);
  color: rgb(var(--v-theme-info));
}

.meta-prev {
  background: rgba(var(--v-theme-secondary), 0.12);
  color: rgb(var(--v-theme-secondary));
}

.variation-right {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.var-counter {
  display: flex;
  align-items: center;
  gap: 6px;
}

.var-count-input {
  width: 72px;
  height: 44px;
  border: 2px solid rgb(var(--v-theme-primary));
  border-radius: 10px;
  text-align: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-surface));
  outline: none;
  transition: all 0.15s ease;
  -moz-appearance: textfield;
}

.var-count-input::-webkit-inner-spin-button,
.var-count-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.var-count-input:focus {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.15);
}

.var-quick-btns {
  display: flex;
  gap: 4px;
}

.quick-num-btn {
  min-width: 30px;
  height: 24px;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
  transition: all 0.15s ease;
}

.quick-num-btn:hover {
  background: rgb(var(--v-theme-primary));
  color: white;
}

.quick-num-btn:active {
  transform: scale(0.93);
}

/* 滾動條樣式 */
.variation-scroll-area::-webkit-scrollbar {
  width: 5px;
}

.variation-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}

.variation-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 3px;
}

.variation-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}

/* 響應式調整 - 多型號對話框 */
@media (max-width: 600px) {
  .variation-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 14px 16px;
  }

  .variation-right {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .var-quick-btns {
    order: -1;
  }

  .batch-bar {
    padding: 10px 16px;
    gap: 6px;
  }
}
</style> 