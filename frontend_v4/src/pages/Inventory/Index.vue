<template>
  <div>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">盤點管理</h1>
      </v-col>
    </v-row>

    <!-- 無任務時：任務選擇器 -->
    <template v-if="!taskStore.hasCurrentTask">
      <!-- 進行中的任務列表 -->
      <v-row class="mb-4" v-if="taskStore.activeTasks.length > 0">
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-clipboard-list</v-icon>
              進行中的盤點任務
              <v-chip size="small" color="primary" variant="tonal" class="ml-2">
                {{ taskStore.activeTasks.length }}
              </v-chip>
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list>
                <v-list-item
                  v-for="task in taskStore.activeTasks"
                  :key="task._id"
                  @click="enterTask(task._id)"
                  class="task-list-item"
                >
                  <template #prepend>
                    <v-icon color="primary">mdi-clipboard-clock</v-icon>
                  </template>
                  <v-list-item-title class="font-weight-bold">
                    {{ formatTaskDate(task.date) }} 盤點任務
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    人員：{{ task.personnel?.map(p => p.name).join('、') }}
                    <span v-if="task.note"> · {{ task.note }}</span>
                  </v-list-item-subtitle>
                  <v-list-item-subtitle>
                    進度：{{ task.summary?.countedProducts || 0 }} / {{ task.summary?.totalProducts || 0 }}
                    <v-chip
                      size="x-small"
                      :color="(task.summary?.completionRate || 0) >= 100 ? 'success' : 'warning'"
                      variant="tonal"
                      class="ml-1"
                    >
                      {{ task.summary?.completionRate || 0 }}%
                    </v-chip>
                    <v-chip
                      v-if="task.summary?.errorProducts > 0"
                      size="x-small"
                      color="error"
                      variant="tonal"
                      class="ml-1"
                    >
                      {{ task.summary.errorProducts }} 異常
                    </v-chip>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn color="primary" variant="tonal" size="small">
                      進入
                      <v-icon end size="small">mdi-arrow-right</v-icon>
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 開新任務 -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card variant="outlined" class="new-task-card">
            <v-card-text class="text-center pa-8">
              <v-icon size="64" color="primary" class="mb-4">mdi-clipboard-plus</v-icon>
              <h2 class="text-h5 mb-2">開啟新的盤點任務</h2>
              <p class="text-body-2 text-medium-emphasis mb-6">
                建立新任務時，系統會擷取當下所有商品的庫存數量作為比對基準。<br>
                盤點期間，即使 POS 銷售導致庫存變動，也不會影響本次盤點的比對結果。
              </p>
              <v-btn color="primary" size="large" @click="openNewTaskDialog">
                <v-icon start>mdi-plus</v-icon>
                建立盤點任務
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 歷史任務 -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2">mdi-history</v-icon>
              歷史盤點任務
              <v-spacer></v-spacer>
              <v-btn variant="text" size="small" @click="loadHistoryTasks" :loading="historyLoading">
                <v-icon start size="small">mdi-refresh</v-icon>
                重新整理
              </v-btn>
            </v-card-title>
            <v-card-text v-if="historyTasks.length === 0" class="text-center py-8">
              <v-icon size="48" color="grey-lighten-1">mdi-inbox</v-icon>
              <p class="text-body-1 mt-2">暫無歷史盤點任務</p>
            </v-card-text>
            <v-card-text v-else class="pa-0">
              <v-list>
                <v-list-item
                  v-for="task in historyTasks"
                  :key="task._id"
                  @click="openTaskDetail(task._id)"
                  class="task-list-item"
                >
                  <template #prepend>
                    <v-icon :color="task.status === 'completed' ? 'success' : 'grey'">
                      {{ task.status === 'completed' ? 'mdi-check-circle' : 'mdi-cancel' }}
                    </v-icon>
                  </template>
                  <v-list-item-title>
                    {{ formatTaskDate(task.date) }} 盤點任務
                    <v-chip size="x-small" :color="task.status === 'completed' ? 'success' : 'grey'" variant="tonal" class="ml-1">
                      {{ task.status === 'completed' ? '已完成' : '已取消' }}
                    </v-chip>
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{ task.summary?.countedProducts || 0 }} / {{ task.summary?.totalProducts || 0 }} 商品
                    <v-chip
                      v-if="task.summary?.errorProducts > 0"
                      size="x-small"
                      color="error"
                      variant="tonal"
                      class="ml-1"
                    >
                      {{ task.summary.errorProducts }} 異常
                    </v-chip>
                    · 人員：{{ task.personnel?.map(p => p.name).join('、') }}
                    <span v-if="task.note" class="text-grey-darken-1"> · {{ task.note }}</span>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn color="primary" variant="text" size="small" density="compact">
                      <v-icon size="small">mdi-eye</v-icon>
                      查看
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- 有任務時：盤點工作台 -->
    <template v-else>
      <!-- 當前任務資訊 -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card color="primary" variant="tonal">
            <v-card-text>
              <div class="d-flex align-center justify-space-between flex-wrap ga-2">
                <div>
                  <div class="d-flex align-center mb-1">
                    <v-icon class="mr-2">mdi-clipboard-clock</v-icon>
                    <span class="text-h6 font-weight-bold">
                      {{ formatTaskDate(taskStore.currentTask.date) }} 盤點任務
                    </span>
                  </div>
                  <div class="text-body-2">
                    人員：{{ taskStore.currentTask.personnel?.map(p => p.name).join('、') }}
                    <span v-if="taskStore.currentTask.note"> · 備註：{{ taskStore.currentTask.note }}</span>
                    <br>
                    快照時間：{{ formatDateTime(taskStore.currentTask.snapshotCreatedAt) }}
                    <span v-if="taskStore.currentTask.lastRefreshedAt">
                      · 上次重新整理：{{ formatDateTime(taskStore.currentTask.lastRefreshedAt) }}
                    </span>
                  </div>
                </div>
                <div class="d-flex ga-2">
                  <v-btn
                    variant="outlined"
                    size="small"
                    @click="handleRefreshSnapshot"
                    :loading="taskStore.snapshotLoading"
                  >
                    <v-icon start size="small">mdi-refresh</v-icon>
                    重新整理未盤點庫存
                  </v-btn>
                  <v-btn color="success" variant="flat" size="small" @click="handleCompleteTask">
                    <v-icon start size="small">mdi-check</v-icon>
                    完成盤點
                  </v-btn>
                  <v-btn variant="text" size="small" @click="exitTask">
                    <v-icon start size="small">mdi-arrow-left</v-icon>
                    返回任務列表
                  </v-btn>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 任務維度統計 -->
      <v-row class="mb-4">
        <v-col cols="6" md="3">
          <v-card color="primary" variant="flat" theme="dark" class="stat-card">
            <v-card-text class="pa-4">
              <div class="d-flex align-center justify-space-between mb-2">
                <v-icon size="32" class="stat-icon">mdi-package-variant</v-icon>
              </div>
              <div class="text-h4 font-weight-bold">{{ taskStore.currentSummary.totalProducts }}</div>
              <div class="text-body-2 mt-1" style="opacity: 0.85">總商品數</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="6" md="3">
          <v-card color="success" variant="flat" theme="dark" class="stat-card">
            <v-card-text class="pa-4">
              <div class="d-flex align-center justify-space-between mb-2">
                <v-icon size="32" class="stat-icon">mdi-check-circle</v-icon>
              </div>
              <div class="text-h4 font-weight-bold">{{ taskStore.currentSummary.countedProducts }}</div>
              <div class="text-body-2 mt-1" style="opacity: 0.85">已盤點</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="6" md="3">
          <v-card color="warning" variant="flat" theme="dark" class="stat-card">
            <v-card-text class="pa-4">
              <div class="d-flex align-center justify-space-between mb-2">
                <v-icon size="32" class="stat-icon">mdi-clock-alert-outline</v-icon>
              </div>
              <div class="text-h4 font-weight-bold">
                {{ taskStore.currentSummary.totalProducts - taskStore.currentSummary.countedProducts }}
              </div>
              <div class="text-body-2 mt-1" style="opacity: 0.85">未盤點</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="6" md="3">
          <v-card color="error" variant="flat" theme="dark" class="stat-card">
            <v-card-text class="pa-4">
              <div class="d-flex align-center justify-space-between mb-2">
                <v-icon size="32" class="stat-icon">mdi-alert-circle</v-icon>
              </div>
              <div class="text-h4 font-weight-bold">{{ taskStore.currentSummary.errorProducts }}</div>
              <div class="text-body-2 mt-1" style="opacity: 0.85">異常商品</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 進度條 -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card>
            <v-card-title>盤點進度</v-card-title>
            <v-card-text>
              <div class="mb-2">
                <span>{{ taskStore.currentSummary.completionRate }}% 完成</span>
                <span class="float-right">
                  {{ taskStore.currentSummary.countedProducts }} / {{ taskStore.currentSummary.totalProducts }} 商品
                </span>
              </div>
              <v-progress-linear
                :model-value="taskStore.currentSummary.completionRate"
                height="20"
                color="success"
                bg-color="grey-lighten-3"
                rounded
              >
                <template v-slot:default="{ value }">
                  <strong>{{ Math.ceil(value) }}%</strong>
                </template>
              </v-progress-linear>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 盤點方式 -->
      <v-row class="mb-4">
        <v-col cols="12">
          <h2 class="text-h5 mb-3">盤點方式</h2>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" md="6">
          <v-card class="h-100" variant="outlined">
            <v-card-text class="text-center pa-6">
              <v-icon size="64" color="primary" class="mb-4">mdi-barcode-scan</v-icon>
              <h3 class="text-h6 mb-2">條碼掃描盤點</h3>
              <p class="text-body-2 mb-4">
                使用手機或條碼掃描器快速掃描商品條碼進行盤點。
              </p>
              <div class="mb-4">
                <v-chip color="primary" size="small" class="mr-2">快速</v-chip>
                <v-chip color="success" size="small" class="mr-2">準確</v-chip>
                <v-chip color="info" size="small">推薦</v-chip>
              </div>
            </v-card-text>
            <v-card-actions class="pa-6 pt-0">
              <v-btn color="primary" size="large" block @click="$router.push('/inventory/scan')">
                開始掃描盤點
                <v-icon end>mdi-camera</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card class="h-100" variant="outlined">
            <v-card-text class="text-center pa-6">
              <v-icon size="64" color="secondary" class="mb-4">mdi-clipboard-text</v-icon>
              <h3 class="text-h6 mb-2">手動盤點</h3>
              <p class="text-body-2 mb-4">
                從商品列表中選擇商品進行手動盤點。
              </p>
              <div class="mb-4">
                <v-chip color="secondary" size="small" class="mr-2">彈性</v-chip>
                <v-chip color="warning" size="small" class="mr-2">精確</v-chip>
                <v-chip color="grey" size="small">傳統</v-chip>
              </div>
            </v-card-text>
            <v-card-actions class="pa-6 pt-0">
              <v-btn color="secondary" size="large" block @click="$router.push('/products')">
                前往商品列表
                <v-icon end>mdi-format-list-bulleted</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <!-- 快速功能 -->
      <v-row class="mt-4">
        <v-col cols="12">
          <h2 class="text-h5 mb-3">快速功能</h2>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" sm="6" md="4">
          <v-card variant="outlined">
            <v-card-text class="text-center">
              <v-icon size="48" color="info" class="mb-2">mdi-history</v-icon>
              <div class="text-h6">盤點記錄</div>
              <div class="text-body-2">查看所有盤點歷史記錄</div>
            </v-card-text>
            <v-card-actions>
              <v-btn color="info" block @click="$router.push('/inventory/logs')">
                查看記錄
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="4">
          <v-card variant="outlined">
            <v-card-text class="text-center">
              <v-icon size="48" color="warning" class="mb-2">mdi-alert-circle</v-icon>
              <div class="text-h6">異常報告</div>
              <div class="text-body-2">查看盤點異常的商品</div>
            </v-card-text>
            <v-card-actions>
              <v-btn color="warning" block @click="generateReport">
                生成報告
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="4">
          <v-card variant="outlined">
            <v-card-text class="text-center">
              <v-icon size="48" color="success" class="mb-2">mdi-download</v-icon>
              <div class="text-h6">匯出數據</div>
              <div class="text-body-2">匯出盤點結果到 Excel</div>
            </v-card-text>
            <v-card-actions>
              <v-btn color="success" block @click="exportData" :loading="exportLoading">
                匯出數據
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- 建立盤點任務 Dialog -->
    <v-dialog v-model="newTaskDialog.show" max-width="560" persistent>
      <v-card>
        <v-card-title class="d-flex align-center pa-6" style="background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-primary-darken-1))); color: white;">
          <v-icon class="mr-2">mdi-clipboard-plus</v-icon>
          建立盤點任務
        </v-card-title>
        <v-card-text class="pa-6">
          <v-text-field
            v-model="newTaskDialog.date"
            label="盤點日期"
            type="date"
            variant="outlined"
            class="mb-4"
            prepend-inner-icon="mdi-calendar"
          ></v-text-field>

          <v-select
            v-model="newTaskDialog.personnel"
            :items="availableUsers"
            item-title="name"
            item-value="_id"
            label="盤點人員"
            variant="outlined"
            multiple
            chips
            closable-chips
            prepend-inner-icon="mdi-account-group"
            class="mb-4"
            :rules="[v => v.length > 0 || '至少選擇一位盤點人員']"
          >
            <template #chip="{ item, props }">
              <v-chip v-bind="props" size="small" color="primary">
                {{ item.title }}
              </v-chip>
            </template>
          </v-select>

          <v-select
            v-model="newTaskDialog.scope"
            :items="scopeOptions"
            label="盤點範圍"
            variant="outlined"
            class="mb-4"
            prepend-inner-icon="mdi-filter-variant"
          ></v-select>

          <v-select
            v-if="newTaskDialog.scope === 'categories'"
            v-model="newTaskDialog.categories"
            :items="availableCategories"
            label="選擇品類"
            variant="outlined"
            multiple
            chips
            closable-chips
            class="mb-4"
            prepend-inner-icon="mdi-tag-multiple"
          ></v-select>

          <v-text-field
            v-model="newTaskDialog.note"
            label="備註（選填）"
            variant="outlined"
            prepend-inner-icon="mdi-note-text"
          ></v-text-field>

          <v-alert type="info" variant="tonal" density="compact" class="mt-2">
            建立任務時，系統將擷取當下所有商品的庫存數量作為比對基準（庫存快照）。
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-6 pt-0">
          <v-btn variant="outlined" @click="newTaskDialog.show = false" class="flex-grow-1 mr-2">
            取消
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            class="flex-grow-1"
            :loading="taskStore.loading"
            :disabled="!newTaskDialog.personnel.length"
            @click="confirmCreateTask"
          >
            <v-icon start>mdi-play</v-icon>
            建立並開始盤點
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 歷史任務詳情 Dialog -->
    <v-dialog v-model="detailDialog.show" max-width="900" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center pa-5" style="background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-primary-darken-1))); color: white;">
          <v-icon class="mr-2">mdi-clipboard-text-clock</v-icon>
          {{ detailDialog.task ? formatTaskDate(detailDialog.task.date) + ' 盤點報告' : '載入中...' }}
          <v-spacer></v-spacer>
          <v-btn icon variant="text" color="white" density="compact" @click="detailDialog.show = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text v-if="detailDialog.loading" class="text-center py-12">
          <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
          <p class="mt-4 text-body-1">載入盤點資料中...</p>
        </v-card-text>

        <template v-else-if="detailDialog.task">
          <v-card-text class="pa-5">
            <!-- 任務摘要 -->
            <v-row class="mb-4">
              <v-col cols="6" sm="3">
                <div class="text-center">
                  <div class="text-h5 font-weight-bold text-primary">{{ detailDialog.task.summary?.totalProducts || 0 }}</div>
                  <div class="text-caption text-medium-emphasis">總商品數</div>
                </div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="text-center">
                  <div class="text-h5 font-weight-bold text-success">{{ detailDialog.task.summary?.countedProducts || 0 }}</div>
                  <div class="text-caption text-medium-emphasis">已盤點</div>
                </div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="text-center">
                  <div class="text-h5 font-weight-bold text-error">{{ detailDialog.task.summary?.errorProducts || 0 }}</div>
                  <div class="text-caption text-medium-emphasis">異常商品</div>
                </div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="text-center">
                  <div class="text-h5 font-weight-bold" :class="(detailDialog.task.summary?.completionRate || 0) >= 100 ? 'text-success' : 'text-warning'">
                    {{ detailDialog.task.summary?.completionRate || 0 }}%
                  </div>
                  <div class="text-caption text-medium-emphasis">完成率</div>
                </div>
              </v-col>
            </v-row>

            <!-- 任務資訊 -->
            <v-card variant="outlined" class="mb-4">
              <v-card-text class="text-body-2">
                <div class="d-flex flex-wrap ga-4">
                  <div>
                    <span class="text-medium-emphasis">盤點日期：</span>
                    <span class="font-weight-medium">{{ formatTaskDate(detailDialog.task.date) }}</span>
                  </div>
                  <div>
                    <span class="text-medium-emphasis">人員：</span>
                    <span class="font-weight-medium">{{ detailDialog.task.personnel?.map(p => p.name).join('、') || '-' }}</span>
                  </div>
                  <div>
                    <span class="text-medium-emphasis">狀態：</span>
                    <v-chip size="x-small" :color="detailDialog.task.status === 'completed' ? 'success' : 'grey'" variant="tonal">
                      {{ detailDialog.task.status === 'completed' ? '已完成' : '已取消' }}
                    </v-chip>
                  </div>
                  <div v-if="detailDialog.task.note">
                    <span class="text-medium-emphasis">備註：</span>
                    <span>{{ detailDialog.task.note }}</span>
                  </div>
                </div>
              </v-card-text>
            </v-card>

            <!-- 篩選 & 搜尋 -->
            <v-row class="mb-2" align="center">
              <v-col cols="12" sm="5">
                <v-text-field
                  v-model="detailDialog.search"
                  label="搜尋商品"
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                  prepend-inner-icon="mdi-magnify"
                  @update:model-value="debounceLoadSnapshot"
                ></v-text-field>
              </v-col>
              <v-col cols="8" sm="4">
                <v-btn-toggle v-model="detailDialog.statusFilter" mandatory density="compact" color="primary" divided variant="outlined">
                  <v-btn value="">全部</v-btn>
                  <v-btn value="normal">正常</v-btn>
                  <v-btn value="error">異常</v-btn>
                  <v-btn value="uncounted">未盤</v-btn>
                </v-btn-toggle>
              </v-col>
              <v-col cols="4" sm="3" class="text-right">
                <v-btn variant="outlined" size="small" @click="exportTaskDetail" :loading="detailDialog.exporting">
                  <v-icon start size="small">mdi-download</v-icon>
                  匯出 CSV
                </v-btn>
              </v-col>
            </v-row>

            <!-- 商品列表 -->
            <v-data-table-virtual
              :headers="snapshotHeaders"
              :items="detailDialog.snapshotItems"
              :loading="detailDialog.snapshotLoading"
              item-value="productId"
              density="compact"
              class="snapshot-table"
              fixed-header
              height="400"
              hover
              @click:row="(e, { item }) => openProductDetail(item)"
            >
              <template #item.product="{ item }">
                <div class="d-flex align-center py-1">
                  <v-avatar size="36" rounded="lg" class="mr-3 flex-shrink-0" color="grey-lighten-3">
                    <v-img v-if="item.product?.image" :src="item.product.image" cover />
                    <v-icon v-else size="20" color="grey">mdi-package-variant-closed</v-icon>
                  </v-avatar>
                  <div class="text-truncate-wrapper">
                    <div class="font-weight-medium text-body-2 text-truncate">{{ item.product?.displayName || item.product?.name || '(已刪除)' }}</div>
                    <div class="text-caption text-medium-emphasis">
                      {{ item.product?.sku || '-' }}
                      <span v-if="item.product?.variantLabel" class="ml-1 text-primary">· {{ item.product.variantLabel }}</span>
                    </div>
                  </div>
                </div>
              </template>
              <template #item.snapshotStockQty="{ item }">
                <span class="font-weight-medium">{{ item.snapshotStockQty }}</span>
              </template>
              <template #item.countedQty="{ item }">
                <span v-if="item.countedQty !== null" class="font-weight-medium">{{ item.countedQty }}</span>
                <span v-else class="text-grey">-</span>
              </template>
              <template #item.diffQty="{ item }">
                <template v-if="item.diffQty !== null">
                  <v-chip
                    :color="item.diffQty === 0 ? 'success' : 'error'"
                    size="small"
                    variant="tonal"
                  >
                    {{ item.diffQty > 0 ? '+' : '' }}{{ item.diffQty }}
                  </v-chip>
                </template>
                <span v-else class="text-grey">-</span>
              </template>
              <template #item.status="{ item }">
                <v-chip
                  :color="item.status === 'normal' ? 'success' : item.status === 'error' ? 'error' : 'grey'"
                  size="small"
                  variant="tonal"
                >
                  {{ item.status === 'normal' ? '正常' : item.status === 'error' ? '異常' : '未盤點' }}
                </v-chip>
              </template>
              <template #item.countedAt="{ item }">
                <span class="text-body-2">{{ item.countedAt ? formatDateTime(item.countedAt) : '-' }}</span>
              </template>
              <template #bottom>
                <div class="text-center text-caption text-medium-emphasis pa-2" v-if="detailDialog.pagination.totalItems > 0">
                  共 {{ detailDialog.pagination.totalItems }} 筆
                  <template v-if="detailDialog.pagination.totalPages > 1">
                    · 第 {{ detailDialog.pagination.currentPage }} / {{ detailDialog.pagination.totalPages }} 頁
                    <v-btn size="x-small" variant="text" :disabled="detailDialog.pagination.currentPage <= 1" @click="loadSnapshotPage(detailDialog.pagination.currentPage - 1)">
                      <v-icon size="small">mdi-chevron-left</v-icon>
                    </v-btn>
                    <v-btn size="x-small" variant="text" :disabled="detailDialog.pagination.currentPage >= detailDialog.pagination.totalPages" @click="loadSnapshotPage(detailDialog.pagination.currentPage + 1)">
                      <v-icon size="small">mdi-chevron-right</v-icon>
                    </v-btn>
                  </template>
                </div>
              </template>
            </v-data-table-virtual>
          </v-card-text>
        </template>
      </v-card>
    </v-dialog>

    <!-- 商品詳情 Dialog -->
    <v-dialog v-model="productDetail.show" max-width="480">
      <v-card>
        <v-card-title class="d-flex align-center pa-4 pb-2">
          <span class="text-h6">商品詳情</span>
          <v-spacer></v-spacer>
          <v-btn icon variant="text" density="compact" @click="productDetail.show = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />

        <template v-if="productDetail.item">
          <!-- 商品圖片 -->
          <div v-if="productDetail.item.product?.image" class="product-detail-image-wrap">
            <v-img
              :src="productDetail.item.product.image"
              max-height="280"
              cover
              class="bg-grey-lighten-4"
            />
          </div>
          <div v-else class="d-flex align-center justify-center bg-grey-lighten-4" style="height: 160px;">
            <v-icon size="64" color="grey-lighten-1">mdi-image-off</v-icon>
          </div>

          <v-card-text class="pa-4">
            <!-- 商品名稱 -->
            <div class="text-h6 font-weight-bold mb-1">
              {{ productDetail.item.product?.displayName || productDetail.item.product?.name || '(已刪除)' }}
            </div>
            <div v-if="productDetail.item.product?.variantLabel" class="text-body-2 text-primary mb-2">
              規格：{{ productDetail.item.product.variantLabel }}
            </div>

            <!-- 基本資訊 -->
            <v-list density="compact" class="pa-0 mt-2">
              <v-list-item class="px-0">
                <template #prepend><v-icon size="18" color="grey" class="mr-2">mdi-barcode</v-icon></template>
                <v-list-item-title class="text-body-2">SKU</v-list-item-title>
                <template #append><span class="text-body-2 font-weight-medium">{{ productDetail.item.product?.sku || '-' }}</span></template>
              </v-list-item>
              <v-list-item v-if="productDetail.item.product?.barcode" class="px-0">
                <template #prepend><v-icon size="18" color="grey" class="mr-2">mdi-barcode-scan</v-icon></template>
                <v-list-item-title class="text-body-2">條碼</v-list-item-title>
                <template #append><span class="text-body-2 font-weight-medium">{{ productDetail.item.product.barcode }}</span></template>
              </v-list-item>
              <v-list-item v-if="productDetail.item.product?.categories?.length" class="px-0">
                <template #prepend><v-icon size="18" color="grey" class="mr-2">mdi-tag</v-icon></template>
                <v-list-item-title class="text-body-2">品類</v-list-item-title>
                <template #append><span class="text-body-2 font-weight-medium">{{ productDetail.item.product.categories.join('、') }}</span></template>
              </v-list-item>
            </v-list>

            <v-divider class="my-3" />

            <!-- 盤點數據 -->
            <div class="text-subtitle-2 font-weight-bold mb-2">盤點數據</div>
            <v-row dense>
              <v-col cols="6">
                <v-card variant="tonal" color="primary" class="pa-3 text-center" rounded="lg">
                  <div class="text-caption text-medium-emphasis">當下庫存</div>
                  <div class="text-h5 font-weight-bold">{{ productDetail.item.snapshotStockQty }}</div>
                </v-card>
              </v-col>
              <v-col cols="6">
                <v-card variant="tonal" :color="productDetail.item.countedQty !== null ? 'info' : 'grey'" class="pa-3 text-center" rounded="lg">
                  <div class="text-caption text-medium-emphasis">盤點數量</div>
                  <div class="text-h5 font-weight-bold">{{ productDetail.item.countedQty ?? '-' }}</div>
                </v-card>
              </v-col>
              <v-col cols="6">
                <v-card
                  variant="tonal"
                  :color="productDetail.item.diffQty === null ? 'grey' : productDetail.item.diffQty === 0 ? 'success' : 'error'"
                  class="pa-3 text-center"
                  rounded="lg"
                >
                  <div class="text-caption text-medium-emphasis">差異數量</div>
                  <div class="text-h5 font-weight-bold">
                    <template v-if="productDetail.item.diffQty !== null">
                      {{ productDetail.item.diffQty > 0 ? '+' : '' }}{{ productDetail.item.diffQty }}
                    </template>
                    <template v-else>-</template>
                  </div>
                </v-card>
              </v-col>
              <v-col cols="6">
                <v-card variant="tonal" :color="productDetail.item.status === 'normal' ? 'success' : productDetail.item.status === 'error' ? 'error' : 'grey'" class="pa-3 text-center" rounded="lg">
                  <div class="text-caption text-medium-emphasis">狀態</div>
                  <div class="text-h6 font-weight-bold">
                    {{ productDetail.item.status === 'normal' ? '正常' : productDetail.item.status === 'error' ? '異常' : '未盤點' }}
                  </div>
                </v-card>
              </v-col>
            </v-row>

            <div v-if="productDetail.item.countedAt" class="text-caption text-medium-emphasis mt-3 text-right">
              盤點時間：{{ formatDateTime(productDetail.item.countedAt) }}
            </div>
          </v-card-text>
        </template>
      </v-card>
    </v-dialog>

    <!-- 確認完成 Dialog -->
    <v-dialog v-model="completeDialog" max-width="400">
      <v-card>
        <v-card-title>確認完成盤點？</v-card-title>
        <v-card-text>
          <div class="mb-2">盤點進度：{{ taskStore.currentSummary.completionRate }}%</div>
          <div class="mb-2">已盤點：{{ taskStore.currentSummary.countedProducts }} / {{ taskStore.currentSummary.totalProducts }}</div>
          <div v-if="taskStore.currentSummary.errorProducts > 0" class="text-error">
            異常商品：{{ taskStore.currentSummary.errorProducts }}
          </div>
          <v-alert
            v-if="taskStore.currentSummary.completionRate < 100"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            尚有 {{ taskStore.currentSummary.totalProducts - taskStore.currentSummary.countedProducts }} 個商品未盤點
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="completeDialog = false">取消</v-btn>
          <v-btn color="success" variant="flat" @click="confirmCompleteTask" :loading="taskStore.loading">
            確認完成
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import moment from 'moment'
import { useInventoryTaskStore } from '@/stores/inventoryTask'
import { useUIStore } from '@/stores/ui'
import api from '@/plugins/axios'

