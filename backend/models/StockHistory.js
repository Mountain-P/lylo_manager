const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, '商品ID為必填欄位'],
    index: true
  },
  wooStockQty: {
    type: Number,
    required: [true, 'WooCommerce庫存數量為必填欄位'],
    min: [0, '庫存數量不能為負數']
  },
  previousStockQty: {
    type: Number,
    default: 0
  },
  changeQty: {
    type: Number
  },
  changeType: {
    type: String,
    enum: ['increase', 'decrease', 'no_change']
  },
  wooProductData: {
    name: String,
    sku: String,
    status: String,
    price: Number
  },
  syncSource: {
    type: String,
    enum: ['cron', 'manual', 'webhook'],
    default: 'cron'
  },
  syncedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  syncDuration: {
    type: Number
  },
  error: {
    type: String
  }
}, {
  timestamps: true
});

// 建立複合索引
stockHistorySchema.index({ productId: 1, syncedAt: -1 });
stockHistorySchema.index({ syncedAt: -1 });
stockHistorySchema.index({ changeType: 1, syncedAt: -1 });

// 在儲存前計算變化數量和類型
stockHistorySchema.pre('save', function(next) {
  this.changeQty = this.wooStockQty - this.previousStockQty;
  
  if (this.changeQty > 0) {
    this.changeType = 'increase';
  } else if (this.changeQty < 0) {
    this.changeType = 'decrease';
  } else {
    this.changeType = 'no_change';
  }
  
  next();
});

// 實例方法：檢查是否有顯著變化
stockHistorySchema.methods.hasSignificantChange = function(threshold = 0) {
  return Math.abs(this.changeQty) > threshold;
};

// 實例方法：格式化變化描述
stockHistorySchema.methods.getChangeDescription = function() {
  if (this.changeQty > 0) {
    return `增加 ${this.changeQty} 件`;
  } else if (this.changeQty < 0) {
    return `減少 ${Math.abs(this.changeQty)} 件`;
  } else {
    return '無變化';
  }
};

// 靜態方法：獲取特定商品的庫存歷史
stockHistorySchema.statics.getProductHistory = function(productId, limit = 50) {
  return this.find({ productId })
    .populate('productId', 'name sku barcode')
    .sort({ syncedAt: -1 })
    .limit(limit);
};

// 靜態方法：獲取有變化的記錄
stockHistorySchema.statics.getChangedRecords = function(startDate, endDate, changeTypes = ['increase', 'decrease']) {
  const query = { 
    changeType: { $in: changeTypes }
  };
  
  if (startDate || endDate) {
    query.syncedAt = {};
    if (startDate) query.syncedAt.$gte = new Date(startDate);
    if (endDate) query.syncedAt.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .populate('productId', 'name sku barcode')
    .sort({ syncedAt: -1 });
};

// 靜態方法：獲取同步統計
stockHistorySchema.statics.getSyncStats = function(startDate, endDate) {
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.syncedAt = {};
    if (startDate) matchStage.syncedAt.$gte = new Date(startDate);
    if (endDate) matchStage.syncedAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSyncs: { $sum: 1 },
        increasedCount: {
          $sum: { $cond: [{ $eq: ['$changeType', 'increase'] }, 1, 0] }
        },
        decreasedCount: {
          $sum: { $cond: [{ $eq: ['$changeType', 'decrease'] }, 1, 0] }
        },
        noChangeCount: {
          $sum: { $cond: [{ $eq: ['$changeType', 'no_change'] }, 1, 0] }
        },
        totalIncrease: {
          $sum: { $cond: [{ $gt: ['$changeQty', 0] }, '$changeQty', 0] }
        },
        totalDecrease: {
          $sum: { $cond: [{ $lt: ['$changeQty', 0] }, { $abs: '$changeQty' }, 0] }
        },
        uniqueProducts: { $addToSet: '$productId' },
        avgSyncDuration: { $avg: '$syncDuration' },
        errorCount: {
          $sum: { $cond: [{ $ne: ['$error', null] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        totalSyncs: 1,
        increasedCount: 1,
        decreasedCount: 1,
        noChangeCount: 1,
        totalIncrease: 1,
        totalDecrease: 1,
        uniqueProductsCount: { $size: '$uniqueProducts' },
        avgSyncDuration: { $round: ['$avgSyncDuration', 2] },
        errorCount: 1,
        changeRate: {
          $multiply: [
            { 
              $divide: [
                { $add: ['$increasedCount', '$decreasedCount'] }, 
                '$totalSyncs'
              ] 
            },
            100
          ]
        },
        errorRate: {
          $multiply: [
            { $divide: ['$errorCount', '$totalSyncs'] },
            100
          ]
        }
      }
    }
  ]);
};

// 靜態方法：每日同步統計
stockHistorySchema.statics.getDailyStats = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { syncedAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$syncedAt' },
          month: { $month: '$syncedAt' },
          day: { $dayOfMonth: '$syncedAt' }
        },
        totalSyncs: { $sum: 1 },
        changedProducts: {
          $sum: { $cond: [{ $ne: ['$changeType', 'no_change'] }, 1, 0] }
        },
        totalIncrease: {
          $sum: { $cond: [{ $gt: ['$changeQty', 0] }, '$changeQty', 0] }
        },
        totalDecrease: {
          $sum: { $cond: [{ $lt: ['$changeQty', 0] }, { $abs: '$changeQty' }, 0] }
        },
        uniqueProducts: { $addToSet: '$productId' },
        avgSyncDuration: { $avg: '$syncDuration' }
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
        totalSyncs: 1,
        changedProducts: 1,
        totalIncrease: 1,
        totalDecrease: 1,
        uniqueProductsCount: { $size: '$uniqueProducts' },
        avgSyncDuration: { $round: ['$avgSyncDuration', 2] },
        changeRate: {
          $multiply: [
            { $divide: ['$changedProducts', '$totalSyncs'] },
            100
          ]
        }
      }
    },
    { $sort: { date: 1 } }
  ]);
};

// 靜態方法：獲取最新的同步狀態
stockHistorySchema.statics.getLatestSyncStatus = function() {
  return this.aggregate([
    { $sort: { syncedAt: -1 } },
    { $limit: 1 },
    {
      $project: {
        lastSyncAt: '$syncedAt',
        syncSource: 1,
        error: 1,
        syncDuration: 1
      }
    }
  ]);
};

// 靜態方法：清理舊記錄（保留指定天數）
stockHistorySchema.statics.cleanOldRecords = function(keepDays = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);
  
  return this.deleteMany({
    syncedAt: { $lt: cutoffDate },
    changeType: 'no_change' // 只清理無變化的記錄
  });
};

module.exports = mongoose.model('StockHistory', stockHistorySchema); 