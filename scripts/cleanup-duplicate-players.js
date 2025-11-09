/**
 * 数据库清理脚本
 * 用于删除重复的玩家记录，只保留最早创建的记录
 * 
 * 使用方法：
 * 1. 连接到 MongoDB
 * 2. 切换到项目数据库：use your_database_name
 * 3. 复制粘贴下面的脚本执行
 */

// ===== 步骤 1: 查找重复的玩家名称 =====
print("🔍 查找重复玩家记录...");

db.players.aggregate([
    {
        $group: {
            _id: { name: "$name", worldId: "$worldId" },
            count: { $sum: 1 },
            players: { $push: { id: "$_id", playerId: "$playerId", joinedAt: "$joinedAt" } }
        }
    },
    {
        $match: { count: { $gt: 1 } }
    },
    {
        $sort: { count: -1 }
    }
]).forEach(function(doc) {
    print(`\n重复玩家: ${doc._id.name} (世界: ${doc._id.worldId})`);
    print(`  - 重复次数: ${doc.count}`);
    doc.players.forEach(function(p) {
        print(`  - ID: ${p.playerId}, 加入时间: ${p.joinedAt}`);
    });
});

// ===== 步骤 2: 清理重复记录（保留最早的记录）=====
print("\n\n🧹 开始清理重复记录...");

let deletedCount = 0;

db.players.aggregate([
    {
        $group: {
            _id: { name: "$name", worldId: "$worldId" },
            count: { $sum: 1 },
            players: { $push: { id: "$_id", playerId: "$playerId", joinedAt: "$joinedAt" } }
        }
    },
    {
        $match: { count: { $gt: 1 } }
    }
]).forEach(function(doc) {
    // 按加入时间排序，保留最早的
    let sorted = doc.players.sort(function(a, b) {
        return new Date(a.joinedAt) - new Date(b.joinedAt);
    });
    
    // 删除除第一个之外的所有记录
    for (let i = 1; i < sorted.length; i++) {
        print(`删除重复记录: ${sorted[i].playerId} (玩家: ${doc._id.name})`);
        db.players.deleteOne({ _id: sorted[i].id });
        deletedCount++;
    }
});

print(`\n✅ 清理完成！共删除 ${deletedCount} 条重复记录`);

// ===== 步骤 3: 验证清理结果 =====
print("\n📊 验证清理结果...");

let remainingDuplicates = db.players.aggregate([
    {
        $group: {
            _id: { name: "$name", worldId: "$worldId" },
            count: { $sum: 1 }
        }
    },
    {
        $match: { count: { $gt: 1 } }
    },
    {
        $count: "duplicates"
    }
]).toArray();

if (remainingDuplicates.length === 0) {
    print("✅ 没有发现重复记录");
} else {
    print(`⚠️  仍有 ${remainingDuplicates[0].duplicates} 组重复记录`);
}

// ===== 步骤 4: 显示当前玩家统计 =====
print("\n📈 当前玩家统计:");
print(`  - 总玩家数: ${db.players.countDocuments()}`);

db.players.aggregate([
    {
        $group: {
            _id: "$worldId",
            count: { $sum: 1 }
        }
    }
]).forEach(function(doc) {
    print(`  - 世界 ${doc._id}: ${doc.count} 个玩家`);
});
