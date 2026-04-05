const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Product = require('../models/Product');
const StockHistory = require('../models/StockHistory');
const {
  authenticateToken,
  requireBoss,
  requireEmployee,
  logUserActivity
} = require('../middleware/auth');
const mongoose = require('mongoose'); // Added for user population

const router = express.Router();

// 處理驗證錯誤
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: '輸入資料驗證失敗',
      errors: errors.array()
    });
  }
  next();
};

// GET /api/products - 獲取商品列表
router.get('/',
  authenticateToken,
  requireEmployee,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('頁碼必須是正整數'),
    query('limit').optional().isInt().custom((value) => {
      const num = parseInt(value, 10);
      if (num === -1 || (num >= 1 && num <= 100)) {
        return true;
      }
      throw new Error('每頁數量必須是-1或1-100之間');
    }),
    query('search').optional().isString().trim(),
    query('barcode').optional().isString().trim(),
    query('sku').optional().isString().trim(),
    query('errorOnly').optional().isBoolean().withMessage('errorOnly必須是布林值'),
    query('inStockOnly').optional().isBoolean().withMessage('inStockOnly必須是布林值'),
    query('category').optional().isString().trim(),
    query('sortBy').optional().isString().trim(),
    query('hideDraft').optional().isBoolean().withMessage('hideDraft必須是布林值'),
    query('hidePreOrder').optional().isBoolean().withMessage('hidePreOrder必須是布林值')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      let {
        page = 1,
        limit = 20,
        search,
        barcode,
        sku,
        errorOnly = false,
        inStockOnly = false,
        category,
        sortBy = 'updatedAt_desc',
        hideDraft = 'true',
        hidePreOrder = 'true'
      } = req.query;

      const usePagination = parseInt(limit, 10) !== -1;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = usePagination ? (pageNum - 1) * limitNum : 0;
      let query = { isActive: true };

      // 條碼搜尋
      if (barcode) {
        // VitePOS uses the wooId of the variation as the barcode value.
        // So, we search in both the custom 'barcode' field and the 'wooId' field.
        const findQuery = {
          $or: [{ barcode: barcode }, { wooId: barcode }],
          isActive: true
        };

        // --- DEBUGGING: Log the exact find query ---
        console.log('--- BARCODE SEARCH QUERY ---');
        console.log(JSON.stringify(findQuery, null, 2));
        // --- END DEBUGGING ---

        const product = await Product.findOne(findQuery);

        if (!product) {
          // --- DEBUGGING: Log if not found ---
          console.log('--- PRODUCT NOT FOUND ---');
          return res.status(404).json({ message: '找不到對應條碼的商品' });
        }

        // 如果找到的是一個型號(variation)，要回傳它的主商品及所有型號
        if (product.type === 'variation') {
          const parentProduct = await Product.findById(product.parentId)
            .populate('lastCountedBy', 'name email');
          if (!parentProduct) {
            return res.status(404).json({ message: '找不到該型號對應的主商品' });
          }
          const variations = await Product.find({ parentId: parentProduct._id, isActive: true })
            .populate('lastCountedBy', 'name email');

          // 將 variations 附加到主商品上再回傳
          const parentObject = parentProduct.toObject();
          parentObject.variations = variations;

          // 注意：為了與列表的格式一致，我們將單一結果包裝在陣列中
          return res.json({
            products: [parentObject],
            pagination: { totalItems: 1, totalPages: 1 }
          });
        }

        // 如果找到的是可變商品，則加載其所有型號
        if (product.type === 'variable') {
          const variations = await Product.find({ parentId: product._id, isActive: true });
          const productObject = product.toObject();
          productObject.variations = variations;
          return res.json({
            products: [productObject],
            pagination: { totalItems: 1, totalPages: 1 }
          });
        }

        // 如果是單純商品，直接回傳
        return res.json({
          products: [product],
          pagination: { totalItems: 1, totalPages: 1 }
        });
      }

      // SKU 搜尋
      if (sku) {
        const product = await Product.findOne({ sku, isActive: true });
        if (!product) {
          return res.status(404).json({ message: '找不到對應SKU的商品' });
        }

        // 如果是可變商品或型號商品，找到主商品及其所有型號
        if (product.type === 'variable' || product.type === 'variation') {
          const parentId = product.type === 'variation' ? product.parentId : product._id;
          const parentProduct = await Product.findById(parentId);
          const variations = await Product.find({ parentId: parentId, isActive: true });
          return res.json({
            message: 'SKU搜尋成功',
            product: parentProduct.toObject(),
            variations
          });
        }

        return res.json({ message: 'SKU搜尋成功', product });
      }

      // 文字搜尋，排除所有 variation 子商品，只顯示主商品
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { barcode: { $regex: search, $options: 'i' } }
        ];
      }

      // 在主要查詢中，我們只獲取主商品 (simple or variable)
      query.type = { $in: ['simple', 'variable'] };

      // 隱藏草稿與私密商品（只保留 publish）
      if (hideDraft === 'true') {
        query['wooData.status'] = 'publish';
      }

      // 使用聚合查詢以支援虛擬欄位和錯誤篩選
      const aggregateQuery = [
        { $match: query },
        {
          $addFields: {
            countStatus: {
              $cond: [
                { $eq: ['$lastCountedAt', null] },
                'uncounted',
                { $cond: [{ $eq: ['$countedQty', '$stockQty'] }, 'normal', 'error'] }
              ]
            },
            isCountError: {
              $and: [
                { $ne: ['$lastCountedAt', null] },
                { $ne: ['$countedQty', '$stockQty'] }
              ]
            },
            diffQty: {
              $cond: [
                { $ne: ['$lastCountedAt', null] },
                { $subtract: ['$countedQty', '$stockQty'] },
                0
              ]
            },
            absDiffQty: {
              $abs: {
                $cond: [
                  { $ne: ['$lastCountedAt', null] },
                  { $subtract: ['$countedQty', '$stockQty'] },
                  0
                ]
              }
            }
          }
        }
      ];

      // 如果只要錯誤商品（已盤點且有差異）
      if (errorOnly === 'true') {
        aggregateQuery.push({ $match: { isCountError: true } });
      }

      // 只顯示有庫存的商品
      if (inStockOnly === 'true') {
        aggregateQuery.push({ $match: { stockQty: { $gt: 0 } } });
      }

      // 篩選指定商品分類（支援多選，逗號分隔）
      if (category) {
        const categories = category.split(',').map(c => c.trim()).filter(c => c);
        if (categories.length === 1) {
          aggregateQuery.push({ $match: { 'wooData.categories.name': categories[0] } });
        } else if (categories.length > 1) {
          aggregateQuery.push({ $match: { 'wooData.categories.name': { $in: categories } } });
        }
      }

      // 排序
      const sortOptionsMap = {
        updatedAt_desc: { updatedAt: -1 },
        name_asc: { name: 1 },
        name_desc: { name: -1 },
        createdAt_desc: { createdAt: -1 },
        createdAt_asc: { createdAt: 1 },
        wooCreatedAt_desc: { 'wooData.dateCreated': -1, createdAt: -1 },
        wooCreatedAt_asc: { 'wooData.dateCreated': 1, createdAt: 1 },
        stockQty_desc: { stockQty: -1 },
        stockQty_asc: { stockQty: 1 },
        lastCountedAt_desc: { lastCountedAt: -1 },
        lastCountedAt_asc: { lastCountedAt: 1 },
        absDiffQty_desc: { absDiffQty: -1 },
        uncountedFirst: { lastCountedAt: 1 },
        price_desc: { 'wooData.price': -1 }
      };
      const sortField = sortOptionsMap[sortBy] || sortOptionsMap.updatedAt_desc;
      aggregateQuery.push({ $sort: sortField });

      const aggregationPipeline = [...aggregateQuery];

      // 分頁
      if (usePagination) {
        aggregationPipeline.push(
          { $skip: skip },
          { $limit: limitNum }
        );
      }

      // 關聯查詢
      aggregationPipeline.push(
        {
          $lookup: {
            from: 'users',
            localField: 'lastCountedBy',
            foreignField: '_id',
            as: 'lastCountedBy',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $addFields: {
            lastCountedBy: { $arrayElemAt: ['$lastCountedBy', 0] }
          }
        }
      );

      // 執行查詢
      const [products, totalCountResult] = await Promise.all([
        Product.aggregate(aggregationPipeline),
        Product.aggregate([...aggregateQuery, { $count: 'total' }])
      ]);

      // 為可變商品聚合其型號的數據
      const shouldHidePreOrder = hidePreOrder === 'true';
      const productsWithAggregatedVariations = await Promise.all(products.map(async (p) => {
        if (p.type === 'variable') {
          let variations = await Product.find({ parentId: p._id, isActive: true });

          // 隱藏預購商品時，過濾掉 pre-order 變體
          if (shouldHidePreOrder) {
            variations = variations.filter(v => {
              const isPreOrder = v.attributes?.some(
                attr => attr.name === '貨況' && attr.option === 'pre-order'
              );
              return !isPreOrder;
            });
          }

          if (variations.length > 0) {
            p.stockQty = variations.reduce((sum, v) => sum + v.stockQty, 0);
            p.countedQty = variations.reduce((sum, v) => sum + v.countedQty, 0);

            // 新公式：差異 = 實際盤點 - 系統庫存
            const hasAnyCounted = variations.some(v => v.lastCountedAt);
            p.diffQty = hasAnyCounted ? (p.countedQty - p.stockQty) : 0;
            p.isCountError = hasAnyCounted && p.diffQty !== 0;
            p.countStatus = !hasAnyCounted ? 'uncounted' : (p.diffQty === 0 ? 'normal' : 'error');

            let latestCountedAt = null;
            let lastCountedBy = null;
            variations.forEach(v => {
              if (v.lastCountedAt && (!latestCountedAt || v.lastCountedAt > latestCountedAt)) {
                latestCountedAt = v.lastCountedAt;
                lastCountedBy = v.lastCountedBy;
              }
            });
            p.lastCountedAt = latestCountedAt;
            if (lastCountedBy && !p.lastCountedBy) {
              const user = await mongoose.model('User').findById(lastCountedBy).select('name email');
              p.lastCountedBy = user;
            }
          } else if (shouldHidePreOrder) {
            // All variations are pre-order, mark for removal
            p._shouldRemove = true;
          }
        }
        return p;
      }));

      // Remove variable products where all variations are pre-order
      const filteredProducts = productsWithAggregatedVariations.filter(p => !p._shouldRemove);

      const total = totalCountResult[0]?.total || 0;
      const totalPages = usePagination ? Math.ceil(total / limitNum) : 1;

      res.json({
        products: filteredProducts,
        pagination: {
          currentPage: usePagination ? pageNum : 1,
          totalPages,
          totalItems: total,
          itemsPerPage: usePagination ? limitNum : total,
          hasNextPage: usePagination && pageNum < totalPages,
          hasPrevPage: usePagination && pageNum > 1
        }
      });

    } catch (error) {
      console.error('獲取商品列表錯誤:', error);
      res.status(500).json({
        message: '獲取商品列表失敗'
      });
    }
  }
);

