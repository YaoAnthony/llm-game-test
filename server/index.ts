/**
 * 游戏服务器入口文件
 * 
 * 主要功能：
 * 1. 初始化 Express 服务器
 * 2. 连接 MongoDB 数据库
 * 3. 启动游戏世界（包括时间系统、天气系统、玩家管理等）
 * 4. 注册 REST API 路由
 * 5. 配置错误处理中间件
 * 6. 实现优雅关闭机制
 */

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { createServer } from "http";
// 加载 .env 文件中的环境变量
dotenv.config();

import { registerRoutes } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { validateEnv } from "./utils/validation.js";
import { WebSocketManager } from "./Services/WebSocketManager.js";

import Game from "./Game/index.js";

// 创建 Express 应用实例
const app = express();

// 创建 HTTP 服务器（用于同时支持 Express 和 WebSocket）
const httpServer = createServer(app);

// 配置中间件：解析 JSON 请求体
app.use(express.json());

// 配置 CORS：允许前端跨域访问
app.use(cors({ 
  origin: process.env.FRONT_END_URL || "http://localhost:5173", // 允许的前端地址
  credentials: true // 允许携带凭证（如 Cookie）
}));

/**
 * 服务器启动函数
 * 
 * 执行顺序：
 * 1. 验证必需的环境变量
 * 2. 连接 MongoDB 数据库
 * 3. 初始化游戏世界
 * 4. 注册 API 路由
 * 5. 启动 HTTP 服务器
 * 6. 设置优雅关闭监听器
 */
async function bootstrap() {
  // ===== 第一步：验证环境变量 =====
  try {
    validateEnv(); // 检查 MONGO_URI 和 OPENAI_API_KEY 是否存在
  } catch (err: any) {
    console.error(err.message);
    process.exit(1); // 如果缺少必需的环境变量，终止程序
  }

  // ===== 第二步：连接数据库 =====
  const MONGO_URI = process.env.MONGO_URI!; // 使用 ! 断言，因为已经过验证

  console.log("Connecting to the database...");
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    throw err; // 数据库连接失败，抛出错误
  }

  // ===== 第三步：初始化游戏世界 =====
  // 从环境变量获取世界 ID，默认为 "default-world"
  const worldId = process.env.GAME_WORLD_ID ?? "default-world";
  console.log(`🌍 Initializing game world: ${worldId}`);
  
  // 获取游戏世界单例实例
  const game = Game.getInstance(worldId);
  
  // 初始化游戏世界：
  // - 从数据库加载世界状态
  // - 启动时间系统（昼夜循环）
  // - 启动游戏主循环（20 TPS）
  // - 开启自动存档（每分钟）
  await game.init();
  
  console.log(`✅ Game world initialized`);
  console.log(`   - Online players: ${game.getPlayerCount()}`); // 显示当前在线玩家数
  console.log(`   - Current tick: ${game.getState().tick}`);    // 显示当前游戏 tick

  // ===== 第四步：初始化 WebSocket 服务器 =====
  const wsManager = new WebSocketManager(httpServer);
  
  // 将 WebSocket 管理器传递给游戏实例，用于实时广播
  
  // ===== 时间同步策略 =====
  // 1. 快速更新（world_update）：每 0.5 秒广播一次，用于实时天气等非关键信息
  // 2. 时间同步（time_sync）：每 30 秒广播一次，用于客户端校准本地计时器
  
  let lastBroadcastTick = 0;
  const BROADCAST_INTERVAL_TICKS = 10; // 每 10 tick 广播一次 (20 TPS / 10 = 2次/秒)
  
  game.onTick(() => {
    const worldState = game.getState();
    const currentTick = worldState.tick;
    
    // 快速广播：世界状态更新
    if (currentTick - lastBroadcastTick >= BROADCAST_INTERVAL_TICKS) {
      wsManager.broadcastWorldUpdate({
        tick: currentTick,
        timeOfDay: worldState.timeOfDay,
        weather: worldState.weather,
      });
      lastBroadcastTick = currentTick;
    }
  });
  
  // 定期时间同步：每 30 秒同步一次精确时间
  setInterval(() => {
    const worldState = game.getState();
    console.log(`⏰ [TIME_SYNC] Broadcasting time sync: tick ${worldState.tick}, ${worldState.timeOfDay}`);
    
    wsManager.broadcast({
      type: 'time_sync',
      data: {
        tick: worldState.tick,
        timeOfDay: worldState.timeOfDay,
        weather: worldState.weather,
        tickIntervalMs: 50,
        speedMultiplier: 1,
      },
      timestamp: Date.now(),
    });
  }, 30000); // 30 秒

  // ===== 第五步：注册 API 路由 =====
  // 准备依赖注入对象，将 game 实例和 wsManager 传递给路由
  const deps = {
    game,
    wsManager, // 路由中也可以使用 WebSocket 广播
  };

  // 注册所有 API 路由：
  // - /api/game/*      -> 世界状态 API
  // - /api/players/*   -> 玩家管理 API
  registerRoutes(app, deps);

  // ===== 第六步：配置错误处理 =====
  // 404 处理：捕获未匹配的路由
  app.use(notFoundHandler);
  
  // 全局错误处理中间件（必须在所有路由之后注册）
  app.use(errorHandler);

  // ===== 第七步：启动 HTTP 服务器 =====
  const port = Number(process.env.PORT) || 4000; // 默认端口 4000
  httpServer.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`   - World API: http://localhost:${port}/api/game/world`);
    console.log(`   - Players API: http://localhost:${port}/api/players`);
    console.log(`   - WebSocket: ws://localhost:${port}/ws`);
  });

  // ===== 第八步：优雅关闭机制 =====
  // 监听 Ctrl+C 信号（SIGINT）
  process.on("SIGINT", async () => {
    console.log("\n⏸️  Shutting down gracefully...");
    
    // 1. 关闭 WebSocket 连接
    wsManager.closeAll();
    
    // 2. 关闭游戏世界：停止游戏循环、保存状态
    await game.shutdown();
    
    // 3. 断开数据库连接
    await mongoose.disconnect();
    
    console.log("👋 Server stopped");
    process.exit(0); // 正常退出
  });
}

// ===== 启动服务器 =====
// 执行启动函数，如果出错则打印错误并退出
bootstrap().catch((err) => {
  console.error("❌ Server failed to start", err);
  process.exit(1); // 异常退出
});
