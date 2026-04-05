import axios from 'axios'
import store from '@/store'
import router from '@/router'

// 創建 axios 實例
const instance = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000, // 30 秒超時
  headers: {
    'Content-Type': 'application/json'
  }
})

// 請求攔截器
instance.interceptors.request.use(
  config => {
    // 從 store 獲取 token
    const token = store.getters['auth/token']
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 顯示載入狀態
    store.dispatch('ui/setLoading', true)

    return config
  },
  error => {
    store.dispatch('ui/setLoading', false)
    return Promise.reject(error)
  }
)

// 回應攔截器
instance.interceptors.response.use(
  response => {
    // 隱藏載入狀態
    store.dispatch('ui/setLoading', false)
    return response
  },
  error => {
    store.dispatch('ui/setLoading', false)

    // 處理不同的錯誤狀態
    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 401:
          // 未授權，清除 token 並跳轉到登入頁
          store.dispatch('auth/logout')
          if (router.currentRoute.name !== 'Login') {
            router.push({
              name: 'Login',
              query: { redirect: router.currentRoute.fullPath }
            })
          }
          break

        case 403:
          // 權限不足
          store.dispatch('ui/showSnackbar', {
            message: data.message || '權限不足',
            color: 'error'
          })
          break

        case 404:
          // 資源不存在
          store.dispatch('ui/showSnackbar', {
            message: data.message || '找不到請求的資源',
            color: 'warning'
          })
          break

        case 422:
        case 400: {
          // 驗證錯誤
          let errorMessage = data.message || '請求參數錯誤'
          if (data.errors && Array.isArray(data.errors)) {
            errorMessage = data.errors.map(err => err.msg || err.message).join(', ')
          }
          store.dispatch('ui/showSnackbar', {
            message: errorMessage,
            color: 'error'
          })
          break
        }

        case 429:
          // 請求過於頻繁
          store.dispatch('ui/showSnackbar', {
            message: '請求過於頻繁，請稍後再試',
            color: 'warning'
          })
          break

        case 500:
          // 伺服器錯誤
          store.dispatch('ui/showSnackbar', {
            message: data.message || '伺服器內部錯誤',
            color: 'error'
          })
          break

        default:
          // 其他錯誤
          store.dispatch('ui/showSnackbar', {
            message: data.message || `請求失敗 (${status})`,
            color: 'error'
          })
      }
    } else if (error.request) {
      // 網路錯誤
      store.dispatch('ui/showSnackbar', {
        message: '無法連接到伺服器，請檢查網路連線',
        color: 'error'
      })
    } else {
      // 其他錯誤
      store.dispatch('ui/showSnackbar', {
        message: error.message || '發生未知錯誤',
        color: 'error'
      })
    }

    return Promise.reject(error)
  }
)

// Token 自動刷新邏輯
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

// 攔截 401 錯誤並嘗試刷新 token
instance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 如果正在刷新，將請求加入隊列
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return instance(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = store.getters['auth/refreshToken']
        if (refreshToken) {
          await store.dispatch('auth/refreshToken')
          const newToken = store.getters['auth/token']
          
          processQueue(null, newToken)
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          
          return instance(originalRequest)
        }
      } catch (refreshError) {
        processQueue(refreshError, null)
        store.dispatch('auth/logout')
        router.push('/login')
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default instance 