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
                <v-form ref="form" v-model="valid" lazy-validation>
                  <v-text-field
                    v-model="form.email"
                    :rules="emailRules"
                    label="電子郵件"
                    name="email"
                    prepend-icon="mdi-email"
                    type="email"
                    required
                  ></v-text-field>

                  <v-text-field
                    v-model="form.password"
                    :rules="passwordRules"
                    :type="showPassword ? 'text' : 'password'"
                    label="密碼"
                    name="password"
                    autocomplete="current-password"
                    prepend-icon="mdi-lock"
                    :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                    @click:append="showPassword = !showPassword"
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
                  large
                  block
                >
                  登入
                </v-btn>
              </v-card-actions>
            </v-card>
            
            <!-- 測試帳號提示 -->
            <v-card class="mt-4 elevation-2">
              <v-card-text class="text-center">
                <v-chip color="info" small class="mr-2">測試帳號</v-chip>
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

<script>
import { mapActions, mapGetters } from 'vuex'

export default {
  name: 'Login',
  data() {
    return {
      valid: false,
      loading: false,
      showPassword: false,
      form: {
        email: '',
        password: ''
      },
      emailRules: [
        v => !!v || '請輸入電子郵件',
        v => /.+@.+\..+/.test(v) || '請輸入有效的電子郵件格式'
      ],
      passwordRules: [
        v => !!v || '請輸入密碼',
        v => (v && v.length >= 6) || '密碼至少需要6個字元'
      ]
    }
  },
  
  computed: {
    ...mapGetters('auth', ['isAuthenticated'])
  },
  
  methods: {
    ...mapActions('auth', ['login']),
    ...mapActions('ui', ['showError']),
    
    async submitLogin() {
      if (!this.$refs.form.validate()) return
      
      try {
        this.loading = true
        
        await this.login({
          email: this.form.email,
          password: this.form.password
        })
        
        // 登入成功，導向首頁
        this.$router.push('/')
        
      } catch (error) {
        console.error('登入失敗:', error)
        this.showError('登入失敗，請檢查帳號密碼')
      } finally {
        this.loading = false
      }
    }
  },
  
  // 如果已經登入，直接導向首頁
  created() {
    if (this.isAuthenticated) {
      this.$router.push('/')
    }
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