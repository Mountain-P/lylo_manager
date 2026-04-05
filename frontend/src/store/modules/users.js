import axios from '@/plugins/axios'

const state = {
  users: [],
  employees: [],
  currentUser: null,
  pagination: {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0
  },
  filters: {
    role: null,
    isActive: null,
    search: ''
  },
  loading: false
}

const getters = {
  activeUsers: state => state.users.filter(user => user.isActive),
  inactiveUsers: state => state.users.filter(user => !user.isActive),
  bossUsers: state => state.users.filter(user => user.role === 'boss'),
  employeeUsers: state => state.users.filter(user => user.role === 'employee'),
  userById: state => id => state.users.find(user => user.id === id)
}

const mutations = {
  SET_USERS(state, users) {
    state.users = users
  },
  
  SET_EMPLOYEES(state, employees) {
    state.employees = employees
  },
  
  ADD_USER(state, user) {
    state.users.unshift(user)
  },
  
  UPDATE_USER(state, updatedUser) {
    const index = state.users.findIndex(user => user.id === updatedUser.id)
    if (index !== -1) {
      state.users.splice(index, 1, updatedUser)
    }
  },
  
  REMOVE_USER(state, userId) {
    const index = state.users.findIndex(user => user.id === userId)
    if (index !== -1) {
      state.users.splice(index, 1)
    }
  },
  
  SET_CURRENT_USER(state, user) {
    state.currentUser = user
  },
  
  SET_PAGINATION(state, pagination) {
    state.pagination = { ...state.pagination, ...pagination }
  },
  
  SET_FILTERS(state, filters) {
    state.filters = { ...state.filters, ...filters }
  },
  
  SET_LOADING(state, loading) {
    state.loading = loading
  }
}

const actions = {
  async fetchUsers({ commit, state }, params = {}) {
    try {
      commit('SET_LOADING', true)
      
      const queryParams = {
        page: params.page || state.pagination.currentPage,
        limit: params.limit || state.pagination.itemsPerPage,
        ...state.filters,
        ...params
      }
      
      // 清除空值
      Object.keys(queryParams).forEach(key => {
        if (queryParams[key] === null || queryParams[key] === undefined || queryParams[key] === '') {
          delete queryParams[key]
        }
      })
      
      const response = await axios.get('/users', { params: queryParams })
      const { users, pagination } = response.data
      
      commit('SET_USERS', users)
      commit('SET_PAGINATION', pagination)
      
      return response.data
    } catch (error) {
      console.error('獲取使用者列表失敗:', error)
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },
  
  async fetchEmployees({ commit }) {
    try {
      const response = await axios.get('/users/employees')
      commit('SET_EMPLOYEES', response.data.employees)
      return response.data
    } catch (error) {
      console.error('獲取員工列表失敗:', error)
      throw error
    }
  },
  
  async fetchUser({ commit }, userId) {
    try {
      const response = await axios.get(`/users/${userId}`)
      commit('SET_CURRENT_USER', response.data.user)
      return response.data
    } catch (error) {
      console.error('獲取使用者詳情失敗:', error)
      throw error
    }
  },
  
  async createUser({ commit, dispatch }, userData) {
    try {
      commit('SET_LOADING', true)
      
      const response = await axios.post('/auth/register', userData)
      const newUser = response.data.user
      
      commit('ADD_USER', newUser)
      await dispatch('ui/showSuccess', `員工 ${newUser.name} 建立成功`, { root: true })
      
      return response.data
    } catch (error) {
      const message = error.response && error.response.data && error.response.data.message || '建立員工失敗';
      await dispatch('ui/showError', message, { root: true });
      throw error;
    } finally {
      commit('SET_LOADING', false)
    }
  },
  
  async updateUser({ commit, dispatch }, { userId, userData }) {
    try {
      commit('SET_LOADING', true)
      
      const response = await axios.put(`/users/${userId}`, userData)
      const updatedUser = response.data.user
      
      commit('UPDATE_USER', updatedUser)
      await dispatch('ui/showSuccess', `使用者 ${updatedUser.name} 更新成功`, { root: true })
      
      return response.data
    } catch (error) {
      const message = (error.response && error.response.data && error.response.data.message) || '更新使用者失敗';
      await dispatch('ui/showError', message, { root: true });
      throw error;
    } finally {
      commit('SET_LOADING', false)
    }
  },
  
  async deleteUser({ commit, dispatch }, userId) {
    try {
      commit('SET_LOADING', true)
      
      const response = await axios.delete(`/users/${userId}`)
      
      commit('REMOVE_USER', userId)
      await dispatch('ui/showSuccess', '使用者已停用', { root: true })
      
      return response.data
    } catch (error) {
      const message = error.response?.data?.message || '停用使用者失敗'
      await dispatch('ui/showError', message, { root: true })
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },
  
  async activateUser({ commit, dispatch }, userId) {
    try {
      commit('SET_LOADING', true)
      
      const response = await axios.post(`/users/${userId}/activate`)
      const activatedUser = response.data.user
      
      commit('UPDATE_USER', activatedUser)
      await dispatch('ui/showSuccess', `使用者 ${activatedUser.name} 已啟用`, { root: true })
      
      return response.data
    } catch (error) {
      const message = error.response?.data?.message || '啟用使用者失敗'
      await dispatch('ui/showError', message, { root: true })
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },
  
  async changeUserPassword({ dispatch }, { userId, newPassword }) {
    try {
      const response = await axios.post(`/auth/change-password/${userId}`, { newPassword })
      
      await dispatch('ui/showSuccess', '使用者密碼重設成功', { root: true })
      
      return response.data
    } catch (error) {
      const message = error.response?.data?.message || '重設密碼失敗'
      await dispatch('ui/showError', message, { root: true })
      throw error
    }
  },
  
  // eslint-disable-next-line no-unused-vars
  async fetchUserInventoryLogs({ commit }, { userId, params = {} }) {
    try {
      const response = await axios.get(`/users/${userId}/inventory-logs`, { params })
      return response.data
    } catch (error) {
      console.error('獲取使用者盤點記錄失敗:', error)
      throw error
    }
  },
  
  setFilters({ commit, dispatch }, filters) {
    commit('SET_FILTERS', filters)
    // 重新獲取資料
    dispatch('fetchUsers')
  },
  
  setPage({ commit, dispatch }, page) {
    commit('SET_PAGINATION', { currentPage: page })
    dispatch('fetchUsers')
  },
  
  clearFilters({ commit, dispatch }) {
    commit('SET_FILTERS', {
      role: null,
      isActive: null,
      search: ''
    })
    dispatch('fetchUsers')
  },
  
  clearCurrentUser({ commit }) {
    commit('SET_CURRENT_USER', null)
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
} 