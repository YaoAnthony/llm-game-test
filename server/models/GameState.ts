import mongoose from "mongoose";

export interface IGameState extends mongoose.Document {
    player: {
        x: number;
        y: number;
    };
}

const GameStateSchema = new mongoose.Schema<IGameState>(
    {
        player: {
        x: { type: Number, required: true, default: 0 },
        y: { type: Number, required: true, default: 0 },
        },
    },
    { collection: "game" } // ✅ 强制写入 game collection
);

export const GameState = mongoose.model<IGameState>("GameState", GameStateSchema);
