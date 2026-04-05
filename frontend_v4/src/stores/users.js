import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/plugins/axios'

export const useUsersStore = defineStore('users', () => {
  // State
  const users = ref([])
  const currentUser = ref(null)
  const stats = ref({
    totalUsers: 0,
    activeUsers: 0,
    bossUsers: 0,
    employeeUsers: 0
  })
  const pagination = ref({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 20
  })
  const filters = ref({
    search: '',
    role: '',
    isActive: null
  })
  const loading = ref(false)

  // Getters
  const activeUsers = computed(() => 
    users.value.filter(user => user.isActive)
  )
  
  const bossUsers = computed(() => 
    users.value.filter(user => user.role === 'boss')
  )
  
  const employeeUsers = computed(() => 
    users.value.filter(user => user.role === 'employee')
  )

  // Actions
  const setUsers = (userList) => {
    users.value = userList
  }

  const setCurrentUser = (user) => {
    currentUser.value = user
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

  const updateUser = (updatedUser) => {
    const index = users.value.findIndex(u => u._id === updatedUser._id)
    if (index !== -1) {
      users.value.splice(index, 1, updatedUser)
    }
    
    if (currentUser.value && currentUser.value._id === updatedUser._id) {
      currentUser.value = updatedUser
    }
  }

  const addUser = (user) => {
    users.value.unshift(user)
    stats.value.totalUsers++
    
    if (user.role === 'boss') {
      stats.value.bossUsers++
    } else {
      stats.value.employeeUsers++
    }
    
    if (user.isActive) {
      stats.value.activeUsers++
    }
  }

  const removeUser = (userId) => {
    const index = users.value.findIndex(u => u._id === userId)
    if (index !== -1) {
      const user = users.value[index]
      users.value.splice(index, 1)
      stats.value.totalUsers--
      
      if (user.role === 'boss') {
        stats.value.bossUsers--
      } else {
        stats.value.employeeUsers--
      }
      
      if (user.isActive) {
        stats.value.activeUsers--
      }
    }
  }

  const clearUsers = () => {
    users.value = []
    currentUser.value = null
  }

  const fetchUsers = async (params = {}) => {
    try {
      setLoading(true)
      
      const response = await api.get('/users', { params })
      const { users: userList, pagination: paginationData, stats: statsData } = response.data

      setUsers(userList)
      setPagination(paginationData)
      setStats(statsData)

      return response.data
    } catch (error) {
      console.error('獲取用戶列表失敗:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const fetchUser = async (userId) => {
    try {
      const response = await api.get(`/users/${userId}`)
      const user = response.data

      setCurrentUser(user)
      updateUser(user)

      return user
    } catch (error) {
      console.error('獲取用戶詳情失敗:', error)
      throw error
    }
  }

  const createUser = async (userData) => {
    try {
      const response = await api.post('/users', userData)
      const user = response.data

      addUser(user)

      return user
    } catch (error) {
      console.error('創建用戶失敗:', error)
      throw error
    }
  }

  const updateUserData = async (userId, userData) => {
    try {
      const response = await api.put(`/users/${userId}`, userData)
      const user = response.data

      updateUser(user)

      return user
    } catch (error) {
      console.error('更新用戶失敗:', error)
      throw error
    }
  }

  const deleteUser = async (userId) => {
    try {
      await api.delete(`/users/${userId}`)
      removeUser(userId)
    } catch (error) {
      console.error('刪除用戶失敗:', error)
      throw error
    }
  }

  const changePassword = async (userId, passwordData) => {
    try {
      const response = await api.post(`/users/${userId}/change-password`, passwordData)
      return response.data
    } catch (error) {
      console.error('修改密碼失敗:', error)
      throw error
    }
  }

  const toggleUserStatus = async (userId) => {
    try {
      const response = await api.post(`/users/${userId}/toggle-status`)
      const user = response.data

      updateUser(user)

      return user
    } catch (error) {
      console.error('切換用戶狀態失敗:', error)
      throw error
    }
  }

  const resetPassword = async (userId) => {
    try {
      const response = await api.post(`/users/${userId}/reset-password`)
      return response.data
    } catch (error) {
      console.error('重設密碼失敗:', error)
      throw error
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/users/stats')
      setStats(response.data)
      return response.data
    } catch (error) {
      console.error('獲取用戶統計失敗:', error)
      throw error
    }
  }

  const getUserActivity = async (userId, params = {}) => {
    try {
      const response = await api.get(`/users/${userId}/activity`, { params })
      return response.data
    } catch (error) {
      console.error('獲取用戶活動記錄失敗:', error)
      throw error
    }
  }

  return {
    // State
    users,
    currentUser,
    stats,
    pagination,
    filters,
    loading,
    
    // Getters
    activeUsers,
    bossUsers,
    employeeUsers,
    
    // Actions
    setUsers,
    setCurrentUser,
    setStats,
    setPagination,
    setFilters,
    setLoading,
    updateUser,
    addUser,
    removeUser,
    clearUsers,
    fetchUsers,
    fetchUser,
    createUser,
    updateUserData,
    deleteUser,
    changePassword,
    toggleUserStatus,
    resetPassword,
    fetchStats,
    getUserActivity
  }
}) 