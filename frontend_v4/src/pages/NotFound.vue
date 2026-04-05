<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="6" md="4" class="text-center">
        <v-icon size="120" color="grey">mdi-file-question</v-icon>
        
        <h1 class="text-h3 mt-4 mb-2">404</h1>
        <p class="text-h6 mb-4">頁面不存在</p>
        <p class="text-body-1 mb-6">
          抱歉，您訪問的頁面不存在或已被移除。
        </p>
        
        <v-btn
          color="primary"
          size="large"
          @click="$router.push('/')"
        >
          返回首頁
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
// 無需額外邏輯
</script> 