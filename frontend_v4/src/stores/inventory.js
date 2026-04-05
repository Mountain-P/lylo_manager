import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/plugins/axios'

export const useInventoryStore = defineStore('inventory', () => {
  // State
  const logs = ref([])
  const currentLog = ref(null)
  const pagination = ref({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0
  })
  const filters = ref({
    userId: null,
    productId: null,
    startDate: null,
    endDate: null,
    hasError: null
  })
  const stats = ref({
    totalLogs: 0,
    errorLogs: 0,
    todayLogs: 0,
    successRate: 0
  })
  const loading = ref(false)
  const syncStatus = ref({
    lastSync: null,
    isRunning: false,
    nextSync: null,
    status: 'idle'
  })

  // Getters
  const errorLogs = computed(() => 
    logs.value.filter(log => log.hasError)
  )
  
  const todayLogs = computed(() => {
    const today = new Date().toDateString()
    return logs.value.filter(log => 
      new Date(log.createdAt).toDateString() === today
    )
  })
  
  const logsByProduct = computed(() => (productId) => {
    return logs.value.filter(log => log.productId === productId)
  })
  
  const logsByUser = computed(() => (userId) => {
    return logs.value.filter(log => log.userId === userId)
  })

  // Actions
  const setLogs = (logList) => {
    logs.value = logList
  }

  const addLog = (log) => {
    logs.value.unshift(log)
  }

  const setCurrentLog = (log) => {
    currentLog.value = log
  }

  const setPagination = (paginationData) => {
    pagination.value = { ...pagination.value, ...paginationData }
  }

  const setFilters = (filterData) => {
    filters.value = { ...filters.value, ...filterData }
  }

  const setStats = (statsData) => {
    stats.value = { ...stats.value, ...statsData }
  }

  const setLoading = (state) => {
    loading.value = state
  }

  const setSyncStatus = (status) => {
    syncStatus.value = { ...syncStatus.value, ...status }
  }

  const countProduct = async ({ productId, countedQty, note, method = 'manual' }) => {
    try {
      setLoading(true)
      
      const response = await api.post(`/inventory/count/${productId}`, {
        countedQty,
        note,
        method
      })
      
      const log = response.data.log
      addLog(log)
      
      return log
    } catch (error) {
      console.error('商品盤點失敗:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const batchCountProducts = async (countData) => {
    try {
      setLoading(true)
      
      const response = await api.post('/inventory/count/batch', {
        counts: countData
      })
      
      console.log('批量盤點API響應:', response.data)
      
      // 後端返回的是 results 不是 logs
      const results = response.data.results || []
      
      // 如果需要添加到logs，創建簡單的log條目
      results.forEach(result => {
        if (result.status === 'updated') {
          addLog({
            productId: result.productId,
            method: 'manual-batch',
            status: 'success',
            createdAt: new Date()
          })
        }
      })
      
      return response.data
    } catch (error) {
      console.error('批量盤點失敗:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async (params = {}) => {
    try {
      setLoading(true)
      
      const response = await api.get('/inventory/logs', { params })
      const { logs: logList, pagination: paginationData, stats: statsData } = response.data
      
      setLogs(logList)
      setPagination(paginationData)
      
      // 只有當API返回統計數據時才更新
      if (statsData) {
        setStats(statsData)
      }

      return response.data
    } catch (error) {
      console.error('❌ 獲取盤點記錄失敗:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const fetchLog = async (logId) => {
    try {
      const response = await api.get(`/inventory/logs/${logId}`)
      const log = response.data

      setCurrentLog(log)

      return log
    } catch (error) {
      console.error('獲取盤點記錄詳情失敗:', error)
      throw error
    }
  }

  const deleteLog = async (logId) => {
    try {
      await api.delete(`/inventory/logs/${logId}`)
      
      const index = logs.value.findIndex(log => log._id === logId)
      if (index !== -1) {
        logs.value.splice(index, 1)
      }
    } catch (error) {
      console.error('刪除盤點記錄失敗:', error)
      throw error
    }
  }

  const exportLogs = async (params = {}) => {
    try {
      const response = await api.get('/inventory/logs/export', {
        params,
        responseType: 'blob'
      })
      
      return response.data
    } catch (error) {
      console.error('匯出盤點記錄失敗:', error)
      throw error
    }
  }

  const fetchSyncStatus = async () => {
    try {
      const response = await api.get('/inventory/sync/status')
      setSyncStatus(response.data)
      
      return response.data
    } catch (error) {
      console.error('獲取同步狀態失敗:', error)
      throw error
    }
  }

  const triggerManualSync = async () => {
    try {
      const response = await api.post('/inventory/sync/manual')
      setSyncStatus(response.data)
      
      return response.data
    } catch (error) {
      console.error('觸發手動同步失敗:', error)
      throw error
    }
  }

  const scanBarcode = async (barcode) => {
    try {
      const response = await api.get('/products', { params: { barcode } })
      const products = response.data.products || []
      return products.length > 0 ? products[0] : null
    } catch (error) {
      if (error.response?.status === 404) return null
      console.error('條碼掃描失敗:', error)
      throw error
    }
  }

  const getStats = async (params = {}) => {
    try {
      const response = await api.get('/inventory/stats', { params })
      setStats(response.data)
      
      return response.data
    } catch (error) {
      console.error('獲取盤點統計失敗:', error)
      throw error
    }
  }

  return {
    // State
    logs,
    currentLog,
    pagination,
    filters,
    stats,
    loading,
    syncStatus,
    
    // Getters
    errorLogs,
    todayLogs,
    logsByProduct,
    logsByUser,
    
    // Actions
    setLogs,
    addLog,
    setCurrentLog,
    setPagination,
    setFilters,
    setStats,
    setLoading,
    setSyncStatus,
    countProduct,
    batchCountProducts,
    fetchLogs,
    fetchLog,
    deleteLog,
    exportLogs,
    fetchSyncStatus,
    triggerManualSync,
    scanBarcode,
    getStats
  }
}) 