const router = useRouter()
const taskStore = useInventoryTaskStore()
const uiStore = useUIStore()

const availableUsers = ref([])
const availableCategories = ref([])
const historyTasks = ref([])
const historyLoading = ref(false)
const exportLoading = ref(false)
const completeDialog = ref(false)

const detailDialog = reactive({
  show: false,
  loading: false,
  task: null,
  snapshotItems: [],
  snapshotLoading: false,
  exporting: false,
  search: '',
  statusFilter: '',
  pagination: { currentPage: 1, totalPages: 1, totalItems: 0 }
})

const snapshotHeaders = [
  { title: '商品', key: 'product', sortable: false, width: '30%' },
  { title: '當下庫存', key: 'snapshotStockQty', align: 'center', width: '12%' },
  { title: '盤點數量', key: 'countedQty', align: 'center', width: '12%' },
  { title: '差異', key: 'diffQty', align: 'center', width: '12%' },
  { title: '狀態', key: 'status', align: 'center', width: '12%' },
  { title: '盤點時間', key: 'countedAt', width: '22%' }
]

const productDetail = reactive({
  show: false,
  item: null
})

let searchDebounceTimer = null

const scopeOptions = [
  { title: '全部商品', value: 'all' },
  { title: '指定品類', value: 'categories' }
]

