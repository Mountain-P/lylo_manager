import Vue from 'vue'
import axios from '@/plugins/axios'

const state = {
  products: [],
  currentProduct: null,
  stats: {
    totalProducts: 0,
    countedProducts: 0,
    errorProducts: 0,
    totalExpected: 0,
    totalCounted: 0,
    totalSales: 0
  },
  pagination: {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 20
  },
  filters: {
    search: '',
    errorOnly: false
  },
  loading: false
}

const getters = {
  products: state => state.products,
  currentProduct: state => state.currentProduct,
  stats: state => state.stats,
  pagination: state => state.pagination,
  filters: state => state.filters,
  loading: state => state.loading,
  
  // 獲取有異常的商品
  errorProducts: state => state.products.filter(product => product.isCountError),
  
  // 計算完成率
  completionRate: state => {
    if (state.stats.totalProducts === 0) return 0
    return Math.round((state.stats.countedProducts / state.stats.totalProducts) * 100)
  },
  
  // 計算異常率
  errorRate: state => {
    if (state.stats.totalProducts === 0) return 0
    return Math.round((state.stats.errorProducts / state.stats.totalProducts) * 100)
  }
}

const mutations = {
  SET_PRODUCTS(state, products) {
    state.products = products
  },
  SET_CURRENT_PRODUCT(state, product) {
    state.currentProduct = product
  },
  SET_STATS(state, stats) {
    state.stats = stats
  },
  SET_PAGINATION(state, pagination) {
    state.pagination = pagination
  },
  SET_FILTERS(state, filters) {
    state.filters = { ...state.filters, ...filters }
  },
  SET_LOADING(state, loading) {
    state.loading = loading
  },
  UPDATE_PRODUCT(state, updatedProduct) {
    const index = state.products.findIndex(p => p._id === updatedProduct._id)
    if (index !== -1) {
      state.products.splice(index, 1, updatedProduct)
    }
    
    // 如果是當前商品，也更新
    if (state.currentProduct && state.currentProduct._id === updatedProduct._id) {
      state.currentProduct = updatedProduct
    }
  },
  ADD_PRODUCT(state, product) {
    state.products.unshift(product)
    state.stats.totalProducts++
  },
  REMOVE_PRODUCT(state, productId) {
    const index = state.products.findIndex(p => p._id === productId)
    if (index !== -1) {
      state.products.splice(index, 1)
      state.stats.totalProducts--
    }
  },
  CLEAR_PRODUCTS(state) {
    state.products = []
    state.currentProduct = null
  },
  SET_PRODUCT_VARIATIONS(state, { productId, variations }) {
    const product = state.products.find(p => p._id === productId);
    if (product) {
      // Use Vue.set to ensure reactivity
      Vue.set(product, 'variations', variations);
    }
  }
}

const actions = {
  // 獲取商品列表
  async fetchProducts({ commit, state, dispatch }, params = {}) {
    try {
      commit('SET_LOADING', true)
      
      const queryParams = {
        page: state.pagination.currentPage,
        limit: state.pagination.itemsPerPage,
        ...state.filters,
        ...params
      }

      const response = await axios.get('/products', { params: queryParams })
      const { products, pagination } = response.data

      commit('SET_PRODUCTS', products)
      commit('SET_PAGINATION', pagination)

      return products
    } catch (error) {
      // 如果是 404 Not Found，表示條碼或 SKU 搜尋無結果
      if (error.response && error.response.status === 404) {
        commit('SET_PRODUCTS', []); // 清空列表
        commit('SET_PAGINATION', { totalItems: 0, totalPages: 1 }); // 重置分頁
        dispatch('ui/showWarning', error.response.data.message || '找不到對應的商品', { root: true });
        return; // 處理完畢，直接返回，不再拋出錯誤
      }
      // 其他錯誤會由 axios interceptor 處理
      throw error; 
    } finally {
      commit('SET_LOADING', false)
    }
  },

  async fetchVariations({ commit }, productId) {
    try {
      // We don't set loading here to avoid global spinner for expansions
      const response = await axios.get(`/products/${productId}/variations`);
      const { variations } = response.data;
      commit('SET_PRODUCT_VARIATIONS', { productId, variations });
      return variations;
    } catch (error) {
      console.error(`獲取型號失敗 (ProductID: ${productId}):`, error);
      // Optionally dispatch a UI error
      return [];
    }
  },

  // 搜尋商品（條碼或SKU）
  async searchProduct({ commit, dispatch }, { barcode, sku }) {
    try {
      let params = {}
      if (barcode) params.barcode = barcode
      if (sku) params.sku = sku

      const response = await axios.get('/products', { params })
      const { product } = response.data

      commit('SET_CURRENT_PRODUCT', product)

      dispatch('ui/showSuccess', '商品搜尋成功', { root: true })

      return product
    } catch (error) {
      if (error.response && error.response.status === 404) {
        dispatch('ui/showWarning', '找不到對應的商品', {
          root: true
        })
      }
      throw error
    }
  },

  // 獲取商品統計
  async fetchStats({ commit }) {
    const response = await axios.get('/products/stats')
    const { stats } = response.data

    commit('SET_STATS', stats)

    return stats
  },

  // 獲取異常商品
  // eslint-disable-next-line no-unused-vars
  async fetchErrorProducts({ commit, dispatch }) {
    const response = await axios.get('/products/errors')
    const { products } = response.data

    dispatch('ui/showInfo', `發現 ${products.length} 個盤點異常商品`, { root: true })

    return products
  },

  // 獲取單一商品詳情
  async fetchProduct({ commit }, productId) {
    const response = await axios.get(`/products/${productId}`)
    const { product } = response.data

    commit('SET_CURRENT_PRODUCT', product)

    return product
  },

  // 更新商品資料（僅老闆可用）
  async updateProduct({ commit, dispatch }, { productId, productData }) {
    const response = await axios.put(`/products/${productId}`, productData)
    const { product } = response.data

    commit('UPDATE_PRODUCT', product)

    dispatch('ui/showSuccess', '商品資料更新成功', { root: true })

    return product
  },

  // 新增商品（僅老闆可用）
  async createProduct({ commit, dispatch }, productData) {
    const response = await axios.post('/products', productData)
    const { product } = response.data

    commit('ADD_PRODUCT', product)

    dispatch('ui/showSuccess', '商品新增成功', { root: true })

    return product
  },

  // 刪除商品（僅老闆可用）
  async deleteProduct({ commit, dispatch }, productId) {
    await axios.delete(`/products/${productId}`)

    commit('REMOVE_PRODUCT', productId)

    dispatch('ui/showSuccess', '商品刪除成功', { root: true })
  },

  // 設定篩選條件
  setFilters({ commit, dispatch }, filters) {
    commit('SET_FILTERS', filters)
    
    // 重新載入商品列表
    dispatch('fetchProducts')
  },

  // 設定頁碼
  setPage({ commit, dispatch }, page) {
    commit('SET_PAGINATION', { 
      ...state.pagination, 
      currentPage: page 
    })
    
    // 重新載入商品列表
    dispatch('fetchProducts')
  },

  // 清除當前商品
  clearCurrentProduct({ commit }) {
    commit('SET_CURRENT_PRODUCT', null)
  },

  // 條碼掃描搜尋
  async scanBarcode({ dispatch }, barcode) {
    const product = await dispatch('searchProduct', { barcode })
      
    return product
  },

  // 重新載入商品列表（保持當前篩選條件）
  async refreshProducts({ dispatch }) {
    await dispatch('fetchProducts')
    await dispatch('fetchStats')
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
} 