export type WeatherType = "clear" | "rain" | "storm" | "snow" | "fog" | string;

export type TimeOfDay = "dawn" | "day" | "dusk" | "night" | string;

// ✅ 地图数据结构（使用 terrain.ts 中的 Tile）
export interface WorldMapData {
  width: number;
  height: number;
  tiles: import('./terrain').Tile[][];
  metadata?: {
    name?: string;
    createdAt?: Date;
    seed?: number;
  };
}

export interface GameWorldTime {
  tick: number;
  timeOfDay: TimeOfDay;
  speedMultiplier: number;
  tickIntervalMs: number;
  isRunning: boolean;
}

export interface GameWorldWeather {
  current: WeatherType;
  description: string;
}

export interface GameWorldMeta {
  autoSaveIntervalMs: number;
}

export interface GameWorldSnapshot {
  worldId: string;
  time: GameWorldTime;
  weather: GameWorldWeather;
  map?: WorldMapData; // ✅ 添加地图数据
  meta: GameWorldMeta;
}

export interface WorldTickState {
  tick: number;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
}
