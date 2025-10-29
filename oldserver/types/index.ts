import type { SerializedMysticalObject } from "./environment.js";
import type { MemorySnapshot } from "./agent.js";

export type StreamEvent =
    | { type: "status"; message: string }
    | { type: "action"; payload: { action: string; args?: Record<string, unknown> } }
    | { type: "step"; payload: { pos?: { x: number; y: number } | null; ok?: boolean; info?: string; hint?: string | null; object?: SerializedMysticalObject | null; memories?: MemorySnapshot[] | null; path?: Array<{ x: number; y: number }>; } }
    | { type: "completion"; payload: { summary?: string; pos?: { x: number; y: number } | null; memories?: MemorySnapshot[] | null } }
    | { type: "error"; message: string };

export * from "./environment.js";
export * from "./agent.js";