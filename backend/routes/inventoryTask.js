const express = require('express');
const { body, query, validationResult } = require('express-validator');
const InventoryTask = require('../models/InventoryTask');
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

// POST /api/inventory-tasks - 建立盤點任務
router.post('/',
  authenticateToken,
  requireEmployee,
  [
    body('date').isISO8601().withMessage('盤點日期格式不正確'),
    body('personnel').isArray({ min: 1 }).withMessage('至少選擇一位盤點人員'),
    body('personnel.*').isMongoId().withMessage('無效的人員ID'),
    body('note').optional().isString().trim()
  ],
  handleValidationErrors,
  logUserActivity('建立盤點任務'),
  async (req, res) => {
    try {
      const { date, personnel, note } = req.body;

      const task = new InventoryTask({
        date: new Date(date),
        personnel,
        createdBy: req.user._id,
        note
      });

      await task.save();
      await task.populate([
        { path: 'personnel', select: 'name email' },
        { path: 'createdBy', select: 'name email' }
      ]);

      res.status(201).json({
        success: true,
        message: '盤點任務建立成功',
        task
      });
    } catch (error) {
      console.error('建立盤點任務失敗:', error);
      res.status(500).json({ success: false, message: '建立盤點任務失敗' });
    }
  }
);

// GET /api/inventory-tasks - 取得盤點任務列表
router.get('/',
  authenticateToken,
  requireEmployee,
  [
    query('status').optional().isIn(['in_progress', 'completed']),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status, limit = 20 } = req.query;
      const filter = {};
      if (status) filter.status = status;

      const tasks = await InventoryTask.find(filter)
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

// GET /api/inventory-tasks/active - 取得目前進行中的任務
router.get('/active',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const task = await InventoryTask.findOne({ status: 'in_progress' })
        .populate('personnel', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      res.json({ success: true, task });
    } catch (error) {
      console.error('取得進行中任務失敗:', error);
      res.status(500).json({ success: false, message: '取得進行中任務失敗' });
    }
  }
);

// PUT /api/inventory-tasks/:id/complete - 完成盤點任務
router.put('/:id/complete',
  authenticateToken,
  requireEmployee,
  logUserActivity('完成盤點任務'),
  async (req, res) => {
    try {
      const task = await InventoryTask.findById(req.params.id);
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
