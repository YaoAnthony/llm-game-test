// server/server.ts
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import MyAgent from "./mcp/index.js";           // ✅ 单例 MCP 实例
import { registerRoutes } from "./routes/index.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

// Mongo 连接
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error("❌ Missing MONGO_URI in .env");
console.log("Connecting to the database...");
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ✅ 依赖注入：把共享对象传给各个路由
const deps = {
  mcpServer: new MyAgent(),     // 所有 /mcp 请求共用这一个实例
};

registerRoutes(app, deps);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
