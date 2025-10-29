import type { AgentInventoryItem } from "../types";


export interface InventoryManager {
    upsert(item: Omit<AgentInventoryItem, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }): AgentInventoryItem;
    remove(id: string): boolean;
    list(): AgentInventoryItem[];
    replaceAll(all: AgentInventoryItem[]): void;
}


export class InMemoryInventoryManager implements InventoryManager {
    private store = new Map<string, AgentInventoryItem>();


    upsert(item: Omit<AgentInventoryItem, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }): AgentInventoryItem {
        const existing = this.store.get(item.id);
        const now = new Date();
        const record: AgentInventoryItem = {
            ...existing,
            ...item,
            quantity: item.quantity ?? existing?.quantity ?? 0,
            createdAt: existing?.createdAt ?? item.createdAt ?? now.toISOString(),
            updatedAt: now.toISOString(),
        } as AgentInventoryItem;

        this.store.set(record.id, record);
        return record;
    }


    remove(id: string): boolean { return this.store.delete(id); }


    list(): AgentInventoryItem[] {
        return Array.from(this.store.values()).sort((a, b) => a.label.localeCompare(b.label));
    }


    replaceAll(all: AgentInventoryItem[]): void {
        this.store.clear();
        all.forEach((i) => this.store.set(i.id, { ...i }));
    }
}