const newTaskDialog = reactive({
  show: false,
  date: new Date().toISOString().split('T')[0],
  personnel: [],
  note: '',
  scope: 'all',
  categories: []
})

const formatTaskDate = (date) => moment(date).format('YYYY/MM/DD')
const formatDateTime = (date) => date ? moment(date).format('YYYY/MM/DD HH:mm') : '-'

const openNewTaskDialog = () => {
  newTaskDialog.date = new Date().toISOString().split('T')[0]
  newTaskDialog.personnel = []
  newTaskDialog.note = ''
  newTaskDialog.scope = 'all'
  newTaskDialog.categories = []
  newTaskDialog.show = true
}

const confirmCreateTask = async () => {
  try {
    await taskStore.createTask({
      date: newTaskDialog.date,
      personnel: newTaskDialog.personnel,
      note: newTaskDialog.note,
      scope: newTaskDialog.scope,
      categories: newTaskDialog.scope === 'categories' ? newTaskDialog.categories : []
    })
    uiStore.showSuccess('盤點任務已建立，庫存快照已完成')
    newTaskDialog.show = false
  } catch (error) {
    uiStore.showError('建立盤點任務失敗')
  }
}

const enterTask = async (taskId) => {
  try {
    await taskStore.resumeTask(taskId)
    uiStore.showSuccess('已進入盤點任務')
  } catch (error) {
    uiStore.showError('進入任務失敗')
  }
}

