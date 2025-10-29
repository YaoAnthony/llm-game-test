// server/routes/index.ts
import type { Express } from "express";
import mcpRouter from "./mcp.js";
import gameRouter from "./game.js";
import envRouter from "./env.js";
import agentRouter from "./agent.js";

export type Deps = {
  mcpServer: any; // 你的 MyAgent 类型；如果有类型定义可以替换 any
};

export function registerRoutes(app: Express, deps: Deps) {
    app.use("/mcp", mcpRouter(deps));            // MCP（给 MCP 客户端用）
    app.use("/api", gameRouter());               // /api/state, /api/move
    app.use("/api/env", envRouter());            // /api/env/*
    app.use("/agent", agentRouter(deps));        // /agent/start|stop|command
}
