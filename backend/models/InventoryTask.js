const mongoose = require('mongoose');

const snapshotItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  snapshotStockQty: {
    type: Number,
    required: true
  },
  countedQty: {
    type: Number,
    default: null
  },
  countedAt: {
    type: Date,
    default: null
  },
  countedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  diffQty: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['uncounted', 'normal', 'error'],
    default: 'uncounted'
  }
}, { _id: false });

const inventoryTaskSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, '盤點日期為必填欄位']
  },
  personnel: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'cancelled'],
    default: 'in_progress'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completedAt: {
    type: Date
  },
  note: {
    type: String,
    maxlength: [500, '備註不能超過500個字元'],
    trim: true
  },
  snapshotScope: {
    type: String,
    enum: ['all', 'categories'],
    default: 'all'
  },
  snapshotCategories: [{
    type: String,
    trim: true
  }],
  stockSnapshot: [snapshotItemSchema],
  summary: {
    totalProducts: { type: Number, default: 0 },
    countedProducts: { type: Number, default: 0 },
    errorProducts: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  },
  snapshotCreatedAt: {
    type: Date
  },
  lastRefreshedAt: {
    type: Date
  }
}, {
  timestamps: true
});

inventoryTaskSchema.index({ status: 1, createdAt: -1 });
inventoryTaskSchema.index({ date: -1 });
inventoryTaskSchema.index({ 'stockSnapshot.productId': 1 });

inventoryTaskSchema.methods.recalcSummary = function () {
  const total = this.stockSnapshot.length;
  const counted = this.stockSnapshot.filter(s => s.status !== 'uncounted').length;
  const errors = this.stockSnapshot.filter(s => s.status === 'error').length;
  this.summary = {
    totalProducts: total,
    countedProducts: counted,
    errorProducts: errors,
    completionRate: total > 0 ? Math.round((counted / total) * 100) : 0
  };
};

inventoryTaskSchema.methods.recordCount = function (productId, countedQty, userId) {
  const item = this.stockSnapshot.find(
    s => s.productId.toString() === productId.toString()
  );
  if (!item) return null;

  item.countedQty = countedQty;
  item.countedAt = new Date();
  item.countedBy = userId;
  item.diffQty = countedQty - item.snapshotStockQty;
  item.status = item.diffQty === 0 ? 'normal' : 'error';

  this.recalcSummary();
  return item;
};

inventoryTaskSchema.methods.refreshUncounted = async function () {
  const Product = mongoose.model('Product');
  const uncountedIds = this.stockSnapshot
    .filter(s => s.status === 'uncounted')
    .map(s => s.productId);

  if (uncountedIds.length === 0) return 0;

  const products = await Product.find({
    _id: { $in: uncountedIds },
    isActive: true
  }).select('_id stockQty').lean();

  const productMap = new Map(products.map(p => [p._id.toString(), p.stockQty]));

  let refreshed = 0;
  for (const item of this.stockSnapshot) {
    if (item.status !== 'uncounted') continue;
    const latestQty = productMap.get(item.productId.toString());
    if (latestQty !== undefined && latestQty !== item.snapshotStockQty) {
      item.snapshotStockQty = latestQty;
      refreshed++;
    }
  }

  this.lastRefreshedAt = new Date();
  return refreshed;
};

module.exports = mongoose.model('InventoryTask', inventoryTaskSchema);
