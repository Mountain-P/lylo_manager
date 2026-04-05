<template>
  <div>
    <!-- 工具列 -->
    <v-card class="mb-4">
      <v-card-title>
        <v-row align="center">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="search"
              append-icon="mdi-magnify"
              label="搜尋商品 (名稱/SKU/條碼)"
              single-line
              hide-details
              clearable
              @input="onSearchChange"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <v-switch
              v-model="errorOnly"
              label="只顯示異常商品"
              color="error"
              hide-details
              @change="onFilterChange"
            ></v-switch>
          </v-col>
          <v-col cols="12" md="5" class="text-right">
            <v-btn
              color="primary"
              @click="openBarcodeScanner"
              class="mr-2"
            >
              <v-icon left>mdi-barcode-scan</v-icon>
              掃描條碼
            </v-btn>
            <v-btn
              color="success"
              @click="refreshData"
              :loading="loading"
            >
              <v-icon left>mdi-refresh</v-icon>
              重新整理
            </v-btn>
          </v-col>
        </v-row>
      </v-card-title>
    </v-card>

    <!-- 統計卡片 -->
    <v-row class="mb-4">
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 primary--text">{{ stats.totalProducts }}</div>
            <div class="text-subtitle-1">總商品數</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 success--text">{{ stats.countedProducts }}</div>
            <div class="text-subtitle-1">已盤點</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 error--text">{{ stats.errorProducts }}</div>
            <div class="text-subtitle-1">異常商品</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 info--text">{{ completionRate }}%</div>
            <div class="text-subtitle-1">完成率</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 商品表格 -->
    <v-card>
      <v-data-table
        :headers="headers"
        :items="products"
        :loading="loading"
        :server-items-length="pagination.totalItems"
        :page.sync="pagination.currentPage"
        :items-per-page.sync="pagination.itemsPerPage"
        :item-class="getRowClass"
        class="elevation-1"
        loading-text="載入商品資料中..."
        no-data-text="沒有找到商品資料"
        @update:page="onPageChange"
        @update:items-per-page="onItemsPerPageChange"
      >
        <!-- 商品名稱欄位 -->
        <template v-slot:item.name="{ item }">
          <div class="d-flex align-center">
            <v-avatar
              v-if="item.wooData && item.wooData.images && item.wooData.images.length > 0"
              size="40"
              class="mr-3"
            >
              <v-img :src="item.wooData.images[0].src" :alt="item.name"></v-img>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.name }}</div>
              <div class="text-caption text--secondary">{{ item.sku }}</div>
            </div>
          </div>
        </template>

        <!-- 條碼欄位 -->
        <template v-slot:item.barcode="{ item }">
          <v-chip
            v-if="item.barcode"
            small
            color="primary"
            text-color="white"
          >
            {{ item.barcode }}
          </v-chip>
          <span v-else class="text--disabled">未設定</span>
        </template>

        <!-- 數量欄位 -->
        <template v-slot:item.expectedQty="{ item }">
          <v-chip small color="blue" text-color="white">
            {{ item.expectedQty }}
          </v-chip>
        </template>

        <template v-slot:item.stockQty="{ item }">
          <v-chip small color="green" text-color="white">
            {{ item.stockQty }}
          </v-chip>
        </template>

        <template v-slot:item.countedQty="{ item }">
          <v-chip 
            small 
            :color="item.countedQty > 0 ? 'orange' : 'grey'"
            :text-color="item.countedQty > 0 ? 'white' : 'black'"
          >
            {{ item.countedQty }}
          </v-chip>
        </template>

        <template v-slot:item.salesQty="{ item }">
          <v-chip small color="purple" text-color="white">
            {{ item.salesQty }}
          </v-chip>
        </template>

        <!-- 差異欄位 -->
        <template v-slot:item.diffQty="{ item }">
          <v-chip
            small
            :color="item.diffQty === 0 ? 'success' : 'error'"
            text-color="white"
          >
            <span v-if="item.diffQty > 0">+{{ item.diffQty }}</span>
            <span v-else>{{ item.diffQty }}</span>
          </v-chip>
        </template>

        <!-- 狀態欄位 -->
        <template v-slot:item.status="{ item }">
          <v-icon
            :color="item.isCountError ? 'error' : 'success'"
            size="20"
          >
            {{ item.isCountError ? 'mdi-alert-circle' : 'mdi-check-circle' }}
          </v-icon>
        </template>

        <!-- 最後盤點時間 -->
        <template v-slot:item.lastCountedAt="{ item }">
          <div v-if="item.lastCountedAt">
            <div class="text-caption">
              {{ formatDate(item.lastCountedAt) }}
            </div>
            <div class="text-caption text--secondary" v-if="item.lastCountedBy">
              by {{ item.lastCountedBy.name }}
            </div>
          </div>
          <span v-else class="text--disabled">未盤點</span>
        </template>

        <!-- 操作欄位 -->
        <template v-slot:item.actions="{ item }">
          <v-btn
            icon
            small
            color="primary"
            @click="openCountDialog(item)"
          >
            <v-icon>mdi-counter</v-icon>
          </v-btn>
          <v-btn
            icon
            small
            color="info"
            @click="viewProduct(item)"
          >
            <v-icon>mdi-eye</v-icon>
          </v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- 條碼掃描對話框 -->
    <v-dialog v-model="barcodeDialog" max-width="600">
      <v-card>
        <v-card-title>
          <span class="headline">條碼掃描</span>
          <v-spacer></v-spacer>
          <v-btn icon @click="closeBarcodeScanner">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <div id="barcode-scanner" class="barcode-scanner">
            <!-- 條碼掃描器會在這裡初始化 -->
          </div>
          <v-text-field
            v-model="manualBarcode"
            label="或手動輸入條碼"
            append-icon="mdi-magnify"
            @click:append="searchByBarcode"
            @keyup.enter="searchByBarcode"
          ></v-text-field>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- 盤點對話框 -->
    <v-dialog v-model="countDialog" max-width="500">
      <v-card v-if="selectedProduct">
        <v-card-title>
          <span class="headline">商品盤點</span>
        </v-card-title>
        <v-card-text>
          <div class="mb-4">
            <h3>{{ selectedProduct.name }}</h3>
            <p class="text--secondary">SKU: {{ selectedProduct.sku }}</p>
          </div>
          
          <v-row>
            <v-col cols="6">
              <v-text-field
                label="到貨數量"
                :value="selectedProduct.expectedQty"
                readonly
                outlined
              ></v-text-field>
            </v-col>
            <v-col cols="6">
              <v-text-field
                label="銷售數量"
                :value="selectedProduct.salesQty"
                readonly
                outlined
              ></v-text-field>
            </v-col>
          </v-row>

          <v-text-field
            v-model.number="countForm.countedQty"
            label="實際盤點數量"
            type="number"
            min="0"
            outlined
            autofocus
            :error-messages="countErrors.countedQty"
          ></v-text-field>

          <v-textarea
            v-model="countForm.note"
            label="備註 (選填)"
            rows="3"
            outlined
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="closeCountDialog">取消</v-btn>
          <v-btn
            color="primary"
            @click="submitCount"
            :loading="countLoading"
          >
            確認盤點
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import moment from 'moment'

