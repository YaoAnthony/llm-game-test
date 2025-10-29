
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
    AgentInventoryItem,
    AgentMemoryFragment,
    AgentOptions,
    AgentRepository,
    AgentSnapshot,
    AgentStatus,
} from "./types/index.js";

type TransportLike = unknown;

export default abstract class Agent {
    protected readonly repository: AgentRepository;
    protected mcpServer: McpServer | null = null;
    protected status: AgentStatus;

    // Unique identifier
    private readonly id: string;

    private readonly mcpName: string;
    private readonly mcpVersion: string;

    // 仅限对地点的记忆
    private readonly memory = new Map<string, AgentMemoryFragment>();
    private readonly inventory = new Map<string, AgentInventoryItem>();

    protected constructor(options: AgentOptions) {
        this.id = options.id ?? randomUUID();
        this.repository = options.repository;
        this.mcpName = options.name ?? "abstract-agent";
        this.mcpVersion = options.version ?? "1.0.0";
        this.status = options.initialStatus ?? "idle";

        options.initialMemories?.forEach((fragment) => this.memory.set(fragment.id, fragment));
        options.initialInventory?.forEach((item) => this.inventory.set(item.id, item));
    }

    public getId() {
        return this.id;
    }

    public getStatus() {
        return this.status;
    }

    public setStatus(status: AgentStatus) {
        this.status = status;
    }

    public async connectMcp(transport: TransportLike) {
        if (!this.mcpServer) {
            this.mcpServer = new McpServer({ name: this.mcpName, version: this.mcpVersion });
            await this.registerTools(this.mcpServer);
        }

        if (!this.mcpServer) {
            throw new Error("MCP server failed to initialize");
        }

        await this.mcpServer.connect(transport as any);
    }

    protected abstract registerTools(server: McpServer): Promise<void> | void;

    public remember(
        fragment: Omit<AgentMemoryFragment, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string },
    ) {
        const existing = this.memory.get(fragment.id);
        const now = new Date();
        const record: AgentMemoryFragment = {
            ...existing,
            ...fragment,
            createdAt: existing?.createdAt ?? fragment.createdAt ?? now.toISOString(),
            updatedAt: now.toISOString(),
        };
        this.memory.set(record.id, record);
        return record;
    }

    public forget(memoryId: string) {
        return this.memory.delete(memoryId);
    }

    public listMemories(limit?: number) {
        const all = Array.from(this.memory.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return typeof limit === "number" && limit >= 0 ? all.slice(0, limit) : all;
    }

    public addInventory(
        item: Omit<AgentInventoryItem, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string },
    ) {
        const existing = this.inventory.get(item.id);
        const now = new Date();
        const record: AgentInventoryItem = {
            ...existing,
            ...item,
            quantity: item.quantity ?? existing?.quantity ?? 0,
            createdAt: existing?.createdAt ?? item.createdAt ?? now.toISOString(),
            updatedAt: now.toISOString(),
        };
        this.inventory.set(record.id, record);
        return record;
    }

    public removeInventory(itemId: string) {
        return this.inventory.delete(itemId);
    }

    public listInventory() {
        return Array.from(this.inventory.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    protected applySnapshot(snapshot: AgentSnapshot) {
        this.status = snapshot.status;
        this.memory.clear();
        this.inventory.clear();

        snapshot.memories.forEach((fragment) => {
            this.memory.set(fragment.id, { ...fragment });
        });

        snapshot.inventory.forEach((item) => {
            this.inventory.set(item.id, { ...item });
        });
    }

    public async loadSnapshotFromRepository(): Promise<AgentSnapshot | null> {
        const snapshot = await this.repository.loadAgent(this.id);
        if (!snapshot) {
            return null;
        }
        this.applySnapshot(snapshot);
        await this.onAfterHydrate(snapshot);
        return snapshot;
    }

    public async update(extra?: Record<string, unknown>) {
        const snapshot = this.snapshot(extra);
        await this.repository.updateAgent(snapshot);
        await this.onAfterUpdate(snapshot);
        return snapshot;
    }

    protected snapshot(extra?: Record<string, unknown>): AgentSnapshot {
        const updatedAt = new Date().toISOString();
        return {
            id: this.id,
            status: this.status,
            memories: this.listMemories(),
            inventory: this.listInventory(),
            updatedAt,
            ...(extra ? { extra } : {}),
        };
    }

    protected async onAfterUpdate(_snapshot: AgentSnapshot) {
        // Optional hook for subclasses.
    }

    protected async onAfterHydrate(_snapshot: AgentSnapshot) {
        // Optional hook for subclasses to react after hydration.
    }
}