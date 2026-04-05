<template>
  <div>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">系統儀表板</h1>
      </v-col>
    </v-row>
    
    <!-- 統計卡片 -->
    <v-row>
      <v-col cols="12" sm="6" md="3">
        <v-card color="primary" dark>
          <v-card-text>
            <div class="text-h6">商品總數</div>
            <div class="text-h3">{{ stats.totalProducts || 0 }}</div>
          </v-card-text>
          <v-card-actions>
            <v-btn text @click="$router.push('/products')">
              查看詳情
              <v-icon right>mdi-arrow-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="3">
        <v-card color="success" dark>
          <v-card-text>
            <div class="text-h6">已盤點商品</div>
            <div class="text-h3">{{ stats.countedProducts || 0 }}</div>
          </v-card-text>
          <v-card-actions>
            <v-btn text @click="$router.push('/inventory')">
              開始盤點
              <v-icon right>mdi-arrow-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="3">
        <v-card color="error" dark>
          <v-card-text>
            <div class="text-h6">異常商品</div>
            <div class="text-h3">{{ stats.errorProducts || 0 }}</div>
          </v-card-text>
          <v-card-actions>
            <v-btn text @click="$router.push('/products?error=true')">
              查看異常
              <v-icon right>mdi-arrow-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="3">
        <v-card color="info" dark>
          <v-card-text>
            <div class="text-h6">今日盤點</div>
            <div class="text-h3">{{ stats.todayLogs || 0 }}</div>
          </v-card-text>
          <v-card-actions>
            <v-btn text @click="$router.push('/inventory/logs')">
              查看記錄
              <v-icon right>mdi-arrow-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
    
    <!-- 功能快捷方式 -->
    <v-row class="mt-4">
      <v-col cols="12">
        <h2 class="text-h5 mb-3">快速操作</h2>
      </v-col>
    </v-row>
    
    <v-row>
      <v-col cols="12" sm="6" md="4">
        <v-card outlined>
          <v-card-text class="text-center">
            <v-icon size="48" color="primary" class="mb-2">mdi-barcode-scan</v-icon>
            <div class="text-h6">條碼盤點</div>
            <div class="text-body-2">使用條碼掃描器快速盤點</div>
          </v-card-text>
          <v-card-actions>
            <v-btn color="primary" block @click="$router.push('/inventory/scan')">
              開始掃描
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="4">
        <v-card outlined>
          <v-card-text class="text-center">
            <v-icon size="48" color="success" class="mb-2">mdi-clipboard-list</v-icon>
            <div class="text-h6">商品清單</div>
            <div class="text-body-2">查看和管理所有商品</div>
          </v-card-text>
          <v-card-actions>
            <v-btn color="success" block @click="$router.push('/products')">
              查看商品
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <v-col cols="12" sm="6" md="4" v-if="isBoss">
        <v-card outlined>
          <v-card-text class="text-center">
            <v-icon size="48" color="warning" class="mb-2">mdi-sync</v-icon>
            <div class="text-h6">WooCommerce 同步</div>
            <div class="text-body-2">管理商品同步設定</div>
          </v-card-text>
          <v-card-actions>
            <v-btn color="warning" block @click="$router.push('/sync')">
              同步管理
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
    
    <!-- 最近活動 -->
    <v-row class="mt-4">
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>
            <v-icon left>mdi-history</v-icon>
            最近盤點記錄
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="logHeaders"
              :items="recentLogs"
              :loading="loading"
              hide-default-footer
              :items-per-page="5"
            >
              <template slot="item.createdAt" slot-scope="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>
              
              <template slot="item.diffQty" slot-scope="{ item }">
                <v-chip
                  :color="item.diffQty === 0 ? 'success' : 'error'"
                  small
                  text-color="white"
                >
                  {{ item.diffQty === 0 ? '正常' : `差異 ${item.diffQty}` }}
                </v-chip>
              </template>
            </v-data-table>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text @click="$router.push('/inventory/logs')">
              查看所有記錄
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>
            <v-icon left>mdi-sync</v-icon>
            同步狀態
          </v-card-title>
          <v-card-text>
            <div class="mb-2">
              <strong>上次同步:</strong><br>
              {{ syncStatus.lastSync ? formatDate(syncStatus.lastSync) : '未同步' }}
            </div>
            <div class="mb-2">
              <strong>狀態:</strong>
              <v-chip
                :color="syncStatus.isRunning ? 'warning' : 'success'"
                small
                class="ml-2"
              >
                {{ syncStatus.isRunning ? '同步中' : '正常' }}
              </v-chip>
            </div>
            <div class="mb-2">
              <strong>下次同步:</strong><br>
              {{ syncStatus.nextSync ? formatDate(syncStatus.nextSync) : '計算中' }}
            </div>
          </v-card-text>
          <v-card-actions v-if="isBoss">
            <v-btn
              color="primary"
              small
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

<script>
import { mapGetters, mapActions } from 'vuex'
import moment from 'moment'

export default {
  name: 'Dashboard',
  
  data() {
    return {
      loading: false,
      syncLoading: false,
      stats: {},
      recentLogs: [],
      syncStatus: {},
      logHeaders: [
        { text: '商品名稱', value: 'productName' },
        { text: '盤點數量', value: 'countedQty' },
        { text: '狀態', value: 'diffQty' },
        { text: '時間', value: 'createdAt' }
      ]
    }
  },
  
  computed: {
    ...mapGetters('auth', ['isBoss'])
  },
  
  methods: {
    ...mapActions('inventory', ['triggerManualSync']),
    ...mapActions('ui', ['showSuccess', 'showError']),
    
    formatDate(date) {
      return moment(date).format('MM/DD HH:mm')
    },
    
    async fetchDashboardData() {
      try {
        this.loading = true
        
        // 獲取統計資料
        const [productsStats, inventoryStats, syncStatus] = await Promise.all([
          this.$http.get('/products/stats'),
          this.$http.get('/inventory/logs/stats'),
          this.$http.get('/inventory/sync/status')
        ])
        
        this.stats = {
          ...productsStats.data,
          ...inventoryStats.data
        }
        
        this.syncStatus = syncStatus.data
        
        // 獲取最近盤點記錄
        const logsResponse = await this.$http.get('/inventory/logs', {
          params: { limit: 5 }
        })
        this.recentLogs = logsResponse.data.logs
        
      } catch (error) {
        console.error('獲取儀表板數據失敗:', error)
        this.showError('獲取數據失敗')
      } finally {
        this.loading = false
      }
    },
    
    async triggerSync() {
      try {
        this.syncLoading = true
        await this.triggerManualSync()
        await this.fetchDashboardData() // 重新載入數據
      } catch (error) {
        console.error('觸發同步失敗:', error)
      } finally {
        this.syncLoading = false
      }
    }
  },
  
  async created() {
    await this.fetchDashboardData()
  }
}
</script>

<style scoped>
.v-card {
  height: 100%;
}
</style> 