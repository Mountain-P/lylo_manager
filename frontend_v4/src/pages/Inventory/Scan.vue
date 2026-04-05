<template>
  <div class="scan-page">
    <!-- 相機區域 -->
    <v-card class="camera-card mb-3" flat>
      <div class="camera-area">
        <div id="reader"></div>
        <div v-if="!isScanning && !scannerError" class="camera-placeholder" @click="startScanner">
          <v-icon size="56" color="grey-lighten-1">mdi-camera</v-icon>
          <div class="text-body-2 mt-2">點擊啟動相機</div>
        </div>
        <v-alert v-if="scannerError" type="error" variant="tonal" density="compact" class="ma-4">
          {{ scannerError }}
          <template #append>
            <v-btn size="small" variant="text" @click="startScanner">重試</v-btn>
          </template>
        </v-alert>
      </div>

      <!-- 相機控制列 -->
      <div class="camera-toolbar">
        <v-btn
          :color="isScanning ? 'error' : 'primary'"
          variant="tonal"
          size="small"
          @click="toggleScanner"
          :loading="scannerLoading"
        >
          <v-icon start>{{ isScanning ? 'mdi-stop' : 'mdi-camera' }}</v-icon>
          {{ isScanning ? '停止' : '啟動相機' }}
        </v-btn>

        <v-btn variant="tonal" size="small" @click="showManualInput = !showManualInput">
          <v-icon start>mdi-keyboard</v-icon>
          手動輸入
        </v-btn>

        <v-spacer></v-spacer>

        <v-chip size="small" variant="tonal" color="primary" v-if="scanHistory.length > 0">
          已掃 {{ scanHistory.length }}
        </v-chip>
      </div>

      <!-- 手動條碼輸入 -->
      <v-expand-transition>
        <div v-if="showManualInput" class="manual-input-bar">
          <v-text-field
            ref="manualInputRef"
            v-model="manualBarcode"
            label="輸入條碼"
            variant="outlined"
            density="compact"
            hide-details
            autofocus
            clearable
            @keyup.enter="searchByManualBarcode"
          >
            <template #append-inner>
              <v-btn
                icon="mdi-magnify"
                size="small"
                variant="text"
                :loading="searchLoading"
                @click="searchByManualBarcode"
              ></v-btn>
            </template>
          </v-text-field>
        </div>
      </v-expand-transition>
    </v-card>

    <!-- 盤點控制區域（掃到商品後顯示） -->
    <v-expand-transition>
      <v-card v-if="activeProduct" class="count-card mb-3" variant="outlined">
        <div class="count-card-inner">
          <!-- 商品資訊 -->
          <div class="product-info-row">
            <v-avatar size="48" rounded class="mr-3 flex-shrink-0">
              <img :src="activeProduct.wooData?.images?.[0]?.src || '/placeholder.png'" :alt="activeProduct.name">
            </v-avatar>
            <div class="flex-grow-1" style="min-width: 0">
              <div class="text-subtitle-2 font-weight-bold text-truncate">{{ activeProduct.name }}</div>
              <div class="text-caption text-medium-emphasis">SKU: {{ activeProduct.sku }}</div>
              <div class="product-meta">
                <span class="meta-tag meta-stock">庫存 {{ activeProduct.stockQty || 0 }}</span>
                <span class="meta-tag meta-prev">上次 {{ activeProduct.countedQty || 0 }}</span>
              </div>
            </div>
            <v-btn icon="mdi-close" size="x-small" variant="text" @click="dismissProduct"></v-btn>
          </div>

          <!-- 數量控制 -->
          <div class="count-controls">
            <v-btn icon size="44" color="error" variant="flat" :disabled="countQty <= 0" @click="countQty--">
              <v-icon size="24">mdi-minus</v-icon>
            </v-btn>

            <input
              ref="countInputRef"
              v-model.number="countQty"
              type="number"
              min="0"
              class="count-input-big"
              @focus="$event.target.select()"
              @keyup.enter="submitCount"
            />

            <v-btn icon size="44" color="success" variant="flat" @click="countQty++">
              <v-icon size="24">mdi-plus</v-icon>
            </v-btn>
          </div>

          <!-- 快速數量按鈕 -->
          <div class="quick-nums">
            <button v-for="n in [0, 1, 2, 3, 5, 10, 20, 50]" :key="n" class="qn-btn" :class="{ active: countQty === n }" @click="countQty = n">{{ n }}</button>
          </div>

          <!-- 確認按鈕 -->
          <v-btn
            color="primary"
            size="large"
            block
            :loading="submitting"
            @click="submitCount"
            class="confirm-btn"
          >
            <v-icon start>mdi-check</v-icon>
            確認盤點 ({{ countQty }})
          </v-btn>
        </div>
      </v-card>
    </v-expand-transition>

    <!-- 多型號選擇（inline，不用 dialog） -->
    <v-expand-transition>
      <v-card v-if="variationPicker.show" class="mb-3" variant="outlined">
        <div class="pa-4">
          <div class="d-flex align-center mb-3">
            <div class="text-subtitle-2 font-weight-bold flex-grow-1">選擇型號 — {{ variationPicker.product?.name }}</div>
            <v-btn icon="mdi-close" size="x-small" variant="text" @click="variationPicker.show = false"></v-btn>
          </div>
          <div class="variation-pick-list">
            <div
              v-for="v in variationPicker.variations"
              :key="v._id"
              class="variation-pick-item"
              @click="selectVariation(v)"
            >
              <div class="flex-grow-1">
                <div class="font-weight-bold text-body-2">{{ v.sku }}</div>
                <div class="text-caption text-medium-emphasis">{{ formatAttributes(v.attributes) }}</div>
              </div>
              <div class="text-caption">庫存 {{ v.stockQty || 0 }}</div>
              <v-icon size="18" color="primary">mdi-chevron-right</v-icon>
            </div>
          </div>
        </div>
      </v-card>
    </v-expand-transition>

    <!-- 盤點設定 -->
    <v-card variant="tonal" class="mb-3 settings-card">
      <div class="d-flex align-center pa-3 ga-3">
        <v-switch
          v-model="accumulateMode"
          label="累加模式"
          color="info"
          density="compact"
          hide-details
          class="flex-grow-0"
        ></v-switch>
        <div class="text-caption text-medium-emphasis flex-grow-1">
          重複掃碼自動 +1
        </div>
        <v-text-field
          v-model.number="defaultCountQty"
          label="預設數量"
          type="number"
          variant="outlined"
          density="compact"
          hide-details
          style="max-width: 100px"
        ></v-text-field>
      </div>
    </v-card>

    <!-- 掃描歷史（精簡） -->
    <v-card v-if="scanHistory.length > 0" flat>
      <div class="history-header">
        <div class="text-subtitle-2 font-weight-bold">
          本次盤點
          <v-chip size="x-small" color="success" variant="tonal" class="ml-1">{{ successCount }} 件完成</v-chip>
        </div>
        <v-btn variant="text" size="x-small" color="error" @click="clearHistory">清除</v-btn>
      </div>

      <div class="history-list">
        <div
          v-for="item in scanHistory"
          :key="item.id"
          class="history-item"
          :class="{ 'history-error': !item.success }"
        >
          <v-icon :color="item.success ? 'success' : 'error'" size="18" class="mr-2">
            {{ item.success ? 'mdi-check-circle' : 'mdi-alert-circle' }}
          </v-icon>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-body-2 text-truncate">{{ item.productName || item.barcode }}</div>
          </div>
          <div v-if="item.success" class="text-body-2 font-weight-bold text-primary mr-2">x{{ item.countedQty }}</div>
          <div class="text-caption text-medium-emphasis">{{ formatTime(item.scannedAt) }}</div>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import moment from 'moment'
