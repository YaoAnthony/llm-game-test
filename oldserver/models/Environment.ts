import mongoose, { Schema, Model } from "mongoose";
import { ItemModel } from "./Item.js";

// 玩家库存条目：引用 Item 集合中的物品，并记录数量
const InventoryEntrySchema = new Schema(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: ItemModel.modelName,
      required: true,
    },
    quantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

// 与物体交互时可能产出的结果预览，方便 Agent 了解返回结构
const InteractionResultSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true },
    description: { type: String },
    resultType: { type: String },
    payloadExample: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

// 物体可执行的交互动作，绑定 MCP 函数及潜在结果
const InteractionSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true },
    verb: { type: String },
    description: { type: String },
    requires: { type: [String], default: [] },
    mcpFunctions: { type: [String], default: ["interact"] },
    resultPreviews: { type: [InteractionResultSchema], default: [] },
  },
  { _id: false },
);

export type Cell = { x: number; y: number };

// 地图中的交互对象：包含位置、描述、状态及交互列表
const ObjectSchema = new Schema(
  {
    type: { type: String, required: true },
    name: { type: String, required: true },
    pos: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    interactVerb: { type: String, default: "use" },
    description: { type: String },
    state: { type: Schema.Types.Mixed, default: {} },
    interactions: { type: [InteractionSchema], default: [] },
  },
  { _id: false },
);

// 环境主文档：描述地图边界、障碍物、对象集合与玩家状态
const EnvironmentSchema = new Schema(
  {
    width: { type: Number, required: true, default: 10 },
    height: { type: Number, required: true, default: 8 },
    obstacles: { type: [{ x: Number, y: Number }], default: [] },
    objects: { type: [ObjectSchema], default: [] },
    player: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      inventory: { type: [InventoryEntrySchema], default: [] },
    },
  },
  { timestamps: true }
);

// 导出环境 type 和模型
export type TEnvironment = mongoose.InferSchemaType<typeof EnvironmentSchema>;

export const EnvironmentModel: Model<TEnvironment> =
  mongoose.models.Environment || mongoose.model<TEnvironment>("Environment", EnvironmentSchema);
