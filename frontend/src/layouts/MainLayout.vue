<template>
  <v-app>
    <!-- 導航抽屜 -->
    <v-navigation-drawer
      v-model="drawer"
      :clipped="$vuetify.breakpoint.lgAndUp"
      app
    >
      <v-list>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.route"
          link
        >
          <v-list-item-icon>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{ item.title }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- 應用程式列 -->
    <v-app-bar
      :clipped-left="$vuetify.breakpoint.lgAndUp"
      app
      color="primary"
      dark
    >
      <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>盤點小助手</v-toolbar-title>
      
      <v-spacer></v-spacer>
      
      <!-- 用戶菜單 -->
      <v-menu bottom left>
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            icon
            v-bind="attrs"
            v-on="on"
          >
            <v-icon>mdi-account-circle</v-icon>
          </v-btn>
        </template>
        
        <v-list>
          <v-list-item>
            <v-list-item-content>
              <v-list-item-title>{{ user.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ user.role === 'boss' ? '管理員' : '員工' }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          
          <v-divider></v-divider>
          
          <v-list-item @click="$router.push('/profile')">
            <v-list-item-icon>
              <v-icon>mdi-account-edit</v-icon>
            </v-list-item-icon>
            <v-list-item-title>個人資料</v-list-item-title>
          </v-list-item>
          
          <v-list-item @click="logout">
            <v-list-item-icon>
              <v-icon>mdi-logout</v-icon>
            </v-list-item-icon>
            <v-list-item-title>登出</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- 頁面內容 -->
    <v-main>
      <v-container fluid>
        <!-- 麵包屑導航 -->
        <v-breadcrumbs
          v-if="breadcrumbs.length > 0"
          :items="breadcrumbs"
          class="pa-0 mb-4"
        >
          <template v-slot:item="{ item }">
            <v-breadcrumbs-item
              :href="item.href"
              :disabled="item.disabled"
              exact
            >
              {{ item.text }}
            </v-breadcrumbs-item>
          </template>
        </v-breadcrumbs>
        
        <!-- 路由視圖 -->
        <router-view />
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  name: 'MainLayout',
  
  data() {
    return {
      drawer: null
    }
  },
  
  computed: {
    ...mapGetters('auth', ['user', 'isBoss']),
    ...mapGetters('ui', ['breadcrumbs']),
    
    menuItems() {
      const items = [
        { title: '儀表板', icon: 'mdi-view-dashboard', route: '/' },
        { title: '商品管理', icon: 'mdi-package-variant', route: '/products' },
        { title: '盤點管理', icon: 'mdi-clipboard-check', route: '/inventory' },
        { title: '盤點記錄', icon: 'mdi-history', route: '/inventory/logs' }
      ]
      
      // 管理員專用菜單
      if (this.isBoss) {
        items.push(
          { title: '員工管理', icon: 'mdi-account-group', route: '/users' },
          { title: '同步管理', icon: 'mdi-sync', route: '/sync' }
        )
      }
      
      return items
    }
  },
  
  methods: {
    ...mapActions('auth', ['logout']),
    
    async logout() {
      try {
        await this.logout()
        this.$router.push('/login')
      } catch (error) {
        console.error('登出失敗:', error)
      }
    }
  }
}
</script>

<style scoped>
.v-toolbar-title {
  font-weight: 500;
  font-size: 1.25rem;
}
</style> 