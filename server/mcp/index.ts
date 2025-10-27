
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getStateService } from "../utils/index.js";
import { interactService, moveWithCollision, senseService } from "../services/env.js";

import { z } from "zod";

export default class MyAgent {
    private mcpServer : McpServer;

    constructor() {
        this.mcpServer = new McpServer({ name: "llm-game-server", version: "1.0.0" });

        this.mcpServer.registerTool(
            "sense",
            {
                title: "Sense around",
                description: "Sense cells around the player (grid, obstacles, objects).",
                inputSchema: { r: z.number().min(0).max(3).default(1) },
                outputSchema: {},
            },
            async ({ r }) => {
                const data = await senseService(r ?? 1);
                return {
                    content: [{ type: "text", text: JSON.stringify(data) }],
                        structuredContent: data as Record<string, unknown>,
                };
            }
        );

        this.mcpServer.registerTool(
          "get-state",
          {
            title: "Get Game State",
            description: "Fetch current world state (player position)",
            inputSchema: {},
            outputSchema: { x: z.number(), y: z.number() },
          },
          async () => {
            const result = await getStateService();
            return {
                content: [{ type: "text", text: JSON.stringify(result) }],
                structuredContent: result as Record<string, unknown>,
            };
          }
        );

        this.mcpServer.registerTool(
            "move-safe",
            {
                title: "Move with collision",
                description: "Move one step in 4 directions. Collides with walls/obstacles.",
                inputSchema: { dx: z.number(), dy: z.number() },
                outputSchema: {},
            },
            async ({ dx, dy }) => {
                const data = await moveWithCollision(dx, dy);
                return {
                    content: [{ type: "text", text: JSON.stringify(data) }],
                    structuredContent: data as Record<string, unknown>,
                };
            }
        );

        this.mcpServer.registerTool(
            "interact",
            {
                title: "Interact on current tile",
                description: "Interact with object on the current tile. Use optional actionId (e.g., brew / inspect).",
                inputSchema: { actionId: z.string().optional() },
                outputSchema: {},
            },
            async ({ actionId }) => {
                const data = await interactService(actionId);
                return {
                content: [{ type: "text", text: JSON.stringify(data) }],
                structuredContent: data as Record<string, unknown>,
                };
            }
        );

    }

    public async connect(transport: any) {
        await this.mcpServer.connect(transport);

    }
}