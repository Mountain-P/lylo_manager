require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db'); // 引入資料庫連線
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// 導入路由
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const inventoryTaskRoutes = require('./routes/inventoryTask');

// 導入 cron jobs
require('./cron/wooSync');

// 連接資料庫
connectDB();

const app = express();

// 日誌中間件
app.use(morgan('dev'));

// 安全性中間件
app.use(helmet());

// 速率限制
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 分鐘
//   max: 100 // 限制每個 IP 15 分鐘內最多 100 請求
// });
// app.use(limiter);

// CORS 設定
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:8080',
  credentials: true
}));

// 解析請求體
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 路由設定
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory-tasks', inventoryTaskRoutes);

// 健康檢查路由
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// 404 處理
app.use('*', (req, res) => {
  res.status(404).json({ message: '找不到請求的資源' });
});

// 全域錯誤處理
app.use((err, req, res, next) => {
  console.error('伺服器錯誤:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      message: '資料驗證失敗', 
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({ message: '無效的資料格式' });
  }
  
  res.status(err.status || 500).json({ 
    message: err.message || '伺服器內部錯誤',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行於 http://localhost:${PORT}`);
  console.log(`📊 API 文件: http://localhost:${PORT}/health`);
}); 