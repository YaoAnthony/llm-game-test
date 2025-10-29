// server/routes/index.ts
import type { Express } from "express";
import type Game from "../Game/index.js";
import { gameRouter } from "./game.js";

export type Deps = {
  game: Game;
};

export function registerRoutes(app: Express, deps: Deps) {
  app.use("/api/game", gameRouter(deps));
  // app.use("/mcp", mcpRouter(deps));            // MCP（给 MCP 客户端用）
  // app.use("/api", gameRouter());               // /api/state, /api/move
  // app.use("/api/env", envRouter());            // /api/env/*
  // app.use("/agent", agentRouter(deps));        // /agent/start|stop|command
}
