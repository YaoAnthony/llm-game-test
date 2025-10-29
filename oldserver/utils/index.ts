import { GameState } from "../models/GameState.js";

// ===== 抽出的共享逻辑 =====
async function ensureState() {
  let state = await GameState.findOne();
  if (!state) {
    state = new GameState({ player: { x: 0, y: 0 } });
    await state.save();
  }
  if (!state.player) state.player = { x: 0, y: 0 };
  return state;
}

async function getStateService() {
  const state = await ensureState();
  return { x: state.player.x ?? 0, y: state.player.y ?? 0 };
}

async function moveService(dx: number, dy: number) {
  const state = await ensureState();
  state.player.x = (state.player.x ?? 0) + dx;
  state.player.y = (state.player.y ?? 0) + dy;
  await state.save();
  return { x: state.player.x ?? 0, y: state.player.y ?? 0 };
}


export { 
    getStateService, 
    moveService,
    ensureState
};