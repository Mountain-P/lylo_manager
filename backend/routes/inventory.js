const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');
const InventoryTask = require('../models/InventoryTask');
const StockHistory = require('../models/StockHistory');
const { 
  authenticateToken, 
  requireBoss, 
  requireEmployee,
  logUserActivity,
  getClientIP
} = require('../middleware/auth');
const mongoose = require('mongoose');

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

// POST /api/inventory/count/batch - 批次執行盤點
router.post('/count/batch',
  authenticateToken,
  requireEmployee,
  [
    body('counts').isArray({ min: 1 }).withMessage('counts 必須是陣列且不能為空'),
    body('counts.*.productId').isMongoId().withMessage('無效的商品ID'),
    body('counts.*.countedQty').isInt({ min: 0 }).withMessage('盤點數量必須是非負整數'),
    body('taskId').isMongoId().withMessage('盤點任務ID為必填'),
  ],
  handleValidationErrors,
  logUserActivity('批次商品盤點'),
  async (req, res) => {
    try {
      const { counts, taskId } = req.body;
      const user = req.user;
      const deviceInfo = { userAgent: req.get('User-Agent'), ip: getClientIP(req) };

      const task = await InventoryTask.findById(taskId);
      if (!task) {
        return res.status(404).json({ message: '找不到指定的盤點任務' });
      }
      if (task.status !== 'in_progress') {
        return res.status(400).json({ message: '此盤點任務已結束，無法繼續盤點' });
      }

      const results = [];

      for (const count of counts) {
        const product = await Product.findById(count.productId);
        if (!product || !product.isActive) {
          results.push({ productId: count.productId, status: 'error', message: 'Product not found or inactive' });
          continue;
        }

        const snapshotItem = task.stockSnapshot.find(
          s => s.productId.toString() === count.productId.toString()
        );
        const snapshotStockQty = snapshotItem ? snapshotItem.snapshotStockQty : product.stockQty;
        
        const previousQty = product.countedQty;
        const newCountedQty = parseInt(count.countedQty);

        const inventoryLog = new InventoryLog({
          productId: product._id,
          userId: user._id,
          taskId,
          countedQty: newCountedQty,
          previousQty,
          expectedQty: snapshotStockQty,
          snapshotStockQty,
          salesQty: product.salesQty,
          method: 'manual-batch',
          deviceInfo
        });
        await inventoryLog.save();

        product.countedQty = newCountedQty;
        product.lastCountedAt = new Date();
        product.lastCountedBy = user._id;
        await product.save();

        if (snapshotItem) {
          task.recordCount(count.productId, newCountedQty, user._id);
        }

        results.push({ productId: product._id, status: 'updated' });
      }

      await task.save();
      
      console.log(`📊 批次盤點完成 by ${user.name}: 共處理 ${counts.length} 個項目, 任務 ${taskId}`);

      res.json({
        message: '批次盤點成功',
        results,
        summary: task.summary
      });

    } catch (error) {
      console.error('批次盤點錯誤:', error);
      res.status(500).json({ message: '批次盤點過程發生錯誤', error: error.message });
    }
  }
);

// POST /api/inventory/count/:productId - 執行盤點
router.post('/count/:productId',
  authenticateToken,
  requireEmployee,
  [
    body('countedQty')
      .isInt({ min: 0 })
      .withMessage('盤點數量必須是非負整數'),
    body('method')
      .optional()
      .isIn(['manual', 'barcode'])
      .withMessage('盤點方式只能是 manual 或 barcode'),
    body('note')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('備註不能超過500個字元'),
    body('taskId')
      .isMongoId()
      .withMessage('盤點任務ID為必填')
  ],
  handleValidationErrors,
  logUserActivity('商品盤點'),
  async (req, res) => {
    try {
      const { productId } = req.params;
      const { countedQty, method = 'manual', note, taskId } = req.body;

      const task = await InventoryTask.findById(taskId);
      if (!task) {
        return res.status(404).json({ message: '找不到指定的盤點任務' });
      }
      if (task.status !== 'in_progress') {
        return res.status(400).json({ message: '此盤點任務已結束，無法繼續盤點' });
      }

      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        return res.status(404).json({ message: '找不到指定商品' });
      }

      const snapshotItem = task.stockSnapshot.find(
        s => s.productId.toString() === productId.toString()
      );
      const snapshotStockQty = snapshotItem ? snapshotItem.snapshotStockQty : product.stockQty;

      const previousQty = product.countedQty;
      const parsedQty = parseInt(countedQty);

      const inventoryLog = new InventoryLog({
        productId: product._id,
        userId: req.user._id,
        taskId,
        countedQty: parsedQty,
        previousQty,
        expectedQty: snapshotStockQty,
        snapshotStockQty,
        salesQty: product.salesQty,
        note: note || undefined,
        method,
        deviceInfo: {
          userAgent: req.get('User-Agent'),
          ip: getClientIP(req)
        }
      });

      await inventoryLog.save();

      await product.updateCount(parsedQty, req.user._id);

      if (snapshotItem) {
        task.recordCount(productId, parsedQty, req.user._id);
        await task.save();
      }

      const updatedProduct = await Product.findById(productId)
        .populate('lastCountedBy', 'name email');

      console.log(`📊 盤點完成: ${product.name} (${product.sku}) - 數量: ${countedQty} - 員工: ${req.user.name} - 任務: ${taskId}`);

      res.json({
        message: '盤點完成',
        product: updatedProduct,
        inventoryLog: await inventoryLog.populate('userId', 'name email'),
        taskSummary: task.summary
      });

    } catch (error) {
      console.error('盤點錯誤:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({ message: '無效的商品ID格式' });
      }

      res.status(500).json({ message: '盤點過程發生錯誤' });
    }
  }
);

