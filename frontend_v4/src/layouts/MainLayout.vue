<template>
  <v-app>
    <!-- 導航抽屜 -->
    <v-navigation-drawer v-model="uiStore.drawer" :rail="!$vuetify.display.lgAndUp" permanent app>
      <template #prepend>
        <v-list-item
          v-if="$vuetify.display.lgAndUp"
          class="pa-4"
          :subtitle="authStore.user?.role === 'boss' ? '管理員' : '員工'"
          :title="authStore.user?.name"
        >
          <template #prepend>
            <v-avatar color="primary" size="36">
              <span class="text-body-1 font-weight-bold">{{ authStore.user?.name?.charAt(0) || '?' }}</span>
            </v-avatar>
          </template>
        </v-list-item>
        <v-divider v-if="$vuetify.display.lgAndUp"></v-divider>
      </template>

      <v-list nav density="compact">
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.route"
          :prepend-icon="item.icon"
          :title="item.title"
          rounded="lg"
          link
          class="my-1"
        >
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- 應用程式列 -->
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="uiStore.toggleDrawer"></v-app-bar-nav-icon>
      <v-toolbar-title>盤點小助手</v-toolbar-title>

      <v-spacer></v-spacer>

      <!-- 同步狀態指示器 -->
      <v-tooltip :text="syncTooltip" location="bottom">
        <template v-slot:activator="{ props }">
          <v-btn
            icon
            v-bind="props"
            @click="$router.push('/sync')"
            v-if="authStore.isBoss"
          >
            <v-icon :class="{ 'sync-spinning': inventoryStore.syncStatus.isRunning }">
              mdi-sync
            </v-icon>
            <v-badge
              v-if="inventoryStore.syncStatus.isRunning"
              dot
              color="warning"
              offset-x="-2"
              offset-y="-2"
            ></v-badge>
          </v-btn>
        </template>
      </v-tooltip>

      <!-- 用戶菜單 -->
      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-account-circle" v-bind="props">
          </v-btn>
        </template>

        <v-list>
          <v-list-item>
            <v-list-item-title>{{ authStore.user?.name }}</v-list-item-title>
            <v-list-item-subtitle>{{ authStore.user?.role === 'boss' ? '管理員' : '員工' }}</v-list-item-subtitle>
          </v-list-item>

          <v-divider></v-divider>

          <v-list-item @click="$router.push('/profile')" prepend-icon="mdi-account-edit">
            <v-list-item-title>個人資料</v-list-item-title>
          </v-list-item>

          <v-list-item @click="handleLogout" prepend-icon="mdi-logout">
            <v-list-item-title>登出</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- 頁面內容 -->
    <v-main>
      <v-container fluid>
        <!-- 麵包屑導航 -->
        <v-breadcrumbs
          v-if="breadcrumbs.length > 1"
          :items="breadcrumbs"
          class="px-0 pt-0 pb-2"
          density="compact"
        >
          <template v-slot:prepend>
            <v-icon size="small" class="mr-1">mdi-home</v-icon>
          </template>
          <template v-slot:divider>
            <v-icon size="small">mdi-chevron-right</v-icon>
          </template>
        </v-breadcrumbs>

        <!-- 路由視圖 -->
        <router-view />
      </v-container>
    </v-main>

    <!-- 全域 Snackbar -->
    <v-snackbar v-model="uiStore.snackbar.show" :color="uiStore.snackbar.color" :timeout="uiStore.snackbar.timeout"
      location="top">
      {{ uiStore.snackbar.message }}

      <template v-slot:actions>
        <v-btn variant="text" @click="uiStore.hideSnackbar()">
          關閉
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useInventoryStore } from '@/stores/inventory'
import moment from 'moment'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()
const inventoryStore = useInventoryStore()

let syncPollTimer = null

// 定期輪詢同步狀態
const startSyncPolling = () => {
  // 每 30 秒檢查一次同步狀態
  syncPollTimer = setInterval(async () => {
    try {
      await inventoryStore.fetchSyncStatus()
    } catch (e) {
      // 靜默失敗
    }
  }, 30000)
}

onMounted(async () => {
  try {
    await inventoryStore.fetchSyncStatus()
  } catch (e) {
    // ignore
  }
  startSyncPolling()
})

onUnmounted(() => {
  if (syncPollTimer) clearInterval(syncPollTimer)
})

// 同步狀態 tooltip
const syncTooltip = computed(() => {
  const status = inventoryStore.syncStatus
  if (status.isRunning) return '同步進行中...'
  if (status.lastSync) return `上次同步: ${moment(status.lastSync).format('MM/DD HH:mm')}`
  return '尚未同步'
})

// 麵包屑導航
const breadcrumbs = computed(() => {
  const crumbs = []
  let current = route

  // 建立麵包屑鏈
  const buildCrumbs = (routeRecord) => {
    const matched = router.getRoutes().find(r => r.name === routeRecord.name)
    if (!matched) return

    const parentName = matched.meta?.parent
    if (parentName) {
      const parentRoute = router.getRoutes().find(r => r.name === parentName)
      if (parentRoute) {
        buildCrumbs({ name: parentName, meta: parentRoute.meta })
      }
    }

    crumbs.push({
      title: matched.meta?.title || matched.name,
      to: matched.path === '' ? '/' : matched.path,
      disabled: matched.name === current.name
    })
  }

  buildCrumbs(current)
  return crumbs
})

// Computed
const menuItems = computed(() => {
  const items = [
    { title: '儀表板', icon: 'mdi-view-dashboard', route: '/' },
    { title: '商品管理', icon: 'mdi-package-variant', route: '/products' },
    { title: '盤點管理', icon: 'mdi-clipboard-check', route: '/inventory' },
    { title: '盤點記錄', icon: 'mdi-history', route: '/inventory/logs' },
    { title: '預購訂單統計', icon: 'mdi-cart-arrow-down', route: '/orders/pre-order-stats' },
    { title: '待處理訂單統計', icon: 'mdi-clipboard-list', route: '/orders/pending-stats' }
  ]

  // 管理員專用菜單
  if (authStore.isBoss) {
    items.push(
      { title: '銷售排行', icon: 'mdi-chart-bar', route: '/products/sales-ranking' },
      { title: '員工管理', icon: 'mdi-account-group', route: '/users' },
      { title: '同步管理', icon: 'mdi-sync', route: '/sync' }
    )
  }

  return items
})

// Methods
const handleLogout = async () => {
  try {
    await authStore.logout()
    uiStore.showInfo('已登出')
    router.push('/login')
  } catch (error) {
    console.error('登出失敗:', error)
  }
}
</script>

<style scoped>
.v-toolbar-title {
  font-weight: 500;
  font-size: 1.25rem;
}

.sync-spinning {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
