const mongoose = require('mongoose');

const inventoryLogSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, '商品ID為必填欄位'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '使用者ID為必填欄位'],
    index: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryTask',
    index: true
  },
  countedQty: {
    type: Number,
    required: [true, '盤點數量為必填欄位'],
    min: [0, '盤點數量不能為負數']
  },
  previousQty: {
    type: Number,
    default: 0
  },
  expectedQty: {
    type: Number,
    default: 0
  },
  salesQty: {
    type: Number,
    default: 0
  },
  diffQty: {
    type: Number
  },
  note: {
    type: String,
    maxlength: [500, '備註不能超過500個字元'],
    trim: true
  },
  method: {
    type: String,
    enum: ['manual', 'barcode', 'manual-batch'],
    default: 'manual'
  },
  deviceInfo: {
    userAgent: String,
    ip: String
  }
}, {
  timestamps: true
});

// 建立複合索引
inventoryLogSchema.index({ productId: 1, createdAt: -1 });
inventoryLogSchema.index({ userId: 1, createdAt: -1 });
inventoryLogSchema.index({ createdAt: -1 });

// 在儲存前計算差異數量（盤點數量 - 系統庫存）
inventoryLogSchema.pre('save', function(next) {
  this.diffQty = this.countedQty - this.expectedQty;
  next();
});

// 實例方法：檢查是否有異常
inventoryLogSchema.methods.hasError = function() {
  return this.diffQty !== 0;
};

// 靜態方法：獲取特定商品的盤點歷史
inventoryLogSchema.statics.getProductHistory = function(productId, limit = 50) {
  return this.find({ productId })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// 靜態方法：獲取特定使用者的盤點記錄
inventoryLogSchema.statics.getUserLogs = function(userId, limit = 100) {
  return this.find({ userId })
    .populate({
      path: 'productId',
      select: 'name sku barcode type parentId attributes wooData',
      populate: {
        path: 'parentId',
        select: 'name sku type',
        model: 'Product'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// 靜態方法：獲取異常盤點記錄
inventoryLogSchema.statics.getErrorLogs = function(startDate, endDate) {
  const query = { diffQty: { $ne: 0 } };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
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
    .sort({ createdAt: -1 });
};

// 靜態方法：獲取盤點統計
inventoryLogSchema.statics.getStats = function(startDate, endDate) {
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalLogs: { $sum: 1 },
        errorLogs: {
          $sum: { $cond: [{ $ne: ['$diffQty', 0] }, 1, 0] }
        },
        uniqueProducts: { $addToSet: '$productId' },
        uniqueUsers: { $addToSet: '$userId' },
        totalCountedQty: { $sum: '$countedQty' },
        totalDiffQty: { $sum: { $abs: '$diffQty' } }
      }
    },
    {
      $project: {
        totalLogs: 1,
        errorLogs: 1,
        uniqueProductsCount: { $size: '$uniqueProducts' },
        uniqueUsersCount: { $size: '$uniqueUsers' },
        totalCountedQty: 1,
        totalDiffQty: 1,
        errorRate: {
          $multiply: [
            { $divide: ['$errorLogs', '$totalLogs'] },
            100
          ]
        }
      }
    }
  ]);
};

// 靜態方法：每日盤點統計
inventoryLogSchema.statics.getDailyStats = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        totalLogs: { $sum: 1 },
        errorLogs: {
          $sum: { $cond: [{ $ne: ['$diffQty', 0] }, 1, 0] }
        },
        uniqueProducts: { $addToSet: '$productId' },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        totalLogs: 1,
        errorLogs: 1,
        uniqueProductsCount: { $size: '$uniqueProducts' },
        uniqueUsersCount: { $size: '$uniqueUsers' },
        errorRate: {
          $multiply: [
            { $divide: ['$errorLogs', '$totalLogs'] },
            100
          ]
        }
      }
    },
    { $sort: { date: 1 } }
  ]);
};

module.exports = mongoose.model('InventoryLog', inventoryLogSchema); 