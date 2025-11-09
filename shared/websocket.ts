import type { WorldTickState } from "./game";
import type { PlayerSnapshot, Position, PlayerId } from "./player";

export type WebSocketMessageType =
  | "world_update"
  | "player_update"
  | "player_move"
  | "player_join"
  | "player_leave"
  | "time_sync"
  | "system";

export interface WebSocketEnvelope<TType extends WebSocketMessageType, TPayload> {
  type: TType;
  data: TPayload;
  timestamp: number;
}

export interface PlayerMoveBroadcast {
  player: PlayerSnapshot;
  previousPosition: Position;
}

export interface SystemMessagePayload {
  message: string;
  clientId?: PlayerId;
}

export interface TimeSyncPayload {
  tick: number;
  timeOfDay: string;
  weather: string;
  tickIntervalMs: number;
  speedMultiplier: number;
}

export type WebSocketMessage =
  | WebSocketEnvelope<"world_update", WorldTickState>
  | WebSocketEnvelope<"player_update", PlayerSnapshot>
  | WebSocketEnvelope<"player_move", PlayerMoveBroadcast>
  | WebSocketEnvelope<"player_join", PlayerSnapshot>
  | WebSocketEnvelope<"player_leave", { playerId: PlayerId }>
  | WebSocketEnvelope<"time_sync", TimeSyncPayload>
  | WebSocketEnvelope<"system", SystemMessagePayload>;
