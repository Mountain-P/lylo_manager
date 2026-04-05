import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/plugins/axios'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const token = ref(localStorage.getItem('token') || null)
  const refreshTokenValue = ref(localStorage.getItem('refreshToken') || null)
  // 如果localStorage中有token，初始化時就設置為已認證
  const isAuthenticated = ref(!!localStorage.getItem('token'))

  // Getters
  const isBoss = computed(() => user.value && user.value.role === 'boss')
  const isEmployee = computed(() => user.value && user.value.role === 'employee')

  // Actions
  const setUser = (userData) => {
    user.value = userData
    isAuthenticated.value = !!userData
  }

  const setToken = (tokenData) => {
    token.value = tokenData.token
    refreshTokenValue.value = tokenData.refreshToken
    
    if (tokenData.token) {
      localStorage.setItem('token', tokenData.token)
      localStorage.setItem('refreshToken', tokenData.refreshToken)
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
    }
  }

  const clearAuth = () => {
    user.value = null
    token.value = null
    refreshTokenValue.value = null
    isAuthenticated.value = false
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  }

  const login = async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials)
      const { user: userData, token: authToken, refreshToken } = response.data

      setUser(userData)
      setToken({ token: authToken, refreshToken })

      return response.data
    } catch (error) {
      clearAuth()
      throw error
    }
  }

  const logout = async () => {
    try {
      if (token.value) {
        await api.post('/auth/logout')
      }
    } catch (error) {
      console.error('登出請求失敗:', error)
    } finally {
      clearAuth()
    }
  }

  const refreshToken = async () => {
    try {
      if (!refreshTokenValue.value) {
        throw new Error('無刷新令牌')
      }

      const response = await api.post('/auth/refresh', {
        refreshToken: refreshTokenValue.value
      })

      const { user: userData, token: authToken, refreshToken } = response.data

      setUser(userData)
      setToken({ token: authToken, refreshToken })

      return authToken
    } catch (error) {
      clearAuth()
      throw error
    }
  }

  const fetchUser = async () => {
    try {
      if (!token.value) {
        return null
      }

      const response = await api.get('/auth/me')
      const { user: userData } = response.data

      setUser(userData)
      return userData
    } catch (error) {
      if (error.response && error.response.status === 401) {
        clearAuth()
      }
      throw error
    }
  }

  const updateProfile = async (profileData) => {
    const response = await api.put('/auth/profile', profileData)
    const { user: userData } = response.data

    setUser({ ...user.value, ...userData })
    return userData
  }

  const register = async (userData) => {
    const response = await api.post('/auth/register', userData)
    return response.data
  }

  const changeUserPassword = async ({ userId, newPassword }) => {
    const response = await api.post(`/auth/change-password/${userId}`, {
      newPassword
    })
    return response.data
  }

  const initAuth = async () => {
    if (token.value) {
      try {
        await fetchUser()
      } catch (error) {
        clearAuth()
      }
    }
  }

  return {
    // State
    user,
    token,
    refreshTokenValue,
    isAuthenticated,
    
    // Getters
    isBoss,
    isEmployee,
    
    // Actions
    setUser,
    setToken,
    clearAuth,
    login,
    logout,
    refreshToken,
    fetchUser,
    updateProfile,
    register,
    changeUserPassword,
    initAuth
  }
}) 