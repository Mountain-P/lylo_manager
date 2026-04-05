import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api from '@/plugins/axios'

export const useOrdersStore = defineStore('orders', () => {
  // State
  const orders = ref([])
  const preOrderStats = ref([])
  const currentOrder = ref(null)
  const loading = ref(false)
  
  const pagination = ref({
    currentPage: 1,
    totalPages: 0,
    totalOrders: 0,
    perPage: 20
  })

  const filters = ref({
    status: 'any',
    search: ''
  })

  const summary = ref({
    totalPreOrderProducts: 0,
    productsWithOrders: 0,
    totalOrders: 0,
    totalOrderQty: 0,
    totalNeedToPurchase: 0
  })

  // Getters
  const hasOrders = computed(() => orders.value.length > 0)
  const hasPreOrderStats = computed(() => preOrderStats.value.length > 0)
  const totalNeedToPurchase = computed(() => summary.value.totalNeedToPurchase)

  // Mutations
  const setOrders = (orderList) => {
    orders.value = orderList
  }

  const setPreOrderStats = (stats) => {
    preOrderStats.value = stats
  }

  const setCurrentOrder = (order) => {
    currentOrder.value = order
  }

  const setPagination = (paginationData) => {
    pagination.value = paginationData
  }

  const setFilters = (filterData) => {
    filters.value = { ...filters.value, ...filterData }
  }

  const setSummary = (summaryData) => {
    summary.value = summaryData
  }

  const setLoading = (value) => {
    loading.value = value
  }

  const clearOrders = () => {
    orders.value = []
    currentOrder.value = null
  }

  const clearPreOrderStats = () => {
    preOrderStats.value = []
    summary.value = {
      totalPreOrderProducts: 0,
      productsWithOrders: 0,
      totalOrders: 0,
      totalOrderQty: 0,
      totalNeedToPurchase: 0
    }
  }

  // Actions
  const fetchOrders = async (params = {}) => {
    try {
      setLoading(true)
      
      const requestParams = {
        page: params.page || pagination.value.currentPage,
        per_page: params.per_page || pagination.value.perPage,
        status: params.status || filters.value.status,
        search: params.search || filters.value.search
      }

      const response = await api.get('/orders', { params: requestParams })
      const { orders: orderList, pagination: paginationData } = response.data

      setOrders(orderList)
      setPagination(paginationData)

      return response.data
    } catch (error) {
      console.error('獲取訂單列表失敗:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const fetchOrder = async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`)
      const order = response.data.order

      setCurrentOrder(order)

      return order
    } catch (error) {
      console.error('獲取訂單詳情失敗:', error)
      throw error
    }
  }

  const fetchPreOrderStats = async (filters = {}) => {
    try {
      setLoading(true)
      
      console.log('📊 開始獲取預購商品統計...', filters)
      
      const params = {}
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate
      if (filters.statuses && filters.statuses.length > 0) {
        params.statuses = filters.statuses.join(',')
      }
      if (filters.excludeCategories && filters.excludeCategories.length > 0) {
        params.excludeCategories = filters.excludeCategories.join(',')
      }
      if (filters.excludeProductNames) {
        params.excludeProductNames = filters.excludeProductNames
      }
      
      const response = await api.get('/orders/stats/pre-order', { params })
      const { stats, summary: summaryData } = response.data

      console.log('✅ 預購商品統計獲取成功:', stats.length, '個商品')

      setPreOrderStats(stats)
      setSummary(summaryData)

      return response.data
    } catch (error) {
      console.error('❌ 獲取預購商品統計失敗:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      console.log('📂 開始獲取商品分類列表...')
      
      const response = await api.get('/orders/categories')
      const { categories } = response.data

      console.log('✅ 商品分類獲取成功:', categories.length, '個分類')

      return categories
    } catch (error) {
      console.error('❌ 獲取商品分類失敗:', error)
      throw error
    }
  }

  const updateFilters = (filterData) => {
    setFilters(filterData)
    // 更新篩選條件後，重置到第一頁
    pagination.value.currentPage = 1
  }

  const changePage = async (page) => {
    pagination.value.currentPage = page
    await fetchOrders()
  }

  const updateOnOrderQty = async (productId, onOrderQty) => {
    try {
      console.log(`📦 更新商品 ${productId} 的已訂購數量為 ${onOrderQty}`)
      
      const response = await api.put(`/products/${productId}/on-order`, {
        onOrderQty
      })

      console.log('✅ 已訂購數量更新成功')

      // 更新 preOrderStats 中對應商品的資料
      const index = preOrderStats.value.findIndex(item => item.productId === productId)
      if (index !== -1) {
        preOrderStats.value[index].onOrderQty = onOrderQty
        preOrderStats.value[index].lastOrderDate = response.data.product.lastOrderDate
        // 重新計算實際缺貨
        const item = preOrderStats.value[index]
        item.actualShortage = Math.max(0, item.totalOrderQty - item.currentStockQty - item.onOrderQty)
      }

      return response.data
    } catch (error) {
      console.error('❌ 更新已訂購數量失敗:', error)
      throw error
    }
  }

  return {
    // State
    orders,
    preOrderStats,
    currentOrder,
    loading,
    pagination,
    filters,
    summary,
    
    // Getters
    hasOrders,
    hasPreOrderStats,
    totalNeedToPurchase,
    
    // Actions
    fetchOrders,
    fetchOrder,
    fetchPreOrderStats,
    fetchCategories,
    updateOnOrderQty,
    updateFilters,
    changePage,
    clearOrders,
    clearPreOrderStats
  }
})

