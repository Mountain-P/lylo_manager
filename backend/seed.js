const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB 連接成功'))
  .catch(err => console.error('❌ MongoDB 連接失敗:', err));

const seedUsers = async () => {
  const users = [
    {
      name: 'admin',
      email: 'admin@example.com',
      password: '123456',
      role: 'boss',
      isActive: true,
      createdBy: null
    },
    {
      name: 'employee',
      email: 'employee@example.com',  
      password: '123456',
      role: 'employee',
      isActive: true,
      createdBy: null
    }
  ];

  try {
    await User.insertMany(users);
    console.log('✅ 種子資料已成功插入');
    process.exit(0);
  } catch (error) {
    console.error('❌ 種子資料插入失敗:', error);
    process.exit(1);
  }
};

seedUsers();