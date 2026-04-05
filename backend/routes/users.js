const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const InventoryLog = require('../models/InventoryLog');
const { 
  authenticateToken, 
  requireBoss,
  requireEmployee,
  canAccessUser,
  logUserActivity 
} = require('../middleware/auth');

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

// GET /api/users - 獲取用戶列表（僅老闆可用）
router.get('/',
  authenticateToken,
  requireBoss,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('頁碼必須是正整數'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每頁數量必須在1-100之間'),
    query('role').optional().isIn(['boss', 'employee']).withMessage('角色只能是 boss 或 employee'),
    query('isActive').optional().isBoolean().withMessage('isActive必須是布林值'),
    query('search').optional().isString().trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        role, 
        isActive, 
        search 
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      let query = {};

      if (role) query.role = role;
      if (isActive !== undefined) query.isActive = isActive === 'true';

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      const [users, totalCount] = await Promise.all([
        User.find(query)
          .populate('createdBy', 'name email')
          .select('-passwordHash')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        User.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
        users,
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
      console.error('獲取用戶列表錯誤:', error);
      res.status(500).json({
        message: '獲取用戶列表失敗'
      });
    }
  }
);

// POST /api/users - 創建新用戶（僅老闆可用）
router.post('/',
  authenticateToken,
  requireBoss,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('姓名為必填項')
      .isLength({ min: 2, max: 50 })
      .withMessage('姓名長度需要在 2-50 個字元之間'),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email 為必填項')
      .isEmail()
      .normalizeEmail()
      .withMessage('請輸入有效的 Email 地址'),
    body('password')
      .trim()
      .notEmpty()
      .withMessage('密碼為必填項')
      .isLength({ min: 6 })
      .withMessage('密碼長度至少需要 6 個字元'),
    body('role')
      .trim()
      .notEmpty()
      .withMessage('角色為必填項')
      .isIn(['boss', 'employee'])
      .withMessage('角色只能是 boss 或 employee')
  ],
  handleValidationErrors,
  logUserActivity('創建新用戶'),
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      // 檢查 Email 是否已存在
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          message: 'Email 已被使用'
        });
      }

      // 創建新用戶
      const newUser = new User({
        name,
        email,
        passwordHash: password,  // 直接設定密碼，save 時會自動加密
        role,
        createdBy: req.user._id,
        isActive: true
      });

      await newUser.save();

      console.log(`✅ 新用戶創建成功: ${email} (${role}) - 由 ${req.user.email} 創建`);

      res.status(201).json({
        message: '用戶創建成功',
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt
        }
      });

    } catch (error) {
      console.error('創建用戶錯誤:', error);
      res.status(500).json({
        message: '創建用戶失敗',
        error: error.message
      });
    }
  }
);

// GET /api/users/active-list - 取得所有啟用中使用者（盤點任務人員選擇用）
router.get('/active-list',
  authenticateToken,
  requireEmployee,
  async (req, res) => {
    try {
      const users = await User.find({ isActive: true })
        .select('name email role')
        .sort({ name: 1 });
      res.json({ success: true, users });
    } catch (error) {
      console.error('獲取使用者列表失敗:', error);
      res.status(500).json({ success: false, message: '獲取使用者列表失敗' });
    }
  }
);

// GET /api/users/employees - 獲取所有員工（僅老闆可用）
router.get('/employees',
  authenticateToken,
  requireBoss,
  async (req, res) => {
    try {
      const employees = await User.getEmployees();
      res.json({
        employees
      });
    } catch (error) {
      console.error('獲取員工列表錯誤:', error);
      res.status(500).json({
        message: '獲取員工列表失敗'
      });
    }
  }

);

// GET /api/users/:userId - 獲取用戶詳情
router.get('/:userId',
  authenticateToken,
  canAccessUser,
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId)
        .populate('createdBy', 'name email')
        .select('-passwordHash');

      if (!user) {
        return res.status(404).json({
          message: '找不到指定用戶'
        });
      }

      // 獲取用戶的盤點統計（如果是查看自己或老闆查看員工）
      let inventoryStats = null;
      if (req.user.role === 'boss' || req.user._id.toString() === userId) {
        const logs = await InventoryLog.getUserLogs(userId, 1000);
        inventoryStats = {
          totalLogs: logs.length,
          errorLogs: logs.filter(log => log.diffQty !== 0).length,
          totalCountedQty: logs.reduce((sum, log) => sum + log.countedQty, 0),
          lastCountedAt: logs.length > 0 ? logs[0].createdAt : null
        };
      }

      res.json({
        user,
        inventoryStats
      });

    } catch (error) {
      console.error('獲取用戶詳情錯誤:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的用戶ID格式'
        });
      }

      res.status(500).json({
        message: '獲取用戶詳情失敗'
      });
    }
  }
);