// GET /api/products/:id/variations - 獲取單一商品的所有型號
router.get('/:id/variations',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { hidePreOrder } = req.query;

      let variations = await Product.find({ parentId: id, isActive: true })
        .populate('lastCountedBy', 'name email')
        .sort({ 'attributes.name': 1, 'attributes.option': 1 });

      if (hidePreOrder === 'true') {
        variations = variations.filter(v => {
          const isPreOrder = v.attributes?.some(
            attr => attr.name === '貨況' && attr.option === 'pre-order'
          );
          return !isPreOrder;
        });
      }

      res.json({ variations });

    } catch (error) {
      console.error('獲取商品型號錯誤:', error);
      if (error.name === 'CastError') {
        return res.status(400).json({ message: '無效的商品ID格式' });
      }
      res.status(500).json({ message: '獲取商品型號失敗' });
    }
  }
);

// GET /api/products/categories - 獲取所有商品分類
router.get('/categories',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const categories = await Product.aggregate([
        { $match: { isActive: true, type: { $in: ['simple', 'variable'] } } },
        { $unwind: '$wooData.categories' },
        { $group: { _id: '$wooData.categories.name', id: { $first: '$wooData.categories.id' }, count: { $sum: 1 } } },
        { $project: { _id: 0, name: '$_id', id: 1, count: 1 } },
        { $sort: { name: 1 } }
      ]);
      res.json({ categories });
    } catch (error) {
      console.error('獲取商品分類錯誤:', error);
      res.status(500).json({ message: '獲取商品分類失敗' });
    }
  }
);

