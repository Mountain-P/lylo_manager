import Vue from 'vue'
import Vuetify from 'vuetify/lib/framework'
import 'vuetify/dist/vuetify.min.css'

Vue.use(Vuetify)

export default new Vuetify({
  theme: {
    themes: {
      light: {
        primary: '#1976D2',
        secondary: '#424242',
        accent: '#82B1FF',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FFC107',
        // 自定義顏色
        countError: '#FF5252', // 盤點異常紅色
        syncSuccess: '#4CAF50', // 同步成功綠色
        pending: '#FF9800' // 待處理橙色
      },
      dark: {
        primary: '#2196F3',
        secondary: '#424242',
        accent: '#FF4081',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FFC107',
        countError: '#FF5252',
        syncSuccess: '#4CAF50',
        pending: '#FF9800'
      }
    },
    dark: false // 預設使用淺色主題
  },
  icons: {
    iconfont: 'mdi'
  },
  // 全域配置
  display: {
    mobileBreakpoint: 'sm'
  }
}) 