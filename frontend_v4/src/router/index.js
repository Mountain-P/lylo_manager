/**
 * router/index.ts
 *
 * Automatic routes for `./src/pages/*.vue`
 */

// Composables
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/Login.vue'),
    meta: {
      requiresAuth: false,
      title: '登入'
    }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/pages/Dashboard.vue'),
        meta: {
          title: '儀表板'
        }
      },
      {
        path: '/products',
        name: 'Products',
        component: () => import('@/pages/Products/Index.vue'),
        meta: {
          title: '商品管理',
          parent: 'Dashboard'
        }
      },
      {
        path: '/products/sales-ranking',
        name: 'SalesRanking',
        component: () => import('@/pages/Products/SalesRanking.vue'),
        meta: {
          title: '銷售排行',
          requiresBoss: true,
          parent: 'Products'
        }
      },
      {
        path: '/products/:id',
        name: 'ProductDetail',
        component: () => import('@/pages/Products/Detail.vue'),
        meta: {
          title: '商品詳情',
          parent: 'Products'
        }
      },
      {
        path: '/inventory',
        name: 'Inventory',
        component: () => import('@/pages/Inventory/Index.vue'),
        meta: {
          title: '盤點管理'
        }
      },
      {
        path: '/inventory/scan',
        name: 'InventoryScan',
        component: () => import('@/pages/Inventory/Scan.vue'),
        meta: {
          title: '條碼盤點',
          parent: 'Inventory'
        }
      },
      {
        path: '/inventory/logs',
        name: 'InventoryLogs',
        component: () => import('@/pages/Inventory/Logs.vue'),
        meta: {
          title: '盤點記錄',
          parent: 'Inventory'
        }
      },
      {
        path: '/users',
        name: 'Users',
        component: () => import('@/pages/Users/Index.vue'),
        meta: {
          title: '員工管理',
          requiresBoss: true
        }
      },
      {
        path: '/sync',
        name: 'Sync',
        component: () => import('@/pages/Sync/Index.vue'),
        meta: {
          title: '同步管理',
          requiresBoss: true
        }
      },
      {
        path: '/orders/pre-order-stats',
        name: 'PreOrderStats',
        component: () => import('@/pages/Orders/PreOrderStats.vue'),
        meta: {
          title: '預購商品訂單統計'
        }
      },
      {
        path: '/orders/pending-stats',
        name: 'PendingOrderStats',
        component: () => import('@/pages/Orders/PendingOrderStats.vue'),
        meta: {
          title: '待處理訂單統計'
        }
      },
      {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/pages/Profile.vue'),
        meta: {
          title: '個人資料'
        }
      }
    ]
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/pages/NotFound.vue'),
    meta: {
      requiresAuth: false,
      title: '頁面不存在'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 路由守衛
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const uiStore = useUIStore()

  // 設定頁面標題
  if (to.meta.title) {
    document.title = `${to.meta.title} - 盤點小助手`
  }

  // 如果有token但用戶資料為空，嘗試初始化認證
  if (authStore.token && !authStore.user) {
    try {
      await authStore.initAuth()
    } catch (error) {
      console.log('認證初始化失敗，可能token已過期')
      // 如果初始化失敗但要訪問需要認證的頁面，才跳轉到登入頁面
      if (to.meta.requiresAuth !== false) {
        authStore.clearAuth()
        next({
          name: 'Login',
          query: { redirect: to.fullPath }
        })
        return
      }
    }
  }

  // 檢查是否需要認證
  if (to.meta.requiresAuth !== false && !authStore.isAuthenticated) {
    next({
      name: 'Login',
      query: { redirect: to.fullPath }
    })
    return
  }

  // 如果已登入，不允許訪問登入頁
  if (to.name === 'Login' && authStore.isAuthenticated) {
    // 如果有重定向參數，跳轉到原始頁面
    // 否則管理員跳轉到儀表板，員工跳轉到預購訂單統計
    const defaultPath = '/'
    const redirectPath = to.query.redirect || defaultPath
    next(redirectPath)
    return
  }

  // 檢查是否需要老闆權限
  if (to.meta.requiresBoss && !authStore.isBoss) {
    uiStore.showError('權限不足，只有管理員可以訪問此頁面')
    next({ name: 'Dashboard' })
    return
  }

  next()
})

// 路由後置守衛
router.afterEach(() => {
  // 滾動到頁面頂部
  window.scrollTo(0, 0)
})

export default router
