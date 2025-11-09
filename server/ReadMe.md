// 1. 获取地图数据
const map = game.getWorldManager().getMapData()

// 2. 检查碰撞
const canWalk = game.getWorldManager().isWalkable({ x: 10, y: 5 })

// 3. 玩家交互
const result = game.handleInteraction({
    playerId: "player_123",
    type: "till",
    target: { x: 10, y: 5 }
})

// 4. 查看环境
const view = game.getWorldManager().describeView({ x: 25, y: 25 }, 3)

// 5. ASCII 地图
const ascii = game.getWorldManager().renderASCII({ x: 25, y: 25 }, 5)