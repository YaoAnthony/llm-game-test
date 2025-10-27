// server/routes/mcp.ts
import { Router } from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Deps } from "./index.js";

export default function mcpRouter({ mcpServer }: Deps) {
    const router = Router();

    router.post("/", async (req, res) => {
        try {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: randomUUID,
                enableJsonResponse: true,
            });
            res.on("close", () => transport.close());
            await mcpServer.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            console.error("MCP Error:", err);
            if (!res.headersSent) {
                res.status(500).json({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal server error" },
                id: null,
                });
            }
        }
    });

    return router;
}
