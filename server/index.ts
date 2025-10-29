import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { registerRoutes } from "./Routes/index.js";

import Game from "./Game/index.js";

const app = express();
app.use(express.json());
app.use(cors({ 
  origin: process.env.FRONT_END_URL, 
  credentials: true
}));

async function bootstrap() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error("❌ Missing MONGO_URI in .env");

  console.log("Connecting to the database...");
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }

  const worldId = process.env.GAME_WORLD_ID ?? "default-world";
  const game = Game.getInstance(worldId);
  await game.init();

  const deps = {
      game,
  };

  registerRoutes(app, deps);

  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
}

bootstrap().catch((err) => {
  console.error("❌ Server failed to start", err);
  process.exit(1);
});
