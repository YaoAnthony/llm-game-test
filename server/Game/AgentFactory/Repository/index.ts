import type { AgentSnapshot } from "../types";


export interface AgentRepository {
    loadAgent(id: string): Promise<AgentSnapshot | null>;
    updateAgent(snapshot: AgentSnapshot): Promise<void>;
}