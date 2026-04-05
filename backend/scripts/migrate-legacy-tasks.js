/**
 * 將舊盤點紀錄遷移為新架構的盤點任務
 * 
 * 邏輯：
 * 1. 按日期區間分組（3 批歷史盤點）
 * 2. 每組建立一個 InventoryTask，含 stockSnapshot
 * 3. snapshot 中已盤點的商品填入最終盤點結果
 * 4. 更新對應的 InventoryLog.taskId
 */

const mongoose = require('mongoose');
const InventoryLog = require('../models/InventoryLog');
const InventoryTask = require('../models/InventoryTask');
const Product = require('../models/Product');
const User = require('../models/User');

const GROUPS = [
  {
    label: '2025/07 測試盤點',
    date: '2025-07-27',
    start: '2025-07-27T00:00:00Z',
    end: '2025-07-30T00:00:00Z',
    note: '系統初期測試盤點（自動歸檔）'
  },
  {
    label: '2026/03 主要盤點',
    date: '2026-03-29',
    start: '2026-03-29T00:00:00Z',
    end: '2026-04-01T00:00:00Z',
    note: '2026年3月全面盤點 03/29~03/31（自動歸檔）'
  },
  {
    label: '2026/04/03 盤點',
    date: '2026-04-03',
    start: '2026-04-03T00:00:00Z',
    end: '2026-04-04T00:00:00Z',
    note: '2026年4月3日盤點（自動歸檔）'
  }
];

async function migrate() {
  await mongoose.connect('mongodb://localhost:27017/inventory_manager');
  console.log('Connected to MongoDB');

  for (const group of GROUPS) {
    console.log(`\n=== 處理: ${group.label} ===`);

    const startDate = new Date(group.start);
    const endDate = new Date(group.end);

    // Check if already migrated
    const existing = await InventoryTask.findOne({
      note: { $regex: '自動歸檔' },
      date: new Date(group.date)
    });
    if (existing) {
      console.log(`  已存在歸檔任務 ${existing._id}，跳過`);
      continue;
    }

    // Get the final count per product (last log wins)
    const finalLogs = await InventoryLog.aggregate([
      { $match: { createdAt: { $gte: startDate, $lt: endDate } } },
      { $sort: { createdAt: -1 } },
      { $group: {
        _id: '$productId',
        countedQty: { $first: '$countedQty' },
        expectedQty: { $first: '$expectedQty' },
        diffQty: { $first: '$diffQty' },
        countedAt: { $first: '$createdAt' },
        userId: { $first: '$userId' }
      }}
    ]);

    console.log(`  最終盤點商品數: ${finalLogs.length}`);

    // Get all users involved
    const userIds = [...new Set(finalLogs.map(l => l.userId.toString()))];
    
    // Get the creator (first user in the logs)
    const allLogs = await InventoryLog.find({
      createdAt: { $gte: startDate, $lt: endDate }
    }).sort({ createdAt: 1 }).limit(1).select('userId').lean();
    const creatorId = allLogs[0]?.userId;

    // Build stockSnapshot from final logs
    // Use expectedQty as the snapshotStockQty (it was the system stock at count time)
    const stockSnapshot = finalLogs.map(log => {
      const diff = log.countedQty - log.expectedQty;
      return {
        productId: log._id,
        snapshotStockQty: log.expectedQty,
        countedQty: log.countedQty,
        countedAt: log.countedAt,
        countedBy: log.userId,
        diffQty: diff,
        status: diff === 0 ? 'normal' : 'error'
      };
    });

    const counted = stockSnapshot.filter(s => s.status !== 'uncounted').length;
    const errors = stockSnapshot.filter(s => s.status === 'error').length;

    const task = new InventoryTask({
      date: new Date(group.date),
      personnel: userIds.map(id => new mongoose.Types.ObjectId(id)),
      status: 'completed',
      createdBy: creatorId,
      completedAt: new Date(group.end),
      note: group.note,
      snapshotScope: 'all',
      snapshotCategories: [],
      stockSnapshot,
      summary: {
        totalProducts: stockSnapshot.length,
        countedProducts: counted,
        errorProducts: errors,
        completionRate: stockSnapshot.length > 0 ? Math.round((counted / stockSnapshot.length) * 100) : 0
      },
      snapshotCreatedAt: startDate,
      lastRefreshedAt: null
    });

    await task.save();
    console.log(`  建立任務: ${task._id}`);
    console.log(`  summary: ${counted}/${stockSnapshot.length} 商品, ${errors} 異常, ${task.summary.completionRate}%`);

    // Update all InventoryLogs in this date range with the taskId
    // We need to bypass the 'required' validation on taskId for the update
    const updateResult = await InventoryLog.collection.updateMany(
      {
        createdAt: { $gte: startDate, $lt: endDate },
        $or: [{ taskId: null }, { taskId: { $exists: false } }]
      },
      {
        $set: { taskId: task._id }
      }
    );
    console.log(`  更新 InventoryLog: ${updateResult.modifiedCount} 筆已綁定 taskId`);
  }

  // Final verification
  console.log('\n=== 遷移結果驗證 ===');
  const totalTasks = await InventoryTask.countDocuments();
  const withTask = await InventoryLog.countDocuments({ taskId: { $ne: null } });
  const withoutTask = await InventoryLog.countDocuments({ $or: [{ taskId: null }, { taskId: { $exists: false } }] });
  console.log(`盤點任務數: ${totalTasks}`);
  console.log(`有 taskId 的 log: ${withTask}`);
  console.log(`無 taskId 的 log: ${withoutTask}`);

  const tasks = await InventoryTask.find().select('date status note summary').sort({ date: 1 }).lean();
  tasks.forEach(t => {
    console.log(`  ${t.date.toISOString().slice(0,10)} | ${t.status} | ${t.summary.countedProducts}/${t.summary.totalProducts} (${t.summary.errorProducts} 異常) | ${t.note}`);
  });

  await mongoose.disconnect();
  console.log('\nDone.');
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
});