// GET /api/products/stats - 獲取商品統計
router.get('/stats',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const stats = await Product.getCountStats();
      res.json({
        stats: stats[0] || {
          totalProducts: 0,
          countedProducts: 0,
          errorProducts: 0,
          totalExpected: 0,
          totalCounted: 0,
          totalSales: 0
        }
      });
    } catch (error) {
      console.error('獲取商品統計錯誤:', error);
      res.status(500).json({
        message: '獲取商品統計失敗'
      });
    }
  }
);

// GET /api/products/errors - 獲取有異常的商品
router.get('/errors',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const errorProducts = await Product.getCountErrorProducts();
      res.json({
        products: errorProducts
      });
    } catch (error) {
      console.error('獲取異常商品錯誤:', error);
      res.status(500).json({
        message: '獲取異常商品失敗'
      });
    }
  }
);

// GET /api/products/:id - 獲取單一商品詳情
router.get('/:id',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const { id } = req.params;

      const product = await Product.findById(id)
        .populate('lastCountedBy', 'name email')
        .lean();

      if (!product || !product.isActive) {
        return res.status(404).json({
          message: '找不到指定商品'
        });
      }

      // 如果是主商品（variable類型），需要彙總變體商品的統計信息
      if (product.type === 'variable') {
        const variations = await Product.find({
          parentId: id,
          isActive: true
        }).lean();

        if (variations.length > 0) {
          // 彙總所有變體的統計信息
          product.stockQty = variations.reduce((sum, v) => sum + (v.stockQty || 0), 0);
          product.countedQty = variations.reduce((sum, v) => sum + (v.countedQty || 0), 0);
          product.expectedQty = variations.reduce((sum, v) => sum + (v.expectedQty || 0), 0);
          product.salesQty = variations.reduce((sum, v) => sum + (v.salesQty || 0), 0);

          // 找到最近的盤點時間和盤點人員
          const recentCountedVariation = variations
            .filter(v => v.lastCountedAt)
            .sort((a, b) => new Date(b.lastCountedAt) - new Date(a.lastCountedAt))[0];

          if (recentCountedVariation) {
            product.lastCountedAt = recentCountedVariation.lastCountedAt;
            const variationWithUser = await Product.findById(recentCountedVariation._id).populate('lastCountedBy', 'name email').lean();
            product.lastCountedBy = variationWithUser.lastCountedBy;
          }
        }
      }

      // 手動計算虛擬字段（新公式：差異 = 盤點數量 - 系統庫存）
      const hasCounted = !!product.lastCountedAt;
      product.countStatus = !hasCounted ? 'uncounted' : (product.countedQty === product.stockQty ? 'normal' : 'error');
      product.isCountError = hasCounted && product.countedQty !== product.stockQty;
      product.diffQty = hasCounted ? (product.countedQty - product.stockQty) : 0;

      res.json({
        product
      });

    } catch (error) {
      console.error('獲取商品詳情錯誤:', error);

      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的商品ID格式'
        });
      }

      res.status(500).json({
        message: '獲取商品詳情失敗'
      });
    }
  }
);

