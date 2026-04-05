import Vue from 'vue'
import Vuex from 'vuex'

// 導入模組
import auth from './modules/auth'
import products from './modules/products'
import inventory from './modules/inventory'
import users from './modules/users'
import ui from './modules/ui'

Vue.use(Vuex)

export default new Vuex.Store({
  modules: {
    auth,
    products,
    inventory,
    users,
    ui
  },
  strict: process.env.NODE_ENV !== 'production'
}) 