export default {
  name: 'ProductDataTable',
  data() {
    return {
      search: '',
      errorOnly: false,
      barcodeDialog: false,
      countDialog: false,
      selectedProduct: null,
      manualBarcode: '',
      countForm: {
        countedQty: 0,
        note: ''
      },
      countErrors: {},
      countLoading: false,
      scanner: null, // QuaggaJS 掃描器實例
      headers: [
        { text: '商品名稱', value: 'name', sortable: false },
        { text: '條碼', value: 'barcode', sortable: false },
        { text: '到貨數量', value: 'expectedQty', align: 'center' },
        { text: '系統庫存', value: 'stockQty', align: 'center' },
        { text: '盤點數量', value: 'countedQty', align: 'center' },
        { text: '銷售數量', value: 'salesQty', align: 'center' },
        { text: '差異', value: 'diffQty', align: 'center' },
        { text: '狀態', value: 'status', align: 'center', sortable: false },
        { text: '最後盤點', value: 'lastCountedAt', sortable: false },
        { text: '操作', value: 'actions', sortable: false, align: 'center' }
      ]
    }
  },
  computed: {
    ...mapGetters('products', [
      'products',
      'stats',
      'pagination',
      'loading',
      'completionRate'
    ])
  },
  methods: {
    ...mapActions('products', [
      'fetchProducts',
      'fetchStats',
      'setFilters',
      'setPage',
      'scanBarcode'
    ]),
    ...mapActions('inventory', ['countProduct']),
    
    // 獲取表格行的樣式類別
    getRowClass(item) {
      return item.isCountError ? 'count-error-row' : ''
    },

    // 格式化日期
    formatDate(date) {
      return moment(date).format('MM/DD HH:mm')
    },

    // 搜尋變更
    onSearchChange() {
      this.setFilters({ search: this.search })
    },

    // 篩選變更
    onFilterChange() {
      this.setFilters({ errorOnly: this.errorOnly })
    },

    // 頁碼變更
    onPageChange(page) {
      this.setPage(page)
    },

    // 每頁項目數變更
    onItemsPerPageChange(itemsPerPage) {
      this.setFilters({ limit: itemsPerPage })
    },

    // 重新整理資料
    async refreshData() {
      await this.fetchProducts()
      await this.fetchStats()
    },

    // 開啟條碼掃描器
    async openBarcodeScanner() {
      this.barcodeDialog = true
      this.manualBarcode = ''
      
      // 等待 DOM 更新後初始化掃描器
      await this.$nextTick()
      this.initBarcodeScanner()
    },

    // 關閉條碼掃描器
    closeBarcodeScanner() {
      this.barcodeDialog = false
      this.stopBarcodeScanner()
    },

    // 初始化條碼掃描器
    initBarcodeScanner() {
      // 這裡可以使用 QuaggaJS 或其他條碼掃描庫
      // 由於這是範例，先使用手動輸入的方式
      console.log('初始化條碼掃描器')
    },

    // 停止條碼掃描器
    stopBarcodeScanner() {
      if (this.scanner) {
        // 停止掃描器
        console.log('停止條碼掃描器')
        this.scanner = null
      }
    },

    // 根據條碼搜尋
    async searchByBarcode() {
      if (!this.manualBarcode.trim()) return

      try {
        const product = await this.scanBarcode(this.manualBarcode.trim())
        if (product) {
          this.closeBarcodeScanner()
          this.openCountDialog(product)
        }
      } catch (error) {
        console.error('條碼搜尋失敗:', error)
      }
    },

    // 開啟盤點對話框
    openCountDialog(product) {
      this.selectedProduct = product
      this.countForm = {
        countedQty: product.countedQty || 0,
        note: ''
      }
      this.countErrors = {}
      this.countDialog = true
    },

    // 關閉盤點對話框
    closeCountDialog() {
      this.countDialog = false
      this.selectedProduct = null
      this.countForm = {
        countedQty: 0,
        note: ''
      }
      this.countErrors = {}
    },

    // 提交盤點
    async submitCount() {
      // 驗證
      this.countErrors = {}
      if (this.countForm.countedQty < 0) {
        this.countErrors.countedQty = ['盤點數量不能為負數']
        return
      }

      try {
        this.countLoading = true
        
        await this.countProduct({
          productId: this.selectedProduct._id,
          countedQty: this.countForm.countedQty,
          method: 'manual',
          note: this.countForm.note
        })

        this.closeCountDialog()
        await this.refreshData()
      } catch (error) {
        console.error('盤點失敗:', error)
      } finally {
        this.countLoading = false
      }
    },

    // 查看商品詳情
    viewProduct(product) {
      this.$router.push(`/products/${product._id}`)
    }
  },

  async created() {
    // 初始載入資料
    await this.refreshData()
  },

  beforeDestroy() {
    // 清理掃描器
    this.stopBarcodeScanner()
  }
}
</script>

<style scoped>
.count-error-row {
  background-color: rgba(255, 82, 82, 0.1) !important;
}

.count-error-row:hover {
  background-color: rgba(255, 82, 82, 0.2) !important;
}

.barcode-scanner {
  width: 100%;
  height: 300px;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #ccc;
  border-radius: 4px;
}
</style> 