// PUT /api/users/:userId - 更新用戶資料（僅老闆可用）
router.put('/:userId',
  authenticateToken,
  requireBoss,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('姓名長度需要在 2-50 個字元之間'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('請輸入有效的 Email 地址'),
    body('role')
      .optional()
      .isIn(['boss', 'employee'])
      .withMessage('角色只能是 boss 或 employee'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive必須是布林值')
  ],
  handleValidationErrors,
  logUserActivity('更新用戶資料'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: '找不到指定用戶'
        });
      }

      // 檢查 Email 唯一性（如果有更新 Email）
      if (updates.email && updates.email !== user.email) {
        const existingUser = await User.findByEmail(updates.email);
        if (existingUser && existingUser._id.toString() !== userId) {
          return res.status(409).json({
            message: 'Email 已被其他用戶使用'
          });
        }
      }

      // 防止刪除最後一個老闆
      if (updates.role === 'employee' && user.role === 'boss') {
        const bossCount = await User.countDocuments({ role: 'boss', isActive: true });
        if (bossCount <= 1) {
          return res.status(400).json({
            message: '至少需要保留一個老闆帳號'
          });
        }
      }

      // 防止停用最後一個老闆
      if (updates.isActive === false && user.role === 'boss') {
        const activeBossCount = await User.countDocuments({ 
          role: 'boss', 
          isActive: true,
          _id: { $ne: userId }
        });
        if (activeBossCount === 0) {
          return res.status(400).json({
            message: '至少需要保留一個啟用的老闆帳號'
          });
        }
      }

      // 更新用戶資料
      Object.assign(user, updates);
      await user.save();

      console.log(`👤 用戶資料更新: ${user.email} - 由 ${req.user.email} 更新`);

      res.json({
        message: '用戶資料更新成功',
        user: await User.findById(userId).select('-passwordHash')
      });

    } catch (error) {
      console.error('更新用戶資料錯誤:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的用戶ID格式'
        });
      }

      res.status(500).json({
        message: '更新用戶資料失敗'
      });
    }
  }
);

// DELETE /api/users/:userId - 軟刪除用戶（僅老闆可用）
router.delete('/:userId',
  authenticateToken,
  requireBoss,
  logUserActivity('停用用戶'),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: '找不到指定用戶'
        });
      }

      // 防止停用自己
      if (userId === req.user._id.toString()) {
        return res.status(400).json({
          message: '不能停用自己的帳號'
        });
      }

      // 防止停用最後一個老闆
      if (user.role === 'boss') {
        const activeBossCount = await User.countDocuments({ 
          role: 'boss', 
          isActive: true,
          _id: { $ne: userId }
        });
        if (activeBossCount === 0) {
          return res.status(400).json({
            message: '至少需要保留一個啟用的老闆帳號'
          });
        }
      }

      user.isActive = false;
      await user.save();

      console.log(`🗑️  用戶停用: ${user.email} - 由 ${req.user.email} 執行`);

      res.json({
        message: '用戶已停用'
      });

    } catch (error) {
      console.error('停用用戶錯誤:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的用戶ID格式'
        });
      }

      res.status(500).json({
        message: '停用用戶失敗'
      });
    }
  }
);

// POST /api/users/:userId/activate - 重新啟用用戶（僅老闆可用）
router.post('/:userId/activate',
  authenticateToken,
  requireBoss,
  logUserActivity('啟用用戶'),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: '找不到指定用戶'
        });
      }

      if (user.isActive) {
        return res.status(400).json({
          message: '用戶已經是啟用狀態'
        });
      }

      user.isActive = true;
      await user.save();

      console.log(`✅ 用戶啟用: ${user.email} - 由 ${req.user.email} 執行`);

      res.json({
        message: '用戶已啟用',
        user: await User.findById(userId).select('-passwordHash')
      });

    } catch (error) {
      console.error('啟用用戶錯誤:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的用戶ID格式'
        });
      }

      res.status(500).json({
        message: '啟用用戶失敗'
      });
    }
  }
);