// GET /api/inventory/logs - 獲取盤點記錄
router.get('/logs',
  authenticateToken,
  requireEmployee,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('頁碼必須是正整數'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每頁數量必須在1-100之間'),
    query('userId').optional().isMongoId().withMessage('無效的用戶ID'),
    query('productId').optional().isMongoId().withMessage('無效的商品ID'),
    query('startDate').optional().isISO8601().withMessage('開始日期格式錯誤'),
    query('endDate').optional().isISO8601().withMessage('結束日期格式錯誤'),
    query('errorOnly').optional().isBoolean().withMessage('errorOnly必須是布林值')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        userId, 
        productId, 
        startDate, 
        endDate,
        errorOnly = false 
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      let query = {};

      // 如果是員工，只能看自己的記錄
      if (req.user.role === 'employee' && !userId) {
        query.userId = req.user._id;
      } else if (userId) {
        query.userId = userId;
      }

      if (productId) {
        query.productId = productId;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      if (errorOnly === 'true') {
        query.diffQty = { $ne: 0 };
      }

      const [logs, totalCount] = await Promise.all([
        InventoryLog.find(query)
          .populate({
            path: 'productId',
            select: 'name sku barcode type parentId attributes wooData',
            populate: {
              path: 'parentId',
              select: 'name sku type',
              model: 'Product'
            }
          })
          .populate('userId', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        InventoryLog.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      });

    } catch (error) {
      console.error('獲取盤點記錄錯誤:', error);
      res.status(500).json({
        message: '獲取盤點記錄失敗'
      });
    }
  }
);

// GET /api/inventory/logs/stats - 獲取盤點統計
router.get('/logs/stats',
  authenticateToken,
  requireEmployee,
  [
    query('startDate').optional().isISO8601().withMessage('開始日期格式錯誤'),
    query('endDate').optional().isISO8601().withMessage('結束日期格式錯誤'),
    query('userId').optional().isMongoId().withMessage('無效的用戶ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { startDate, endDate, userId } = req.query;

      // 如果是員工，只能看自己的統計
      const targetUserId = req.user.role === 'employee' ? req.user._id : userId;

      const stats = await InventoryLog.getStats(startDate, endDate);
      
      let userStats = null;
      if (targetUserId) {
        const userLogs = await InventoryLog.find({
          userId: targetUserId,
          ...(startDate || endDate ? {
            createdAt: {
              ...(startDate && { $gte: new Date(startDate) }),
              ...(endDate && { $lte: new Date(endDate) })
            }
          } : {})
        });

        userStats = {
          totalLogs: userLogs.length,
          errorLogs: userLogs.filter(log => log.diffQty !== 0).length,
          totalCountedQty: userLogs.reduce((sum, log) => sum + log.countedQty, 0)
        };
      }

      res.json({
        overallStats: stats[0] || {
          totalLogs: 0,
          errorLogs: 0,
          uniqueProductsCount: 0,
          uniqueUsersCount: 0,
          totalCountedQty: 0,
          totalDiffQty: 0,
          errorRate: 0
        },
        userStats
      });

    } catch (error) {
      console.error('獲取盤點統計錯誤:', error);
      res.status(500).json({
        message: '獲取盤點統計失敗'
      });
    }
  }
);

// GET /api/inventory/logs/daily - 獲取每日盤點統計
router.get('/logs/daily',
  authenticateToken,
  requireBoss,
  [
    query('days').optional().isInt({ min: 1, max: 90 }).withMessage('天數必須在1-90之間')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { days = 7 } = req.query;
      const dailyStats = await InventoryLog.getDailyStats(parseInt(days));
      
      res.json({
        dailyStats
      });

    } catch (error) {
      console.error('獲取每日盤點統計錯誤:', error);
      res.status(500).json({
        message: '獲取每日盤點統計失敗'
      });
    }
  }
);

// GET /api/inventory/logs/errors - 獲取異常盤點記錄
router.get('/logs/errors',
  authenticateToken,
  requireBoss,
  [
    query('startDate').optional().isISO8601().withMessage('開始日期格式錯誤'),
    query('endDate').optional().isISO8601().withMessage('結束日期格式錯誤')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const errorLogs = await InventoryLog.getErrorLogs(startDate, endDate);
      
      res.json({
        errorLogs
      });

    } catch (error) {
      console.error('獲取異常盤點記錄錯誤:', error);
      res.status(500).json({
        message: '獲取異常盤點記錄失敗'
      });
    }
  }
);

