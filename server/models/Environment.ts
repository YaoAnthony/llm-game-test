import mongoose, { Schema, Model } from "mongoose";

export type Cell = { x: number; y: number };

const ObjectSchema = new Schema(
  {
    type: { type: String, required: true },
    name: { type: String, required: true },
    pos: { x: { type: Number, required: true }, y: { type: Number, required: true } },
    interactVerb: { type: String, default: "use" },
  },
  { _id: false }
);

const EnvironmentSchema = new Schema(
  {
    width: { type: Number, required: true, default: 10 },
    height: { type: Number, required: true, default: 8 },
    obstacles: { type: [{ x: Number, y: Number }], default: [] },
    objects: { type: [ObjectSchema], default: [] },
    player: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
  },
  { timestamps: true }
);

export type TEnvironment = mongoose.InferSchemaType<typeof EnvironmentSchema>;

// ✅ 用更明确的变量名，避免与 DOM 冲突
export const EnvironmentModel: Model<TEnvironment> =
  mongoose.models.Environment || mongoose.model<TEnvironment>("Environment", EnvironmentSchema);
