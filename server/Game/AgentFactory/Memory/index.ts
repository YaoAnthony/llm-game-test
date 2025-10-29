import type { AgentMemoryFragment } from "../types";


export interface MemoryManager {
    upsert(fragment: Omit<AgentMemoryFragment, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }): AgentMemoryFragment;
    remove(id: string): boolean;
    list(limit?: number): AgentMemoryFragment[];
    replaceAll(all: AgentMemoryFragment[]): void;
}


export class InMemoryMemoryManager implements MemoryManager {
    private store = new Map<string, AgentMemoryFragment>();


    upsert(fragment: Omit<AgentMemoryFragment, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }): AgentMemoryFragment {
        const existing = this.store.get(fragment.id);

        const now = new Date();

        const record: AgentMemoryFragment = {
            ...existing,
            ...fragment,
            createdAt: existing?.createdAt ?? fragment.createdAt ?? now.toISOString(),
            updatedAt: now.toISOString(),
        } as AgentMemoryFragment;

        this.store.set(record.id, record);

        return record;
    }


    remove(id: string): boolean { return this.store.delete(id); }


    list(limit?: number): AgentMemoryFragment[] {
    const all = Array.from(this.store.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return typeof limit === "number" && limit >= 0 ? all.slice(0, limit) : all;
    }


    replaceAll(all: AgentMemoryFragment[]): void {
    this.store.clear();
    all.forEach((f) => this.store.set(f.id, { ...f }));
    }
}