import Vue from 'vue'
import VueRouter from 'vue-router'
import store from '@/store'

Vue.use(VueRouter)

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
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
        component: () => import('@/views/Dashboard.vue'),
        meta: { 
          title: '儀表板',
          breadcrumbs: [
            { text: '首頁', to: '/' }
          ]
        }
      },
      {
        path: '/products',
        name: 'Products',
        component: () => import('@/views/Products/Index.vue'),
        meta: { 
          title: '商品管理',
          breadcrumbs: [
            { text: '首頁', to: '/' },
            { text: '商品管理', to: '/products' }
          ]
        }
      },
      {
        path: '/products/:id',
        name: 'ProductDetail',
        component: () => import('@/views/Products/Detail.vue'),
        meta: { 
          title: '商品詳情',
          breadcrumbs: [
            { text: '首頁', to: '/' },
            { text: '商品管理', to: '/products' },
            { text: '商品詳情' }
          ]
        }
      },
      {
        path: '/inventory',
        name: 'Inventory',
        component: () => import('@/views/Inventory/Index.vue'),
        meta: { 
          title: '盤點管理',
          breadcrumbs: [
            { text: '首頁', to: '/' },
            { text: '盤點管理', to: '/inventory' }
          ]
        }
      },
      {
        path: '/inventory/scan',
        name: 'InventoryScan',
        component: () => import('@/views/Inventory/Scan.vue'),
        meta: { 
          title: '條碼盤點',
          breadcrumbs: [
            { text: '首頁', to: '/' },
            { text: '盤點管理', to: '/inventory' },
            { text: '條碼盤點' }
          ]
        }
      },
      {
        path: '/inventory/logs',
        name: 'InventoryLogs',
        component: () => import('@/views/Inventory/Logs.vue'),
        meta: { 
          title: '盤點記錄',
          breadcrumbs: [
            { text: '首頁', to: '/' },
            { text: '盤點管理', to: '/inventory' },
            { text: '盤點記錄' }
          ]
        }
      },
      {
        path: '/users',
        name: 'Users',
        component: () => import('@/views/Users/Index.vue'),
        meta: { 
          title: '員工管理',
          requiresBoss: true,
          breadcrumbs: [
            { text: '首頁', to: '/' },
            { text: '員工管理', to: '/users' }
          ]
        }
      },
      {
        path: '/sync',
        name: 'Sync',
        component: () => import('@/views/Sync/Index.vue'),
        meta: { 
          title: '同步管理',
          requiresBoss: true,
          breadcrumbs: [
            { text: '首頁', to: '/' },
            { text: '同步管理', to: '/sync' }
          ]
        }
      },
      {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { 
          title: '個人資料',
          breadcrumbs: [
            { text: '首頁', to: '/' },
            { text: '個人資料' }
          ]
        }
      }
    ]
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { 
      requiresAuth: false,
      title: '頁面不存在'
    }
  },
  {
    path: '*',
    redirect: '/404'
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

// 路由守衛
router.beforeEach(async (to, from, next) => {
  // 設定頁面標題
  if (to.meta.title) {
    document.title = `${to.meta.title} - 盤點小助手`
  }

  // 設定麵包屑
  if (to.meta.breadcrumbs) {
    store.dispatch('ui/setBreadcrumbs', to.meta.breadcrumbs)
  }

  const isAuthenticated = store.getters['auth/isAuthenticated']
  const isBoss = store.getters['auth/isBoss']

  // 檢查是否需要認證
  if (to.meta.requiresAuth !== false && !isAuthenticated) {
    next({
      name: 'Login',
      query: { redirect: to.fullPath }
    })
    return
  }

  // 如果已登入，不允許訪問登入頁
  if (to.name === 'Login' && isAuthenticated) {
    next({ name: 'Dashboard' })
    return
  }

  // 檢查是否需要老闆權限
  if (to.meta.requiresBoss && !isBoss) {
    store.dispatch('ui/showError', '權限不足，只有老闆可以訪問此頁面')
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