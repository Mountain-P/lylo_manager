const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const InventoryTask = require('../models/InventoryTask');
const Product = require('../models/Product');
const {
  authenticateToken,
  requireEmployee,
  logUserActivity
} = require('../middleware/auth');

const router = express.Router();

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

// POST /api/inventory-tasks - 建立盤點任務（含庫存快照）
router.post('/',
  authenticateToken,
  requireEmployee,
  [
    body('date').isISO8601().withMessage('盤點日期格式不正確'),
    body('personnel').isArray({ min: 1 }).withMessage('至少選擇一位盤點人員'),
    body('personnel.*').isMongoId().withMessage('無效的人員ID'),
    body('note').optional().isString().trim(),
    body('scope').optional().isIn(['all', 'categories']).withMessage('scope 必須是 all 或 categories'),
    body('categories').optional().isArray()
  ],
  handleValidationErrors,
  logUserActivity('建立盤點任務'),
  async (req, res) => {
    try {
      const { date, personnel, note, scope = 'all', categories = [] } = req.body;

      const productFilter = {
        isActive: true,
        type: { $in: ['simple', 'variation'] }
      };

      if (scope === 'categories' && categories.length > 0) {
        productFilter['wooData.categories.name'] = { $in: categories };
      }

      const products = await Product.find(productFilter)
        .select('_id stockQty')
        .lean();

      const stockSnapshot = products.map(p => ({
        productId: p._id,
        snapshotStockQty: p.stockQty || 0,
        countedQty: null,
        countedAt: null,
        countedBy: null,
        diffQty: null,
        status: 'uncounted'
      }));

      const task = new InventoryTask({
        date: new Date(date),
        personnel,
        createdBy: req.user._id,
        note,
        snapshotScope: scope,
        snapshotCategories: scope === 'categories' ? categories : [],
        stockSnapshot,
        summary: {
          totalProducts: stockSnapshot.length,
          countedProducts: 0,
          errorProducts: 0,
          completionRate: 0
        },
        snapshotCreatedAt: new Date()
      });

      await task.save();
      await task.populate([
        { path: 'personnel', select: 'name email' },
        { path: 'createdBy', select: 'name email' }
      ]);

      console.log(`📋 盤點任務建立: ${task._id}, 快照 ${stockSnapshot.length} 個商品 by ${req.user.name}`);

      res.status(201).json({
        success: true,
        message: `盤點任務建立成功，已快照 ${stockSnapshot.length} 個商品的庫存`,
        task: {
          _id: task._id,
          date: task.date,
          personnel: task.personnel,
          createdBy: task.createdBy,
          status: task.status,
          note: task.note,
          snapshotScope: task.snapshotScope,
          snapshotCategories: task.snapshotCategories,
          summary: task.summary,
          snapshotCreatedAt: task.snapshotCreatedAt,
          createdAt: task.createdAt
        }
      });
    } catch (error) {
      console.error('建立盤點任務失敗:', error);
      res.status(500).json({ success: false, message: '建立盤點任務失敗' });
    }
  }
);

// GET /api/inventory-tasks - 取得盤點任務列表（不含完整 snapshot）
router.get('/',
  authenticateToken,
  requireEmployee,
  [
    query('status').optional().isIn(['in_progress', 'completed', 'cancelled']),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status, limit = 20 } = req.query;
      const filter = {};
      if (status) filter.status = status;

      const tasks = await InventoryTask.find(filter)
        .select('-stockSnapshot')
        .populate('personnel', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      res.json({ success: true, tasks });
    } catch (error) {
      console.error('取得盤點任務失敗:', error);
      res.status(500).json({ success: false, message: '取得盤點任務失敗' });
    }
  }
);

// GET /api/inventory-tasks/active - 取得目前進行中的任務列表
router.get('/active',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const tasks = await InventoryTask.find({ status: 'in_progress' })
        .select('-stockSnapshot')
        .populate('personnel', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      res.json({ success: true, tasks, task: tasks[0] || null });
    } catch (error) {
      console.error('取得進行中任務失敗:', error);
      res.status(500).json({ success: false, message: '取得進行中任務失敗' });
    }
  }
);

// GET /api/inventory-tasks/:id - 取得任務詳情（含 summary，不含完整 snapshot）
router.get('/:id',
  authenticateToken,
  requireEmployee,
  [param('id').isMongoId().withMessage('無效的任務ID')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const task = await InventoryTask.findById(req.params.id)
        .select('-stockSnapshot')
        .populate('personnel', 'name email')
        .populate('createdBy', 'name email');

      if (!task) {
        return res.status(404).json({ success: false, message: '找不到盤點任務' });
      }

      res.json({ success: true, task });
    } catch (error) {
      console.error('取得任務詳情失敗:', error);
      res.status(500).json({ success: false, message: '取得任務詳情失敗' });
    }
  }
);

