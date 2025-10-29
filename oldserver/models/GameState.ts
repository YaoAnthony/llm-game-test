import mongoose, { Schema, type Document, type Model } from "mongoose";
import { ItemModel } from "./Item.js";

export interface GameStateDocument extends Document {
    player: {
        x: number;
        y: number;
        inventory: Array<{ item: mongoose.Types.ObjectId; quantity: number }>;
    };
    createdAt?: Date;
    updatedAt?: Date;
}

const InventoryEntrySchema = new Schema(
    {
        item: { type: Schema.Types.ObjectId, ref: ItemModel.modelName, required: true },
        quantity: { type: Number, required: true, min: 0, default: 0 },
    },
    { _id: false },
);

const GameStateSchema = new Schema<GameStateDocument>(
    {
        player: {
            x: { 
                type: Number, 
                required: true, 
                default: 0 
            },
            y: { 
                type: Number, 
                required: true, 
                default: 0 
            },
            inventory: { type: [InventoryEntrySchema], default: [] },
        },
    },
    { collection: "game", timestamps: true },
);

export const GameState: Model<GameStateDocument> =
    mongoose.models.GameState || mongoose.model<GameStateDocument>("GameState", GameStateSchema);
