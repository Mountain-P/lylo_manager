<template>
  <v-app id="login">
    <v-main>
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="4">
            <v-card class="elevation-12">
              <v-toolbar color="primary" dark flat>
                <v-toolbar-title>盤點小助手</v-toolbar-title>
                <v-spacer></v-spacer>
                <v-icon>mdi-clipboard-check</v-icon>
              </v-toolbar>
              <v-card-text>
                <v-form ref="formRef" v-model="valid" @submit.prevent="submitLogin">
                  <v-text-field
                    v-model="form.email"
                    :rules="emailRules"
                    label="電子郵件"
                    name="email"
                    prepend-inner-icon="mdi-email"
                    type="email"
                    variant="outlined"
                    required
                  ></v-text-field>

                  <v-text-field
                    v-model="form.password"
                    :rules="passwordRules"
                    :type="showPassword ? 'text' : 'password'"
                    label="密碼"
                    name="password"
                    autocomplete="current-password"
                    prepend-inner-icon="mdi-lock"
                    :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                    @click:append-inner="showPassword = !showPassword"
                    variant="outlined"
                    required
                    @keyup.enter="submitLogin"
                  ></v-text-field>
                </v-form>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                  :disabled="!valid || loading"
                  :loading="loading"
                  color="primary"
                  @click="submitLogin"
                  size="large"
                  block
                >
                  登入
                </v-btn>
              </v-card-actions>
            </v-card>
            
            <!-- 測試帳號提示 -->
            <v-card class="mt-4 elevation-2">
              <v-card-text class="text-center">
                <v-chip color="info" size="small" class="mr-2">測試帳號</v-chip>
                <br><br>
                <strong>管理員:</strong> admin@example.com / admin123<br>
                <strong>員工:</strong> employee@example.com / employee123
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUIStore()

// Reactive data
const valid = ref(false)
const loading = ref(false)
const showPassword = ref(false)
const formRef = ref()

const form = ref({
  email: '',
  password: ''
})

// Validation rules
const emailRules = [
  v => !!v || '請輸入電子郵件',
  v => /.+@.+\..+/.test(v) || '請輸入有效的電子郵件格式'
]

const passwordRules = [
  v => !!v || '請輸入密碼',
  v => (v && v.length >= 6) || '密碼至少需要6個字元'
]

// Methods
const submitLogin = async () => {
  const { valid: isValid } = await formRef.value.validate()
  if (!isValid) return
  
  try {
    loading.value = true
    
    await authStore.login({
      email: form.value.email,
      password: form.value.password
    })
    
    uiStore.showSuccess('登入成功')
    
    // 導向首頁或原來要訪問的頁面
    const redirect = router.currentRoute.value.query.redirect || '/'
    router.push(redirect)
    
  } catch (error) {
    console.error('登入失敗:', error)
    const status = error.response?.status
    if (!error.response) {
      uiStore.showError('無法連線到伺服器，請檢查網路連線或稍後再試')
    } else if (status === 502 || status === 503 || status === 504) {
      uiStore.showError(`伺服器暫時無法使用 (${status})，請稍後再試`)
    } else if (status === 500) {
      uiStore.showError('伺服器內部錯誤，請聯繫管理員')
    } else if (status === 401 || status === 403) {
      uiStore.showError('帳號或密碼錯誤，請重新輸入')
    } else {
      const msg = error.response?.data?.message || error.message || '登入失敗'
      uiStore.showError(msg)
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
#login {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.v-card {
  border-radius: 8px;
}

.v-toolbar {
  border-radius: 8px 8px 0 0;
}
</style> 