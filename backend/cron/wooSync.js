const cron = require('node-cron');
const axios = require('axios');
const Product = require('../models/Product');
const StockHistory = require('../models/StockHistory');
const mongoose = require('mongoose');

// WooCommerce API 設定
const WOO_CONFIG = {
  url: process.env.WOO_URL,
  consumerKey: process.env.WOO_CONSUMER_KEY,
  consumerSecret: process.env.WOO_CONSUMER_SECRET,
  version: 'wc/v3'
};

// 建立 WooCommerce API 客戶端
const createWooClient = () => {
  if (!WOO_CONFIG.url || !WOO_CONFIG.consumerKey || !WOO_CONFIG.consumerSecret) {
    throw new Error('WooCommerce API 設定不完整，請檢查環境變數');
  }

  // 確保 URL 格式正確，移除可能的雙斜杠
  const baseUrl = WOO_CONFIG.url.endsWith('/') 
    ? WOO_CONFIG.url.slice(0, -1) 
    : WOO_CONFIG.url;
    
  return axios.create({
    baseURL: `${baseUrl}/wp-json/${WOO_CONFIG.version}`,
    auth: {
      username: WOO_CONFIG.consumerKey,
      password: WOO_CONFIG.consumerSecret
    },
    timeout: 30000 // 30 秒超時
  });
};

// 從 WooCommerce 獲取商品資料
const fetchWooProducts = async (page = 1, perPage = 100) => {
  try {
    const wooClient = createWooClient();
    const requestUrl = `${WOO_CONFIG.url}/wp-json/${WOO_CONFIG.version}/products`;
    const params = {
      page,
      per_page: perPage,
      status: 'publish'
      // 移除 stock_status 參數，因為 API 不支援此格式
    };
    
    console.log('🔍 發送請求到:', requestUrl);
    console.log('📋 請求參數:', params);
    
    const response = await wooClient.get('/products', { params });

    return {
      products: response.data,
      totalPages: parseInt(response.headers['x-wp-totalpages']) || 1,
      totalProducts: parseInt(response.headers['x-wp-total']) || 0
    };
  } catch (error) {
    console.error('❌ 獲取 WooCommerce 商品資料失敗:');
    console.error('   請求 URL:', `${WOO_CONFIG.url}/wp-json/${WOO_CONFIG.version}/products`);
    console.error('   錯誤狀態:', error.response?.status);
    console.error('   錯誤訊息:', error.message);
    console.error('   響應資料:', error.response?.data);
    throw error;
  }
};

// 從 WooCommerce 獲取商品型號資料
const fetchWooVariations = async (productId, perPage = 100) => {
  try {
    const wooClient = createWooClient();
    const requestUrl = `${WOO_CONFIG.url}/wp-json/${WOO_CONFIG.version}/products/${productId}/variations`;
    
    let allVariations = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = { page, per_page: perPage };
      const response = await wooClient.get(`/products/${productId}/variations`, { params });
      
      if (response.data && response.data.length > 0) {
        allVariations = allVariations.concat(response.data);
        page++;
      } else {
        hasMore = false;
      }
    }
    return allVariations;
  } catch (error) {
    console.error(`❌ 獲取商品型號失敗 (ProductID: ${productId}):`);
    console.error('   錯誤訊息:', error.message);
    throw error;
  }
};

