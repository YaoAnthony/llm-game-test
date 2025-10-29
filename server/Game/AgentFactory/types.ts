
// ****** Agent ******
export type Agent = {
    
}
export type AgentStatus = "idle" | "moving" | "thinking" | "error";


export type AgentMemoryFragment = {
    id: string;
    content: string;
    type: "observation" | "dialogue" | "reflection";
    relatedObject?: string;
    createdAt: string; // ISO
    updatedAt: string; // ISO
};


export type AgentInventoryItem = {
    id: string;
    label: string;
    quantity: number;
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


export type AgentOptions = {
    id: string;
    repository: any; // AgentRepository
    initialStatus?: AgentStatus;
    initialMemories?: AgentMemoryFragment[];
    initialInventory?: AgentInventoryItem[];
};

// ****** Inventory Item ******



// ****** Memory ******



// ****** Agent Options ******



// ****** Other ******
export interface AgentRepository {
    loadAgent(id: string): Promise<AgentSnapshot | null>;
    updateAgent(snapshot: AgentSnapshot): Promise<void>;
}