const exitTask = () => {
  taskStore.clearCurrentTask()
}

const handleRefreshSnapshot = async () => {
  try {
    const result = await taskStore.refreshSnapshot()
    uiStore.showSuccess(result.message)
  } catch (error) {
    uiStore.showError('重新整理失敗')
  }
}

const handleCompleteTask = () => {
  completeDialog.value = true
}

const confirmCompleteTask = async () => {
  try {
    await taskStore.completeTask(taskStore.currentTaskId)
    uiStore.showSuccess('盤點任務已完成')
    completeDialog.value = false
    await loadActiveTasks()
  } catch (error) {
    uiStore.showError('完成盤點任務失敗')
  }
}

const loadActiveTasks = async () => {
  await taskStore.fetchActiveTasks()
}

const loadHistoryTasks = async () => {
  try {
    historyLoading.value = true
    const allTasks = await taskStore.fetchTasks({ limit: 50 })
    historyTasks.value = allTasks.filter(t => t.status !== 'in_progress')
  } catch (error) {
    console.error('載入歷史任務失敗:', error)
  } finally {
    historyLoading.value = false
  }
}

const loadCategories = async () => {
  try {
    const response = await api.get('/products/categories')
    availableCategories.value = (response.data.categories || []).map(c => c.name || c)
  } catch (error) {
    console.error('載入品類失敗:', error)
  }
}