// POST /api/users/:userId/change-password - 修改用戶密碼（僅老闆可用）
router.post('/:userId/change-password',
  authenticateToken,
  requireBoss,
  [
    body('newPassword')
      .trim()
      .notEmpty()
      .withMessage('新密碼為必填項')
      .isLength({ min: 6 })
      .withMessage('密碼長度至少需要 6 個字元')
  ],
  handleValidationErrors,
  logUserActivity('修改用戶密碼'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: '找不到指定用戶'
        });
      }

      // 更新密碼
      user.passwordHash = newPassword;
      await user.save();

      console.log(`🔐 密碼已更新: ${user.email} - 由 ${req.user.email} 執行`);

      res.json({
        message: '密碼更新成功'
      });

    } catch (error) {
      console.error('修改密碼錯誤:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的用戶ID格式'
        });
      }

      res.status(500).json({
        message: '修改密碼失敗',
        error: error.message
      });
    }
  }
);

// POST /api/users/:userId/toggle-status - 切換用戶啟用/停用狀態（僅老闆可用）
router.post('/:userId/toggle-status',
  authenticateToken,
  requireBoss,
  logUserActivity('切換用戶狀態'),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: '找不到指定用戶'
        });
      }

      // 防止操作自己
      if (userId === req.user._id.toString()) {
        return res.status(400).json({
          message: '不能修改自己的帳號狀態'
        });
      }

      // 如果要停用老闆，檢查是否是最後一個
      if (user.isActive && user.role === 'boss') {
        const activeBossCount = await User.countDocuments({ 
          role: 'boss', 
          isActive: true,
          _id: { $ne: userId }
        });
        if (activeBossCount === 0) {
          return res.status(400).json({
            message: '至少需要保留一個啟用的老闆帳號'
          });
        }
      }

      // 切換狀態
      user.isActive = !user.isActive;
      await user.save();

      const statusText = user.isActive ? '啟用' : '停用';
      console.log(`🔄 用戶狀態切換: ${user.email} - ${statusText} - 由 ${req.user.email} 執行`);

      res.json({
        message: `用戶已${statusText}`,
        user: await User.findById(userId).select('-passwordHash')
      });

    } catch (error) {
      console.error('切換用戶狀態錯誤:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的用戶ID格式'
        });
      }

      res.status(500).json({
        message: '切換用戶狀態失敗',
        error: error.message
      });
    }
  }
);

// POST /api/users/:userId/reset-password - 重置用戶密碼為預設值（僅老闆可用）
router.post('/:userId/reset-password',
  authenticateToken,
  requireBoss,
  logUserActivity('重置用戶密碼'),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: '找不到指定用戶'
        });
      }

      // 防止重置自己的密碼
      if (userId === req.user._id.toString()) {
        return res.status(400).json({
          message: '不能重置自己的密碼'
        });
      }

      // 重置為預設密碼 (可以設定為 email 的前綴或固定值)
      const defaultPassword = 'password123';
      user.passwordHash = defaultPassword;
      await user.save();

      console.log(`🔐 密碼已重置: ${user.email} - 由 ${req.user.email} 執行`);

      res.json({
        message: '密碼已重置為預設值',
        defaultPassword: defaultPassword
      });

    } catch (error) {
      console.error('重置密碼錯誤:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的用戶ID格式'
        });
      }

      res.status(500).json({
        message: '重置密碼失敗',
        error: error.message
      });
    }
  }
);

// GET /api/users/:userId/inventory-logs - 獲取用戶的盤點記錄
router.get('/:userId/inventory-logs',
  authenticateToken,
  canAccessUser,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('頁碼必須是正整數'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每頁數量必須在1-100之間'),
    query('startDate').optional().isISO8601().withMessage('開始日期格式錯誤'),
    query('endDate').optional().isISO8601().withMessage('結束日期格式錯誤')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { 
        page = 1, 
        limit = 20, 
        startDate, 
        endDate 
      } = req.query;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: '找不到指定用戶'
        });
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      let query = { userId };

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const [logs, totalCount] = await Promise.all([
        InventoryLog.find(query)
          .populate('productId', 'name sku barcode')
          .populate('userId', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        InventoryLog.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
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
      console.error('獲取用戶盤點記錄錯誤:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          message: '無效的用戶ID格式'
        });
      }

      res.status(500).json({
        message: '獲取用戶盤點記錄失敗'
      });
    }
  }
);

module.exports = router; 