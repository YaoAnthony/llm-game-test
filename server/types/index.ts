export type StreamEvent =
    | { type: "status"; message: string }
    | { type: "action"; payload: { action: string; args?: Record<string, unknown> } }
    | { type: "step"; payload: { pos?: { x: number; y: number } | null; ok?: boolean; info?: string; hint?: string | null } }
    | { type: "completion"; payload: { summary?: string; pos?: { x: number; y: number } | null } }
    | { type: "error"; message: string };