


import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Agent } from "../types";


export type TransportLike = unknown;


export type ToolRegistrar = (server: McpServer, agent: Agent) => Promise<void> | void;


export class AgentMcpAdapter {
    private server: McpServer | null = null;
    private readonly name: string;
    private readonly version: string;
    private readonly agent: Agent;
    private readonly register: ToolRegistrar;


    constructor(params: { agent: Agent; name?: string; version?: string; registerTools: ToolRegistrar }) {
        this.agent = params.agent;
        this.name = params.name ?? "agent-mcp";
        this.version = params.version ?? "1.0.0";
        this.register = params.registerTools;
    }


    async connect(transport: TransportLike) {
        if (!this.server) {
            this.server = new McpServer({ name: this.name, version: this.version });
            await this.register(this.server, this.agent);
        }
        if (!this.server) throw new Error("MCP server failed to initialize");
            await this.server.connect(transport as any);
    }
}