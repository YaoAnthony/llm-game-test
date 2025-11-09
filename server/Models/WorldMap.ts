import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
import type { InferSchemaType, Model } from "mongoose";

/**
 * 瓦片状态 Schema
 * 存储瓦片的动态数据
 */
const TileStateSchema = new Schema({
    tilled: { type: Boolean },
    crop: { type: String },
    growthStage: { type: Number },
    watered: { type: Boolean },
    durability: { type: Number },
    lastInteractedAt: { type: Date },
}, { _id: false });

/**
 * 瓦片 Schema
 */
const TileSchema = new Schema({
    type: { type: String, required: true },
    state: { type: TileStateSchema },
    metadata: { type: Schema.Types.Mixed },
}, { _id: false });

/**
 * 世界地图 Schema
 * 用于持久化存储地形数据
 */
const WorldMapSchema = new Schema({
    // 世界 ID
    worldId: { type: String, required: true, unique: true },
    
    // 地图尺寸
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    
    // 瓦片数据（压缩存储）
    // 使用 JSON 字符串存储,减少数据库体积
    tilesData: { type: String, required: true },
    
    // 地图元数据
    metadata: {
        name: { type: String, required: true },
        seed: { type: Number },
    },
    
    // 脏数据标记：记录哪些区块被修改
    dirtyChunks: [{ 
        x: { type: Number },
        y: { type: Number }
    }],
    
    // 最后保存时间
    lastSavedAt: { type: Date, required: true },
}, { 
    timestamps: true // 自动添加 createdAt 和 updatedAt
});

// unique: true 已经创建了索引，不需要重复声明

export type WorldMapDocument = InferSchemaType<typeof WorldMapSchema>;

/**
 * 导出世界地图模型
 */
export const WorldMapModel: Model<WorldMapDocument> = (models.WorldMap as Model<WorldMapDocument> | undefined)
    ?? model<WorldMapDocument>("WorldMap", WorldMapSchema);