// GET /api/products/:id/history - 獲取商品庫存變化歷史
router.get('/:id/history',
  authenticateToken,
  requireEmployee,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('限制數量必須在1-100之間')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = 50 } = req.query;

      const product = await Product.findById(id);
      if (!product || !product.isActive) {
        return res.status(404).json({
          message: '找不到指定商品'
        });
      }

      const history = await StockHistory.getProductHistory(id, parseInt(limit));

      res.json({
        product: {
          id: product._id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode
        },
        history
      });

    } catch (error) {
      console.error('獲取商品歷史錯誤:', error);

      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的商品ID格式'
        });
      }

      res.status(500).json({
        message: '獲取商品歷史失敗'
      });
    }
  }
);

// GET /api/products/stats/sales-ranking - 獲取銷售排行
router.get('/stats/sales-ranking',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const {
        startDate,
        endDate,
        sortBy = 'desc',
        limit = 50,
        statuses = 'completed'
      } = req.query;

      console.log('📊 開始統計銷售排行...');
      console.log('篩選條件:', { startDate, endDate, sortBy, limit, statuses });

      // 設定預設日期範圍（如果未提供）
      let queryStartDate = startDate;
      let queryEndDate = endDate;

      if (!queryStartDate) {
        const date = new Date();
        date.setDate(date.getDate() - 30); // 預設 30 天前
        queryStartDate = date.toISOString().split('T')[0];
      }

      if (!queryEndDate) {
        queryEndDate = new Date().toISOString().split('T')[0];
      }

      console.log(`📅 查詢日期範圍: ${queryStartDate} 到 ${queryEndDate}`);

      // 1. 從資料庫獲取所有啟用的商品
      const allProducts = await Product.find({
        isActive: true,
        type: { $in: ['simple', 'variation'] } // 只統計單純商品和變化商品
      }).populate('parentId', 'name wooId wooData');

      console.log(`✅ 找到 ${allProducts.length} 個商品`);

      // 2. 從 WooCommerce 獲取訂單
      const axios = require('axios');
      const WOO_CONFIG = {
        url: process.env.WOO_URL,
        consumerKey: process.env.WOO_CONSUMER_KEY,
        consumerSecret: process.env.WOO_CONSUMER_SECRET,
        version: 'wc/v3'
      };

      if (!WOO_CONFIG.url || !WOO_CONFIG.consumerKey || !WOO_CONFIG.consumerSecret) {
        throw new Error('WooCommerce API 設定不完整');
      }

      const baseUrl = WOO_CONFIG.url.endsWith('/')
        ? WOO_CONFIG.url.slice(0, -1)
        : WOO_CONFIG.url;

      const wooClient = axios.create({
        baseURL: `${baseUrl}/wp-json/${WOO_CONFIG.version}`,
        auth: {
          username: WOO_CONFIG.consumerKey,
          password: WOO_CONFIG.consumerSecret
        },
        timeout: 120000 // 增加到 120 秒
      });

      // 使用用戶選擇的狀態
      const validStatuses = statuses.split(',').map(s => s.trim());

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
              per_page: 100,
              after: new Date(queryStartDate).toISOString(),
            };

            // 結束日期加一天，以包含當天的所有訂單
            const endDateTime = new Date(queryEndDate);
            endDateTime.setDate(endDateTime.getDate() + 1);
            params.before = endDateTime.toISOString();

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

      console.log(`✅ 共獲取 ${allOrders.length} 筆訂單`);

      // 3. 統計各商品銷售數量
      const salesStats = {};

      // 初始化統計物件
      allProducts.forEach(product => {
        const image = product.wooData?.images?.[0]?.src ||
          (product.parentId?.wooData?.images?.[0]?.src) ||
          '';

        salesStats[product.wooId] = {
          productId: product._id,
          wooId: product.wooId,
          name: product.name,
          parentName: product.parentId?.name || '',
          sku: product.sku,
          image: image,
          price: product.wooData?.price || 0,
          regularPrice: product.wooData?.regularPrice || 0,
          salePrice: product.wooData?.salePrice || null,
          attributes: product.attributes || [],
          soldQuantity: 0,
          currentStock: product.stockQty || 0,
          totalRevenue: 0,
          orderCount: 0,
          type: product.type,
          orders: [] // 新增：儲存訂單清單
        };
      });

      // 遍歷所有訂單，累計銷售數量
      allOrders.forEach(order => {
        order.line_items.forEach(item => {
          const productId = item.variation_id || item.product_id;

          if (salesStats[productId]) {
            const quantity = item.quantity;
            const price = parseFloat(item.price) || 0;

            salesStats[productId].soldQuantity += quantity;
            salesStats[productId].totalRevenue += quantity * price;
            salesStats[productId].orderCount += 1;
            
            // 新增：記錄訂單資訊
            salesStats[productId].orders.push({
              orderId: order.id,
              orderNumber: order.number,
              status: order.status,
              quantity: quantity,
              price: price,
              subtotal: quantity * price,
              dateCreated: order.date_created,
              customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || '訪客',
              customerEmail: order.billing?.email || '',
              customerPhone: order.billing?.phone || ''
            });
          }
        });
      });

      // 轉換為陣列並排序
      const limitNum = parseInt(limit) || 50;
      let statsArray = Object.values(salesStats)
        .filter(stat => stat.soldQuantity > 0) // 只顯示有銷售的商品
        .sort((a, b) => {
          if (sortBy === 'asc') {
            return a.soldQuantity - b.soldQuantity; // 低到高
          } else {
            return b.soldQuantity - a.soldQuantity; // 高到低
          }
        })
        .slice(0, limitNum); // 限制數量

      console.log(`✅ 統計完成，有 ${statsArray.length} 個商品有銷售記錄`);

      // 計算總計
      const summary = {
        totalProducts: statsArray.length,
        totalSoldQuantity: statsArray.reduce((sum, s) => sum + s.soldQuantity, 0),
        totalRevenue: statsArray.reduce((sum, s) => sum + s.totalRevenue, 0),
        totalOrders: allOrders.length
      };

      res.json({
        success: true,
        data: statsArray,
        summary,
        filters: {
          startDate: queryStartDate,
          endDate: queryEndDate,
          sortBy,
          statuses: validStatuses
        }
      });

    } catch (error) {
      console.error('❌ 統計銷售排行失敗:', error.message);
      console.error(error.stack);
      res.status(500).json({
        success: false,
        message: '統計銷售排行失敗',
        error: error.message
      });
    }
  }
);

