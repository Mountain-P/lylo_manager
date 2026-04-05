<template>
  <div>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">員工管理</h1>
      </v-col>
    </v-row>

    <!-- 統計卡片 -->
    <v-row class="mb-4">
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 primary--text">{{ usersStore.stats.totalUsers }}</div>
            <div class="text-subtitle-1">總員工數</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 success--text">{{ usersStore.stats.activeUsers }}</div>
            <div class="text-subtitle-1">活躍員工</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 info--text">{{ usersStore.stats.bossUsers }}</div>
            <div class="text-subtitle-1">管理員</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 secondary--text">{{ usersStore.stats.employeeUsers }}</div>
            <div class="text-subtitle-1">一般員工</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card>
      <v-card-title>
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="search"
              append-inner-icon="mdi-magnify"
              label="搜尋員工姓名或信箱"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @input="debouncedSearch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.role"
              :items="roleOptions"
              label="角色篩選"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @update:model-value="fetchData"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.isActive"
              :items="statusOptions"
              label="狀態篩選"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @update:model-value="fetchData"
            ></v-select>
          </v-col>
          <v-col cols="12" md="2" class="text-right">
            <v-btn
              color="primary"
              @click="openUserDialog()"
            >
              <v-icon start>mdi-plus</v-icon>
              新增員工
            </v-btn>
          </v-col>
        </v-row>
      </v-card-title>

      <v-data-table
        :headers="headers"
        :items="usersStore.users"
        :loading="usersStore.loading"
        :items-length="usersStore.pagination.totalItems"
        :items-per-page="usersStore.pagination.itemsPerPage"
        :page="usersStore.pagination.currentPage"
        class="elevation-1"
        loading-text="正在載入員工資料..."
        no-data-text="找不到員工資料"
        @update:page="onPageChange"
        @update:items-per-page="onItemsPerPageChange"
      >
        <template #item.avatar="{ item }">
          <v-avatar color="primary" class="my-2">
            <span class="white--text">{{ getInitials(item.name) }}</span>
          </v-avatar>
        </template>
        
        <template #item.name="{ item }">
          <div>
            <div class="font-weight-bold">{{ item.name }}</div>
            <div class="text-caption text-grey">{{ item.email }}</div>
          </div>
        </template>
        
        <template #item.role="{ item }">
          <v-chip
            :color="item.role === 'boss' ? 'primary' : 'secondary'"
            size="small"
            variant="flat"
          >
            {{ item.role === 'boss' ? '管理員' : '一般員工' }}
          </v-chip>
        </template>
        
        <template #item.isActive="{ item }">
          <v-chip
            :color="item.isActive ? 'success' : 'error'"
            size="small"
            variant="flat"
          >
            {{ item.isActive ? '啟用' : '停用' }}
          </v-chip>
        </template>
        
        <template #item.lastLoginAt="{ item }">
          {{ item.lastLoginAt ? formatDate(item.lastLoginAt) : '從未登入' }}
        </template>
        
        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>
        
        <template #item.actions="{ item }">
          <v-btn
            icon="mdi-eye"
            size="small"
            variant="text"
            @click="viewUserDetail(item)"
          ></v-btn>
          <v-btn
            icon="mdi-pencil"
            size="small"
            variant="text"
            @click="openUserDialog(item)"
          ></v-btn>
          <v-btn
            :icon="item.isActive ? 'mdi-account-off' : 'mdi-account-check'"
            size="small"
            variant="text"
            :color="item.isActive ? 'warning' : 'success'"
            @click="toggleUserStatus(item)"
          ></v-btn>
          <v-btn
            icon="mdi-key"
            size="small"
            variant="text"
            color="info"
            @click="openPasswordDialog(item)"
          ></v-btn>
          <v-btn
            v-if="item._id !== authStore.user._id"
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            @click="deleteUser(item)"
          ></v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- 用戶新增/編輯 Dialog -->
    <v-dialog v-model="userDialog.show" max-width="500px">
      <v-card>
        <v-card-title>
          {{ userDialog.isEdit ? '編輯員工' : '新增員工' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="userFormRef" v-model="userDialog.valid">
            <v-text-field
              v-model="userDialog.user.name"
              :rules="nameRules"
              label="姓名"
              variant="outlined"
              required
            ></v-text-field>
            
            <v-text-field
              v-model="userDialog.user.email"
              :rules="emailRules"
              label="電子郵件"
              type="email"
              variant="outlined"
              required
            ></v-text-field>
            
            <v-text-field
              v-if="!userDialog.isEdit"
              v-model="userDialog.user.password"
              :rules="passwordRules"
              label="密碼"
              type="password"
              variant="outlined"
              required
            ></v-text-field>
            
            <v-select
              v-model="userDialog.user.role"
              :items="roleSelectOptions"
              :rules="roleRules"
              label="角色"
              variant="outlined"
              required
            ></v-select>
            
            <v-switch
              v-model="userDialog.user.isActive"
              label="啟用帳號"
              color="primary"
              hide-details
            ></v-switch>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="userDialog.show = false">取消</v-btn>
          <v-btn 
            color="primary" 
            :loading="userDialog.loading"
            :disabled="!userDialog.valid"
            @click="saveUser"
          >
            {{ userDialog.isEdit ? '更新' : '新增' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 用戶詳情 Dialog -->
    <v-dialog v-model="detailDialog.show" max-width="600px">
      <v-card v-if="detailDialog.user">
        <v-card-title>員工詳情</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="4" class="text-center">
              <v-avatar color="primary" size="80" class="mb-4">
                <span class="white--text text-h4">
                  {{ getInitials(detailDialog.user.name) }}
                </span>
              </v-avatar>
              <v-chip
                :color="detailDialog.user.role === 'boss' ? 'primary' : 'secondary'"
                variant="flat"
              >
                {{ detailDialog.user.role === 'boss' ? '管理員' : '一般員工' }}
              </v-chip>
            </v-col>
            <v-col cols="8">
              <v-list density="compact">
                <v-list-item>
                  <v-list-item-title>姓名</v-list-item-title>
                  <v-list-item-subtitle>{{ detailDialog.user.name }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>電子郵件</v-list-item-title>
                  <v-list-item-subtitle>{{ detailDialog.user.email }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>帳號狀態</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip
                      :color="detailDialog.user.isActive ? 'success' : 'error'"
                      size="small"
                      variant="flat"
                    >
                      {{ detailDialog.user.isActive ? '啟用' : '停用' }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>建立時間</v-list-item-title>
                  <v-list-item-subtitle>{{ formatDate(detailDialog.user.createdAt) }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>最後登入</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ detailDialog.user.lastLoginAt ? formatDate(detailDialog.user.lastLoginAt) : '從未登入' }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>
          
          <!-- 用戶活動統計 -->
          <v-divider class="my-4"></v-divider>
          <div class="text-subtitle-2 mb-2">盤點活動統計</div>
          <v-row v-if="userActivity">
            <v-col cols="6">
              <div class="text-center">
                <div class="text-h6 primary--text">{{ userActivity.totalCounts || 0 }}</div>
                <div class="text-caption">總盤點次數</div>
              </div>
            </v-col>
            <v-col cols="6">
              <div class="text-center">
                <div class="text-h6 success--text">{{ userActivity.todayCounts || 0 }}</div>
                <div class="text-caption">今日盤點</div>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="detailDialog.show = false">關閉</v-btn>
          <v-btn color="primary" @click="openUserDialog(detailDialog.user)">
            編輯
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 修改密碼 Dialog -->
    <v-dialog v-model="passwordDialog.show" max-width="400px">
      <v-card>
        <v-card-title>修改密碼</v-card-title>
        <v-card-text>
          <p class="mb-4">
            <strong>{{ passwordDialog.user?.name }}</strong> 的密碼
          </p>
          <v-form ref="passwordFormRef" v-model="passwordDialog.valid">
            <v-text-field
              v-model="passwordDialog.newPassword"
              :rules="passwordRules"
              label="新密碼"
              type="password"
              variant="outlined"
              required
            ></v-text-field>
            
            <v-text-field
              v-model="passwordDialog.confirmPassword"
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
          <v-btn variant="text" @click="passwordDialog.show = false">取消</v-btn>
          <v-btn 
            color="primary" 
            :loading="passwordDialog.loading"
            :disabled="!passwordDialog.valid"
            @click="changePassword"
          >
            修改密碼
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 刪除確認 Dialog -->
    <v-dialog v-model="deleteDialog.show" max-width="400px">
      <v-card>
        <v-card-title>確認刪除</v-card-title>
        <v-card-text>
          確定要刪除員工 <strong>{{ deleteDialog.user?.name }}</strong> 嗎？
          <br><br>
          <v-alert type="warning" variant="outlined">
            此操作無法復原，將同時刪除該員工的所有相關記錄。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteDialog.show = false">取消</v-btn>
          <v-btn 
            color="error" 
            :loading="deleteDialog.loading"
            @click="confirmDelete"
          >
            刪除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import moment from 'moment'
import _ from 'lodash'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

// Stores
const usersStore = useUsersStore()
const authStore = useAuthStore()
const uiStore = useUIStore()

// Reactive data
const search = ref('')
const filters = reactive({
  role: '',
  isActive: null
})
const userActivity = ref(null)

const userDialog = reactive({
  show: false,
  loading: false,
  valid: false,
  isEdit: false,
  user: {
    name: '',
    email: '',
    password: '',
    role: 'employee',
    isActive: true
  }
})

const detailDialog = reactive({
  show: false,
  user: null
})

const passwordDialog = reactive({
  show: false,
  loading: false,
  valid: false,
  user: null,
  newPassword: '',
  confirmPassword: ''
})

const deleteDialog = reactive({
  show: false,
  loading: false,
  user: null
})

const userFormRef = ref()
const passwordFormRef = ref()

const headers = [
  { title: '頭像', key: 'avatar', sortable: false, width: '80px' },
  { title: '姓名', key: 'name', width: '200px' },
  { title: '角色', key: 'role', width: '120px' },
  { title: '狀態', key: 'isActive', width: '100px' },
  { title: '最後登入', key: 'lastLoginAt', width: '140px' },
  { title: '建立時間', key: 'createdAt', width: '140px' },
  { title: '操作', key: 'actions', sortable: false, width: '200px' }
]

const roleOptions = [
  { title: '全部', value: '' },
  { title: '管理員', value: 'boss' },
  { title: '一般員工', value: 'employee' }
]

const statusOptions = [
  { title: '全部', value: null },
  { title: '啟用', value: true },
  { title: '停用', value: false }
]

const roleSelectOptions = [
  { title: '管理員', value: 'boss' },
  { title: '一般員工', value: 'employee' }
]

// Validation rules
const nameRules = [
  v => !!v || '請輸入姓名',
  v => (v && v.length >= 2) || '姓名至少需要2個字元'
]

const emailRules = [
  v => !!v || '請輸入電子郵件',
  v => /.+@.+\..+/.test(v) || '請輸入有效的電子郵件格式'
]

const passwordRules = [
  v => !!v || '請輸入密碼',
  v => (v && v.length >= 6) || '密碼至少需要6個字元'
]

const confirmPasswordRules = [
  v => !!v || '請確認密碼',
  v => v === passwordDialog.newPassword || '密碼不符'
]

const roleRules = [
  v => !!v || '請選擇角色'
]

// Methods
const formatDate = (date) => {
  return moment(date).format('YYYY/MM/DD HH:mm')
}

const getInitials = (name) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}

const debouncedSearch = _.debounce(() => {
  fetchData()
}, 500)

const fetchData = async () => {
  const params = {
    page: usersStore.pagination.currentPage,
    limit: usersStore.pagination.itemsPerPage,
    search: search.value || undefined,
    role: filters.role || undefined,
    isActive: filters.isActive
  }

  try {
    await usersStore.fetchUsers(params)
  } catch (error) {
    uiStore.showError('獲取員工列表失敗')
  }
}

const onPageChange = (page) => {
  usersStore.setPagination({ currentPage: page })
  fetchData()
}

const onItemsPerPageChange = (itemsPerPage) => {
  usersStore.setPagination({ 
    itemsPerPage, 
    currentPage: 1 
  })
  fetchData()
}

const openUserDialog = (user = null) => {
  if (user) {
    userDialog.isEdit = true
    userDialog.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive
    }
  } else {
    userDialog.isEdit = false
    userDialog.user = {
      name: '',
      email: '',
      password: '',
      role: 'employee',
      isActive: true
    }
  }
  userDialog.show = true
}

const saveUser = async () => {
  const { valid } = await userFormRef.value.validate()
  if (!valid) return

  userDialog.loading = true
  try {
    if (userDialog.isEdit) {
      await usersStore.updateUserData(userDialog.user._id, {
        name: userDialog.user.name,
        email: userDialog.user.email,
        role: userDialog.user.role,
        isActive: userDialog.user.isActive
      })
      uiStore.showSuccess('員工資料更新成功')
    } else {
      await usersStore.createUser(userDialog.user)
      uiStore.showSuccess('員工新增成功')
    }
    
    userDialog.show = false
    fetchData()
  } catch (error) {
    console.error('儲存員工失敗:', error)
    uiStore.showError(userDialog.isEdit ? '更新員工失敗' : '新增員工失敗')
  } finally {
    userDialog.loading = false
  }
}

const viewUserDetail = async (user) => {
  detailDialog.user = user
  detailDialog.show = true
  
  // 獲取用戶活動統計
  try {
    userActivity.value = await usersStore.getUserActivity(user._id)
  } catch (error) {
    console.error('獲取用戶活動失敗:', error)
  }
}

const toggleUserStatus = async (user) => {
  try {
    await usersStore.toggleUserStatus(user._id)
    uiStore.showSuccess(`員工 ${user.name} 狀態已更新`)
    fetchData()
  } catch (error) {
    console.error('切換用戶狀態失敗:', error)
    uiStore.showError('狀態更新失敗')
  }
}

const openPasswordDialog = (user) => {
  passwordDialog.user = user
  passwordDialog.newPassword = ''
  passwordDialog.confirmPassword = ''
  passwordDialog.show = true
}

const changePassword = async () => {
  const { valid } = await passwordFormRef.value.validate()
  if (!valid) return

  passwordDialog.loading = true
  try {
    await usersStore.changePassword(passwordDialog.user._id, {
      newPassword: passwordDialog.newPassword
    })
    
    uiStore.showSuccess('密碼修改成功')
    passwordDialog.show = false
  } catch (error) {
    console.error('修改密碼失敗:', error)
    uiStore.showError('修改密碼失敗')
  } finally {
    passwordDialog.loading = false
  }
}

const deleteUser = (user) => {
  deleteDialog.user = user
  deleteDialog.show = true
}

const confirmDelete = async () => {
  deleteDialog.loading = true
  try {
    await usersStore.deleteUser(deleteDialog.user._id)
    uiStore.showSuccess(`員工 ${deleteDialog.user.name} 已刪除`)
    deleteDialog.show = false
    fetchData()
  } catch (error) {
    console.error('刪除員工失敗:', error)
    uiStore.showError('刪除員工失敗')
  } finally {
    deleteDialog.loading = false
  }
}

// 頁面載入時獲取數據
onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.v-data-table th {
  white-space: nowrap;
}
</style> 