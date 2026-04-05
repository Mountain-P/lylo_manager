<template>
  <div class="text-center">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" md="6">
          <v-icon size="120" color="grey lighten-1">mdi-emoticon-sad-outline</v-icon>
          <h1 class="text-h2 grey--text lighten-1 mb-4">404</h1>
          <h2 class="text-h4 mb-4">頁面不存在</h2>
          <p class="text-body-1 mb-4">
            抱歉，您訪問的頁面不存在或已被移動。
          </p>
          <v-btn color="primary" large @click="$router.push('/')">
            <v-icon left>mdi-home</v-icon>
            返回首頁
          </v-btn>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
export default {
  name: 'NotFound'
}
</script> 