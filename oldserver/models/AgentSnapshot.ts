import mongoose, { Schema, type Document, type Model } from "mongoose";

export type AgentMemoryDoc = {
    id: string;
    label: string;
    detail?: string;
    tags?: string[];
    position?: { x: number; y: number };
    objectType?: string;
    createdAt: Date;
    updatedAt: Date;
};

export type AgentInventoryDoc = {
    id: string;
    label: string;
    quantity: number;
    description?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
};

export interface AgentSnapshotDocument extends Document {
    id: string;
    status: "idle" | "active" | "paused" | "error";
    memories: AgentMemoryDoc[];
    inventory: AgentInventoryDoc[];
    updatedAt: Date;
    extra?: Record<string, unknown>;
    createdAt: Date;
}

const AgentMemorySchema = new Schema<AgentMemoryDoc>(
    {
        id: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        detail: { type: String },
        tags: { type: [String], default: [] },
        position: {
            x: { type: Number },
            y: { type: Number },
        },
        objectType: { type: String },
        createdAt: { type: Date, required: true, default: Date.now },
        updatedAt: { type: Date, required: true, default: Date.now },
    },
    { _id: false },
);

const AgentInventorySchema = new Schema<AgentInventoryDoc>(
    {
        id: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 0, default: 0 },
        description: { type: String },
        metadata: { type: Schema.Types.Mixed },
        createdAt: { type: Date, required: true, default: Date.now },
        updatedAt: { type: Date, required: true, default: Date.now },
    },
    { _id: false },
);

const AgentSnapshotSchema = new Schema<AgentSnapshotDocument>(
    {
        id: { type: String, required: true, unique: true, index: true, trim: true },
        status: { type: String, enum: ["idle", "active", "paused", "error"], default: "idle" },
        memories: { type: [AgentMemorySchema], default: [] },
        inventory: { type: [AgentInventorySchema], default: [] },
        updatedAt: { type: Date, required: true, default: Date.now },
        extra: { type: Schema.Types.Mixed, default: {} },
    },
    {
        collection: "agent_snapshots",
        timestamps: { createdAt: true, updatedAt: false },
    },
);

export const AgentSnapshotModel: Model<AgentSnapshotDocument> =
    mongoose.models.AgentSnapshot || mongoose.model<AgentSnapshotDocument>("AgentSnapshot", AgentSnapshotSchema);
