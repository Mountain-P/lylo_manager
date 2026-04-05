const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 驗證 JWT Token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        message: '存取被拒絕，需要有效的認證令牌' 
      });
    }

    // 驗證 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 從資料庫獲取用戶資料
    const user = await User.findById(decoded.userId).select('-passwordHash');
    
    if (!user) {
      return res.status(401).json({ 
        message: '認證令牌無效，找不到對應用戶' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        message: '用戶帳號已被停用' 
      });
    }

    // 將用戶資訊添加到請求對象
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: '認證令牌格式錯誤' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: '認證令牌已過期，請重新登入' 
      });
    }

    console.error('認證中間件錯誤:', error);
    return res.status(500).json({ 
      message: '認證過程發生錯誤' 
    });
  }
};

// 驗證用戶角色
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: '需要先通過身份認證' 
      });
    }

    // 如果 roles 是字串，轉換為陣列
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: '權限不足，無法存取此資源',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

// 驗證是否為老闆
const requireBoss = requireRole('boss');

// 驗證是否為員工（包含老闆）
const requireEmployee = requireRole(['boss', 'employee']);

// 驗證用戶是否可以存取特定資源
const canAccessUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: '需要先通過身份認證' 
    });
  }

  const targetUserId = req.params.userId || req.body.userId;
  
  // 老闆可以存取所有用戶資料
  if (req.user.role === 'boss') {
    return next();
  }

  // 員工只能存取自己的資料
  if (req.user._id.toString() === targetUserId) {
    return next();
  }

  return res.status(403).json({ 
    message: '只能存取自己的用戶資料' 
  });
};

// 產生 JWT Token
const generateToken = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// 產生刷新 Token
const generateRefreshToken = (user) => {
  const payload = {
    userId: user._id,
    type: 'refresh'
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
};

// 驗證刷新 Token
const verifyRefreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      throw new Error('不是有效的刷新令牌');
    }

    const user = await User.findById(decoded.userId).select('-passwordHash');
    
    if (!user || !user.isActive) {
      throw new Error('找不到對應用戶或用戶已被停用');
    }

    return user;
  } catch (error) {
    throw new Error('刷新令牌無效: ' + error.message);
  }
};

// 從請求中提取用戶 IP
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         'unknown';
};

// 記錄用戶活動
const logUserActivity = (action) => {
  return (req, res, next) => {
    // 在請求完成後記錄活動
    res.on('finish', async () => {
      if (req.user && res.statusCode < 400) {
        try {
          // 這裡可以擴展為專門的活動記錄系統
          console.log(`👤 用戶活動: ${req.user.email} (${req.user.role}) 執行了 ${action}`, {
            ip: getClientIP(req),
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('記錄用戶活動失敗:', error);
        }
      }
    });
    
    next();
  };
};

// 可選的身份認證（不強制要求登入）
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-passwordHash');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // 可選認證失敗時不拋出錯誤，只是不設定 req.user
    console.log('可選認證失敗:', error.message);
  }
  
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireBoss,
  requireEmployee,
  canAccessUser,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  getClientIP,
  logUserActivity,
  optionalAuth
}; 