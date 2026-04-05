const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken, requireEmployee } = require('../middleware/auth');
const Product = require('../models/Product');

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

  const baseUrl = WOO_CONFIG.url.endsWith('/') 
    ? WOO_CONFIG.url.slice(0, -1) 
    : WOO_CONFIG.url;

  return axios.create({
    baseURL: `${baseUrl}/wp-json/${WOO_CONFIG.version}`,
    auth: {
      username: WOO_CONFIG.consumerKey,
      password: WOO_CONFIG.consumerSecret
    },
    timeout: 30000
  });
};

// GET /api/orders - 獲取訂單列表
router.get('/',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const { 
        page = 1, 
        per_page = 20, 
        status = 'any',
        search = ''
      } = req.query;

      const wooClient = createWooClient();
      
      const params = {
        page: parseInt(page),
        per_page: parseInt(per_page),
        status: status
      };

      if (search) {
        params.search = search;
      }

      console.log('🔍 查詢訂單，參數:', params);

      const response = await wooClient.get('/orders', { params });

      const orders = response.data;
      const totalOrders = parseInt(response.headers['x-wp-total']) || 0;
      const totalPages = parseInt(response.headers['x-wp-totalpages']) || 1;

      res.json({
        success: true,
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders,
          perPage: parseInt(per_page)
        }
      });

    } catch (error) {
      console.error('❌ 獲取訂單失敗:', error.message);
      res.status(500).json({
        success: false,
        message: '獲取訂單失敗',
        error: error.response?.data || error.message
      });
    }
  }
);

// GET /api/orders/categories - 獲取 WooCommerce 商品分類列表
// 注意：必須放在 /:id 路由之前，否則會被 /:id 匹配到
router.get('/categories',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      console.log('📂 開始獲取商品分類列表...');
      
      const wooClient = createWooClient();
      let allCategories = [];
      let page = 1;
      let hasMore = true;

      // 分頁獲取所有分類
      while (hasMore) {
        try {
          const response = await wooClient.get('/products/categories', {
            params: {
              page,
              per_page: 100,
              hide_empty: true  // 只顯示有商品的分類
            }
          });

          const categories = response.data;
          allCategories = allCategories.concat(categories);

          const totalPages = parseInt(response.headers['x-wp-totalpages']) || 1;
          hasMore = page < totalPages;
          page++;
        } catch (error) {
          console.error(`獲取分類第 ${page} 頁失敗:`, error.message);
          hasMore = false;
        }
      }

      console.log(`✅ 共獲取 ${allCategories.length} 個商品分類`);

      // 整理分類資料，只保留需要的欄位
      const categoriesData = allCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        count: cat.count,
        parent: cat.parent
      }));

      res.json({
        success: true,
        categories: categoriesData
      });

    } catch (error) {
      console.error('❌ 獲取商品分類失敗:', error.message);
      res.status(500).json({
        success: false,
        message: '獲取商品分類失敗',
        error: error.message
      });
    }
  }
);

