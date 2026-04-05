<template>
  <div>
    <v-progress-circular
      v-if="loading"
      indeterminate
      class="mx-auto d-block"
    ></v-progress-circular>

    <div v-else-if="product">
      <v-row>
        <!-- 商品基本資訊 -->
        <v-col cols="12" md="8">
          <v-card>
            <v-card-title>
              <v-row align="center">
                <v-col>
                  <div class="text-h5">{{ product.name }}</div>
                  <div class="text-subtitle-1 text-grey">SKU: {{ product.sku }}</div>
                </v-col>
                <v-col cols="auto">
                  <v-chip
                    :color="product.isCountError ? 'error' : 'success'"
                    variant="flat"
                  >
                    {{ product.isCountError ? '異常' : '正常' }}
                  </v-chip>
                </v-col>
              </v-row>
            </v-card-title>

            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6">
                  <div class="text-subtitle-2 mb-2">商品圖片</div>
                  <v-img
                    :src="product.wooData?.images?.[0]?.src || '/placeholder.png'"
                    :alt="product.name"
                    max-width="200"
                    class="rounded"
                  ></v-img>
                </v-col>

                <v-col cols="12" sm="6">
                  <v-list density="compact">
                    <v-list-item>
                      <v-list-item-title>商品類型</v-list-item-title>
                      <v-list-item-subtitle>
                        {{ product.type === 'variable' ? '多型號商品' : '單一商品' }}
                      </v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item v-if="product.wooData?.price">
                      <v-list-item-title>售價</v-list-item-title>
                      <v-list-item-subtitle>${{ product.wooData.price }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item>
                      <v-list-item-title>系統庫存</v-list-item-title>
                      <v-list-item-subtitle>{{ product.stockQty }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item>
                      <v-list-item-title>盤點數量</v-list-item-title>
                      <v-list-item-subtitle>{{ product.countedQty }}</v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item>
                      <v-list-item-title>差異數量</v-list-item-title>
                      <v-list-item-subtitle
                        :class="product.isCountError ? 'text-error font-weight-bold' : ''"
                      >
                        {{ product.diffQty }}
                      </v-list-item-subtitle>
                    </v-list-item>

                    <v-list-item v-if="product.lastCountedAt">
                      <v-list-item-title>上次盤點</v-list-item-title>
                      <v-list-item-subtitle>
                        {{ formatDate(product.lastCountedAt) }}
                        <br>
                        由 {{ product.lastCountedBy?.name || 'N/A' }} 盤點
                      </v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-col>
              </v-row>

              <!-- 商品描述 -->
              <div v-if="product.wooData?.description" class="mt-4">
                <div class="text-subtitle-2 mb-2">商品描述</div>
                <div v-html="product.wooData.description"></div>
              </div>
            </v-card-text>

            <v-card-actions>
              <!-- 立即盤點按鈕 -->
              <v-btn
                color="primary"
                variant="flat"
                @click="openCountDialog"
              >
                <v-icon start>mdi-clipboard-check</v-icon>
                立即盤點
              </v-btn>
              <v-btn
                v-if="product.wooData?.permalink"
                :href="product.wooData.permalink"
                target="_blank"
                variant="outlined"
              >
                <v-icon start>mdi-open-in-new</v-icon>
                查看網站
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- 快速統計 -->
        <v-col cols="12" md="4">
          <v-card class="mb-4">
            <v-card-title>統計資訊</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="6">
                  <div class="text-center">
                    <v-icon color="primary" size="24" class="mb-1">mdi-clipboard-check</v-icon>
                    <div class="text-h4 text-primary font-weight-bold">{{ inventoryLogs.length }}</div>
                    <div class="text-caption">盤點次數</div>
                  </div>
                </v-col>
                <v-col cols="6">
                  <div class="text-center">
                    <v-icon color="success" size="24" class="mb-1">mdi-check-circle</v-icon>
                    <div class="text-h4 text-success font-weight-bold">
                      {{ inventoryLogs.filter(log => !log.hasError).length }}
                    </div>
                    <div class="text-caption">正常盤點</div>
                  </div>
                </v-col>
              </v-row>

              <!-- 多型號盤點進度 -->
              <div v-if="product.type === 'variable' && product.variations?.length" class="mt-4">
                <div class="text-subtitle-2 mb-1">規格盤點進度</div>
                <v-progress-linear
                  :model-value="variationCountProgress"
                  color="primary"
                  height="20"
                  rounded
                >
                  <template v-slot:default>
                    <strong class="text-caption">{{ countedVariations }}/{{ product.variations.length }}</strong>
                  </template>
                </v-progress-linear>
              </div>
            </v-card-text>
          </v-card>

          <!-- WooCommerce 資訊 -->
          <v-card v-if="product.wooData">
            <v-card-title>WooCommerce 資訊</v-card-title>
            <v-card-text>
              <v-list density="compact">
                <v-list-item>
                  <v-list-item-title>商品 ID</v-list-item-title>
                  <v-list-item-subtitle>{{ product.wooData.id }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <v-list-item-title>狀態</v-list-item-title>
                  <v-list-item-subtitle>{{ product.wooData.status }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item v-if="product.wooData.categories?.length">
                  <v-list-item-title>分類</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ product.wooData.categories.map(cat => cat.name).join(', ') }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <v-list-item-title>上次同步</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatDate(product.updatedAt) }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 多型號商品列表 -->
      <v-row v-if="product.type === 'variable' && product.variations?.length">
        <v-col cols="12">
          <v-card>
            <v-card-title>
              商品型號
              <v-chip size="small" color="primary" variant="tonal" class="ml-2">
                已盤 {{ countedVariations }}/{{ product.variations.length }}
              </v-chip>
            </v-card-title>
            <v-card-text>
              <v-data-table
                :headers="variationHeaders"
                :items="product.variations"
                density="compact"
                hide-default-footer
                :items-per-page="50"
              >
                <template #item.attributes="{ item }">
                  {{ formatAttributes(item.attributes) }}
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
                  <span :class="item.isCountError ? 'text-error font-weight-bold' : ''">
                    {{ item.diffQty }}
                  </span>
                </template>

                <template #item.lastCountedAt="{ item }">
                  <span v-if="item.lastCountedAt">{{ formatDate(item.lastCountedAt) }}</span>
                  <v-chip v-else size="x-small" color="warning" variant="tonal">未盤點</v-chip>
                </template>

                <template #item.actions="{ item }">
                  <v-btn
                    icon="mdi-clipboard-check"
                    size="small"
                    variant="text"
                    color="primary"
                    @click="openCountDialogForVariation(item)"
                  ></v-btn>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 盤點歷史 -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title>盤點歷史</v-card-title>
            <v-card-text>
              <v-data-table
                :headers="logHeaders"
                :items="inventoryLogs"
                :loading="logsLoading"
                density="compact"
              >
                <template #item.createdAt="{ item }">
                  {{ formatDate(item.createdAt) }}
                </template>

                <template #item.variationInfo="{ item }">
                  <div v-if="item.variationInfo">
                    <div class="font-weight-medium text-caption">{{ item.variationInfo.name }}</div>
                    <div class="text-caption text-grey">SKU: {{ item.variationInfo.sku }}</div>
                  </div>
                  <span v-else class="text-grey">主商品</span>
                </template>

                <template #item.userId="{ item }">
                  {{ item.userId?.name || 'N/A' }}
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

                <template #item.expectedQty="{ item }">
                  <v-chip
                    size="small"
                    color="blue"
                    variant="flat"
                  >
                    {{ item.expectedQty }}
                  </v-chip>
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
                    {{
                      item.method === 'barcode' ? '條碼掃描' :
                      item.method === 'manual-batch' ? '批量盤點' :
                      '手動輸入'
                    }}
                  </v-chip>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <v-alert v-else type="error">
      找不到商品資訊
    </v-alert>

    <!-- 盤點 Dialog -->
    <v-dialog v-model="countDialog.show" max-width="480px">
      <v-card>
        <v-card-title class="text-center">
          <v-icon color="primary" size="28" class="mb-1">mdi-clipboard-check</v-icon>
          <div class="text-h5 font-weight-bold">商品盤點</div>
        </v-card-title>

        <v-card-text class="pa-6">
          <div class="text-center mb-4">
            <h3>{{ countDialog.product?.name }}</h3>
            <v-chip size="small" color="info" class="mt-1">
              SKU: {{ countDialog.product?.sku }}
            </v-chip>
          </div>

          <v-row class="text-center mb-4">
            <v-col cols="6">
              <div class="text-caption text-grey">系統庫存</div>
              <div class="text-h5 font-weight-bold">{{ countDialog.product?.stockQty || 0 }}</div>
            </v-col>
            <v-col cols="6">
              <div class="text-caption text-grey">上次盤點</div>
              <div class="text-h5 font-weight-bold">{{ countDialog.product?.countedQty || 0 }}</div>
            </v-col>
          </v-row>

          <div class="text-center mb-3">
            <div class="text-subtitle-2">盤點數量</div>
          </div>

          <div class="d-flex align-center justify-center ga-4">
            <v-btn
              icon
              size="large"
              color="error"
              variant="outlined"
              :disabled="countDialog.quantity <= 0"
              @click="countDialog.quantity--"
            >
              <v-icon>mdi-minus</v-icon>
            </v-btn>

            <input
              v-model.number="countDialog.quantity"
              type="number"
              min="0"
              class="count-input text-center"
              @keyup.enter="submitCount"
              @focus="$event.target.select()"
            />

            <v-btn
              icon
              size="large"
              color="success"
              variant="outlined"
              @click="countDialog.quantity++"
            >
              <v-icon>mdi-plus</v-icon>
            </v-btn>
          </div>

          <div class="d-flex justify-center flex-wrap ga-2 mt-4">
            <v-btn
              v-for="num in [5, 10, 20, 50]"
              :key="num"
              size="small"
              variant="tonal"
              @click="countDialog.quantity = num"
            >
              {{ num }}
            </v-btn>
            <v-btn
              size="small"
              variant="tonal"
              color="warning"
              @click="countDialog.quantity = 0"
            >
              清零
            </v-btn>
          </div>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-btn variant="outlined" size="large" class="flex-grow-1 mr-2" @click="countDialog.show = false">
            取消
          </v-btn>
          <v-btn color="primary" size="large" class="flex-grow-1" :loading="countDialog.loading" @click="submitCount">
            <v-icon start>mdi-content-save</v-icon>
            確認盤點
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import moment from 'moment'
import { useProductsStore } from '@/stores/products'
import { useInventoryStore } from '@/stores/inventory'
import { useUIStore } from '@/stores/ui'

// Composables
const route = useRoute()

// Stores
const productsStore = useProductsStore()
const inventoryStore = useInventoryStore()
const uiStore = useUIStore()

// Reactive data
const loading = ref(false)
const logsLoading = ref(false)
const product = ref(null)
const inventoryLogs = ref([])

const countDialog = reactive({
  show: false,
  loading: false,
  product: null,
  quantity: 0
})

const variationHeaders = [
  { title: 'SKU', key: 'sku' },
  { title: '屬性', key: 'attributes' },
  { title: '系統庫存', key: 'stockQty' },
  { title: '盤點數量', key: 'countedQty' },
  { title: '差異', key: 'diffQty' },
  { title: '上次盤點', key: 'lastCountedAt' },
  { title: '盤點', key: 'actions', sortable: false }
]

const logHeaders = [
  { title: '盤點時間', key: 'createdAt' },
  { title: '變體信息', key: 'variationInfo' },
  { title: '盤點人員', key: 'userId' },
  { title: '盤點數量', key: 'countedQty' },
  { title: '系統庫存', key: 'expectedQty' },
  { title: '狀態', key: 'hasError' },
  { title: '方式', key: 'method' },
  { title: '備註', key: 'note' }
]

// Computed
const countedVariations = computed(() => {
  if (!product.value?.variations) return 0
  return product.value.variations.filter(v => v.lastCountedAt).length
})

const variationCountProgress = computed(() => {
  if (!product.value?.variations?.length) return 0
  return (countedVariations.value / product.value.variations.length) * 100
})

// Methods
const formatDate = (date) => {
  return moment(date).format('YYYY/MM/DD HH:mm:ss')
}

const formatAttributes = (attributes) => {
  if (!attributes || attributes.length === 0) return 'N/A'
  return attributes.map(attr => attr.option).join(', ')
}

const openCountDialog = () => {
  // 如果是多型號商品，預設盤第一個未盤的 variation
  if (product.value.type === 'variable' && product.value.variations?.length) {
    const uncounted = product.value.variations.find(v => !v.lastCountedAt)
    const target = uncounted || product.value.variations[0]
    openCountDialogForVariation(target)
    return
  }
  countDialog.product = product.value
  countDialog.quantity = product.value.countedQty || 0
  countDialog.show = true
}

const openCountDialogForVariation = (variation) => {
  countDialog.product = variation
  countDialog.quantity = variation.countedQty || 0
  countDialog.show = true
}

const submitCount = async () => {
  countDialog.loading = true
  try {
    await inventoryStore.countProduct({
      productId: countDialog.product._id,
      countedQty: countDialog.quantity,
      method: 'manual'
    })
    uiStore.showSuccess(`${countDialog.product.name} 盤點完成`)
    countDialog.show = false
    // 重新載入資料
    await fetchProduct()
    await fetchInventoryLogs()
  } catch (error) {
    console.error('盤點失敗:', error)
    uiStore.showError('盤點失敗')
  } finally {
    countDialog.loading = false
  }
}

const fetchProduct = async () => {
  try {
    loading.value = true
    const productId = route.params.id

    product.value = await productsStore.fetchProduct(productId)

    // 如果是多型號商品，獲取型號資訊
    if (product.value.type === 'variable') {
      await productsStore.fetchVariations(productId)
      product.value = productsStore.products.find(p => p._id === productId)
    }
  } catch (error) {
    console.error('獲取商品詳情失敗:', error)
    uiStore.showError('獲取商品詳情失敗')
  } finally {
    loading.value = false
  }
}

const fetchInventoryLogs = async () => {
  try {
    logsLoading.value = true
    const productId = route.params.id

    let currentProduct = product.value
    if (!currentProduct || !currentProduct.type) {
      currentProduct = await productsStore.fetchProduct(productId)
    }

    if (currentProduct?.type === 'variable') {
      const variationsResponse = await productsStore.fetchVariations(productId)
      const variations = variationsResponse || []

      if (variations.length > 0) {
        const allLogs = []

        for (const variation of variations) {
          try {
            const variationLogs = await inventoryStore.fetchLogs({
              productId: variation._id,
              limit: 20
            })

            const logsWithVariation = (variationLogs.logs || []).map(log => ({
              ...log,
              variationInfo: {
                name: variation.name,
                attributes: variation.attributes,
                sku: variation.sku
              }
            }))

            allLogs.push(...logsWithVariation)
          } catch (error) {
            console.warn('獲取變體盤點歷史失敗:', variation._id, error)
          }
        }

        allLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        inventoryLogs.value = allLogs
      } else {
        inventoryLogs.value = []
      }
    } else {
      const response = await inventoryStore.fetchLogs({
        productId,
        limit: 50
      })

      inventoryLogs.value = response.logs || []
    }
  } catch (error) {
    console.error('獲取盤點歷史失敗:', error)
    uiStore.showError('獲取盤點歷史失敗')
  } finally {
    logsLoading.value = false
  }
}

// 頁面載入時獲取資料
onMounted(async () => {
  await fetchProduct()
  await fetchInventoryLogs()
})
</script>

<style scoped>
.v-img {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.count-input {
  width: 80px;
  font-size: 2rem;
  font-weight: bold;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px;
  outline: none;
}

.count-input:focus {
  border-color: #1976d2;
}

/* 隱藏 number input 的上下箭頭 */
.count-input::-webkit-inner-spin-button,
.count-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.count-input[type=number] {
  -moz-appearance: textfield;
}
</style>
