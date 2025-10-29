// server/agent.ts
import OpenAI from "openai";
import { getStateService, moveService } from "./game.js";
import { agentMemory } from "./agentMemory.js";
import dotenv from "dotenv";
dotenv.config();
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

type StepLog = { pos: { x: number; y: number }; move?: { dx: number; dy: number }; error?: string };

export class AgentController {
  private client: OpenAI;
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = 1500;
  private lastLog: StepLog | null = null;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  isRunning() {
    return !!this.timer;
  }

  getLastLog() {
    return this.lastLog;
  }

  start() {
    if (this.timer) return;
    this.loop(); // 立刻跑一次
    this.timer = setInterval(() => this.loop(), this.intervalMs);
    console.log("🤖 Agent started");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    console.log("🛑 Agent stopped");
  }

  private async loop() {
    try {
      const { x, y } = await getStateService();

      // 定义一个函数调用（工具），让模型“只能”返回 dx,dy（-1..1）
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
          type: "function",
          function: {
            name: "propose_move",
            description: "Propose next 4-direction move (grid step).",
            parameters: {
              type: "object",
              properties: {
                dx: { type: "integer", minimum: -1, maximum: 1 },
                dy: { type: "integer", minimum: -1, maximum: 1 },
              },
              required: ["dx", "dy"],
              additionalProperties: false,
            },
          },
        },
      ];

      const memorySummary = agentMemory.summarize();
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content:
            "You control a character on a 2D grid. Only move one step per turn. Prefer exploring. Always use the function tool to return your decision.",
        },
        {
          role: "user",
          content: `Current position: (${x}, ${y}). Known memories:\n${memorySummary}\nChoose the next step (dx,dy) with -1..1 constraints.`,
        },
      ];

      const completion = await this.client.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.2,
      });

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== "propose_move") {
        this.lastLog = { pos: { x, y }, error: "No valid tool call from model." };
        console.log("⚠️ No valid tool call from model.");
        return;
      }

      const args = JSON.parse(toolCall.function.arguments || "{}");
      let dx = Number(args.dx);
      let dy = Number(args.dy);
      // 兜底约束
      dx = Math.max(-1, Math.min(1, isFinite(dx) ? dx : 0));
      dy = Math.max(-1, Math.min(1, isFinite(dy) ? dy : 0));

      const moved = await moveService(dx, dy);
      this.lastLog = { pos: moved, move: { dx, dy } };
      console.log(`🤖 move: dx=${dx}, dy=${dy} → new=(${moved.x},${moved.y})`);
    } catch (err: any) {
      this.lastLog = { pos: await getStateService(), error: String(err?.message || err) };
      console.error("Agent loop error:", err);
    }
  }
}

export const agent = new AgentController();
