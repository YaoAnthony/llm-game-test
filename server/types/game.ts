import type { TimeOfDay } from "./weather.js";

export interface GameTimeSnapshot {
	tick: number;
	timeOfDay: TimeOfDay;
	speedMultiplier: number;
	tickIntervalMs: number;
	lastUpdatedAt: string; // ISO timestamp from Date.toISOString()
}

export interface StartTimeConfig {
	tickIntervalMs?: number;
	speedMultiplier?: number;
}
