import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/plugins/axios'

export const useInventoryTaskStore = defineStore('inventoryTask', () => {
  const currentTask = ref(null)
  const tasks = ref([])
  const activeTasks = ref([])
  const loading = ref(false)
  const snapshotLoading = ref(false)

  const hasCurrentTask = computed(() => !!currentTask.value)
  const currentTaskId = computed(() => currentTask.value?._id || null)
  const currentSummary = computed(() => currentTask.value?.summary || {
    totalProducts: 0,
    countedProducts: 0,
    errorProducts: 0,
    completionRate: 0
  })

  const setCurrentTask = (task) => {
    currentTask.value = task
    if (task) {
      localStorage.setItem('currentTaskId', task._id)
    } else {
      localStorage.removeItem('currentTaskId')
    }
  }

  const createTask = async ({ date, personnel, note, scope = 'all', categories = [] }) => {
    try {
      loading.value = true
      const response = await api.post('/inventory-tasks', {
        date, personnel, note, scope, categories
      })
      const task = response.data.task
      setCurrentTask(task)
      return task
    } catch (error) {
      console.error('建立盤點任務失敗:', error)
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

  const fetchActiveTasks = async () => {
    try {
      const response = await api.get('/inventory-tasks/active')
      activeTasks.value = response.data.tasks || []
      return activeTasks.value
    } catch (error) {
      console.error('取得進行中任務失敗:', error)
      activeTasks.value = []
      return []
    }
  }

  const fetchActiveTask = async () => {
    await fetchActiveTasks()
    return activeTasks.value[0] || null
  }

  const fetchTaskDetail = async (taskId) => {
    try {
      const response = await api.get(`/inventory-tasks/${taskId}`)
      return response.data.task
    } catch (error) {
      console.error('取得任務詳情失敗:', error)
      return null
    }
  }

  const resumeTask = async (taskId) => {
    try {
      loading.value = true
      const task = await fetchTaskDetail(taskId)
      if (task) {
        setCurrentTask(task)
      }
      return task
    } catch (error) {
      console.error('恢復任務失敗:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const restoreTask = async () => {
    const savedId = localStorage.getItem('currentTaskId')
    if (!savedId) return null
    try {
      const task = await fetchTaskDetail(savedId)
      if (task && task.status === 'in_progress') {
        setCurrentTask(task)
        return task
      }
      localStorage.removeItem('currentTaskId')
      return null
    } catch {
      localStorage.removeItem('currentTaskId')
      return null
    }
  }

  const completeTask = async (taskId) => {
    try {
      loading.value = true
      const response = await api.put(`/inventory-tasks/${taskId}/complete`)
      if (currentTask.value?._id === taskId) {
        setCurrentTask(null)
      }
      return response.data.task
    } catch (error) {
      console.error('完成盤點任務失敗:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const refreshSnapshot = async (taskId) => {
    try {
      snapshotLoading.value = true
      const response = await api.put(`/inventory-tasks/${taskId || currentTaskId.value}/refresh`)
      if (currentTask.value) {
        currentTask.value.summary = response.data.summary
        currentTask.value.lastRefreshedAt = response.data.lastRefreshedAt
      }
      return response.data
    } catch (error) {
      console.error('重新整理快照失敗:', error)
      throw error
    } finally {
      snapshotLoading.value = false
    }
  }

  const fetchSnapshot = async (taskId, params = {}) => {
    try {
      snapshotLoading.value = true
      const response = await api.get(`/inventory-tasks/${taskId || currentTaskId.value}/snapshot`, { params })
      return response.data
    } catch (error) {
      console.error('取得快照失敗:', error)
      throw error
    } finally {
      snapshotLoading.value = false
    }
  }

  const updateCurrentSummary = (summary) => {
    if (currentTask.value && summary) {
      currentTask.value.summary = summary
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

  const clearCurrentTask = () => {
    setCurrentTask(null)
  }

  return {
    currentTask,
    tasks,
    activeTasks,
    loading,
    snapshotLoading,
    hasCurrentTask,
    currentTaskId,
    currentSummary,
    setCurrentTask,
    createTask,
    fetchTasks,
    fetchActiveTasks,
    fetchActiveTask,
    fetchTaskDetail,
    resumeTask,
    restoreTask,
    completeTask,
    refreshSnapshot,
    fetchSnapshot,
    updateCurrentSummary,
    fetchActiveUsers,
    clearCurrentTask,
    // backward compat
    get activeTask() { return currentTask.value },
    get hasActiveTask() { return hasCurrentTask.value }
  }
})
