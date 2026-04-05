<template>
  <div>
    <v-card>
      <v-card-title>
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="search"
              append-icon="mdi-magnify"
              label="搜尋商品 (名稱, SKU, 條碼)"
              single-line
              hide-details
              clearable
              @input="debouncedSearch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <v-switch
              v-model="errorOnly"
              label="只顯示異常商品"
              color="error"
              @change="fetchData"
            ></v-switch>
          </v-col>
          <v-col cols="12" md="5" class="text-right">
            <v-btn color="primary" @click="openBarcodeScanner">
              <v-icon left>mdi-barcode-scan</v-icon>
              掃碼盤點
            </v-btn>
            <v-btn color="success" @click="refreshData" :loading="loading" class="ml-2">
              <v-icon left>mdi-refresh</v-icon>
              重新整理
            </v-btn>
          </v-col>
        </v-row>
      </v-card-title>

      <v-data-table
        :headers="headers"
        :items="products"
        :loading="loading"
        :options.sync="options"
        :server-items-length="pagination.totalItems"
        :item-class="getRowClass"
        :expanded.sync="expanded"
        item-key="_id"
        show-expand
        class="elevation-1"
        loading-text="正在載入商品資料..."
        no-data-text="找不到商品"
      >
        <template #item.image="{ item }">
          <v-avatar size="40" class="my-2">
            <img :src="item.wooData.images[0] ? item.wooData.images[0].src : '/placeholder.png'" alt="Product Image">
          </v-avatar>
        </template>
        
        <template #item.name="{ item }">
          <div class="font-weight-bold">{{ item.name }}</div>
          <div class="text-caption grey--text">{{ item.sku }}</div>
          <v-chip v-if="item.type === 'variable'" x-small color="info" class="ml-1">多型號</v-chip>
        </template>
        
        <template #item.stockQty="{ item }">
          <v-chip small color="blue" text-color="white">{{ item.stockQty }}</v-chip>
        </template>
        
        <template #item.countedQty="{ item }">
           <v-chip small :color="item.lastCountedAt ? 'green' : 'grey'" text-color="white">{{ item.countedQty }}</v-chip>
        </template>
        
        <template #item.diffQty="{ item }">
          <span :class="item.isCountError ? 'red--text font-weight-bold' : ''">
            {{ item.diffQty }}
          </span>
        </template>

        <template #item.lastCountedAt="{ item }">
          <div v-if="item.lastCountedAt">
            <div>{{ formatDate(item.lastCountedAt) }}</div>
            <div class="text-caption">{{ item.lastCountedBy ? item.lastCountedBy.name : 'N/A' }}</div>
          </div>
          <span v-else>未盤點</span>
        </template>
        
        <template #item.actions="{ item }">
          <v-icon small class="mr-2" @click.stop="openCountDialog(item)">mdi-clipboard-check</v-icon>
          <v-icon small @click.stop="viewProduct(item)">mdi-eye</v-icon>
        </template>

        <template #expanded-item="{ headers, item }">
          <td :colspan="headers.length" class="pa-0">
            <v-simple-table dense>
              <template v-slot:default>
                <thead>
                  <tr>
                    <th class="text-left">型號 (SKU)</th>
                    <th class="text-left">屬性</th>
                    <th class="text-left">系統庫存</th>
                    <th class="text-left">盤點數量</th>
                    <th class="text-left">差異</th>
                    <th class="text-left">上次盤點</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!item.variations || item.variations.length === 0">
                     <td colspan="6" class="text-center">正在載入型號...</td>
                  </tr>
                  <tr v-for="variation in item.variations" :key="variation._id">
                    <td>{{ variation.sku }}</td>
                    <td>{{ formatAttributes(variation.attributes) }}</td>
                    <td>{{ variation.stockQty }}</td>
                    <td>{{ variation.countedQty }}</td>
                    <td :class="variation.isCountError ? 'red--text font-weight-bold' : ''">{{ variation.diffQty }}</td>
                    <td>
                      <div v-if="variation.lastCountedAt">
                        {{ formatDate(variation.lastCountedAt) }}
                      </div>
                      <span v-else>未盤點</span>
                    </td>
                  </tr>
                </tbody>
              </template>
            </v-simple-table>
          </td>
        </template>

        <template #item.data-table-expand="{ item, isExpanded }">
            <v-icon
                v-if="item.type === 'variable'"
                @click.stop="toggleExpand(item)"
            >
                {{ isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
            </v-icon>
        </template>
      </v-data-table>
    </v-card>

    <!-- 掃碼盤點 Dialog -->
    <v-dialog v-model="scannerDialog.show" max-width="600px" @click:outside="closeScannerDialog">
      <v-card>
        <v-card-title>
          <span class="text-h5">掃描商品條碼</span>
        </v-card-title>
        <v-card-text class="pa-4">
          <div id="reader" style="width: 100%;"></div>
          <p v-if="scannerDialog.error" class="red--text text-center mt-2">{{ scannerDialog.error }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="closeScannerDialog">關閉</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 單一商品盤點 Dialog -->
    <v-dialog v-model="countDialog.show" max-width="500px" @keydown.esc="closeCountDialog">
      <v-card>
        <v-card-title>
          <span class="text-h5">盤點商品</span>
        </v-card-title>
        <v-card-text>
          <p><strong>{{ countDialog.product.name }}</strong></p>
          <p>SKU: {{ countDialog.product.sku }}</p>
          <v-text-field
            v-model.number="countDialog.quantity"
            label="盤點數量"
            type="number"
            autofocus
            @keyup.enter="submitCount"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="closeCountDialog">取消</v-btn>
          <v-btn color="blue darken-1" :loading="countDialog.loading" @click="submitCount">確認</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 多型號商品盤點 Dialog -->
    <v-dialog v-model="variationCountDialog.show" max-width="700px" @keydown.esc="closeVariationCountDialog">
      <v-card>
        <v-card-title>
          <span class="text-h5">盤點多型號商品</span>
        </v-card-title>
        <v-card-subtitle>{{ variationCountDialog.product.name }}</v-card-subtitle>
        <v-card-text>
          <v-simple-table dense>
            <template v-slot:default>
              <thead>
                <tr>
                  <th class="text-left">型號 (SKU)</th>
                  <th class="text-left">屬性</th>
                  <th class="text-left" style="width: 120px;">盤點數量</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="variation in variationCountDialog.variations" :key="variation._id">
                  <td>{{ variation.sku }}</td>
                  <td>{{ formatAttributes(variation.attributes) }}</td>
                  <td>
                    <v-text-field
                      v-model.number="variation.newCountedQty"
                      type="number"
                      dense
                      hide-details
                    ></v-text-field>
                  </td>
                </tr>
              </tbody>
            </template>
          </v-simple-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="closeVariationCountDialog">取消</v-btn>
          <v-btn color="blue darken-1" :loading="variationCountDialog.loading" @click="submitVariationCount">全部儲存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import moment from 'moment';
import _ from 'lodash';
import { Html5Qrcode } from 'html5-qrcode';

export default {
  name: 'ProductsIndex',
  data() {
    return {
      search: '',
      errorOnly: false,
      options: {},
      expanded: [],
      countDialog: {
        show: false,
        loading: false,
        product: {},
        quantity: 0
      },
      variationCountDialog: {
        show: false,
        loading: false,
        product: {},
        variations: []
      },
      scannerDialog: {
        show: false,
        html5Qrcode: null,
        error: ''
      },
      headers: [
        { text: '圖片', value: 'image', sortable: false },
        { text: '商品名稱', value: 'name' },
        { text: '系統庫存', value: 'stockQty' },
        { text: '盤點數量', value: 'countedQty' },
        { text: '差異', value: 'diffQty' },
        { text: '上次盤點', value: 'lastCountedAt' },
        { text: '操作', value: 'actions', sortable: false },
        { text: '', value: 'data-table-expand' },
      ],
    };
  },
  computed: {
    ...mapState('products', ['products', 'pagination', 'loading']),
  },
  watch: {
    options: {
      handler() {
        this.fetchData();
      },
      deep: true,
    },
    'scannerDialog.show'(val) {
      if (val) {
        // When dialog opens, start scanner
        this.$nextTick(() => {
          this.startScan();
        });
      } else {
        // When dialog closes, stop scanner
        this.closeScannerDialog();
      }
    },
  },
  methods: {
    ...mapActions('products', ['fetchProducts', 'fetchVariations']),
    ...mapActions('inventory', ['countProduct', 'batchCountProducts']),

    openBarcodeScanner() {
      this.scannerDialog.show = true;
      this.$nextTick(() => {
        this.startScan();
      });
    },

    closeScannerDialog() {
      if (this.scannerDialog.html5Qrcode && this.scannerDialog.html5Qrcode.isScanning) {
        this.scannerDialog.html5Qrcode.stop().catch(err => {
          console.error("Error stopping the scanner: ", err);
        });
      }
      this.scannerDialog.show = false;
    },

    startScan() {
      if (!this.scannerDialog.html5Qrcode) {
        this.scannerDialog.html5Qrcode = new Html5Qrcode("reader");
      }
      
      const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
          let minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          let qrboxSize = Math.floor(minEdge * 0.7);
          return {
              width: qrboxSize,
              height: qrboxSize
          };
      }

      const config = {
        fps: 10,
        qrbox: qrboxFunction,
        rememberLastUsedCamera: true,
      };

      this.scannerDialog.html5Qrcode.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
          // success callback
          this.onBarcodeScanned(decodedText);
        },
        (errorMessage) => {
          // parse error callback, we can ignore it.
        }
      ).catch((err) => {
        console.error("相機啟動失敗:", err);
        this.scannerDialog.error = '無法啟動相機，請檢查權限或重新整理頁面。';
      });
    },

    onBarcodeScanned(barcode) {
      this.closeScannerDialog();
      this.search = barcode;
      this.debouncedSearch();
    },

    async toggleExpand(item) {
      const index = this.expanded.findIndex(i => i._id === item._id);

      if (index > -1) {
        // Already expanded, so collapse it
        this.expanded.splice(index, 1);
      } else {
        // Not expanded, so expand it
        // Fetch variations if they haven't been loaded yet
        if (!item.variations || item.variations.length === 0) {
          await this.fetchVariations(item._id);
        }
        this.expanded.push(item);
      }
    },

    fetchData() {
      const { page, itemsPerPage } = this.options;
      
      const params = {
        page,
        limit: itemsPerPage,
        isCountError: this.errorOnly || undefined,
      };

      // 判斷 search 的內容是條碼還是文字
      if (this.search) {
        // 如果是純數字，就當作 barcode 搜尋
        if (/^\d+$/.test(this.search)) {
          params.barcode = this.search;
        } else {
          params.search = this.search;
        }
      }

      this.fetchProducts(params);
    },

    debouncedSearch: _.debounce(function() {
      this.options.page = 1;
      this.fetchData();
    }, 500),

    refreshData() {
      this.fetchData();
    },
    
    getRowClass(item) {
      return item.isCountError ? 'count-error-row' : '';
    },
    
    formatAttributes(attributes) {
      if (!attributes || attributes.length === 0) return 'N/A';
      return attributes.map(attr => attr.option).join(', ');
    },
    
    formatDate(date) {
      return date ? moment(date).format('YYYY/MM/DD HH:mm') : '';
    },

    async openCountDialog(product) {
      if (product.type === 'variable') {
        // 如果是多型號商品
        if (!product.variations || product.variations.length === 0) {
          await this.fetchVariations(product._id);
        }
        // 找到最新的 variations
        const freshProduct = this.products.find(p => p._id === product._id);
        this.variationCountDialog.product = freshProduct;
        this.variationCountDialog.variations = _.cloneDeep(freshProduct.variations).map(v => ({ ...v, newCountedQty: v.countedQty }));
        this.variationCountDialog.show = true;
      } else {
        // 如果是單一商品
        this.countDialog.product = product;
        this.countDialog.quantity = product.countedQty;
        this.countDialog.show = true;
      }
    },

    closeCountDialog() {
      this.countDialog.show = false;
      this.countDialog.product = {};
    },

    closeVariationCountDialog() {
        this.variationCountDialog.show = false;
        this.variationCountDialog.product = {};
        this.variationCountDialog.variations = [];
    },

    async submitCount() {
      this.countDialog.loading = true;
      try {
        await this.countProduct({
          productId: this.countDialog.product._id,
          countedQty: this.countDialog.quantity,
        });
        this.closeCountDialog();
        this.fetchData(); // Refresh data
      } catch (error) {
        console.error('盤點失敗:', error);
      } finally {
        this.countDialog.loading = false;
      }
    },
    
    async submitVariationCount() {
      this.variationCountDialog.loading = true;
      try {
        const counts = this.variationCountDialog.variations.map(v => ({
          productId: v._id,
          countedQty: parseInt(v.newCountedQty || 0, 10)
        }));
        await this.batchCountProducts(counts);
        this.closeVariationCountDialog();
        this.fetchData();
      } catch (error) {
        console.error('批量盤點失敗:', error);
      } finally {
        this.variationCountDialog.loading = false;
      }
    },

    viewProduct(product) {
      this.$router.push(`/products/${product._id}`);
    },
  },
};
</script>

<style scoped>
.count-error-row {
  background-color: rgba(255, 82, 82, 0.1) !important;
}
.count-error-row:hover {
  background-color: rgba(255, 82, 82, 0.2) !important;
}
</style> 