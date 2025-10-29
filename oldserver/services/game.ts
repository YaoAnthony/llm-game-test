// server/services/game.ts
import { ensureEnvDoc, moveWithCollision } from "./env.js";

export async function getStateService() {
  const envDoc = await ensureEnvDoc();
  const player = envDoc.player ?? { x: 0, y: 0 };
  return { x: player.x ?? 0, y: player.y ?? 0 };
}

export async function moveService(dx: number, dy: number) {
  const result = await moveWithCollision(dx, dy);
  if (!result.ok || !result.pos) {
    const error: Error & { result?: typeof result } = new Error(result.reason ?? "Move blocked");
    error.result = result;
    throw error;
  }
  return { x: result.pos.x, y: result.pos.y };
}
