const state = {
  loading: false,
  snackbar: {
    show: false,
    message: '',
    color: 'info',
    timeout: 5000
  },
  drawer: true,
  theme: localStorage.getItem('theme') || 'light',
  breadcrumbs: []
}

const getters = {
  loading: state => state.loading,
  snackbar: state => state.snackbar,
  drawer: state => state.drawer,
  theme: state => state.theme,
  isDarkTheme: state => state.theme === 'dark',
  breadcrumbs: state => state.breadcrumbs
}

const mutations = {
  SET_LOADING(state, loading) {
    state.loading = loading
  },
  SHOW_SNACKBAR(state, { message, color = 'info', timeout = 5000 }) {
    state.snackbar.message = message
    state.snackbar.color = color
    state.snackbar.timeout = timeout
    state.snackbar.show = true
  },
  HIDE_SNACKBAR(state) {
    state.snackbar.show = false
  },
  TOGGLE_DRAWER(state) {
    state.drawer = !state.drawer
  },
  SET_DRAWER(state, value) {
    state.drawer = value
  },
  TOGGLE_THEME(state) {
    state.theme = state.theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('theme', state.theme)
  },
  SET_THEME(state, theme) {
    state.theme = theme
    localStorage.setItem('theme', theme)
  },
  SET_BREADCRUMBS(state, breadcrumbs) {
    state.breadcrumbs = breadcrumbs
  },
  ADD_BREADCRUMB(state, breadcrumb) {
    state.breadcrumbs.push(breadcrumb)
  },
  CLEAR_BREADCRUMBS(state) {
    state.breadcrumbs = []
  }
}

const actions = {
  setLoading({ commit }, loading) {
    commit('SET_LOADING', loading)
  },
  showSnackbar({ commit }, payload) {
    commit('SHOW_SNACKBAR', payload)
  },
  hideSnackbar({ commit }) {
    commit('HIDE_SNACKBAR')
  },
  toggleDrawer({ commit }) {
    commit('TOGGLE_DRAWER')
  },
  setDrawer({ commit }, value) {
    commit('SET_DRAWER', value)
  },
  toggleTheme({ commit }) {
    commit('TOGGLE_THEME')
  },
  setTheme({ commit }, theme) {
    commit('SET_THEME', theme)
  },
  setBreadcrumbs({ commit }, breadcrumbs) {
    commit('SET_BREADCRUMBS', breadcrumbs)
  },
  addBreadcrumb({ commit }, breadcrumb) {
    commit('ADD_BREADCRUMB', breadcrumb)
  },
  clearBreadcrumbs({ commit }) {
    commit('CLEAR_BREADCRUMBS')
  },
  // 顯示成功訊息
  showSuccess({ dispatch }, message) {
    dispatch('showSnackbar', {
      message,
      color: 'success'
    })
  },
  // 顯示錯誤訊息
  showError({ dispatch }, message) {
    dispatch('showSnackbar', {
      message,
      color: 'error',
      timeout: 8000
    })
  },
  // 顯示警告訊息
  showWarning({ dispatch }, message) {
    dispatch('showSnackbar', {
      message,
      color: 'warning'
    })
  },
  // 顯示資訊訊息
  showInfo({ dispatch }, message) {
    dispatch('showSnackbar', {
      message,
      color: 'info'
    })
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
} 