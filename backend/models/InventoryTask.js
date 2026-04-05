const mongoose = require('mongoose');

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
    enum: ['in_progress', 'completed'],
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
  }
}, {
  timestamps: true
});

inventoryTaskSchema.index({ status: 1, createdAt: -1 });
inventoryTaskSchema.index({ date: -1 });

module.exports = mongoose.model('InventoryTask', inventoryTaskSchema);
