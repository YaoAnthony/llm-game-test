import type { AgentInventoryItem, AgentMemoryFragment, AgentRepository, AgentSnapshot } from "../Agent/types/index.js";
import { AgentSnapshotModel } from "../models/AgentSnapshot.js";

function serializeMemory(fragment: AgentMemoryFragment) {
    return {
        id: fragment.id,
        label: fragment.label,
        detail: fragment.detail ?? undefined,
        tags: fragment.tags ?? [],
        position: fragment.position ? { x: fragment.position.x, y: fragment.position.y } : undefined,
        objectType: fragment.objectType ?? undefined,
        createdAt: new Date(fragment.createdAt),
        updatedAt: new Date(fragment.updatedAt),
    };
}

function serializeInventory(item: AgentInventoryItem) {
    return {
        id: item.id,
        label: item.label,
        quantity: item.quantity,
        description: item.description ?? undefined,
        metadata: item.metadata ?? undefined,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
    };
}

function normalizeMetadata(metadata: unknown) {
    if (!metadata) return undefined;
    if (metadata instanceof Map) {
        return Object.fromEntries(metadata.entries());
    }
    return metadata as Record<string, unknown>;
}

export class MongoAgentRepository implements AgentRepository {
    async loadAgent(id: string): Promise<AgentSnapshot | null> {
        const doc = await AgentSnapshotModel.findOne({ id }).lean();
        if (!doc) {
            return null;
        }

        const memories = (doc.memories ?? []).map((fragment) => {
            const record: AgentMemoryFragment = {
                id: fragment.id,
                label: fragment.label,
                createdAt:
                    fragment.createdAt instanceof Date
                        ? fragment.createdAt.toISOString()
                        : new Date(fragment.createdAt).toISOString(),
                updatedAt:
                    fragment.updatedAt instanceof Date
                        ? fragment.updatedAt.toISOString()
                        : new Date(fragment.updatedAt).toISOString(),
            };

            if (fragment.detail) {
                record.detail = fragment.detail;
            }

            if (fragment.tags && fragment.tags.length) {
                record.tags = [...fragment.tags];
            }

            if (
                fragment.position &&
                typeof fragment.position.x === "number" &&
                typeof fragment.position.y === "number"
            ) {
                record.position = { x: fragment.position.x, y: fragment.position.y };
            }

            if (fragment.objectType) {
                record.objectType = fragment.objectType;
            }

            return record;
        });

        const inventory = (doc.inventory ?? []).map((item) => {
            const record: AgentInventoryItem = {
                id: item.id,
                label: item.label,
                quantity: item.quantity,
                createdAt:
                    item.createdAt instanceof Date
                        ? item.createdAt.toISOString()
                        : new Date(item.createdAt).toISOString(),
                updatedAt:
                    item.updatedAt instanceof Date
                        ? item.updatedAt.toISOString()
                        : new Date(item.updatedAt).toISOString(),
            };

            if (item.description) {
                record.description = item.description;
            }

            const metadata = normalizeMetadata(item.metadata);
            if (metadata && Object.keys(metadata).length > 0) {
                record.metadata = metadata;
            }

            return record;
        });

        return {
            id: doc.id,
            status: doc.status,
            memories,
            inventory,
            updatedAt: (doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt)).toISOString(),
            ...(doc.extra ? { extra: normalizeMetadata(doc.extra) } : {}),
        };
    }

    async updateAgent(snapshot: AgentSnapshot): Promise<void> {
        const update = {
            id: snapshot.id,
            status: snapshot.status,
            memories: snapshot.memories.map(serializeMemory),
            inventory: snapshot.inventory.map(serializeInventory),
            updatedAt: new Date(snapshot.updatedAt),
            extra: snapshot.extra ?? {},
        };

        await AgentSnapshotModel.findOneAndUpdate(
            { id: snapshot.id },
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ).exec();
    }
}

export default MongoAgentRepository;