// GET /api/orders/stats/pre-order - 獲取預購商品統計
router.get('/stats/pre-order',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      // 獲取篩選參數
      const { startDate, endDate, statuses, excludeCategories, excludeProductNames, excludeProductIds } = req.query;
      
      console.log('📊 開始統計預購商品訂單...');
      console.log('篩選條件:', { startDate, endDate, statuses, excludeCategories, excludeProductNames, excludeProductIds });

      // 1. 從資料庫獲取所有預購商品（attributes 中包含 name:"貨況", option:"pre-order"）
      let preOrderProducts = await Product.find({
        isActive: true,
        type: 'variation',
        attributes: {
          $elemMatch: {
            name: '貨況',
            option: 'pre-order'
          }
        }
      }).populate('parentId', 'name wooId');

      console.log(`✅ 找到 ${preOrderProducts.length} 個預購商品`);

      // 2. 如果有排除分類，過濾掉這些分類的商品
      if (excludeCategories) {
        const excludeCategoryIds = excludeCategories.split(',').map(id => parseInt(id));
        console.log(`🔍 排除分類 ID: ${excludeCategoryIds.join(', ')}`);
        
        const originalCount = preOrderProducts.length;
        preOrderProducts = preOrderProducts.filter(product => {
          // 檢查商品的 wooData.categories 是否包含要排除的分類
          if (!product.wooData || !product.wooData.categories) return true;
          
          const hasExcludedCategory = product.wooData.categories.some(cat => 
            excludeCategoryIds.includes(cat.id)
          );
          
          return !hasExcludedCategory;
        });
        
        console.log(`✅ 排除分類後剩餘 ${preOrderProducts.length} 個商品（排除了 ${originalCount - preOrderProducts.length} 個）`);
      }

      // 3. 如果有排除商品名稱關鍵字，過濾掉包含這些關鍵字的商品
      if (excludeProductNames) {
        const excludeKeywords = excludeProductNames.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
        if (excludeKeywords.length > 0) {
          console.log(`🔍 排除商品名稱關鍵字: ${excludeKeywords.join(', ')}`);
          
          const originalCount = preOrderProducts.length;
          preOrderProducts = preOrderProducts.filter(product => {
            const productName = product.name.toLowerCase();
            const parentName = product.parentId?.name?.toLowerCase() || '';
            
            // 檢查商品名稱或父商品名稱是否包含任何排除關鍵字
            const hasExcludedKeyword = excludeKeywords.some(keyword => 
              productName.includes(keyword) || parentName.includes(keyword)
            );
            
            return !hasExcludedKeyword;
          });
          
          console.log(`✅ 排除商品名稱後剩餘 ${preOrderProducts.length} 個商品（排除了 ${originalCount - preOrderProducts.length} 個）`);
        }
      }

      if (preOrderProducts.length === 0) {
        return res.json({
          success: true,
          message: '目前沒有預購商品',
          stats: [],
          filters: { startDate, endDate, statuses, excludeCategories, excludeProductNames }
        });
      }

      // 2. 從 WooCommerce 獲取待處理的訂單
      const wooClient = createWooClient();
      
      // 使用用戶選擇的狀態，如果沒有則使用預設值（排除 on-hold）
      const validStatuses = statuses 
        ? statuses.split(',')
        : ['pending', 'processing'];
      
      let allOrders = [];
      
      // 分別查詢各狀態的訂單
      for (const status of validStatuses) {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          try {
            const params = {
              status,
              page,
              per_page: 100
            };
            
            // 如果有日期範圍，加入篩選條件
            if (startDate) {
              params.after = new Date(startDate).toISOString();
            }
            if (endDate) {
              // 結束日期加一天，以包含當天的所有訂單
              const endDateTime = new Date(endDate);
              endDateTime.setDate(endDateTime.getDate() + 1);
              params.before = endDateTime.toISOString();
            }
            
            const response = await wooClient.get('/orders', { params });

            const orders = response.data;
            allOrders = allOrders.concat(orders);

            const totalPages = parseInt(response.headers['x-wp-totalpages']) || 1;
            hasMore = page < totalPages;
            page++;

            console.log(`   已獲取 ${status} 訂單第 ${page - 1}/${totalPages} 頁`);
          } catch (error) {
            console.error(`   獲取 ${status} 訂單失敗:`, error.message);
            hasMore = false;
          }
        }
      }

      console.log(`✅ 共獲取 ${allOrders.length} 筆待處理訂單`);

      // 3. 統計各預購商品在訂單中的數量
      const preOrderStats = {};

      // 初始化統計物件
      preOrderProducts.forEach(product => {
        preOrderStats[product.wooId] = {
          productId: product._id,
          wooId: product.wooId,
          name: product.name,
          parentName: product.parentId?.name || '',
          sku: product.sku,
          attributes: product.attributes,
          totalOrderQty: 0,
          currentStockQty: product.stockQty,
          onOrderQty: product.onOrderQty || 0,
          lastOrderDate: product.lastOrderDate,
          actualShortage: 0,
          needToPurchase: 0,
          orderCount: 0,
          orders: [] // 包含此商品的訂單列表
        };
      });

      // 遍歷所有訂單，累計數量
      allOrders.forEach(order => {
        order.line_items.forEach(item => {
          const variationId = item.variation_id || item.product_id;
          
          if (preOrderStats[variationId]) {
            preOrderStats[variationId].totalOrderQty += item.quantity;
            preOrderStats[variationId].orderCount += 1;
            preOrderStats[variationId].orders.push({
              orderId: order.id,
              orderNumber: order.number,
              status: order.status,
              quantity: item.quantity,
              dateCreated: order.date_created
            });
          }
        });
      });

      // 計算需要進貨的數量和實際缺貨數量
      Object.keys(preOrderStats).forEach(wooId => {
        const stat = preOrderStats[wooId];
        // 需要進貨 = 訂單數量 - 現有庫存（不考慮已訂購）
        stat.needToPurchase = Math.max(0, stat.totalOrderQty - stat.currentStockQty);
        // 實際缺貨 = 訂單數量 - 現有庫存 - 已訂購數量
        stat.actualShortage = Math.max(0, stat.totalOrderQty - stat.currentStockQty - stat.onOrderQty);
      });

      // 轉換為陣列並排序（依需要進貨數量排序）
      const statsArray = Object.values(preOrderStats)
        .filter(stat => stat.totalOrderQty > 0) // 只顯示有訂單的商品
        .sort((a, b) => b.needToPurchase - a.needToPurchase);

      console.log(`✅ 統計完成，有 ${statsArray.length} 個商品有預購訂單`);

      res.json({
        success: true,
        stats: statsArray,
        summary: {
          totalPreOrderProducts: preOrderProducts.length,
          productsWithOrders: statsArray.length,
          totalOrders: allOrders.length,
          totalOrderQty: statsArray.reduce((sum, s) => sum + s.totalOrderQty, 0),
          totalNeedToPurchase: statsArray.reduce((sum, s) => sum + s.needToPurchase, 0)
        },
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          statuses: validStatuses,
          excludeCategories: excludeCategories || null,
          excludeProductNames: excludeProductNames || null
        }
      });

    } catch (error) {
      console.error('❌ 統計預購商品訂單失敗:', error.message);
      console.error(error.stack);
      res.status(500).json({
        success: false,
        message: '統計預購商品訂單失敗',
        error: error.message
      });
    }
  }
);

