import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
import type { InferSchemaType, Model } from "mongoose";

/**
 * 玩家位置 Schema
 */
const PositionSchema = new Schema({
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true },
}, { _id: false });

/**
 * 玩家属性 Schema
 */
const PlayerAttributesSchema = new Schema({
    name: { type: String, required: true },
    level: { type: Number, required: true, default: 1 },
    health: { type: Number, required: true, default: 100 },
    maxHealth: { type: Number, required: true, default: 100 },
    experience: { type: Number, required: true, default: 0 },
}, { _id: false });

/**
 * 玩家数据 Schema
 * 用于持久化存储玩家信息到 MongoDB
 */
const PlayerSchema = new Schema({
    // 玩家唯一 ID
    playerId: { type: String, required: true, unique: true },
    // 所属世界 ID
    worldId: { type: String, required: true },
    // 玩家名称
    name: { type: String, required: true },
    // 当前位置
    position: { type: PositionSchema, required: true },
    // 玩家状态（idle/moving/mining/building/fighting/offline）
    status: { type: String, required: true, default: "idle" },
    // 玩家属性
    attributes: { type: PlayerAttributesSchema, required: true },
    // 加入时间
    joinedAt: { type: Date, required: true },
    // 最后活跃时间
    lastActiveAt: { type: Date, required: true },
}, { 
    timestamps: true // 自动添加 createdAt 和 updatedAt
});

// 复合索引：按世界ID查询玩家（会自动创建 worldId 的索引）
PlayerSchema.index({ worldId: 1, playerId: 1 });

export type PlayerDocument = InferSchemaType<typeof PlayerSchema>;

/**
 * 导出玩家模型
 */
export const PlayerModel: Model<PlayerDocument> = (models.Player as Model<PlayerDocument> | undefined)
    ?? model<PlayerDocument>("Player", PlayerSchema);
