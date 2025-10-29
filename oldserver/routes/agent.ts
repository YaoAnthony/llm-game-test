// server/routes/agent.ts
import { Router } from "express";
import type { Deps } from "./index.js";
import { agent } from "../services/agent.js";
import OpenAI from "openai";
import { senseService, moveWithCollision, interactService, moveToTarget } from "../services/env.js";
import type { MysticalObjectInteraction } from "../types/environment.js";
import { agentMemory } from "../services/agentMemory.js";
// types
import type { StreamEvent } from "../types/index.js";
type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;



export default function agentRouter(_deps: Deps) {
    const router = Router();

    router.post("/start", (_req, res) => {
        agent.start();
        res.json({ running: agent.isRunning(), last: agent.getLastLog() });
    });

    router.post("/stop", (_req, res) => {
        agent.stop();
        res.json({ running: agent.isRunning(), last: agent.getLastLog() });
    });

    // 自然语言 → 计划 → 执行
    router.post("/command", async (req, res) => {
        const { command } = req.body ?? {};
        if (!command) return res.status(400).json({ error: "Missing command" });

        const key = process.env.OPENAI_API_KEY;
        if (!key) return res.status(500).json({ error: "Missing OpenAI API key" });

        try {
            console.log(`[AGENT] /command received instruction: ${command}`);
            const openai = new OpenAI({ apiKey: key });
            const env = await senseService(2);
            console.log("[AGENT] Initial environment snapshot: ", {
                player: env.player,
                objects: env.objects?.length,
            });

            const system =
                "You are a planner for a 2D grid environment. You must output STRICT JSON. " +
                "Allowed primitive actions: move(dx,dy) single step; move_to(x,y) to walk via shortest path; interact(). " +
                "You receive the agent's memory fragments; use them to reason about previously seen objects. " +
                "Always plan a concise sequence in `plan`, avoiding blocked cells. If goal is 'go to (x,y) and use coffee machine', first move_to target tile then interact().";

            const user = {
                command,
                env,
                memories: agentMemory.list(16),
                schema_hint: {
                plan_format: {
                    type: "object",
                    properties: {
                    plan: {
                        type: "array",
                        items: {
                        anyOf: [
                            { type: "object", properties: { action: { const: "move" }, dx: { type: "integer" }, dy: { type: "integer" } }, required: ["action","dx","dy"] },
                            { type: "object", properties: { action: { const: "move_to" }, x: { type: "integer" }, y: { type: "integer" } }, required: ["action", "x", "y"] },
                            { type: "object", properties: { action: { const: "interact" } }, required: ["action"] }
                        ]
                        }
                    }
                    },
                    required: ["plan"]
                }
                }
            };

            const completion = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                temperature: 0.2,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: JSON.stringify(user) },
                ],
            });

            const raw = completion.choices[0]?.message?.content?.trim() || "{}";
            const jsonText = raw.match(/\{[\s\S]*\}$/)?.[0] || raw;

            console.log("Agent plan JSON:", jsonText);
            let plan: any = {};
            try { plan = JSON.parse(jsonText); } catch { plan = { plan: [] }; }

            type PlannedStep =
                | { action: "move"; dx: number; dy: number }
                | { action: "move_to"; x: number; y: number }
                | { action: "interact" };
            const steps: PlannedStep[] = Array.isArray(plan.plan) ? plan.plan : [];
            console.log(`[AGENT] Parsed plan with ${steps.length} step(s)`);

            let last = env.player;
            let lastMsg = "";
            for (const step of steps) {
                if (step.action === "move") {
                    const r = await moveWithCollision(step.dx ?? 0, step.dy ?? 0);
                    console.log("[AGENT] Executed plan move", { step, result: r });
                    last = r.pos ?? last;
                if (!r.ok) { lastMsg = r.reason ?? "blocked"; break; }
                } else if (step.action === "move_to") {
                    const targetX = Number.isFinite(Number(step.x)) ? Math.trunc(Number(step.x)) : last?.x ?? 0;
                    const targetY = Number.isFinite(Number(step.y)) ? Math.trunc(Number(step.y)) : last?.y ?? 0;
                    const r = await moveToTarget(targetX, targetY);
                    console.log("[AGENT] Executed plan move_to", { step, result: r });
                    last = r.pos ?? last;
                    if (!r.ok) { lastMsg = r.reason ?? "move_to failed"; break; }
                    lastMsg = `move_to reached (${targetX}, ${targetY})`;
                } else if (step.action === "interact") {
                    const r = await interactService();
                    console.log("[AGENT] Executed plan interact", { step, result: r });
                    lastMsg = r.message;
                }
            }

            res.json({ pos: last, reply: lastMsg || `Executed ${steps.length} step(s).`, plan: steps });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "LLM planning failed" });
        }
    });

    router.post("/command-stream", async (req, res) => {
        const { command } = req.body ?? {};
        if (!command) {
            return res.status(400).json({ error: "Missing command" });
        }

        const key = process.env.OPENAI_API_KEY;
        if (!key) {
            return res.status(500).json({ error: "Missing OpenAI API key" });
        }

        console.log(`[AGENT] /command-stream opened for instruction: ${command}`);
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        (res as any).flushHeaders?.();

        const send = (event: StreamEvent) => {
            const { type, ...payload } = event as StreamEvent & Record<string, unknown>;
            console.log("[AGENT] → SSE", { type, payload });
            res.write(`event: ${type}\n`);
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
            (res as any).flush?.();
        };

        const openai = new OpenAI({ apiKey: key });
        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
        const maxIterations = 24;
        let currentPos: { x: number; y: number } | undefined;
        let closed = false;
        const maxCollisions = 6;
        let collisionCount = 0;
        let abortDueToCollisions = false;

        res.on("close", () => {
            closed = true;
            console.log("[AGENT] /command-stream connection closed by client");
        });

        send({ type: "status", message: `收到指令：${command}` });

        try {
            const initialEnv = await senseService(2);
            console.log("[AGENT] Initial env for stream", {
                player: initialEnv.player,
                objects: initialEnv.objects?.length,
            });
            if (initialEnv.player) currentPos = { ...initialEnv.player };
            send({
                type: "step",
                payload: {
                    pos: currentPos ?? null,
                    ok: true,
                    info: "已感知当前环境",
                    memories: agentMemory.list(16),
                },
            });

            const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
                {
                    type: "function",
                    function: {
                        name: "sense",
                        description: "感知玩家周围网格，可选 radius (0-3)。",
                        parameters: {
                            type: "object",
                            properties: {
                                radius: { type: "integer", minimum: 0, maximum: 3, default: 1 },
                            },
                            additionalProperties: false,
                        },
                    },
                },
                {
                    type: "function",
                    function: {
                        name: "move_safe",
                        description: "朝四个方向移动一步，处理碰撞。",
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
                {
                    type: "function",
                    function: {
                        name: "move_to",
                        description: "使用最短路径移动到目标坐标（自动多步 move_safe）。",
                        parameters: {
                            type: "object",
                            properties: {
                                x: { type: "integer" },
                                y: { type: "integer" },
                            },
                            required: ["x", "y"],
                            additionalProperties: false,
                        },
                    },
                },
                {
                    type: "function",
                    function: {
                        name: "interact",
                        description: "与当前格子的对象互动。",
                        parameters: {
                            type: "object",
                            properties: {},
                            additionalProperties: false,
                        },
                    },
                },
            ];

            const messages: ChatMessage[] = [
                {
                    role: "system",
                    content:
                        "你控制一个网格世界中的玩家。必须通过提供的工具完成指令。" +
                        "可用工具：sense(radius)、move_safe(dx,dy)、move_to(x,y)、interact()。" +
                        "move_safe 仅走一步(|dx|+|dy|=1且为整数)；move_to 会自动规划多步最短路径。" +
                        "你会收到记忆碎片（memories），代表之前看到的对象与信息，回答时要参考这些记忆。" +
                        "如果 move_safe 返回阻挡或失败，先分析原因，必要时调用 sense(radius≥1) 再决定下一步；" +
                        "若多次仍无法前进，则用中文向用户说明遇到障碍并停止。",
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        command,
                        env: initialEnv,
                        memories: agentMemory.list(16),
                    }),
                },
            ];

            let summary = "";

            for (let step = 0; step < maxIterations && !closed; step++) {
                console.log(`[AGENT] Iteration ${step + 1} of ${maxIterations}`);
                const completion = await openai.chat.completions.create({
                    model,
                    temperature: 0.2,
                    messages,
                    tools,
                    tool_choice: "auto",
                });

                const choice = completion.choices[0];
                
                if (!choice) {
                    send({ type: "error", message: "模型未返回结果" });
                    break;
                }else{
                    console.log("LLM choice:", choice);
                }

                const message = choice.message;
                messages.push(message);

                const toolCalls = message.tool_calls ?? [];
                if (toolCalls.length === 0) {
                    summary = message.content?.toString().trim() ?? "";
                    console.log("[AGENT] LLM returned final reply", summary);
                    send({
                        type: "completion",
                        payload: { summary, pos: currentPos ?? null, memories: agentMemory.list(16) },
                    });
                    break;
                }

                for (const toolCall of toolCalls) {
                    if (closed) break;

                    if (toolCall.type !== "function") {
                        console.log("[AGENT] Unsupported tool call type", toolCall.type);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify({ ok: false, message: "仅支持 function 工具调用" }),
                        });
                        send({ type: "error", message: "收到非 function 类型的工具调用" });
                        continue;
                    }

                    const toolName = toolCall.function.name;
                    let args: Record<string, unknown> = {};
                    try {
                        args = JSON.parse(toolCall.function.arguments || "{}");
                    } catch {
                        args = {};
                    }
                    console.log("[AGENT] Executing tool", toolName, args);

                    send({
                        type: "action",
                        payload: { action: toolName, args },
                    });

                    if (toolName === "sense") {
                        const radius = Number.isFinite(Number(args.radius)) ? Number(args.radius) : 1;
                        const sensed = await senseService(Math.max(0, Math.min(3, radius)));
                        if (sensed.player) currentPos = { ...sensed.player };
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(sensed),
                        });
                        console.log("[AGENT] Tool sense result", {
                            player: sensed.player,
                            cells: sensed.cells.length,
                        });
                        send({
                            type: "step",
                            payload: {
                                pos: currentPos ?? null,
                                ok: true,
                                info: "获得感知信息",
                                memories: agentMemory.list(16),
                            },
                        });
                        continue;
                    }

                    if (toolName === "move_safe") {
                        let dx = Number.isFinite(Number(args.dx)) ? Math.trunc(Number(args.dx)) : 0;
                        let dy = Number.isFinite(Number(args.dy)) ? Math.trunc(Number(args.dy)) : 0;
                        const manhattan = Math.abs(dx) + Math.abs(dy);
                        let coerced = false;
                        if (manhattan !== 1) {
                            if (dx !== 0 && dy !== 0) {
                                // prefer vertical/horizontal priority by zeroing dy
                                dy = 0;
                            }
                            if (Math.abs(dx) > 1) dx = Math.sign(dx);
                            if (Math.abs(dy) > 1) dy = Math.sign(dy);
                            if (Math.abs(dx) + Math.abs(dy) !== 1) {
                                if (dx !== 0) {
                                    dx = Math.sign(dx);
                                    dy = 0;
                                } else if (dy !== 0) {
                                    dy = Math.sign(dy);
                                    dx = 0;
                                } else {
                                    dx = 1;
                                    dy = 0;
                                }
                            }
                            coerced = true;
                        }
                        if (coerced) {
                            messages.push({
                                role: "system",
                                content: "⚠️ 你需要一次只移动一个格子的上下左右步伐。我已帮你改为合法步长。",
                            });
                        }
                        const result = await moveWithCollision(dx, dy);
                        if (result.pos) currentPos = { ...result.pos };
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(result),
                        });
                        console.log("[AGENT] Tool move_safe result", result);
                        if (result.ok) {
                            collisionCount = 0;
                        } else {
                            collisionCount += 1;
                            messages.push({
                                role: "system",
                                content: `移动失败：${result.reason ?? "受阻"}${
                                    result.hint ? `。提示：${result.hint}` : ""
                                }`,
                            });
                            if (collisionCount === 1) {
                                messages.push({
                                    role: "system",
                                    content:
                                        `你刚才的移动失败：${result.reason ?? "受阻"}。${
                                            result.hint ? `提示：${result.hint}` : "请结合 sense(radius=2) 等工具重新评估，再决定是否继续；若依旧无法通过，请直接告诉用户受阻并停止。"
                                        }`,
                                });
                            }
                            const statusMsg = `⚠️ 移动失败：${result.reason ?? "受阻"}${
                                result.hint ? `（${result.hint}）` : ""
                            }`;
                            send({ type: "status", message: statusMsg });
                            if (collisionCount >= maxCollisions) {
                                const summary = `多次受到障碍阻挡（${result.reason ?? "原因未知"}），未能继续前进，当前停留在 (${currentPos?.x ?? "?"}, ${currentPos?.y ?? "?"})。`;
                                send({
                                    type: "completion",
                                    payload: {
                                        summary,
                                        pos: currentPos ?? null,
                                        memories: agentMemory.list(16),
                                    },
                                });
                                abortDueToCollisions = true;
                            }
                        }
                        const stepInfo = result.ok
                            ? "已移动"
                            : result.hint
                                ? `${result.reason ?? "移动受阻"}。${result.hint}`
                                : result.reason ?? "移动受阻";
                        const memories = agentMemory.list(16);
                        send({
                            type: "step",
                            payload: {
                                pos: currentPos ?? null,
                                ok: result.ok,
                                info: stepInfo,
                                hint: result.hint ?? null,
                                memories,
                            },
                        });
                        if (abortDueToCollisions) {
                            break;
                        }
                        continue;
                    }

                    if (toolName === "move_to") {
                        const targetX = Number.isFinite(Number(args.x)) ? Math.trunc(Number(args.x)) : currentPos?.x ?? 0;
                        const targetY = Number.isFinite(Number(args.y)) ? Math.trunc(Number(args.y)) : currentPos?.y ?? 0;
                        const perStepSummaries: Array<{ pos: { x: number; y: number }; info: string; ok: boolean; hint?: string | null }> = [];
                        const result = await moveToTarget(targetX, targetY, {
                            onStep: async ({ index, total, pos, result: moveResult }) => {
                                currentPos = { ...pos };
                                const info = moveResult.ok
                                    ? `move_to 路径步 (${index}/${total})`
                                    : moveResult.reason ?? "move_to 步骤失败";
                                perStepSummaries.push({ pos, info, ok: moveResult.ok, hint: moveResult.hint ?? null });
                                send({
                                    type: "step",
                                    payload: {
                                        pos: currentPos,
                                        ok: moveResult.ok,
                                        info,
                                        hint: moveResult.hint ?? null,
                                        memories: agentMemory.list(16),
                                    },
                                });
                            },
                        });
                        if (result.pos) currentPos = { ...result.pos };
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(result),
                        });
                        console.log("[AGENT] Tool move_to result", result);
                        if (result.ok) {
                            collisionCount = 0;
                        } else {
                            collisionCount += 1;
                            const reason = result.reason ?? "无法到达目标";
                            messages.push({
                                role: "system",
                                content: `move_to(${targetX},${targetY}) 失败：${reason}。请重新规划路线或尝试 sense(radius=2)。`,
                            });
                            const statusMsg = `⚠️ move_to 失败：${reason}`;
                            send({ type: "status", message: statusMsg });
                            if (collisionCount >= maxCollisions) {
                                const summary = `多次尝试路径规划失败，未能到达 (${targetX}, ${targetY})，当前停留在 (${currentPos?.x ?? "?"}, ${currentPos?.y ?? "?"})。`;
                                send({
                                    type: "completion",
                                    payload: {
                                        summary,
                                        pos: currentPos ?? null,
                                        memories: agentMemory.list(16),
                                    },
                                });
                                abortDueToCollisions = true;
                            }
                        }
                        const info = result.ok
                            ? `已抵达 (${currentPos?.x ?? "?"}, ${currentPos?.y ?? "?"})，耗时 ${result.steps?.length ?? 0} 步。`
                            : result.reason ?? "无法到达目标";
                        const memories = agentMemory.list(16);
                        if (perStepSummaries.length === 0) {
                            send({
                                type: "step",
                                payload: {
                                    pos: currentPos ?? null,
                                    ok: result.ok,
                                    info,
                                    memories,
                                },
                            });
                        } else if (!result.ok) {
                            const lastStep = perStepSummaries[perStepSummaries.length - 1];
                            const lastPos = lastStep?.pos ?? currentPos ?? null;
                            send({
                                type: "step",
                                payload: {
                                    pos: lastPos,
                                    ok: false,
                                    info: info,
                                    hint: result.reason ?? lastStep?.hint ?? null,
                                    memories,
                                },
                            });
                        } else {
                            send({
                                type: "step",
                                payload: {
                                    pos: currentPos ?? null,
                                    ok: result.ok,
                                    info,
                                    memories,
                                },
                            });
                        }
                        if (abortDueToCollisions) {
                            break;
                        }
                        continue;
                    }

                    if (toolName === "interact") {
                        const actionId = typeof args.actionId === "string" ? args.actionId : undefined;
                        const result = await interactService(actionId);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(result),
                        });
                        console.log("[AGENT] Tool interact result", result);
                        if ("object" in result && result.object) {
                            const interactionList =
                                result.object.interactions
                                    ?.map((interaction: MysticalObjectInteraction) => interaction.id)
                                    .join(", ") || "无";
                            messages.push({
                                role: "system",
                                content: `交互对象：${result.object.name} (${result.object.type})，可选交互：${interactionList}。状态：${JSON.stringify(result.object.state ?? {})}`,
                            });
                        }
                        send({
                            type: "step",
                            payload: {
                                pos: currentPos ?? null,
                                ok: result.ok,
                                info: result.message,
                                object: "object" in result ? result.object ?? null : null,
                                memories: agentMemory.list(16),
                            },
                        });
                        continue;
                    }

                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ ok: false, message: "未知工具" }),
                    });
                    console.log("[AGENT] Unknown tool", toolName);
                    send({ type: "error", message: `未识别工具 ${toolName}` });
                }
            }

            if (!closed) {
                console.log("[AGENT] /command-stream completed, closing response");
                res.end();
            }
        } catch (err) {
            console.error("Streaming agent error", err);
            send({ type: "error", message: "指令执行失败" });
            res.end();
        }
    });

    return router;
}