// GET /api/inventory/sync/status - 獲取同步狀態
router.get('/sync/status',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const latestSync = await StockHistory.getLatestSyncStatus();
      
      res.json({
        syncStatus: latestSync[0] || {
          lastSyncAt: null,
          syncSource: null,
          error: null,
          syncDuration: null
        }
      });

    } catch (error) {
      console.error('獲取同步狀態錯誤:', error);
      res.status(500).json({
        message: '獲取同步狀態失敗'
      });
    }
  }
);

// GET /api/inventory/sync/history - 獲取同步歷史
router.get('/sync/history',
  authenticateToken,
  requireBoss,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('頁碼必須是正整數'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每頁數量必須在1-100之間'),
    query('startDate').optional().isISO8601().withMessage('開始日期格式錯誤'),
    query('endDate').optional().isISO8601().withMessage('結束日期格式錯誤'),
    query('changedOnly').optional().isBoolean().withMessage('changedOnly必須是布林值')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        startDate, 
        endDate,
        changedOnly = false 
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      let query = {};

      if (startDate || endDate) {
        query.syncedAt = {};
        if (startDate) query.syncedAt.$gte = new Date(startDate);
        if (endDate) query.syncedAt.$lte = new Date(endDate);
      }

      if (changedOnly === 'true') {
        query.changeType = { $in: ['increase', 'decrease'] };
      }

      const [history, totalCount] = await Promise.all([
        StockHistory.find(query)
          .populate('productId', 'name sku barcode')
          .sort({ syncedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        StockHistory.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      });

    } catch (error) {
      console.error('獲取同步歷史錯誤:', error);
      res.status(500).json({
        message: '獲取同步歷史失敗'
      });
    }
  }
);

// GET /api/inventory/sync/stats - 獲取同步統計
router.get('/sync/stats',
  authenticateToken,
  requireBoss,
  [
    query('startDate').optional().isISO8601().withMessage('開始日期格式錯誤'),
    query('endDate').optional().isISO8601().withMessage('結束日期格式錯誤')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const syncStats = await StockHistory.getSyncStats(startDate, endDate);
      
      res.json({
        syncStats: syncStats[0] || {
          totalSyncs: 0,
          increasedCount: 0,
          decreasedCount: 0,
          noChangeCount: 0,
          totalIncrease: 0,
          totalDecrease: 0,
          uniqueProductsCount: 0,
          avgSyncDuration: 0,
          errorCount: 0,
          changeRate: 0,
          errorRate: 0
        }
      });

    } catch (error) {
      console.error('獲取同步統計錯誤:', error);
      res.status(500).json({
        message: '獲取同步統計失敗'
      });
    }
  }
);

// POST /api/inventory/sync/manual - 手動觸發同步（僅老闆可用）
router.post('/sync/manual',
  authenticateToken,
  requireBoss,
  logUserActivity('手動觸發WooCommerce同步'),
  async (req, res) => {
    try {
      // 動態導入同步模組
      const { triggerManualSync } = require('../cron/wooSync');
      
      // 觸發手動同步
      const result = await triggerManualSync();
      
      if (result.success) {
        res.json({
          message: '手動同步完成',
          stats: result.stats
        });
      } else {
        // 如果是配置問題，返回400錯誤
        const statusCode = result.error === 'WooCommerce API 設定不完整' ? 400 : 500;
        res.status(statusCode).json({
          message: result.message || '手動同步失敗',
          error: result.error
        });
      }

    } catch (error) {
      console.error('手動同步錯誤:', error);
      res.status(500).json({
        message: '手動同步過程發生錯誤',
        error: error
      });
    }
  }
);

// DELETE /api/inventory/logs/cleanup - 清理舊的盤點記錄（僅老闆可用）
router.delete('/logs/cleanup',
  authenticateToken,
  requireBoss,
  [
    body('keepDays').isInt({ min: 30, max: 365 }).withMessage('保留天數必須在30-365之間')
  ],
  handleValidationErrors,
  logUserActivity('清理舊盤點記錄'),
  async (req, res) => {
    try {
      const { keepDays } = req.body;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);

      const result = await InventoryLog.deleteMany({
        createdAt: { $lt: cutoffDate },
        diffQty: 0 // 只清理無異常的記錄
      });

      console.log(`🧹 清理舊盤點記錄: 刪除了 ${result.deletedCount} 筆記錄 - 由 ${req.user.email} 執行`);

      res.json({
        message: '清理完成',
        deletedCount: result.deletedCount
      });

    } catch (error) {
      console.error('清理記錄錯誤:', error);
      res.status(500).json({
        message: '清理記錄失敗'
      });
    }
  }
);

module.exports = router; 