export type AgentStatus =
  | "idle"
  | "moving"
  | "mining"
  | "building"
  | "fighting"
  | "thinking"
  | "offline"
  | "error";

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface PlayerAttributes {
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  experience: number;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  position: Position;
  status: AgentStatus;
  attributes: PlayerAttributes;
  joinedAt: string;
  lastActiveAt: string;
}

export interface CreatePlayerParams {
  name: string;
  spawnPosition?: Position;
}

export interface MovePlayerDelta {
  x?: number;
  y?: number;
  z?: number;
}

export type PlayerId = string;
