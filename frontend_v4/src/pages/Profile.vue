<template>
  <div>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">個人資料</h1>
      </v-col>
    </v-row>

    <v-row>
      <!-- 基本資料 -->
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title>基本資料</v-card-title>
          <v-card-text>
            <v-form ref="profileFormRef" v-model="profileForm.valid">
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="profileForm.name"
                    :rules="nameRules"
                    label="姓名"
                    variant="outlined"
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="profileForm.email"
                    :rules="emailRules"
                    label="電子郵件"
                    type="email"
                    variant="outlined"
                    required
                    readonly
                    hint="電子郵件無法修改"
                  ></v-text-field>
                </v-col>
              </v-row>
              
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field
                    :model-value="profileForm.role === 'boss' ? '管理員' : '一般員工'"
                    label="角色"
                    variant="outlined"
                    readonly
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    :model-value="formatDate(authStore.user?.createdAt)"
                    label="建立時間"
                    variant="outlined"
                    readonly
                  ></v-text-field>
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              :loading="profileForm.loading"
              :disabled="!profileForm.valid || !hasProfileChanges"
              @click="updateProfile"
            >
              更新資料
            </v-btn>
          </v-card-actions>
        </v-card>
        
        <!-- 密碼修改 -->
        <v-card class="mt-4">
          <v-card-title>密碼設定</v-card-title>
          <v-card-text>
            <v-form ref="passwordFormRef" v-model="passwordForm.valid">
              <v-text-field
                v-model="passwordForm.currentPassword"
                :rules="currentPasswordRules"
                label="目前密碼"
                type="password"
                variant="outlined"
                required
              ></v-text-field>
              
              <v-text-field
                v-model="passwordForm.newPassword"
                :rules="newPasswordRules"
                label="新密碼"
                type="password"
                variant="outlined"
                required
              ></v-text-field>
              
              <v-text-field
                v-model="passwordForm.confirmPassword"
                :rules="confirmPasswordRules"
                label="確認新密碼"
                type="password"
                variant="outlined"
                required
              ></v-text-field>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              variant="outlined"
              @click="resetPasswordForm"
            >
              重設
            </v-btn>
            <v-btn
              color="primary"
              :loading="passwordForm.loading"
              :disabled="!passwordForm.valid"
              @click="changePassword"
            >
              修改密碼
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      
      <!-- 統計資訊 -->
      <v-col cols="12" md="4">
        <v-card class="mb-4">
          <v-card-title>
            <v-row align="center">
              <v-col>
                <v-avatar color="primary" size="48" class="mr-3">
                  <span class="white--text text-h6">
                    {{ getInitials(authStore.user?.name) }}
                  </span>
                </v-avatar>
                {{ authStore.user?.name }}
              </v-col>
            </v-row>
          </v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title>角色</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip
                    :color="authStore.user?.role === 'boss' ? 'primary' : 'secondary'"
                    size="small"
                    variant="flat"
                  >
                    {{ authStore.user?.role === 'boss' ? '管理員' : '一般員工' }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
              
              <v-list-item>
                <v-list-item-title>上次登入</v-list-item-title>
                <v-list-item-subtitle>
                  {{ authStore.user?.lastLoginAt ? formatDate(authStore.user.lastLoginAt) : '首次登入' }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
        
        <!-- 活動統計 -->
        <v-card>
          <v-card-title>活動統計</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="6">
                <div class="text-center">
                  <div class="text-h4 primary--text">{{ userActivity.totalCounts || 0 }}</div>
                  <div class="text-caption">總盤點次數</div>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="text-center">
                  <div class="text-h4 success--text">{{ userActivity.todayCounts || 0 }}</div>
                  <div class="text-caption">今日盤點</div>
                </div>
              </v-col>
            </v-row>
            
            <v-divider class="my-3"></v-divider>
            
            <v-row>
              <v-col cols="6">
                <div class="text-center">
                  <div class="text-h6 info--text">{{ userActivity.thisWeekCounts || 0 }}</div>
                  <div class="text-caption">本週盤點</div>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="text-center">
                  <div class="text-h6 warning--text">{{ userActivity.thisMonthCounts || 0 }}</div>
                  <div class="text-caption">本月盤點</div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
        
        <!-- 最近盤點記錄 -->
        <v-card class="mt-4">
          <v-card-title>最近盤點記錄</v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item
                v-for="log in recentLogs"
                :key="log._id"
                class="px-0"
              >
                <template #prepend>
                  <v-avatar size="32" class="mr-3">
                    <img 
                      :src="log.product?.wooData?.images?.[0]?.src || '/placeholder.png'" 
                      :alt="log.product?.name"
                    >
                  </v-avatar>
                </template>
                
                <v-list-item-title class="text-body-2">
                  {{ log.product?.name || 'N/A' }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ formatDate(log.createdAt) }} · 數量: {{ log.countedQty }}
                </v-list-item-subtitle>
                
                <template #append>
                  <v-chip
                    :color="log.hasError ? 'error' : 'success'"
                    size="x-small"
                    variant="flat"
                  >
                    {{ log.hasError ? '異常' : '正常' }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            
            <div v-if="recentLogs.length === 0" class="text-center py-4">
              <v-icon color="grey-lighten-1">mdi-inbox</v-icon>
              <p class="text-caption mt-1">暫無盤點記錄</p>
            </div>
          </v-card-text>
          <v-card-actions v-if="recentLogs.length > 0">
            <v-spacer></v-spacer>
            <v-btn
              variant="text"
              size="small"
              @click="$router.push('/inventory/logs')"
            >
              查看全部
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import moment from 'moment'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import api from '@/plugins/axios'

// Stores
const authStore = useAuthStore()
const uiStore = useUIStore()

// Reactive data
const userActivity = ref({
  totalCounts: 0,
  todayCounts: 0,
  thisWeekCounts: 0,
  thisMonthCounts: 0
})
const recentLogs = ref([])

const profileForm = reactive({
  valid: false,
  loading: false,
  name: '',
  email: '',
  role: ''
})

const passwordForm = reactive({
  valid: false,
  loading: false,
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const profileFormRef = ref()
const passwordFormRef = ref()

// Validation rules
const nameRules = [
  v => !!v || '請輸入姓名',
  v => (v && v.length >= 2) || '姓名至少需要2個字元'
]

const emailRules = [
  v => !!v || '請輸入電子郵件',
  v => /.+@.+\..+/.test(v) || '請輸入有效的電子郵件格式'
]

const currentPasswordRules = [
  v => !!v || '請輸入目前密碼'
]

const newPasswordRules = [
  v => !!v || '請輸入新密碼',
  v => (v && v.length >= 6) || '密碼至少需要6個字元',
  v => v !== passwordForm.currentPassword || '新密碼不能與目前密碼相同'
]

const confirmPasswordRules = [
  v => !!v || '請確認新密碼',
  v => v === passwordForm.newPassword || '密碼不符'
]

// Computed
const hasProfileChanges = computed(() => {
  return profileForm.name !== authStore.user?.name
})

// Methods
const formatDate = (date) => {
  return moment(date).format('YYYY/MM/DD HH:mm')
}

const getInitials = (name) => {
  if (!name) return ''
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}

const initProfileForm = () => {
  if (authStore.user) {
    profileForm.name = authStore.user.name
    profileForm.email = authStore.user.email
    profileForm.role = authStore.user.role
  }
}

const updateProfile = async () => {
  const { valid } = await profileFormRef.value.validate()
  if (!valid) return

  profileForm.loading = true
  try {
    const updatedUser = await authStore.updateProfile({
      name: profileForm.name
    })
    
    uiStore.showSuccess('個人資料更新成功')
  } catch (error) {
    console.error('更新資料失敗:', error)
    uiStore.showError('更新資料失敗')
  } finally {
    profileForm.loading = false
  }
}

const changePassword = async () => {
  const { valid } = await passwordFormRef.value.validate()
  if (!valid) return

  passwordForm.loading = true
  try {
    await api.post('/auth/change-password', {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    })
    
    uiStore.showSuccess('密碼修改成功')
    resetPasswordForm()
  } catch (error) {
    console.error('修改密碼失敗:', error)
    if (error.response?.status === 400) {
      uiStore.showError('目前密碼不正確')
    } else {
      uiStore.showError('修改密碼失敗')
    }
  } finally {
    passwordForm.loading = false
  }
}

const resetPasswordForm = () => {
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  if (passwordFormRef.value) {
    passwordFormRef.value.resetValidation()
  }
}

const fetchUserActivity = async () => {
  try {
    const response = await api.get(`/users/${authStore.user._id}/activity`)
    userActivity.value = response.data
  } catch (error) {
    console.error('獲取用戶活動失敗:', error)
  }
}

const fetchRecentLogs = async () => {
  try {
    const response = await api.get('/inventory/logs', {
      params: {
        userId: authStore.user._id,
        limit: 5
      }
    })
    recentLogs.value = response.data.logs || []
  } catch (error) {
    console.error('獲取最近記錄失敗:', error)
  }
}

// 頁面載入時初始化
onMounted(async () => {
  initProfileForm()
  
  await Promise.all([
    fetchUserActivity(),
    fetchRecentLogs()
  ])
})
</script>

<style scoped>
.v-avatar img {
  border-radius: 50%;
}
</style> 