import { Html5Qrcode } from 'html5-qrcode'
import { useProductsStore } from '@/stores/products'
import { useInventoryStore } from '@/stores/inventory'
import { useInventoryTaskStore } from '@/stores/inventoryTask'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const { mobile: isMobile } = useDisplay()

const productsStore = useProductsStore()
const inventoryStore = useInventoryStore()
const taskStore = useInventoryTaskStore()
const uiStore = useUIStore()

// Scanner state
const isScanning = ref(false)
const scannerLoading = ref(false)
const scannerError = ref('')
const searchLoading = ref(false)
const showManualInput = ref(false)
const manualBarcode = ref('')
const manualInputRef = ref(null)
const countInputRef = ref(null)
let html5Qrcode = null
let lastScannedBarcode = ''
let lastScannedTime = 0

// Count state
const activeProduct = ref(null)
const countQty = ref(1)
const submitting = ref(false)
const activeBarcode = ref('')
const accumulateMode = ref(true)
const defaultCountQty = ref(1)

// Variation picker
const variationPicker = reactive({ show: false, product: null, variations: [] })

// History
const scanHistory = ref([])
const successCount = computed(() => scanHistory.value.filter(i => i.success).length)

// --- Scanner ---
const toggleScanner = () => isScanning.value ? stopScanner() : startScanner()

