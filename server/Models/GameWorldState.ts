import mongoose from "mongoose";
const { Schema, model, models } = mongoose;
import type { InferSchemaType, Model } from "mongoose";

/**
 * 代表一次“世界时间”快照，就像《我的世界》服务端保存好的一帧游戏时间。
 * 每个字段都描述了服务器世界钟的状态。
 */
const TimeSnapshotSchema = new Schema({
    // 当前世界 tick，相当于 Minecraft 里的 Game Tick 计数器。
    tick: { type: Number, required: true },
    // 世界所处的时间段（dawn/day/dusk/night），类似 MC 中的日夜阶段。
    timeOfDay: { type: String, required: true },
    // 时间流速倍率，可理解为指令 /gamerule randomTickSpeed 之类的效果。
    speedMultiplier: { type: Number, required: true },
    // 每个 tick 需要的真实毫秒数，例如 1000 表示现实 1 秒推进 1 tick。
    tickIntervalMs: { type: Number, required: true },
    // 最近一次写入世界钟数据的真实时间戳。
    lastUpdatedAt: { type: Date, required: true },
}, { _id: false });

/**
 * Mongo 里的世界存档文档，类似 Minecraft 的 level.dat：
 * - worldId 对应某个世界（如不同服务器或存档槽位）。
 * - time 里保存世界钟的核心状态。
 * - environment 预留用于未来扩展（地形、天气种子等）。
 */
const GameWorldStateSchema = new Schema({
    worldId: { type: String, required: true, unique: true },
    time: { type: TimeSnapshotSchema, required: true },
    environment: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export type GameWorldStateDocument = InferSchemaType<typeof GameWorldStateSchema>;

// 导出模型，允许在任何地方像访问“世界存档”一样去读写时间信息。
export const GameWorldStateModel: Model<GameWorldStateDocument> = (models.GameWorldState as Model<GameWorldStateDocument> | undefined)
    ?? model<GameWorldStateDocument>("GameWorldState", GameWorldStateSchema);
