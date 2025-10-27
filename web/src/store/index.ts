import { create } from "zustand";

interface GameState {
    x: number;
    y: number;
    setPosition: (x: number, y: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
    x: 0,
    y: 0,
    setPosition: (x, y) => set({ x, y }),
}));
