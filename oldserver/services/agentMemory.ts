import crypto from "crypto";
import type { SerializedMysticalObject } from "../types/environment.js";
import type { MemorySnapshot } from "../types/agent.js";

export class MemoryFragment {
    readonly id: string;
    label: string;
    detail: string;
    position?: { x: number; y: number } | undefined;
    objectType?: string | undefined;
    createdAt: Date;
    updatedAt: Date;

    constructor(init: Omit<MemorySnapshot, "createdAt" | "updatedAt" | "id"> & { createdAt?: string; updatedAt?: string; id?: string }) {
        this.id = init.id ?? crypto.randomUUID();
        this.label = init.label;
        this.detail = init.detail;
        this.position = init.position;
        this.objectType = init.objectType;
        this.createdAt = init.createdAt ? new Date(init.createdAt) : new Date();
        this.updatedAt = init.updatedAt ? new Date(init.updatedAt) : new Date();
    }

    touch(detail?: string) {
        if (detail) {
            this.detail = detail;
        }
        this.updatedAt = new Date();
    }

    toSnapshot(): MemorySnapshot {
        return {
            id: this.id,
            label: this.label,
            detail: this.detail,
            position: this.position,
            objectType: this.objectType,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
        };
    }
}

const MAX_MEMORY = 32;

export class AgentMemory {
    private fragments: MemoryFragment[] = [];

    list(limit = MAX_MEMORY): MemorySnapshot[] {
        return this.fragments
        .slice(-limit)
        .map((fragment) => fragment.toSnapshot());
    }

    summarize(limit = 10): string {
        const items = this.list(limit);
        if (!items.length) {
            return "(no stored memories)";
        }
            return items
            .map((m) => `${m.label}: ${m.detail}${m.position ? ` @ (${m.position.x},${m.position.y})` : ""}`)
            .join("\n");
    }

    private upsert(fragment: MemoryFragment) {
        this.fragments = this.fragments.filter((f) => f.id !== fragment.id);
        this.fragments.push(fragment);
        if (this.fragments.length > MAX_MEMORY) {
            this.fragments = this.fragments.slice(-MAX_MEMORY);
        }
    }

    rememberObject(object: SerializedMysticalObject, position: { x: number; y: number }) {
        const label = object.name ?? object.type;
        const baseDetail = `${object.type}${object.description ? ` · ${object.description}` : ""}`;
        const detail = object.state
            ? `${baseDetail} · 状态=${JSON.stringify(object.state)}`
            : baseDetail;
        const existing = this.fragments.find(
            (f) => f.objectType === object.type && f.position?.x === position.x && f.position?.y === position.y
            );
        if (existing) {
            existing.touch(detail);
            this.upsert(existing);
            return existing;
        }
        const fragment = new MemoryFragment({
            label,
            detail,
            position,
            objectType: object.type,
        });
        this.upsert(fragment);
        return fragment;
    }

    rememberFact(label: string, detail: string) {
        const fragment = new MemoryFragment({ label, detail });
        this.upsert(fragment);
        return fragment;
    }

    clear() {
        this.fragments = [];
    }
}

export const agentMemory = new AgentMemory();