const generateReport = async () => {
  if (!taskStore.hasCurrentTask) return
  try {
    uiStore.showInfo('正在生成異常報告...')
    const data = await taskStore.fetchSnapshot(taskStore.currentTaskId, { status: 'error', limit: 10000 })
    const items = data.snapshot || []

    if (items.length === 0) {
      uiStore.showInfo('本次盤點沒有異常商品')
      return
    }

    const csvContent = [
      ['商品名稱', 'SKU', '當下庫存', '盤點數量', '差異數量', '盤點時間'].join(','),
      ...items.map(item => [
        item.product?.displayName || item.product?.name || '',
        item.product?.sku || '',
        item.snapshotStockQty,
        item.countedQty,
        item.diffQty,
        item.countedAt ? moment(item.countedAt).format('YYYY-MM-DD HH:mm:ss') : ''
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `inventory_error_report_${formatTaskDate(taskStore.currentTask.date)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    uiStore.showSuccess('異常報告已匯出')
  } catch (error) {
    uiStore.showError('生成報告失敗')
  }
}

const exportData = async () => {
  if (!taskStore.hasCurrentTask) return
  try {
    exportLoading.value = true
    const data = await taskStore.fetchSnapshot(taskStore.currentTaskId, { limit: 10000 })
    const items = data.snapshot || []

    const csvContent = [
      ['商品名稱', 'SKU', '當下庫存', '當前庫存', '盤點數量', '差異數量', '狀態', '盤點時間'].join(','),
      ...items.map(item => [
        item.product?.displayName || item.product?.name || '',
        item.product?.sku || '',
        item.snapshotStockQty,
        item.currentStockQty ?? '',
        item.countedQty ?? '',
        item.diffQty ?? '',
        item.status === 'uncounted' ? '未盤點' : item.status === 'normal' ? '正常' : '異常',
        item.countedAt ? moment(item.countedAt).format('YYYY-MM-DD HH:mm:ss') : ''
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `inventory_data_${formatTaskDate(taskStore.currentTask.date)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    uiStore.showSuccess('盤點數據已匯出')
  } catch (error) {
    uiStore.showError('匯出數據失敗')
  } finally {
    exportLoading.value = false
  }
}

const openTaskDetail = async (taskId) => {
  detailDialog.show = true
  detailDialog.loading = true
  detailDialog.task = null
  detailDialog.snapshotItems = []
  detailDialog.search = ''
  detailDialog.statusFilter = ''
  detailDialog.pagination = { currentPage: 1, totalPages: 1, totalItems: 0 }

  try {
    const task = await taskStore.fetchTaskDetail(taskId)
    detailDialog.task = task
    detailDialog.loading = false
    await loadSnapshotPage(1)
  } catch (error) {
    uiStore.showError('載入任務詳情失敗')
    detailDialog.show = false
  }
}

const loadSnapshotPage = async (page = 1) => {
  if (!detailDialog.task) return
  try {
    detailDialog.snapshotLoading = true
    const params = { page, limit: 100 }
    if (detailDialog.statusFilter) params.status = detailDialog.statusFilter
    if (detailDialog.search) params.search = detailDialog.search

    const data = await taskStore.fetchSnapshot(detailDialog.task._id, params)
    detailDialog.snapshotItems = data.snapshot || []
    detailDialog.pagination = data.pagination || { currentPage: page, totalPages: 1, totalItems: 0 }
  } catch (error) {
    console.error('載入快照失敗:', error)
  } finally {
    detailDialog.snapshotLoading = false
  }
}

const debounceLoadSnapshot = () => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => loadSnapshotPage(1), 300)
}

watch(() => detailDialog.statusFilter, () => loadSnapshotPage(1))

const openProductDetail = (item) => {
  productDetail.item = item
  productDetail.show = true
}

const exportTaskDetail = async () => {
  if (!detailDialog.task) return
  try {
    detailDialog.exporting = true
    const data = await taskStore.fetchSnapshot(detailDialog.task._id, {
      limit: 10000,
      status: detailDialog.statusFilter || undefined
    })
    const items = data.snapshot || []

    const csvContent = [
      ['商品名稱', 'SKU', '當下庫存', '盤點數量', '差異數量', '狀態', '盤點時間'].join(','),
      ...items.map(item => [
        `"${(item.product?.displayName || item.product?.name || '').replace(/"/g, '""')}"`,
        item.product?.sku || '',
        item.snapshotStockQty,
        item.countedQty ?? '',
        item.diffQty ?? '',
        item.status === 'normal' ? '正常' : item.status === 'error' ? '異常' : '未盤點',
        item.countedAt ? moment(item.countedAt).format('YYYY-MM-DD HH:mm:ss') : ''
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `盤點報告_${formatTaskDate(detailDialog.task.date)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    uiStore.showSuccess('盤點報告已匯出')
  } catch (error) {
    uiStore.showError('匯出失敗')
  } finally {
    detailDialog.exporting = false
  }
}

onMounted(async () => {
  await Promise.all([
    taskStore.restoreTask(),
    loadActiveTasks(),
    loadHistoryTasks(),
    taskStore.fetchActiveUsers().then(u => { availableUsers.value = u }),
    loadCategories()
  ])
})
</script>

<style scoped>
.h-100 {
  height: 100%;
}

.v-progress-linear {
  border-radius: 10px;
}

.stat-card {
  border-radius: 12px !important;
}

.new-task-card {
  border-style: dashed !important;
  border-width: 2px !important;
}

.task-list-item {
  cursor: pointer;
  transition: background-color 0.15s;
}

.task-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
}

.text-truncate-wrapper {
  min-width: 0;
  overflow: hidden;
}

.snapshot-table :deep(tbody tr) {
  cursor: pointer;
}

.product-detail-image-wrap {
  position: relative;
  overflow: hidden;
}
</style>
