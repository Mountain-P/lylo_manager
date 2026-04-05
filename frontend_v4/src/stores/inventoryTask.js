import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/plugins/axios'

export const useInventoryTaskStore = defineStore('inventoryTask', () => {
  const activeTask = ref(null)
  const tasks = ref([])
  const loading = ref(false)

  const hasActiveTask = computed(() => !!activeTask.value)

  const fetchActiveTask = async () => {
    try {
      const response = await api.get('/inventory-tasks/active')
      activeTask.value = response.data.task || null
      return activeTask.value
    } catch (error) {
      console.error('取得進行中任務失敗:', error)
      activeTask.value = null
      return null
    }
  }

  const createTask = async ({ date, personnel, note }) => {
    try {
      loading.value = true
      const response = await api.post('/inventory-tasks', { date, personnel, note })
      activeTask.value = response.data.task
      return response.data.task
    } catch (error) {
      console.error('建立盤點任務失敗:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const completeTask = async (taskId) => {
    try {
      loading.value = true
      const response = await api.put(`/inventory-tasks/${taskId}/complete`)
      activeTask.value = null
      return response.data.task
    } catch (error) {
      console.error('完成盤點任務失敗:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchTasks = async (params = {}) => {
    try {
      const response = await api.get('/inventory-tasks', { params })
      tasks.value = response.data.tasks || []
      return tasks.value
    } catch (error) {
      console.error('取得任務列表失敗:', error)
      return []
    }
  }

  const fetchActiveUsers = async () => {
    try {
      const response = await api.get('/users/active-list')
      return response.data.users || []
    } catch (error) {
      console.error('取得使用者列表失敗:', error)
      return []
    }
  }

  return {
    activeTask,
    tasks,
    loading,
    hasActiveTask,
    fetchActiveTask,
    createTask,
    completeTask,
    fetchTasks,
    fetchActiveUsers
  }
})
