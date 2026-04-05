import axios from '@/plugins/axios'

const state = {
  logs: [],
  currentLog: null,
  pagination: {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0
  },
  filters: {
    userId: null,
    productId: null,
    startDate: null,
    endDate: null,
    hasError: null
  },
  stats: {
    totalLogs: 0,
    errorLogs: 0,
    todayLogs: 0,
    successRate: 0
  },
  loading: false,
  syncStatus: {
    lastSync: null,
    isRunning: false,
    nextSync: null,
    status: 'idle'
  }
}

const getters = {
  errorLogs: state => state.logs.filter(log => log.hasError),
  todayLogs: state => {
    const today = new Date().toDateString()
    return state.logs.filter(log => new Date(log.createdAt).toDateString() === today)
  },
  logsByProduct: state => productId => {
    return state.logs.filter(log => log.productId === productId)
  },
  logsByUser: state => userId => {
    return state.logs.filter(log => log.userId === userId)
  }
}

const mutations = {
  SET_LOGS(state, logs) {
    state.logs = logs
  },
  
  ADD_LOG(state, log) {
    state.logs.unshift(log)
  },
  
  SET_CURRENT_LOG(state, log) {
    state.currentLog = log
  },
  
  SET_PAGINATION(state, pagination) {
    state.pagination = { ...state.pagination, ...pagination }
  },
  
  SET_FILTERS(state, filters) {
    state.filters = { ...state.filters, ...filters }
  },
  
  SET_STATS(state, stats) {
    state.stats = { ...state.stats, ...stats }
  },
  
  SET_LOADING(state, loading) {
    state.loading = loading
  },
  
  SET_SYNC_STATUS(state, status) {
    state.syncStatus = { ...state.syncStatus, ...status }
  }
}

const actions = {
  async countProduct({ commit, dispatch }, { productId, countedQty, note, method = 'manual' }) {
    try {
      commit('SET_LOADING', true)
      
      const response = await axios.post(`/inventory/count/${productId}`, {
        countedQty,
        note,
        method
      })
      
      const log = response.data.log
      commit('ADD_LOG', log)
      
      await dispatch('ui/showSuccess', `商品盤點完成！數量：${countedQty}`, { root: true })
      
      // 更新商品資料
      await dispatch('products/fetchProduct', productId, { root: true })
      
      return response.data
    } catch (error) {
      const message = (error.response && error.response.data && error.response.data.message) || '盤點失敗';
      await dispatch('ui/showError', message, { root: true });
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },

  async batchCountProducts({ commit, dispatch }, counts) {
    try {
      commit('SET_LOADING', true);

      const url = '/inventory/count/batch';
      const payload = { counts };

      // --- DEBUGGING: Log the exact request before sending ---
      console.log('--- Sending BATCH COUNT request ---');
      console.log('URL:', url);
      console.log('Payload:', JSON.stringify(payload, null, 2));
      // --- END DEBUGGING ---

      const response = await axios.post(url, payload);
      
      await dispatch('ui/showSuccess', '批量盤點成功', { root: true });
      
      // Optionally, you might want to refresh products data
      // For now, we rely on the component to do that
      
      return response.data;
    } catch (error) {
      const message = (error.response && error.response.data && error.response.data.message) || '批量盤點失敗';
      await dispatch('ui/showError', message, { root: true });
      throw error;
    } finally {
      commit('SET_LOADING', false);
    }
  },
  
  async fetchLogs({ commit, state }, params = {}) {
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
      
      const response = await axios.get('/inventory/logs', { params: queryParams })
      const { logs, pagination } = response.data
      
      commit('SET_LOGS', logs)
      commit('SET_PAGINATION', pagination)
      
      return response.data
    } catch (error) {
      console.error('獲取盤點記錄失敗:', error)
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },
  
  async fetchStats({ commit }, params = {}) {
    try {
      const response = await axios.get('/inventory/logs/stats', { params })
      commit('SET_STATS', response.data)
      return response.data
    } catch (error) {
      console.error('獲取盤點統計失敗:', error)
      throw error
    }
  },
  
  async fetchSyncStatus({ commit }) {
    try {
      const response = await axios.get('/inventory/sync/status')
      commit('SET_SYNC_STATUS', response.data)
      return response.data
    } catch (error) {
      console.error('獲取同步狀態失敗:', error)
      throw error
    }
  },
  
  async triggerManualSync({ commit, dispatch }) {
    try {
      commit('SET_LOADING', true)
      
      const response = await axios.post('/inventory/sync/manual')
      
      await dispatch('ui/showSuccess', 'WooCommerce 手動同步已觸發', { root: true })
      await dispatch('fetchSyncStatus')
      
      return response.data
    } catch (error) {
      const message = error.response?.data?.message || '觸發同步失敗'
      await dispatch('ui/showError', message, { root: true })
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },
  
  setFilters({ commit, dispatch }, filters) {
    commit('SET_FILTERS', filters)
    // 重新獲取資料
    dispatch('fetchLogs')
  },
  
  setPage({ commit, dispatch }, page) {
    commit('SET_PAGINATION', { currentPage: page })
    dispatch('fetchLogs')
  },
  
  clearFilters({ commit, dispatch }) {
    commit('SET_FILTERS', {
      userId: null,
      productId: null,
      startDate: null,
      endDate: null,
      hasError: null
    })
    dispatch('fetchLogs')
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
} 