const startScanner = async () => {
  try {
    scannerLoading.value = true
    scannerError.value = ''
    if (!html5Qrcode) html5Qrcode = new Html5Qrcode('reader')

    const config = {
      fps: 10,
      qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s } },
      rememberLastUsedCamera: true,
      showTorchButtonIfSupported: true
    }

    await html5Qrcode.start(
      { facingMode: 'environment' },
      config,
      onBarcodeDetected,
      () => {}
    )
    isScanning.value = true
  } catch (err) {
    console.error('Camera start failed:', err)
    scannerError.value = err.message?.includes('Permission')
      ? '需要允許相機權限才能掃描'
      : '無法啟動相機，請檢查權限或使用手動輸入'
  } finally {
    scannerLoading.value = false
  }
}

const stopScanner = async () => {
  try {
    if (html5Qrcode?.isScanning) await html5Qrcode.stop()
  } catch (e) { /* ignore */ }
  isScanning.value = false
}

// --- Barcode handling ---
const onBarcodeDetected = async (decodedText) => {
  const now = Date.now()
  if (decodedText === lastScannedBarcode && now - lastScannedTime < 1500) return
  lastScannedBarcode = decodedText
  lastScannedTime = now

  // Accumulate mode: if same barcode already counted, +1
  if (accumulateMode.value) {
    const existing = scanHistory.value.find(i => i.barcode === decodedText && i.success)
    if (existing) {
      try {
        existing.countedQty += 1
        await inventoryStore.countProduct({
          productId: existing.productId,
          countedQty: existing.countedQty,
          method: 'barcode',
          taskId: taskStore.currentTaskId
        })
        vibrate()
        uiStore.showSuccess(`${existing.productName} → ${existing.countedQty}`)
      } catch (e) {
        existing.countedQty -= 1
        uiStore.showError('累加失敗')
      }
      return
    }
  }

  await processBarcode(decodedText)
}

const searchByManualBarcode = async () => {
  const code = manualBarcode.value?.trim()
  if (!code) return
  manualBarcode.value = ''
  await processBarcode(code)
}

const processBarcode = async (barcode) => {
  try {
    searchLoading.value = true
    activeProduct.value = null
    variationPicker.show = false

    const product = await inventoryStore.scanBarcode(barcode)

    if (!product) {
      scanHistory.value.unshift({
        id: Date.now(), barcode, scannedAt: new Date(),
        success: false, productName: '找不到商品', countedQty: 0, productId: null
      })
      vibrate([100, 50, 100])
      uiStore.showError(`找不到條碼 ${barcode}`)
      return
    }

    vibrate()

    // Variable product → need variation selection
    if (product.type === 'variable') {
      const variations = product.variations || []
      if (variations.length === 0) {
        await productsStore.fetchVariations(product._id)
        const fresh = productsStore.products.find(p => p._id === product._id)
        variationPicker.variations = fresh?.variations || []
      } else {
        variationPicker.variations = variations
      }
      variationPicker.product = product
      variationPicker.show = true
      activeBarcode.value = barcode
      return
    }

    showProductForCount(product, barcode)
  } catch (error) {
    console.error('processBarcode error:', error)
    uiStore.showError('搜尋商品失敗')
  } finally {
    searchLoading.value = false
  }
}

const selectVariation = (variation) => {
  variationPicker.show = false
  showProductForCount(variation, activeBarcode.value)
}

const showProductForCount = (product, barcode) => {
  activeProduct.value = product
  activeBarcode.value = barcode
  countQty.value = defaultCountQty.value
  nextTick(() => countInputRef.value?.focus())
}

const dismissProduct = () => {
  activeProduct.value = null
}