// GET /api/orders/stats/in-stock - 獲取現貨商品待處理訂單統計
router.get('/stats/in-stock',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const { startDate, endDate, statuses, excludeCategories, excludeProductNames, excludeProductIds } = req.query;

      console.log('📊 開始統計現貨商品訂單...');

      // 取得所有非 pre-order 的 variation（現貨）
      let inStockVariations = await Product.find({
        isActive: true,
        type: 'variation',
        $nor: [{
          attributes: {
            $elemMatch: { name: '貨況', option: 'pre-order' }
          }
        }]
      }).populate('parentId', 'name wooId wooData');

      // 也包含 simple 商品
      const simpleProducts = await Product.find({
        isActive: true,
        type: 'simple'
      });

      let allInStockProducts = [...inStockVariations, ...simpleProducts];

      console.log(`✅ 找到 ${allInStockProducts.length} 個現貨商品`);

      // 排除分類
      if (excludeCategories) {
        const excludeCategoryIds = excludeCategories.split(',').map(id => parseInt(id));
        allInStockProducts = allInStockProducts.filter(product => {
          const cats = product.wooData?.categories || product.parentId?.wooData?.categories || [];
          return !cats.some(cat => excludeCategoryIds.includes(cat.id));
        });
      }

      // 排除商品名稱
      if (excludeProductNames) {
        const keywords = excludeProductNames.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
        if (keywords.length > 0) {
          allInStockProducts = allInStockProducts.filter(product => {
            const name = product.name.toLowerCase();
            const parentName = product.parentId?.name?.toLowerCase() || '';
            return !keywords.some(kw => name.includes(kw) || parentName.includes(kw));
          });
        }
      }

      if (allInStockProducts.length === 0) {
        return res.json({
          success: true,
          stats: [],
          summary: { totalInStockProducts: 0, productsWithOrders: 0, totalOrders: 0, totalOrderQty: 0 },
          filters: { startDate, endDate, statuses, excludeCategories, excludeProductNames }
        });
      }

      // 從 WooCommerce 獲取訂單
      const wooClient = createWooClient();
      const validStatuses = statuses ? statuses.split(',') : ['processing'];

      let allOrders = [];
      for (const status of validStatuses) {
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          try {
            const params = { status, page, per_page: 100 };
            if (startDate) params.after = new Date(startDate).toISOString();
            if (endDate) {
              const endDateTime = new Date(endDate);
              endDateTime.setDate(endDateTime.getDate() + 1);
              params.before = endDateTime.toISOString();
            }
            const response = await wooClient.get('/orders', { params });
            allOrders = allOrders.concat(response.data);
            const totalPages = parseInt(response.headers['x-wp-totalpages']) || 1;
            hasMore = page < totalPages;
            page++;
          } catch (error) {
            console.error(`獲取 ${status} 訂單失敗:`, error.message);
            hasMore = false;
          }
        }
      }

      console.log(`✅ 共獲取 ${allOrders.length} 筆訂單`);

      // 排除包含指定商品的訂單
      let filteredOrders = allOrders;
      if (excludeProductIds) {
        const excludeIds = excludeProductIds.split(',').map(id => id.trim());
        const excludeWooIds = new Set();
        for (const id of excludeIds) {
          const product = await Product.findById(id).select('wooId');
          if (product) excludeWooIds.add(parseInt(product.wooId));
        }
        if (excludeWooIds.size > 0) {
          filteredOrders = allOrders.filter(order => {
            return !order.line_items.some(item => {
              const itemId = item.variation_id || item.product_id;
              return excludeWooIds.has(itemId);
            });
          });
          console.log(`✅ 排除商品後剩餘 ${filteredOrders.length} 筆訂單`);
        }
      }

      // 統計各商品在訂單中的數量
      const inStockStats = {};
      allInStockProducts.forEach(product => {
        inStockStats[product.wooId] = {
          productId: product._id,
          wooId: product.wooId,
          name: product.name,
          parentName: product.parentId?.name || '',
          sku: product.sku,
          attributes: product.attributes || [],
          totalOrderQty: 0,
          currentStockQty: product.stockQty,
          onOrderQty: product.onOrderQty || 0,
          lastOrderDate: product.lastOrderDate,
          actualShortage: 0,
          orderCount: 0,
          orders: []
        };
      });

      filteredOrders.forEach(order => {
        order.line_items.forEach(item => {
          const variationId = item.variation_id || item.product_id;
          if (inStockStats[variationId]) {
            inStockStats[variationId].totalOrderQty += item.quantity;
            inStockStats[variationId].orderCount += 1;
            inStockStats[variationId].orders.push({
              orderId: order.id,
              orderNumber: order.number,
              status: order.status,
              quantity: item.quantity,
              dateCreated: order.date_created,
              customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || '訪客'
            });
          }
        });
      });

      // 計算缺貨數量
      Object.values(inStockStats).forEach(stat => {
        stat.actualShortage = Math.max(0, stat.totalOrderQty - stat.currentStockQty - stat.onOrderQty);
      });

      const statsArray = Object.values(inStockStats)
        .filter(stat => stat.totalOrderQty > 0)
        .sort((a, b) => b.totalOrderQty - a.totalOrderQty);

      res.json({
        success: true,
        stats: statsArray,
        summary: {
          totalInStockProducts: allInStockProducts.length,
          productsWithOrders: statsArray.length,
          totalOrders: filteredOrders.length,
          totalOrderQty: statsArray.reduce((sum, s) => sum + s.totalOrderQty, 0)
        },
        filters: { startDate, endDate, statuses: validStatuses, excludeCategories, excludeProductNames, excludeProductIds }
      });

    } catch (error) {
      console.error('❌ 統計現貨商品訂單失敗:', error.message);
      res.status(500).json({ success: false, message: '統計現貨商品訂單失敗', error: error.message });
    }
  }
);

// GET /api/orders/:id - 獲取單一訂單詳情
// 注意：必須放在最後，因為 :id 是通配符會匹配任何路徑
router.get('/:id',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const { id } = req.params;
      const wooClient = createWooClient();

      console.log('🔍 查詢訂單詳情，ID:', id);

      const response = await wooClient.get(`/orders/${id}`);

      res.json({
        success: true,
        order: response.data
      });

    } catch (error) {
      console.error('❌ 獲取訂單詳情失敗:', error.message);
      res.status(error.response?.status || 500).json({
        success: false,
        message: '獲取訂單詳情失敗',
        error: error.response?.data || error.message
      });
    }
  }
);

module.exports = router;

