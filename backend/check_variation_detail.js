const Product = require('./models/Product');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('=== 查看變化商品(variation)的完整結構 ===\n');
    
    // 1. 找一個有「貨況=pre-order」的變化商品
    const preOrderProduct = await Product.findOne({
      isActive: true,
      type: 'variation',
      'attributes.name': '貨況',
      'attributes.option': 'pre-order'
    });
    
    if (preOrderProduct) {
      console.log('找到預購商品範例:');
      console.log(JSON.stringify(preOrderProduct, null, 2));
      console.log('\n');
    }
    
    // 2. 統計所有變化商品中「貨況」的值
    console.log('=== 統計變化商品的貨況分布 ===\n');
    
    const variations = await Product.find({
      isActive: true,
      type: 'variation'
    });
    
    const statusCounts = {};
    const withoutStatus = [];
    
    variations.forEach(v => {
      const statusAttr = v.attributes.find(a => a.name === '貨況');
      if (statusAttr) {
        const status = statusAttr.option || 'null';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      } else {
        withoutStatus.push(v.name);
      }
    });
    
    console.log('貨況統計:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} 個商品`);
    });
    
    console.log(`\n沒有「貨況」屬性的商品: ${withoutStatus.length} 個`);
    if (withoutStatus.length > 0 && withoutStatus.length <= 5) {
      console.log('範例:', withoutStatus.join(', '));
    }
    
    // 3. 查看 simple 商品是否有貨況
    console.log('\n\n=== 檢查 simple 商品的貨況 ===\n');
    
    const simpleProducts = await Product.find({
      isActive: true,
      type: 'simple'
    }).limit(10);
    
    console.log(`找到 ${simpleProducts.length} 個 simple 商品`);
    
    simpleProducts.forEach(p => {
      const statusAttr = p.attributes.find(a => a.name === '貨況');
      if (statusAttr) {
        console.log(`  ${p.name}: 貨況=${statusAttr.option}`);
      }
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('錯誤:', err.message);
    process.exit(1);
  });