// PUT /api/products/:id - 更新商品資料（僅老闆可用）
router.put('/:id',
  authenticateToken,
  requireBoss,
  [
    body('name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('商品名稱長度需要在1-200字元之間'),
    body('sku').optional().trim().isLength({ min: 1 }).withMessage('SKU不能為空'),
    body('barcode').optional().trim(),
    body('expectedQty').optional().isInt({ min: 0 }).withMessage('到貨數量必須是非負整數'),
    body('salesQty').optional().isInt({ min: 0 }).withMessage('銷售數量必須是非負整數')
  ],
  handleValidationErrors,
  logUserActivity('更新商品資料'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const product = await Product.findById(id);
      if (!product || !product.isActive) {
        return res.status(404).json({
          message: '找不到指定商品'
        });
      }

      // 檢查 SKU 唯一性（如果有更新 SKU）
      if (updates.sku && updates.sku !== product.sku) {
        const existingProduct = await Product.findOne({
          sku: updates.sku.toUpperCase(),
          _id: { $ne: id },
          isActive: true
        });

        if (existingProduct) {
          return res.status(409).json({
            message: 'SKU已被其他商品使用'
          });
        }
      }

      // 檢查條碼唯一性（如果有更新條碼）
      if (updates.barcode && updates.barcode !== product.barcode) {
        const existingProduct = await Product.findOne({
          barcode: updates.barcode,
          _id: { $ne: id },
          isActive: true
        });

        if (existingProduct) {
          return res.status(409).json({
            message: '條碼已被其他商品使用'
          });
        }
      }

      // 更新商品資料
      Object.assign(product, updates);

      if (updates.sku) {
        product.sku = updates.sku.toUpperCase();
      }

      await product.save();

      console.log(`📦 商品資料更新: ${product.name} (${product.sku}) - 由 ${req.user.email} 更新`);

      res.json({
        message: '商品資料更新成功',
        product
      });

    } catch (error) {
      console.error('更新商品資料錯誤:', error);

      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的商品ID格式'
        });
      }

      res.status(500).json({
        message: '更新商品資料失敗'
      });
    }
  }
);

