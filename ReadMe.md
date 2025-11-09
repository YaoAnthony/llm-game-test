# 🎮 多人在线游戏框架

一个基于 Express + React 的多人在线游戏基础框架，实现了玩家管理、世界时间系统、天气系统和游戏主循环。

## ✨ 核心功能

- ✅ **玩家系统** - 创建、管理、移动玩家
- ✅ **世界时间** - 昼夜循环、可调速度
- ✅ **天气系统** - 动态天气变化
- ✅ **游戏循环** - 20 TPS 主循环
- ✅ **REST API** - 完整的 API 接口
- ✅ **实时界面** - React + Ant Design
- ✅ **数据持久化** - MongoDB 存储

## 🚀 快速开始

### 1. 环境要求

- Node.js 16+
- MongoDB Atlas 账户（或本地 MongoDB）
- OpenAI API Key（可选）

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `server/.env.example` 为 `server/.env`，并填写配置：

```env
# MongoDB 连接
MONGO_URI=mongodb+srv://your-connection-string

# OpenAI API（可选）
OPENAI_API_KEY=sk-proj-your-key
OPENAI_MODEL=gpt-4o-mini

# 前端地址
FRONT_END_URL=http://localhost:5173

# 游戏世界 ID
GAME_WORLD_ID=default-world

# 服务器端口
PORT=4000
```

### 4. 启动项目

```bash
# 同时启动前后端
npm run dev
```

访问：
- 🌐 前端：http://localhost:5173
- 🔌 API：http://localhost:4000

## 📡 API 示例

### 创建玩家
```bash
curl -X POST http://localhost:4000/api/players \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice"}'
```

### 移动玩家
```bash
curl -X POST http://localhost:4000/api/players/{playerId}/move \
  -H "Content-Type: application/json" \
  -d '{"x": 10, "y": 0, "z": 5}'
```

### 获取所有玩家
```bash
curl http://localhost:4000/api/players
```

## 📚 完整文档

- **API 使用指南**: [API_GUIDE.md](./API_GUIDE.md)
- **实现总结**: [IMPLEMENTATION.md](./IMPLEMENTATION.md)

## 🏗️ 项目结构

```
llm-game-test/
├── server/                 # 后端服务
│   ├── Game/              # 游戏核心
│   ├── routes/            # API 路由
│   ├── types/             # 类型定义
│   └── middleware/        # 中间件
├── web/                   # 前端应用
│   ├── src/
│   │   ├── Pages/
│   │   ├── Components/
│   │   └── Redux/
└── package.json
```

## 🎯 核心特性

### 游戏循环 (20 TPS)
```typescript
// 每 50ms 更新一次所有系统
private update(deltaTime: number) {
    this.agentManager.updateAll(deltaTime);
}
```

### 玩家管理
- 创建/移除玩家
- 位置追踪
- 属性管理（生命值、经验、等级）
- 范围查询

### 世界系统
- 昼夜循环（240 ticks = 1 天）
- 动态天气
- 自动存档

## 📈 性能指标

| 指标 | 值 |
|------|-----|
| 游戏循环 | 20 TPS |
| 自动存档 | 每 60 秒 |
| 世界时间 | 240 ticks/天 |
| 最大坐标 | ±30,000,000 |

## 🔧 扩展开发

### 添加新的玩家属性
编辑 `server/types/agent.ts`

### 添加新的 API 路由
编辑 `server/routes/agent.ts`

### 在游戏循环中添加系统
编辑 `server/Game/index.ts` 的 `update()` 方法

## 🚧 下一步开发

- [ ] WebSocket 实时通信
- [ ] 玩家数据持久化
- [ ] 战斗系统
- [ ] 物品系统
- [ ] 地图系统
- [ ] NPC AI

## 📄 许可

MIT License