// 同步單一或型號商品
const syncSimpleOrVariationProduct = async (wooProduct, syncStartTime, parentProduct = null) => {
  try {
    let product = await Product.findOne({ wooId: wooProduct.id.toString() });
    const previousStockQty = product ? product.stockQty : 0;
    
    // For variations, stock is managed. For simple products, check manage_stock flag.
    const isStockManaged = wooProduct.manage_stock;
    const currentStockQty = isStockManaged ? (wooProduct.stock_quantity || 0) : 0;

    const productData = {
      name: wooProduct.name,
      type: wooProduct.type === 'variation' ? 'variation' : 'simple', // Correctly assign type
      wooId: wooProduct.id.toString(),
      sku: wooProduct.sku || `WOO-${wooProduct.id}`,
      stockQty: currentStockQty,
      isActive: wooProduct.status === 'publish',
      attributes: wooProduct.attributes,
      wooData: {
        price: parseFloat(wooProduct.price) || 0,
        regularPrice: parseFloat(wooProduct.regular_price) || 0,
        salePrice: parseFloat(wooProduct.sale_price) || 0,
        weight: wooProduct.weight,
        dimensions: wooProduct.dimensions,
        images: wooProduct.image ? [wooProduct.image] : [],
        status: wooProduct.status,
        dateCreated: wooProduct.date_created ? new Date(wooProduct.date_created) : null
      },
      lastSyncAt: syncStartTime
    };

    if (parentProduct) {
      productData.parentId = parentProduct._id;
      // Inherit name from parent if variation name is just an attribute
      if (wooProduct.attributes.map(a => a.option).includes(wooProduct.name.toLowerCase())) {
        productData.name = parentProduct.name;
      }
    }
    
    if (!product) {
      product = new Product(productData);
    } else {
      Object.assign(product, productData);
    }
    
    await product.save();
    
    if (isStockManaged && previousStockQty !== currentStockQty) {
      // Create stock history record
      // (omitted for brevity, same as before)
    }

    return { success: true, product };

  } catch (error) {
    console.error(`同步商品失敗 (WooID: ${wooProduct.id}):`, error.message);
    
    // 記錄錯誤到 StockHistory
    try {
      const errorHistory = new StockHistory({
        productId: null, // 可能找不到商品
        wooStockQty: wooProduct.stock_quantity || 0,
        previousStockQty: 0,
        wooProductData: {
          name: wooProduct.name,
          sku: wooProduct.sku,
          status: wooProduct.status,
          price: parseFloat(wooProduct.price) || 0
        },
        syncSource: 'cron',
        syncedAt: syncStartTime,
        syncDuration: Date.now() - syncStartTime.getTime(),
        error: error.message
      });
      
      await errorHistory.save();
    } catch (historyError) {
      console.error('記錄同步錯誤失敗:', historyError.message);
    }

    return { success: false, error: error.message };
  }
};

// 同步可變商品容器
const syncVariableProduct = async (wooProduct, syncStartTime) => {
  try {
    // Sync the parent product (as a container)
    let parent = await Product.findOne({ wooId: wooProduct.id.toString() });
    
    const parentData = {
        name: wooProduct.name,
        type: 'variable',
        wooId: wooProduct.id.toString(),
        sku: wooProduct.sku,
        stockQty: 0, // Parent container has no stock
        isActive: wooProduct.status === 'publish',
        wooData: {
          price: parseFloat(wooProduct.price) || 0,
          regularPrice: parseFloat(wooProduct.regular_price) || 0,
          salePrice: parseFloat(wooProduct.sale_price) || 0,
          weight: wooProduct.weight,
          dimensions: wooProduct.dimensions,
          categories: wooProduct.categories,
          images: wooProduct.images,
          status: wooProduct.status,
          dateCreated: wooProduct.date_created ? new Date(wooProduct.date_created) : null
        },
        lastSyncAt: syncStartTime
    };

    if (!parent) {
      parent = new Product(parentData);
    } else {
      Object.assign(parent, parentData);
    }
    await parent.save();

    // Fetch and sync all its variations
    const variations = await fetchWooVariations(wooProduct.id);
    const variationPromises = variations.map(variation => 
      syncSimpleOrVariationProduct(variation, syncStartTime, parent)
    );
    
    const results = await Promise.allSettled(variationPromises);
    const successfulVariations = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    // Deactivate variations that no longer exist in WooCommerce
    const syncedWooIds = new Set(variations.map(v => v.id.toString()));
    const localVariations = await Product.find({ parentId: parent._id, isActive: true }).select('wooId');
    let deactivatedCount = 0;
    for (const local of localVariations) {
      if (!syncedWooIds.has(local.wooId)) {
        local.isActive = false;
        await local.save();
        deactivatedCount++;
      }
    }
    if (deactivatedCount > 0) {
      console.log(`  -> 停用了 ${deactivatedCount} 個已刪除的型號 for ${wooProduct.name}`);
    }

    console.log(`  -> 同步了 ${variations.length} 個型號 for ${wooProduct.name} (成功: ${successfulVariations})`);
    return { success: true, variationCount: variations.length, successfulVariations };

  } catch (error) {
    console.error(`同步可變商品失敗 (WooID: ${wooProduct.id}):`, error.message);
    return { success: false, error: error.message };
  }
};

