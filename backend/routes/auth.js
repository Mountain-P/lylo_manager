const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  authenticateToken,
  requireBoss,
  getClientIP,
  logUserActivity 
} = require('../middleware/auth');

const router = express.Router();

// 輸入驗證規則
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('請輸入有效的 Email 地址'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('密碼至少需要 6 個字元')
];

const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('姓名長度需要在 2-50 個字元之間'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('請輸入有效的 Email 地址'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('密碼至少需要 6 個字元'),
  body('role')
    .optional()
    .isIn(['boss', 'employee'])
    .withMessage('角色只能是 boss 或 employee')
];

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

// POST /api/auth/login - 用戶登入
router.post('/login', loginValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    // 查找用戶
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        message: 'Email 或密碼錯誤'
      });
    }

    // 檢查帳號是否啟用
    if (!user.isActive) {
      return res.status(401).json({
        message: '帳號已被停用，請聯繫管理員'
      });
    }

    // 驗證密碼
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Email 或密碼錯誤'
      });
    }

    // 更新最後登入時間
    await user.updateLastLogin();

    // 產生 token
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // 記錄登入活動
    console.log(`✅ 用戶登入成功: ${user.email} (${user.role}) - IP: ${getClientIP(req)}`);

    res.json({
      message: '登入成功',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt
      },
      token,
      refreshToken
    });

  } catch (error) {
    console.error('登入錯誤:', error);
    res.status(500).json({
      message: '登入過程發生錯誤'
    });
  }
});

// POST /api/auth/register - 註冊新用戶（只有老闆可以註冊員工）
router.post('/register', 
  authenticateToken, 
  requireBoss, 
  registerValidation, 
  handleValidationErrors,
  logUserActivity('註冊新用戶'),
  async (req, res) => {
    try {
      const { name, email, password, role = 'employee' } = req.body;

      // 檢查 Email 是否已存在
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          message: 'Email 已被使用'
        });
      }

      // 建立新用戶
      const newUser = new User({
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash: password,
        role,
        createdBy: req.user._id
      });

      await newUser.save();

      console.log(`👤 新用戶註冊: ${newUser.email} (${newUser.role}) - 由 ${req.user.email} 建立`);

      res.status(201).json({
        message: '用戶註冊成功',
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          createdAt: newUser.createdAt
        }
      });

    } catch (error) {
      console.error('註冊錯誤:', error);
      
      if (error.code === 11000) {
        return res.status(409).json({
          message: 'Email 已被使用'
        });
      }

      res.status(500).json({
        message: '註冊過程發生錯誤'
      });
    }
  }
);

// POST /api/auth/refresh - 刷新 token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        message: '缺少刷新令牌'
      });
    }

    // 驗證刷新 token
    const user = await verifyRefreshToken(refreshToken);

    // 產生新的 token
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      message: '令牌刷新成功',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token: newToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('刷新令牌錯誤:', error);
    res.status(401).json({
      message: '刷新令牌無效'
    });
  }
});

// GET /api/auth/me - 獲取當前用戶資訊
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        lastLoginAt: req.user.lastLoginAt,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('獲取用戶資訊錯誤:', error);
    res.status(500).json({
      message: '獲取用戶資訊失敗'
    });
  }
});

// PUT /api/auth/profile - 更新個人資料
router.put('/profile', 
  authenticateToken,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('姓名長度需要在 2-50 個字元之間'),
    body('currentPassword')
      .optional()
      .isLength({ min: 6 })
      .withMessage('目前密碼至少需要 6 個字元'),
    body('newPassword')
      .optional()
      .isLength({ min: 6 })
      .withMessage('新密碼至少需要 6 個字元')
  ],
  handleValidationErrors,
  logUserActivity('更新個人資料'),
  async (req, res) => {
    try {
      const { name, currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id);

      // 更新姓名
      if (name) {
        user.name = name.trim();
      }

      // 更新密碼
      if (currentPassword && newPassword) {
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            message: '目前密碼錯誤'
          });
        }
        user.passwordHash = newPassword;
      }

      await user.save();

      res.json({
        message: '個人資料更新成功',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });

    } catch (error) {
      console.error('更新個人資料錯誤:', error);
      res.status(500).json({
        message: '更新個人資料失敗'
      });
    }
  }
);

// POST /api/auth/logout - 登出（前端處理，這裡只記錄）
router.post('/logout', authenticateToken, logUserActivity('登出'), (req, res) => {
  console.log(`👋 用戶登出: ${req.user.email} - IP: ${getClientIP(req)}`);
  
  res.json({
    message: '登出成功'
  });
});

// POST /api/auth/change-password/:userId - 管理員重設用戶密碼
router.post('/change-password/:userId',
  authenticateToken,
  requireBoss,
  [
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('新密碼至少需要 6 個字元')
  ],
  handleValidationErrors,
  logUserActivity('重設用戶密碼'),
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

      user.passwordHash = newPassword;
      await user.save();

      console.log(`🔑 管理員重設密碼: ${user.email} - 由 ${req.user.email} 執行`);

      res.json({
        message: '密碼重設成功'
      });

    } catch (error) {
      console.error('重設密碼錯誤:', error);
      res.status(500).json({
        message: '重設密碼失敗'
      });
    }
  }
);

module.exports = router; 