// POST /api/products - 手動新增商品（僅老闆可用）
router.post('/',
  authenticateToken,
  requireBoss,
  [
    body('name').trim().isLength({ min: 1, max: 200 }).withMessage('商品名稱長度需要在1-200字元之間'),
    body('sku').trim().isLength({ min: 1 }).withMessage('SKU不能為空'),
    body('barcode').optional().trim(),
    body('expectedQty').optional().isInt({ min: 0 }).withMessage('到貨數量必須是非負整數'),
    body('salesQty').optional().isInt({ min: 0 }).withMessage('銷售數量必須是非負整數')
  ],
  handleValidationErrors,
  logUserActivity('新增商品'),
  async (req, res) => {
    try {
      const { name, sku, barcode, expectedQty = 0, salesQty = 0 } = req.body;

      // 檢查 SKU 唯一性
      const existingBySku = await Product.findBySku(sku);
      if (existingBySku) {
        return res.status(409).json({
          message: 'SKU已存在'
        });
      }

      // 檢查條碼唯一性（如果有提供）
      if (barcode) {
        const existingByBarcode = await Product.findByBarcode(barcode);
        if (existingByBarcode) {
          return res.status(409).json({
            message: '條碼已存在'
          });
        }
      }

      const product = new Product({
        name: name.trim(),
        sku: sku.toUpperCase(),
        barcode: barcode || undefined,
        expectedQty,
        salesQty,
        stockQty: 0,
        countedQty: 0
      });

      await product.save();

      console.log(`➕ 新增商品: ${product.name} (${product.sku}) - 由 ${req.user.email} 建立`);

      res.status(201).json({
        message: '商品新增成功',
        product
      });

    } catch (error) {
      console.error('新增商品錯誤:', error);
      res.status(500).json({
        message: '新增商品失敗'
      });
    }
  }
);