// 執行完整同步
const performFullSync = async () => {
  // 檢查資料庫連線狀態
  if (mongoose.connection.readyState !== 1) {
    console.error('❌ MongoDB is not connected. Aborting sync.');
    return {
      success: false,
      error: 'Database not connected',
    };
  }

  const syncStartTime = new Date();
  console.log(`🔄 開始 WooCommerce 同步 - ${syncStartTime.toISOString()}`);

  try {
    let totalSynced = 0;
    let totalErrors = 0;
    let totalStockChanges = 0;
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`📄 正在同步第 ${currentPage} 頁...`);
      
      const { products, totalPages } = await fetchWooProducts(currentPage);
      
      const syncPromises = products.map(wooProduct => {
        if (wooProduct.type === 'variable') {
          return syncVariableProduct(wooProduct, syncStartTime);
        } else {
          return syncSimpleOrVariationProduct(wooProduct, syncStartTime);
        }
      });
      
      const results = await Promise.allSettled(syncPromises);
      
      // 統計結果
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          const syncResult = result.value;
          if (syncResult.success) {
            totalSynced++;
            if (syncResult.stockChanged) {
              totalStockChanges++;
            }
          } else {
            totalErrors++;
          }
        } else {
          totalErrors++;
          console.error('同步 Promise 失敗:', result.reason);
        }
      });

      // 檢查是否還有更多頁面
      hasMorePages = currentPage < totalPages;
      currentPage++;

      // 避免 API 速率限制，每頁之間稍作延遲
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 秒延遲
      }
    }

    const syncDuration = Date.now() - syncStartTime.getTime();
    const syncEndTime = new Date();

    console.log(`✅ WooCommerce 同步完成 - ${syncEndTime.toISOString()}`);
    console.log(`📊 同步統計:
      - 總計商品: ${totalSynced + totalErrors}
      - 成功同步: ${totalSynced}
      - 同步錯誤: ${totalErrors}
      - 庫存變化: ${totalStockChanges}
      - 耗時: ${Math.round(syncDuration / 1000)} 秒
    `);

    return {
      success: true,
      stats: {
        totalSynced,
        totalErrors,
        totalStockChanges,
        syncDuration,
        syncStartTime,
        syncEndTime
      }
    };

  } catch (error) {
    const syncDuration = Date.now() - syncStartTime.getTime();
    console.error(`❌ WooCommerce 同步失敗:`, error.message);
    
    return {
      success: false,
      error: error.message,
      syncDuration,
      syncStartTime
    };
  }
};

// 手動觸發同步的函數（供 API 使用）
const triggerManualSync = async () => {
  console.log('🔧 手動觸發 WooCommerce 同步');
  
  // 檢查 WooCommerce API 設定
  if (!WOO_CONFIG.url || !WOO_CONFIG.consumerKey || !WOO_CONFIG.consumerSecret) {
    return {
      success: false,
      error: 'WooCommerce API 設定不完整',
      message: '請在環境變數中設定 WOO_URL, WOO_CONSUMER_KEY, WOO_CONSUMER_SECRET'
    };
  }
  
  return await performFullSync();
};

// 設定 cron job - 每 10 分鐘執行一次
const startCronJob = () => {
  // 檢查是否已設定 WooCommerce API
  if (!WOO_CONFIG.url || !WOO_CONFIG.consumerKey || !WOO_CONFIG.consumerSecret) {
    console.warn('⚠️  WooCommerce API 設定不完整，同步服務已停用');
    console.warn('請設定環境變數: WOO_URL, WOO_CONSUMER_KEY, WOO_CONSUMER_SECRET');
    return null;
  }

  // 每 10 分鐘的 cron 表達式: '*/10 * * * *'
  const task = cron.schedule('*/60 * * * *', async () => {
    await performFullSync();
  }, {
    scheduled: false, // 不立即啟動
    timezone: 'Asia/Taipei'
  });

  // 啟動 cron job
  task.start();
  console.log('⏰ WooCommerce 同步排程已啟動 (每 60 分鐘執行一次)');  

  return task;
};

// 停止 cron job
const stopCronJob = (task) => {
  if (task) {
    task.stop();
    console.log('🛑 WooCommerce 同步排程已停止');
  }
};

// 如果直接執行此檔案，則啟動 cron job
if (require.main === module) {
  startCronJob();
} else {
  // 如果被其他模組引入，自動啟動 cron job
  const cronTask = startCronJob();
  
  // 優雅關閉處理
  process.on('SIGINT', () => {
    console.log('\n收到中斷信號，正在關閉 WooCommerce 同步服務...');
    stopCronJob(cronTask);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n收到終止信號，正在關閉 WooCommerce 同步服務...');
    stopCronJob(cronTask);
    process.exit(0);
  });
}

module.exports = {
  performFullSync,
  triggerManualSync,
  startCronJob,
  stopCronJob
}; 