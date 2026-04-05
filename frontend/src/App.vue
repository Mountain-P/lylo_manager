<template>
  <v-app>
    <!-- 全域載入指示器 -->
    <v-overlay :value="loading" z-index="9999">
      <v-progress-circular
        indeterminate
        size="64"
        color="primary"
      ></v-progress-circular>
    </v-overlay>

    <!-- 主要內容 -->
    <router-view />

    <!-- 全域通知 -->
    <v-snackbar
      v-model="snackbarShow"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
      bottom
      right
    >
      {{ snackbar.message }}
      <template v-slot:action="{ attrs }">
        <v-btn
          text
          v-bind="attrs"
          @click="snackbarShow = false"
        >
          關閉
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  name: 'App',
  data() {
    return {
      snackbarShow: false,
    }
  },
  computed: {
    ...mapGetters('ui', ['loading', 'snackbar'])
  },
  watch: {
    'snackbar.show'(newValue) {
      // 當 store 的狀態變為 true 時，同步到本地 data，以顯示 snackbar
      this.snackbarShow = newValue;
    },
    snackbarShow(newValue) {
      // 當本地 data (v-model) 變為 false 時 (由超時或點擊觸發), 
      // 如果 store 中的狀態仍然是 true，則 commit 一個 mutation 來同步 store
      if (!newValue && this.snackbar.show) {
        this.hideSnackbar();
      }
    }
  },
  methods: {
    ...mapActions('ui', ['hideSnackbar']),
    ...mapActions('auth', ['initAuth'])
  },
  async created() {
    // 初始化認證狀態
    await this.initAuth()
  }
}
</script>

<style>
/* 全域樣式 */
.v-application {
  font-family: 'Roboto', sans-serif !important;
}

/* 盤點異常商品的紅色樣式 */
.count-error-row {
  background-color: rgba(255, 82, 82, 0.1) !important;
}

.count-error-row:hover {
  background-color: rgba(255, 82, 82, 0.2) !important;
}

/* 載入狀態 */
.loading-overlay {
  background-color: rgba(255, 255, 255, 0.9) !important;
}

/* 條碼掃描器樣式 */
.barcode-scanner {
  max-width: 100%;
  max-height: 400px;
}

/* 數據表格樣式 */
.v-data-table .v-data-table__wrapper {
  overflow-x: auto;
}

/* 響應式表格 */
@media (max-width: 600px) {
  .v-data-table .v-data-table__wrapper {
    font-size: 12px;
  }
}
</style> 