import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  // State
  const loading = ref(false)
  const snackbar = ref({
    show: false,
    message: '',
    color: 'info',
    timeout: 4000
  })
  const drawer = ref(true)

  // Actions
  const setLoading = (state) => {
    loading.value = state
  }

  const showSnackbar = ({ message, color = 'info', timeout = 4000 }) => {
    snackbar.value = {
      show: true,
      message,
      color,
      timeout
    }
  }

  const hideSnackbar = () => {
    snackbar.value.show = false
  }

  const showSuccess = (message) => {
    showSnackbar({ message, color: 'success' })
  }

  const showError = (message) => {
    showSnackbar({ message, color: 'error' })
  }

  const showWarning = (message) => {
    showSnackbar({ message, color: 'warning' })
  }

  const showInfo = (message) => {
    showSnackbar({ message, color: 'info' })
  }

  const toggleDrawer = () => {
    drawer.value = !drawer.value
  }

  return {
    // State
    loading,
    snackbar,
    drawer,
    
    // Actions
    setLoading,
    showSnackbar,
    hideSnackbar,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    toggleDrawer
  }
}) 