const axios = require('axios');
const Product = require('./models/Product');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

const WOO_CONFIG = {
  url: process.env.WOO_URL,
  consumerKey: process.env.WOO_CONSUMER_KEY,
  consumerSecret: process.env.WOO_CONSUMER_SECRET,
};

const wooClient = axios.create({
  baseURL: `${WOO_CONFIG.url}/wp-json/wc/v3`,
  auth: {
    username: WOO_CONFIG.consumerKey,
    password: WOO_CONFIG.consumerSecret
  }
});

async function testPreOrderAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('=== 測試預購商品訂單統計 API 邏輯 ===\n');
    
    // 1. 從資料庫獲取所有預購商品
    console.log('步驟 1: 查詢預購商品...');
    const preOrderProducts = await Product.find({
      isActive: true,
      type: 'variation',
      attributes: {
        $elemMatch: {
          name: '貨況',
          option: 'pre-order'
        }
      }
    }).populate('parentId', 'name wooId');
    
    console.log(`找到 ${preOrderProducts.length} 個預購商品\n`);
    
    if (preOrderProducts.length === 0) {
      console.log('❌ 沒有找到預購商品！');
      process.exit(0);
    }
    
    // 2. 取得前 5 個商品的 WooCommerce ID
    const productWooIds = preOrderProducts.slice(0, 10).map(p => p.wooId);
    console.log('步驟 2: 查詢這些商品的訂單...');
    console.log('商品 WooID:', productWooIds.join(', '));
    console.log('');
    
    // 3. 從 WooCommerce 查詢訂單
    const targetStatuses = ['processing', 'pending', 'on-hold'];
    console.log(`步驟 3: 查詢訂單狀態: ${targetStatuses.join(', ')}\n`);
    
    const ordersRes = await wooClient.get('/orders', {
      params: {
        per_page: 100,
        status: targetStatuses.join(',')
      }
    });
    
    const orders = ordersRes.data;
    console.log(`找到 ${orders.length} 筆符合狀態的訂單\n`);
    
    // 4. 統計每個預購商品的訂單數量
    console.log('步驟 4: 統計預購商品訂單...\n');
    
    const productStats = {};
    
    preOrderProducts.forEach(product => {
      productStats[product.wooId] = {
        product,
        orderQty: 0,
        orderCount: 0,
        orderNumbers: []
      };
    });
    
    // 遍歷訂單
    orders.forEach(order => {
      order.line_items.forEach(item => {
        const wooId = item.variation_id ? String(item.variation_id) : String(item.product_id);
        
        if (productStats[wooId]) {
          productStats[wooId].orderQty += item.quantity;
          productStats[wooId].orderCount += 1;
          productStats[wooId].orderNumbers.push(order.number);
        }
      });
    });
    
    // 5. 顯示有訂單的預購商品
    console.log('=== 有訂單的預購商品 ===\n');
    
    const productsWithOrders = Object.values(productStats)
      .filter(stat => stat.orderQty > 0)
      .sort((a, b) => b.orderQty - a.orderQty);
    
    console.log(`找到 ${productsWithOrders.length} 個有訂單的預購商品\n`);
    
    productsWithOrders.slice(0, 10).forEach(stat => {
      console.log(`商品: ${stat.product.name}`);
      console.log(`  WooID: ${stat.product.wooId}`);
      console.log(`  訂單數量: ${stat.orderQty}`);
      console.log(`  訂單筆數: ${stat.orderCount}`);
      console.log(`  訂單編號: ${stat.orderNumbers.slice(0, 3).join(', ')}${stat.orderNumbers.length > 3 ? '...' : ''}`);
      console.log(`  現有庫存: ${stat.product.stockQty}`);
      console.log(`  需要進貨: ${Math.max(0, stat.orderQty - stat.product.stockQty)}`);
      console.log('');
    });
    
    if (productsWithOrders.length === 0) {
      console.log('❌ 沒有找到任何有訂單的預購商品！');
      console.log('\n可能原因:');
      console.log('1. 所有訂單狀態都不是 processing/pending/on-hold');
      console.log('2. 訂單中的商品 ID 與資料庫中的 wooId 不匹配');
      console.log('3. 訂單中沒有預購商品');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('錯誤:', err.message);
    if (err.response) {
      console.error('API 回應:', err.response.data);
    }
    process.exit(1);
  }
}

testPreOrderAPI();

