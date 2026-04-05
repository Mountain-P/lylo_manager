const mongoose = require('mongoose');

const attributeSchema = new mongoose.Schema({
  id: Number,
  name: String,
  slug: String,
  option: String
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '商品名稱為必填欄位'],
    trim: true,
    maxlength: [200, '商品名稱不能超過200個字元']
  },
  type: {
    type: String,
    enum: ['simple', 'variable', 'variation'],
    default: 'simple'
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    index: true
  },
  attributes: [attributeSchema],
  sku: {
    type: String,
    trim: true,
    uppercase: true,
    index: true
  }, // SKU for variations or simple products, can be empty for variable container
  barcode: {
    type: String,
    trim: true,
    index: true,
    sparse: true // 允許多個文檔沒有此欄位，但如果有則必須唯一
  },
  expectedQty: {
    type: Number,
    default: 0,
    min: [0, '到貨數量不能為負數']
  },
  stockQty: {
    type: Number,
    default: 0,
    min: [0, '庫存數量不能為負數']
  },
  onOrderQty: {
    type: Number,
    default: 0,
    min: [0, '已訂購數量不能為負數']
  },
  lastOrderDate: {
    type: Date
  },
  salesQty: {
    type: Number,
    default: 0,
    min: [0, '銷售數量不能為負數']
  },
  countedQty: {
    type: Number,
    default: 0,
    min: [0, '盤點數量不能為負數']
  },
  wooId: {
    type: String,
    index: true
  },
  wooData: {
    price: Number,
    regularPrice: Number,
    salePrice: Number,
    weight: String,
    dimensions: {
      length: String,
      width: String,
      height: String
    },
    categories: [{
      id: Number,
      name: String,
      _id: false // 告訴 Mongoose 不要為 categories 創建 _id
    }],
    images: [{
      id: Number, // 添加 id 欄位
      src: String,
      alt: String,
      _id: false // 告訴 Mongoose 不要為 images 創建 _id
    }],
    status: {
      type: String,
      enum: ['publish', 'private', 'draft'],
      default: 'publish'
    },
    dateCreated: {
      type: Date
    }
  },
  lastSyncAt: {
    type: Date
  },
  lastCountedAt: {
    type: Date
  },
  lastCountedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// 建立複合索引
productSchema.index({ sku: 1, isActive: 1 });
productSchema.index({ barcode: 1 }, { sparse: true });
productSchema.index({ wooId: 1 });
productSchema.index({ lastSyncAt: -1 });

// 虛擬欄位：盤點狀態（三級：uncounted / normal / error）
productSchema.virtual('countStatus').get(function() {
  if (!this.lastCountedAt) return 'uncounted';
  return this.countedQty === this.stockQty ? 'normal' : 'error';
});

// 虛擬欄位：計算是否盤點異常（已盤點且差異不為 0）
productSchema.virtual('isCountError').get(function() {
  if (!this.lastCountedAt) return false;
  return this.countedQty !== this.stockQty;
});

// 虛擬欄位：差異數量 = 實際盤點 - 系統庫存
productSchema.virtual('diffQty').get(function() {
  if (!this.lastCountedAt) return 0;
  return this.countedQty - this.stockQty;
});

// 確保虛擬欄位在JSON輸出中包含
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// 實例方法：更新盤點資料
productSchema.methods.updateCount = function(countedQty, userId) {
  this.countedQty = countedQty;
  this.lastCountedAt = new Date();
  this.lastCountedBy = userId;
  return this.save();
};

// 實例方法：從WooCommerce資料更新
productSchema.methods.updateFromWoo = function(wooProduct) {
  this.name = wooProduct.name;
  this.stockQty = wooProduct.stock_quantity || 0;
  this.wooData = {
    price: parseFloat(wooProduct.price) || 0,
    regularPrice: parseFloat(wooProduct.regular_price) || 0,
    salePrice: parseFloat(wooProduct.sale_price) || null,
    weight: wooProduct.weight,
    dimensions: wooProduct.dimensions,
    categories: wooProduct.categories,
    images: wooProduct.images,
    status: wooProduct.status
  };
  this.lastSyncAt = new Date();
  return this.save();
};

// 靜態方法：根據條碼查找商品
productSchema.statics.findByBarcode = function(barcode) {
  return this.findOne({ barcode, isActive: true });
};

// 靜態方法：根據SKU查找商品
productSchema.statics.findBySku = function(sku) {
  return this.findOne({ sku: sku.toUpperCase(), isActive: true });
};

// 靜態方法：獲取需要盤點的商品（已盤點且差異不為 0）
productSchema.statics.getCountErrorProducts = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $addFields: {
        isCountError: {
          $and: [
            { $ne: ['$lastCountedAt', null] },
            { $ne: ['$countedQty', '$stockQty'] }
          ]
        },
        diffQty: {
          $cond: [
            { $ne: ['$lastCountedAt', null] },
            { $subtract: ['$countedQty', '$stockQty'] },
            0
          ]
        }
      }
    },
    { $match: { isCountError: true } },
    { $sort: { updatedAt: -1 } }
  ]);
};

// 靜態方法：獲取盤點統計
productSchema.statics.getCountStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        countedProducts: {
          $sum: {
            $cond: [{ $gt: ['$lastCountedAt', null] }, 1, 0]
          }
        },
        errorProducts: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$lastCountedAt', null] },
                  { $ne: ['$countedQty', '$stockQty'] }
                ]
              },
              1,
              0
            ]
          }
        },
        totalStock: { $sum: '$stockQty' },
        totalCounted: { $sum: '$countedQty' }
      }
    }
  ]);
};

module.exports = mongoose.model('Product', productSchema); 