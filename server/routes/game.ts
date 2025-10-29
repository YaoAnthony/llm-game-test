import { Router } from "express";
import type Game from "../Game/index.js";

export type GameRouteDeps = {
	game: Game;
};

export function gameRouter({ game }: GameRouteDeps) {
	const router = Router();

	router.get("/world", (_req, res) => {
		try {
			const snapshot = game.getWorldData();
			res.json(snapshot);
		} catch (err) {
			console.error("Failed to produce world snapshot", err);
			res.status(500).json({ message: "Failed to load world snapshot" });
		}
	});

	return router;
}
