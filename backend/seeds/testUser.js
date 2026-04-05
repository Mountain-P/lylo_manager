require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 連接到 MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_manager');

// 定義簡化的用戶 Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  passwordHash: String,
  role: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createTestUsers() {
  try {
    // 檢查是否已存在測試用戶
    const existingAdmin = await User.findOne({ email: 'admin@example.com' });
    const existingEmployee = await User.findOne({ email: 'employee@example.com' });

    if (!existingAdmin) {
      // 創建管理員用戶
      const adminPassword = await bcrypt.hash('admin123', 12);
      const admin = new User({
        name: '系統管理員',
        email: 'admin@example.com',
        passwordHash: adminPassword,
        role: 'boss'
      });
      await admin.save();
      console.log('✅ 管理員用戶創建成功');
      console.log('   Email: admin@example.com');
      console.log('   Password: admin123');
    } else {
      console.log('ℹ️  管理員用戶已存在');
    }

    if (!existingEmployee) {
      // 創建員工用戶
      const employeePassword = await bcrypt.hash('employee123', 12);
      const employee = new User({
        name: '測試員工',
        email: 'employee@example.com',
        passwordHash: employeePassword,
        role: 'employee'
      });
      await employee.save();
      console.log('✅ 員工用戶創建成功');
      console.log('   Email: employee@example.com');
      console.log('   Password: employee123');
    } else {
      console.log('ℹ️  員工用戶已存在');
    }

    console.log('\n🎉 測試用戶設置完成！');
    
  } catch (error) {
    console.error('❌ 創建測試用戶失敗:', error);
  } finally {
    mongoose.connection.close();
  }
}

// 執行創建函數
createTestUsers(); 