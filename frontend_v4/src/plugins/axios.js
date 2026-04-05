import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

// 創建 axios 實例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 60000, // 增加到 60 秒，適應需要長時間處理的 API
  headers: {
    'Content-Type': 'application/json'
  }
})

// Token 刷新狀態管理
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  failedQueue = []
}

// 請求攔截器 - 添加 JWT token
api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    const token = authStore.token

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 響應攔截器 - 處理 token 刷新和錯誤
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const authStore = useAuthStore()
    const originalRequest = error.config

    // 如果收到 401 且不是重試請求，也不是刷新token的請求本身
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/refresh')) {
      originalRequest._retry = true

      // 如果正在刷新 token，將請求加入隊列
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      isRefreshing = true

      try {
        // 嘗試刷新 token
        const newToken = await authStore.refreshToken()

        if (newToken) {
          processQueue(null, newToken)
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // 刷新失敗，清除認證狀態並導向登入頁
        processQueue(refreshError, null)
        authStore.clearAuth()

        // 使用Vue Router而不是直接location跳轉，保持當前頁面路徑作為redirect參數
        const currentPath = router.currentRoute.value.fullPath
        if (currentPath !== '/login') {
          router.push({
            name: 'Login',
            query: { redirect: currentPath }
          })
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // 如果是刷新token的請求失敗，直接清除認證
    if (error.response?.status === 401 && originalRequest.url.includes('/auth/refresh')) {
      const authStore = useAuthStore()
      authStore.clearAuth()

      const currentPath = router.currentRoute.value.fullPath
      if (currentPath !== '/login') {
        router.push({
          name: 'Login',
          query: { redirect: currentPath }
        })
      }
    }

    // 其他錯誤處理
    if (error.response?.status === 403) {
      // 權限不足
      console.error('權限不足')
    } else if (error.response?.status === 500) {
      // 伺服器錯誤
      console.error('伺服器錯誤')
    }

    return Promise.reject(error)
  }
)

export default api 