// --- Submit count ---
const submitCount = async () => {
  if (!activeProduct.value) return
  submitting.value = true
  try {
    await inventoryStore.countProduct({
      productId: activeProduct.value._id,
      countedQty: countQty.value,
      method: 'barcode',
      taskId: taskStore.currentTaskId
    })

    scanHistory.value.unshift({
      id: Date.now(),
      barcode: activeBarcode.value,
      scannedAt: new Date(),
      success: true,
      productName: activeProduct.value.name,
      countedQty: countQty.value,
      productId: activeProduct.value._id
    })

    uiStore.showSuccess(`${activeProduct.value.name} × ${countQty.value} 完成`)
    activeProduct.value = null
  } catch (error) {
    console.error('Count failed:', error)
    uiStore.showError('盤點失敗')
  } finally {
    submitting.value = false
  }
}

// --- Utils ---
const vibrate = (pattern = [50]) => {
  try { navigator.vibrate?.(pattern) } catch (e) { /* ignore */ }
}

const formatAttributes = (attrs) => {
  if (!attrs?.length) return ''
  return attrs.map(a => a.option).join(', ')
}

const formatTime = (date) => moment(date).format('HH:mm:ss')

const clearHistory = () => {
  scanHistory.value = []
  uiStore.showInfo('已清除')
}

// --- Lifecycle ---
onMounted(async () => {
  await taskStore.restoreTask()
  if (!taskStore.hasCurrentTask) {
    uiStore.showError('請先建立或選擇盤點任務')
    router.replace('/inventory')
    return
  }
  startScanner()
})

onUnmounted(async () => {
  if (html5Qrcode?.isScanning) {
    try { await html5Qrcode.stop() } catch (e) { /* ignore */ }
  }
})
</script>

<style scoped>
.scan-page {
  max-width: 640px;
  margin: 0 auto;
}

/* Camera */
.camera-card {
  border-radius: 16px !important;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}

.camera-area {
  background: #111;
  min-height: 200px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-area #reader {
  width: 100%;
}

.camera-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 40px;
  color: #999;
}

.camera-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid rgb(var(--v-theme-outline));
}

.manual-input-bar {
  padding: 10px 14px 14px;
}

/* Count card */
.count-card {
  border-radius: 16px !important;
  border-color: rgb(var(--v-theme-primary)) !important;
  border-width: 2px !important;
}

.count-card-inner {
  padding: 16px;
}

.product-info-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
}

.product-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.meta-tag {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 5px;
}

.meta-stock {
  background: rgba(var(--v-theme-info), 0.12);
  color: rgb(var(--v-theme-info));
}

.meta-prev {
  background: rgba(var(--v-theme-secondary), 0.12);
  color: rgb(var(--v-theme-secondary));
}

/* Count controls */
.count-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
}

.count-input-big {
  width: 100px;
  height: 52px;
  border: 3px solid rgb(var(--v-theme-primary));
  border-radius: 14px;
  text-align: center;
  font-size: 1.75rem;
  font-weight: 800;
  color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-surface));
  outline: none;
  -moz-appearance: textfield;
}

.count-input-big::-webkit-inner-spin-button,
.count-input-big::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.count-input-big:focus {
  box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), 0.15);
}

/* Quick numbers */
.quick-nums {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.qn-btn {
  min-width: 36px;
  height: 32px;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
  transition: all 0.12s ease;
}

.qn-btn:hover, .qn-btn.active {
  background: rgb(var(--v-theme-primary));
  color: white;
}

.qn-btn:active {
  transform: scale(0.9);
}

.confirm-btn {
  border-radius: 14px !important;
  height: 52px !important;
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
}

/* Variation picker */
.variation-pick-list {
  max-height: 240px;
  overflow-y: auto;
}

.variation-pick-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s;
}

.variation-pick-item:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}

/* Settings */
.settings-card {
  border-radius: 12px !important;
}

/* History */
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
}

.history-list {
  max-height: 240px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.5);
  transition: background 0.1s;
}

.history-item:last-child {
  border-bottom: none;
}

.history-error {
  opacity: 0.55;
}

/* Responsive */
@media (max-width: 600px) {
  .scan-page {
    margin: -12px;
  }

  .camera-card {
    border-radius: 0 !important;
  }

  .camera-area {
    min-height: 220px;
  }

  .count-card-inner {
    padding: 14px 12px;
  }
}
</style>