// DELETE /api/products/:id - 軟刪除商品（僅老闆可用）
router.delete('/:id',
  authenticateToken,
  requireBoss,
  logUserActivity('刪除商品'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({
          message: '找不到指定商品'
        });
      }

      product.isActive = false;
      await product.save();

      console.log(`🗑️  商品軟刪除: ${product.name} (${product.sku}) - 由 ${req.user.email} 執行`);

      res.json({
        message: '商品刪除成功'
      });

    } catch (error) {
      console.error('刪除商品錯誤:', error);

      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的商品ID格式'
        });
      }

      res.status(500).json({
        message: '刪除商品失敗'
      });
    }
  }
);

// PUT /api/products/:id/on-order - 更新商品已訂購數量
router.put('/:id/on-order',
  authenticateToken,
  requireEmployee,
  [
    body('onOrderQty').isInt({ min: 0 }).withMessage('已訂購數量必須為非負整數')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { onOrderQty } = req.body;

      // 驗證 ID 格式
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: '無效的商品 ID'
        });
      }

      // 查找商品
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: '找不到該商品'
        });
      }

      // 更新已訂購數量
      product.onOrderQty = onOrderQty;
      product.lastOrderDate = onOrderQty > 0 ? new Date() : null;
      await product.save();

      console.log(`✅ 已更新商品 ${product.name} 的已訂購數量為 ${onOrderQty}`);

      res.json({
        success: true,
        message: '已訂購數量更新成功',
        product: {
          _id: product._id,
          name: product.name,
          onOrderQty: product.onOrderQty,
          lastOrderDate: product.lastOrderDate
        }
      });

    } catch (error) {
      console.error('❌ 更新已訂購數量失敗:', error);
      res.status(500).json({
        success: false,
        message: '更新已訂購數量失敗',
        error: error.message
      });
    }
  }
);

module.exports = router; 