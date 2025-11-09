/**
 * API 路由注册中心
 * 
 * 职责：
 * 1. 集中管理所有 API 路由
 * 2. 将依赖项（如 Game 实例）注入到各个路由模块
 * 3. 统一路由前缀和版本管理
 * 
 * 当前已注册的 API：
 * - /api/game/*      -> 游戏世界相关 API（时间、天气等）
 * - /api/players/*   -> 玩家管理 API（增删改查、移动等）
 */

import type { Express } from "express";
import type Game from "../Game/index.js";
import type { WebSocketManager } from "../Services/WebSocketManager.js";
import { gameRouter } from "./game.js";
import { agentRouter } from "./agent.js";

/**
 * 依赖注入类型定义
 * 包含路由需要的所有依赖项
 */
export type Deps = {
  game: Game; // 游戏世界实例，用于访问玩家、世界状态等
  wsManager: WebSocketManager; // WebSocket 管理器，用于实时推送
};

/**
 * 注册所有 API 路由
 * 
 * @param app Express 应用实例
 * @param deps 依赖注入对象，包含 Game 实例等
 * 
 * 路由结构：
 * - /api/game/world           -> 获取世界快照
 * - /api/players              -> 玩家 CRUD 操作
 * - /api/players/:id/move     -> 移动玩家
 * - /api/players/:id/teleport -> 传送玩家
 */
export function registerRoutes(app: Express, deps: Deps) {
  // 注册游戏世界路由：获取世界状态、时间、天气等
  app.use("/api/game", gameRouter(deps));
  
  // 注册玩家管理路由：创建、查询、移动玩家等
  app.use("/api/players", agentRouter(deps));
  
  // 预留的路由（可选实现）：
  // app.use("/mcp", mcpRouter(deps));       // MCP（Model Context Protocol）客户端 API
  // app.use("/api/env", envRouter());       // 环境/地图相关 API
  // app.use("/api/items", itemsRouter());   // 物品系统 API
  // app.use("/api/combat", combatRouter()); // 战斗系统 API
}
