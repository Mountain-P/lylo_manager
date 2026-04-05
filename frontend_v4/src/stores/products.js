import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/plugins/axios'

export const useProductsStore = defineStore('products', () => {
  // State
  const products = ref([])
  const currentProduct = ref(null)
  const stats = ref({
    totalProducts: 0,
    countedProducts: 0,
    errorProducts: 0,
    totalExpected: 0,
    totalCounted: 0,
    totalSales: 0
  })
  const pagination = ref({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 20
  })
  const filters = ref({
    search: '',
    errorOnly: false,
    inStockOnly: false,
    category: '',
    sortBy: 'wooCreatedAt_desc'
  })
  const loading = ref(false)
  const categories = ref([])

  // Getters
  const errorProducts = computed(() =>
    products.value.filter(product => product.isCountError)
  )

  const completionRate = computed(() => {
    if (stats.value.totalProducts === 0) return 0
    return Math.round((stats.value.countedProducts / stats.value.totalProducts) * 100)
  })

  const errorRate = computed(() => {
    if (stats.value.totalProducts === 0) return 0
    return Math.round((stats.value.errorProducts / stats.value.totalProducts) * 100)
  })

  // Actions
  const setProducts = (productList) => {
    products.value = productList
  }

  const setCurrentProduct = (product) => {
    currentProduct.value = product
  }

  const setStats = (statsData) => {
    stats.value = { ...stats.value, ...statsData }
  }

  const setPagination = (paginationData) => {
    pagination.value = { ...pagination.value, ...paginationData }
  }

  const setFilters = (filterData) => {
    filters.value = { ...filters.value, ...filterData }
  }

  const setLoading = (state) => {
    loading.value = state
  }

  const updateProduct = (updatedProduct) => {
    const index = products.value.findIndex(p => p._id === updatedProduct._id)
    if (index !== -1) {
      products.value.splice(index, 1, updatedProduct)
    }

    if (currentProduct.value && currentProduct.value._id === updatedProduct._id) {
      currentProduct.value = updatedProduct
    }
  }

  const addProduct = (product) => {
    products.value.unshift(product)
    stats.value.totalProducts++
  }

  const removeProduct = (productId) => {
    const index = products.value.findIndex(p => p._id === productId)
    if (index !== -1) {
      products.value.splice(index, 1)
      stats.value.totalProducts--
    }
  }

  const clearProducts = () => {
    products.value = []
    currentProduct.value = null
  }

  const setProductVariations = ({ productId, variations }) => {
    const product = products.value.find(p => p._id === productId)
    if (product) {
      product.variations = variations
    }
  }

  const fetchProducts = async (overrideParams = {}) => {
    try {
      setLoading(true)

      // 結合 store 狀態和傳入的參數
      const queryParams = {
        page: pagination.value.currentPage,
        limit: pagination.value.itemsPerPage,
        ...filters.value,
        ...overrideParams
      }

      // 搜尋統一走文字模糊搜尋（後端已支援 name/sku/barcode regex）
      // 條碼精確搜尋僅用於掃碼頁面，不在搜尋框處理

      const response = await api.get('/products', { params: queryParams })
      const { products: productList, pagination: paginationData } = response.data

      setProducts(productList)
      setPagination(paginationData)

      return response.data
    } catch (error) {
      console.error('獲取商品列表失敗:', error)

      // 如果是 404，可能是搜尋無結果
      if (error.response && error.response.status === 404) {
        setProducts([])
        setPagination({
          ...pagination.value,
          totalItems: 0,
          totalPages: 1,
          currentPage: 1
        })
        return { products: [], pagination: pagination.value }
      }

      throw error
    } finally {
      setLoading(false)
    }
  }

  const fetchProduct = async (productId) => {
    try {
      const response = await api.get(`/products/${productId}`)
      const product = response.data.product || response.data

      setCurrentProduct(product)
      updateProduct(product)

      return product
    } catch (error) {
      console.error('獲取商品詳情失敗:', error)
      throw error
    }
  }

  const fetchVariations = async (productId, params = {}) => {
    try {
      const response = await api.get(`/products/${productId}/variations`, { params })
      const { variations } = response.data

      setProductVariations({ productId, variations })

      return variations
    } catch (error) {
      console.error('獲取商品型號失敗:', error)
      return []
    }
  }

  const createProduct = async (productData) => {
    try {
      const response = await api.post('/products', productData)
      const product = response.data

      addProduct(product)

      return product
    } catch (error) {
      console.error('創建商品失敗:', error)
      throw error
    }
  }

  const updateProductData = async (productId, productData) => {
    try {
      const response = await api.put(`/products/${productId}`, productData)
      const product = response.data

      updateProduct(product)

      return product
    } catch (error) {
      console.error('更新商品失敗:', error)
      throw error
    }
  }

  const deleteProduct = async (productId) => {
    try {
      await api.delete(`/products/${productId}`)
      removeProduct(productId)
    } catch (error) {
      console.error('刪除商品失敗:', error)
      throw error
    }
  }

  const syncProducts = async () => {
    try {
      const response = await api.post('/products/sync')
      return response.data
    } catch (error) {
      console.error('同步商品失敗:', error)
      throw error
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/products/stats')
      setStats(response.data)
      return response.data
    } catch (error) {
      console.error('獲取統計資料失敗:', error)
      throw error
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await api.get('/products/categories')
      categories.value = response.data.categories || []
      return categories.value
    } catch (error) {
      console.error('獲取商品分類失敗:', error)
      return []
    }
  }

  // 獲取銷售排行
  const salesRanking = ref([])
  const salesRankingSummary = ref({
    totalProducts: 0,
    totalSoldQuantity: 0,
    totalRevenue: 0,
    totalOrders: 0
  })
  const salesRankingLoading = ref(false)

  const fetchSalesRanking = async (filters = {}) => {
    try {
      salesRankingLoading.value = true
      const response = await api.get('/products/stats/sales-ranking', { params: filters })

      salesRanking.value = response.data.data || []
      salesRankingSummary.value = response.data.summary || {
        totalProducts: 0,
        totalSoldQuantity: 0,
        totalRevenue: 0,
        totalOrders: 0
      }

      return response.data
    } catch (error) {
      console.error('獲取銷售排行失敗:', error)
      throw error
    } finally {
      salesRankingLoading.value = false
    }
  }

  const clearSalesRanking = () => {
    salesRanking.value = []
    salesRankingSummary.value = {
      totalProducts: 0,
      totalSoldQuantity: 0,
      totalRevenue: 0,
      totalOrders: 0
    }
  }

  // 新增：設定頁碼並重新載入資料
  const changePage = async (page) => {
    setPagination({
      ...pagination.value,
      currentPage: page
    })
    await fetchProducts()
  }

  // 新增：設定每頁項目數並重新載入資料
  const changeItemsPerPage = async (itemsPerPage) => {
    setPagination({
      ...pagination.value,
      itemsPerPage,
      currentPage: 1  // 重置到第一頁
    })
    await fetchProducts()
  }

  // 新增：設定篩選條件並重新載入資料
  const changeFilters = async (newFilters) => {
    setFilters(newFilters)
    setPagination({
      ...pagination.value,
      currentPage: 1
    })  // 重置到第一頁
    await fetchProducts()
  }

  // 新增：重新載入資料（保持當前狀態）
  const refreshProducts = async () => {
    await fetchProducts()
    await fetchStats()
  }

  return {
    // State
    products,
    currentProduct,
    stats,
    pagination,
    filters,
    loading,
    categories,
    salesRanking,
    salesRankingSummary,
    salesRankingLoading,

    // Getters
    errorProducts,
    completionRate,
    errorRate,

    // Actions
    setProducts,
    setCurrentProduct,
    setStats,
    setPagination,
    setFilters,
    setLoading,
    updateProduct,
    addProduct,
    removeProduct,
    clearProducts,
    setProductVariations,
    fetchProducts,
    fetchProduct,
    fetchVariations,
    createProduct,
    updateProductData,
    deleteProduct,
    syncProducts,
    fetchStats,
    fetchCategories,
    changePage,
    changeItemsPerPage,
    changeFilters,
    refreshProducts,
    fetchSalesRanking,
    clearSalesRanking
  }
}) 