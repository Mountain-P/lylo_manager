import axios from '@/plugins/axios'

const state = {
  user: null,
  token: localStorage.getItem('token') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  isAuthenticated: false
}

const getters = {
  token: state => state.token,
  user: state => state.user,
  refreshToken: state => state.refreshToken,
  isAuthenticated: state => state.isAuthenticated,
  isBoss: state => state.user && state.user.role === 'boss',
  isEmployee: state => state.user && state.user.role === 'employee',
};

const mutations = {
  SET_USER(state, user) {
    state.user = user
    state.isAuthenticated = !!user
  },
  SET_TOKEN(state, { token, refreshToken }) {
    state.token = token
    state.refreshToken = refreshToken
    
    if (token) {
      localStorage.setItem('token', token)
      localStorage.setItem('refreshToken', refreshToken)
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
    }
  },
  CLEAR_AUTH(state) {
    state.user = null
    state.token = null
    state.refreshToken = null
    state.isAuthenticated = false
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  },
  UPDATE_USER_PROFILE(state, userUpdates) {
    if (state.user) {
      state.user = { ...state.user, ...userUpdates }
    }
  }
}

const actions = {
  // 登入
  async login({ commit, dispatch }, credentials) {
    try {
      const response = await axios.post('/auth/login', credentials)
      const { user, token, refreshToken } = response.data

      commit('SET_USER', user)
      commit('SET_TOKEN', { token, refreshToken })

      dispatch('ui/showSnackbar', {
        message: '登入成功',
        color: 'success'
      }, { root: true })

      return response.data
    } catch (error) {
      commit('CLEAR_AUTH')
      throw error
    }
  },

  // 登出
  async logout({ commit, dispatch }) {
    try {
      // 通知後端登出（記錄用）
      if (state.token) {
        await axios.post('/auth/logout')
      }
    } catch (error) {
      // 登出時即使後端請求失敗也要清除本地狀態
      console.error('登出請求失敗:', error)
    } finally {
      commit('CLEAR_AUTH')
      dispatch('ui/showSnackbar', {
        message: '已登出',
        color: 'info'
      }, { root: true })
    }
  },

  // 刷新 token
  async refreshToken({ commit, state }) {
    try {
      if (!state.refreshToken) {
        throw new Error('無刷新令牌')
      }

      const response = await axios.post('/auth/refresh', {
        refreshToken: state.refreshToken
      })

      const { user, token, refreshToken } = response.data

      commit('SET_USER', user)
      commit('SET_TOKEN', { token, refreshToken })

      return token
    } catch (error) {
      commit('CLEAR_AUTH')
      throw error
    }
  },

  // 獲取當前用戶資訊
  async fetchUser({ commit, state }) {
    try {
      if (!state.token) {
        return null
      }

      const response = await axios.get('/auth/me')
      const { user } = response.data

      commit('SET_USER', user)
      return user
    } catch (error) {
      if (error.response && error.response.status === 401) {
        commit('CLEAR_AUTH');
      }
      throw error;
    }
  },

  // 更新個人資料
  async updateProfile({ commit, dispatch }, profileData) {
    const response = await axios.put('/auth/profile', profileData)
    const { user } = response.data

    commit('UPDATE_USER_PROFILE', user)

    dispatch('ui/showSnackbar', {
      message: '個人資料更新成功',
      color: 'success'
    }, { root: true })

    return user
  },

  // 註冊新用戶（僅老闆可用）
  async register({ dispatch }, userData) {
    const response = await axios.post('/auth/register', userData)

    dispatch('ui/showSnackbar', {
      message: '用戶註冊成功',
      color: 'success'
    }, { root: true })

    return response.data
  },

  // 重設用戶密碼（僅老闆可用）
  async changeUserPassword({ dispatch }, { userId, newPassword }) {
    const response = await axios.post(`/auth/change-password/${userId}`, {
      newPassword
    })

    dispatch('ui/showSnackbar', {
      message: '密碼重設成功',
      color: 'success'
    }, { root: true })

    return response.data
  },

  // 初始化認證狀態
  async initAuth({ commit, dispatch, state }) {
    if (state.token) {
      try {
        await dispatch('fetchUser')
      } catch (error) {
        // 如果獲取用戶資訊失敗，清除認證狀態
        commit('CLEAR_AUTH')
      }
    }
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
} 