const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '姓名為必填欄位'],
    trim: true,
    maxlength: [50, '姓名不能超過50個字元']
  },
  email: {
    type: String,
    required: [true, 'Email為必填欄位'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '請輸入有效的Email格式']
  },
  passwordHash: {
    type: String,
    required: [true, '密碼為必填欄位'],
    minlength: [6, '密碼至少需要6個字元']
  },
  role: {
    type: String,
    enum: {
      values: ['boss', 'employee'],
      message: '角色只能是 boss 或 employee'
    },
    required: [true, '角色為必填欄位'],
    default: 'employee'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.passwordHash;
      return ret;
    }
  }
});

// 建立索引
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

// 密碼加密中間件
userSchema.pre('save', async function(next) {
  // 只有密碼被修改時才需要加密
  if (!this.isModified('passwordHash')) return next();
  
  try {
    // 加密密碼
    const saltRounds = 12;
    this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// 比對密碼方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// 檢查是否為老闆
userSchema.methods.isBoss = function() {
  return this.role === 'boss';
};

// 更新最後登入時間
userSchema.methods.updateLastLogin = function() {
  this.lastLoginAt = new Date();
  return this.save();
};

// 靜態方法：根據Email查找用戶
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// 靜態方法：獲取所有員工
userSchema.statics.getEmployees = function() {
  return this.find({ role: 'employee', isActive: true }).select('-passwordHash');
};

module.exports = mongoose.model('User', userSchema); 