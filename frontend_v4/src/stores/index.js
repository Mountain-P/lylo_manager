// Utilities
import { createPinia } from 'pinia'

const pinia = createPinia()

export default pinia

// 匯出所有 stores
export { useAuthStore } from './auth'
export { useUIStore } from './ui'
export { useProductsStore } from './products'
export { useInventoryStore } from './inventory'
export { useUsersStore } from './users'
