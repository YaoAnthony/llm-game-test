export type AgentStatus = "idle" | "active" | "paused" | "error";

export type AgentMemoryFragment = {
	id: string;
	label: string;
	detail?: string;
	tags?: string[];
	position?: { x: number; y: number };
	objectType?: string;
	createdAt: string;
	updatedAt: string;
};

export type AgentInventoryItem = {
	id: string;
	label: string;
	quantity: number;
	description?: string;
	metadata?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
};

export type AgentSnapshot = {
	id: string;
	status: AgentStatus;
	memories: AgentMemoryFragment[];
	inventory: AgentInventoryItem[];
	updatedAt: string;
	extra?: Record<string, unknown>;
};

export interface AgentRepository {
	loadAgent(id: string): Promise<AgentSnapshot | null>;
	updateAgent(snapshot: AgentSnapshot): Promise<void>;
}

export type AgentOptions = {
	id?: string;
	name?: string;
	version?: string;
	repository: AgentRepository;
	initialStatus?: AgentStatus;
	initialMemories?: AgentMemoryFragment[];
	initialInventory?: AgentInventoryItem[];
};