// GET /api/inventory-tasks/:id/snapshot - 取得任務的庫存快照（含商品資訊）
router.get('/:id/snapshot',
  authenticateToken,
  requireEmployee,
  [
    param('id').isMongoId().withMessage('無效的任務ID'),
    query('status').optional().isIn(['uncounted', 'normal', 'error']),
    query('search').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status, search, page = 1, limit = 50 } = req.query;

      const task = await InventoryTask.findById(req.params.id).lean();
      if (!task) {
        return res.status(404).json({ success: false, message: '找不到盤點任務' });
      }

      let snapshot = task.stockSnapshot;

      if (status) {
        snapshot = snapshot.filter(s => s.status === status);
      }

      const productIds = snapshot.map(s => s.productId);
      const products = await Product.find({ _id: { $in: productIds } })
        .select('name sku barcode type parentId attributes wooData stockQty')
        .populate('parentId', 'name')
        .lean();

      const productMap = new Map(products.map(p => [p._id.toString(), p]));

      let enriched = snapshot.map(s => ({
        ...s,
        product: productMap.get(s.productId.toString()) || null,
        currentStockQty: productMap.get(s.productId.toString())?.stockQty ?? null
      }));

      if (search) {
        const lower = search.toLowerCase();
        enriched = enriched.filter(item => {
          const p = item.product;
          if (!p) return false;
          return (
            p.name?.toLowerCase().includes(lower) ||
            p.sku?.toLowerCase().includes(lower) ||
            p.barcode?.toLowerCase().includes(lower)
          );
        });
      }

      const total = enriched.length;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const paginated = enriched.slice(skip, skip + parseInt(limit));

      res.json({
        success: true,
        snapshot: paginated,
        summary: task.summary,
        snapshotCreatedAt: task.snapshotCreatedAt,
        lastRefreshedAt: task.lastRefreshedAt,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('取得庫存快照失敗:', error);
      res.status(500).json({ success: false, message: '取得庫存快照失敗' });
    }
  }
);

// PUT /api/inventory-tasks/:id/refresh - 重新整理未盤點商品的庫存快照
router.put('/:id/refresh',
  authenticateToken,
  requireEmployee,
  [param('id').isMongoId().withMessage('無效的任務ID')],
  handleValidationErrors,
  logUserActivity('重新整理盤點快照'),
  async (req, res) => {
    try {
      const task = await InventoryTask.findById(req.params.id);
      if (!task) {
        return res.status(404).json({ success: false, message: '找不到盤點任務' });
      }
      if (task.status !== 'in_progress') {
        return res.status(400).json({ success: false, message: '只能重新整理進行中的任務' });
      }

      const refreshedCount = await task.refreshUncounted();
      await task.save();

      console.log(`🔄 快照重新整理: 任務 ${task._id}, 更新 ${refreshedCount} 個商品 by ${req.user.name}`);

      res.json({
        success: true,
        message: `已重新整理 ${refreshedCount} 個未盤點商品的庫存數量`,
        refreshedCount,
        lastRefreshedAt: task.lastRefreshedAt,
        summary: task.summary
      });
    } catch (error) {
      console.error('重新整理快照失敗:', error);
      res.status(500).json({ success: false, message: '重新整理快照失敗' });
    }
  }
);

// PUT /api/inventory-tasks/:id/complete - 完成盤點任務
router.put('/:id/complete',
  authenticateToken,
  requireEmployee,
  [param('id').isMongoId().withMessage('無效的任務ID')],
  handleValidationErrors,
  logUserActivity('完成盤點任務'),
  async (req, res) => {
    try {
      const task = await InventoryTask.findById(req.params.id)
        .select('-stockSnapshot');
      if (!task) {
        return res.status(404).json({ success: false, message: '找不到盤點任務' });
      }

      task.status = 'completed';
      task.completedAt = new Date();
      await task.save();
      await task.populate([
        { path: 'personnel', select: 'name email' },
        { path: 'createdBy', select: 'name email' }
      ]);

      res.json({ success: true, message: '盤點任務已完成', task });
    } catch (error) {
      console.error('完成盤點任務失敗:', error);
      res.status(500).json({ success: false, message: '完成盤點任務失敗' });
    }
  }
);

// DELETE /api/inventory-tasks/:id - 刪除盤點任務
router.delete('/:id',
  authenticateToken,
  requireEmployee,
  [param('id').isMongoId().withMessage('無效的任務ID')],
  handleValidationErrors,
  logUserActivity('刪除盤點任務'),
  async (req, res) => {
    try {
      const task = await InventoryTask.findByIdAndDelete(req.params.id);
      if (!task) {
        return res.status(404).json({ success: false, message: '找不到盤點任務' });
      }
      res.json({ success: true, message: '盤點任務已刪除' });
    } catch (error) {
      console.error('刪除盤點任務失敗:', error);
      res.status(500).json({ success: false, message: '刪除盤點任務失敗' });
    }
  }
);

module.exports = router;
