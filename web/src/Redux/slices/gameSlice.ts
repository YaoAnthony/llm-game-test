import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Player, Position } from '../api/gameApi';

/**
 * 客户端预测的操作记录
 */
export interface PredictedAction {
    actionId: string;
    type: 'move' | 'interact' | 'teleport';
    data: Position | Record<string, unknown>;
    timestamp: number;
    applied: boolean;  // 是否已应用到本地状态
}

/**
 * 玩家客户端状态（包含预测和和解）
 */
export interface ClientPlayerState {
    // 服务端权威状态
    serverState: Player | null;
    // 客户端预测状态（实际显示的状态）
    predictedState: Player | null;
    // 未确认的操作队列
    pendingActions: PredictedAction[];
    // 最后确认的 actionId
    lastAcknowledgedActionId: string | null;
    // 配置
    enablePrediction: boolean;
    enableReconciliation: boolean;
}

/**
 * 其他玩家状态（用于插值）
 */
export interface OtherPlayerState {
    player: Player;
    previousPosition: Position | null;
    targetPosition: Position;
    interpolationProgress: number; // 0-1
    enableInterpolation: boolean;
}

/**
 * 游戏状态 Slice
 */
interface GameState {
    // 当前玩家（自己）
    localPlayer: ClientPlayerState;
    // 其他玩家
    otherPlayers: Record<string, OtherPlayerState>;
    // 性能统计
    stats: {
        latency: number;  // 网络延迟（ms）
        pendingActionsCount: number;
        reconciliationCount: number;
    };
}

const initialState: GameState = {
    localPlayer: {
        serverState: null,
        predictedState: null,
        pendingActions: [],
        lastAcknowledgedActionId: null,
        enablePrediction: true,
        enableReconciliation: true,
    },
    otherPlayers: {},
    stats: {
        latency: 0,
        pendingActionsCount: 0,
        reconciliationCount: 0,
    },
};

export const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        // ==================== 本地玩家操作 ====================
        
        /**
         * 设置本地玩家
         */
        setLocalPlayer: (state, action: PayloadAction<Player>) => {
            state.localPlayer.serverState = action.payload;
            state.localPlayer.predictedState = action.payload;
        },

        /**
         * 客户端预测：立即应用操作到本地状态
         */
        predictAction: (state, action: PayloadAction<PredictedAction>) => {
            const { localPlayer } = state;
            
            if (!localPlayer.enablePrediction || !localPlayer.predictedState) {
                return;
            }

            // 记录未确认的操作
            localPlayer.pendingActions.push({
                ...action.payload,
                applied: true,
            });

            // 立即应用到预测状态
            applyActionToState(localPlayer.predictedState, action.payload);

            // 更新统计
            state.stats.pendingActionsCount = localPlayer.pendingActions.length;
        },

        /**
         * 服务端状态更新 + 和解
         */
        reconcileServerState: (state, action: PayloadAction<{
            serverState: Player;
            acknowledgedActionId: string;
        }>) => {
            const { serverState, acknowledgedActionId } = action.payload;
            const { localPlayer } = state;

            // 更新服务端状态
            localPlayer.serverState = serverState;
            localPlayer.lastAcknowledgedActionId = acknowledgedActionId;

            if (!localPlayer.enableReconciliation) {
                // 不启用和解，直接使用服务端状态
                localPlayer.predictedState = serverState;
                localPlayer.pendingActions = [];
                return;
            }

            // 1. 找到已确认的操作
            const ackIndex = localPlayer.pendingActions.findIndex(
                a => a.actionId === acknowledgedActionId
            );

            if (ackIndex === -1) {
                // 找不到对应操作，直接使用服务端状态
                localPlayer.predictedState = serverState;
                localPlayer.pendingActions = [];
                return;
            }

            // 2. 移除已确认的操作
            const unacknowledgedActions = localPlayer.pendingActions.slice(ackIndex + 1);
            localPlayer.pendingActions = unacknowledgedActions;

            // 3. 基于服务端状态，重新应用未确认的操作
            localPlayer.predictedState = JSON.parse(JSON.stringify(serverState));
            
            for (const action of unacknowledgedActions) {
                if (localPlayer.predictedState) {
                    applyActionToState(localPlayer.predictedState, action);
                }
            }

            // 4. 更新统计
            state.stats.reconciliationCount += 1;
            state.stats.pendingActionsCount = localPlayer.pendingActions.length;
        },

        /**
         * 清理过期的未确认操作
         */
        cleanupPendingActions: (state) => {
            const now = Date.now();
            const { localPlayer } = state;
            
            localPlayer.pendingActions = localPlayer.pendingActions.filter(
                action => now - action.timestamp < 5000  // 保留 5 秒内的
            );

            state.stats.pendingActionsCount = localPlayer.pendingActions.length;
        },

        /**
         * 切换预测开关
         */
        togglePrediction: (state) => {
            state.localPlayer.enablePrediction = !state.localPlayer.enablePrediction;
        },

        /**
         * 切换和解开关
         */
        toggleReconciliation: (state) => {
            state.localPlayer.enableReconciliation = !state.localPlayer.enableReconciliation;
        },

        // ==================== 其他玩家操作 ====================

        /**
         * 更新其他玩家状态（用于插值）
         */
        updateOtherPlayer: (state, action: PayloadAction<{
            player: Player;
            enableInterpolation?: boolean;
        }>) => {
            const { player, enableInterpolation = true } = action.payload;
            const existing = state.otherPlayers[player.id];

            if (existing) {
                // 已存在，设置目标位置（用于插值）
                state.otherPlayers[player.id] = {
                    player,
                    previousPosition: existing.player.position,
                    targetPosition: player.position,
                    interpolationProgress: 0,
                    enableInterpolation,
                };
            } else {
                // 新玩家，直接设置
                state.otherPlayers[player.id] = {
                    player,
                    previousPosition: null,
                    targetPosition: player.position,
                    interpolationProgress: 1,
                    enableInterpolation,
                };
            }
        },

        /**
         * 更新插值进度（在动画帧中调用）
         */
        updateInterpolationProgress: (state, action: PayloadAction<{
            playerId: string;
            progress: number;  // 0-1
        }>) => {
            const { playerId, progress } = action.payload;
            const playerState = state.otherPlayers[playerId];
            
            if (playerState) {
                playerState.interpolationProgress = Math.min(progress, 1);
                
                // 如果插值完成，更新当前位置
                if (progress >= 1) {
                    playerState.player.position = playerState.targetPosition;
                    playerState.previousPosition = playerState.targetPosition;
                }
            }
        },

        /**
         * 移除其他玩家
         */
        removeOtherPlayer: (state, action: PayloadAction<string>) => {
            delete state.otherPlayers[action.payload];
        },

        /**
         * 切换插值开关
         */
        toggleInterpolation: (state, action: PayloadAction<string>) => {
            const playerState = state.otherPlayers[action.payload];
            if (playerState) {
                playerState.enableInterpolation = !playerState.enableInterpolation;
            }
        },

        // ==================== 统计 ====================

        /**
         * 更新网络延迟
         */
        updateLatency: (state, action: PayloadAction<number>) => {
            state.stats.latency = action.payload;
        },
    },
});

/**
 * 辅助函数：应用操作到玩家状态
 */
function applyActionToState(player: Player, action: PredictedAction): void {
    switch (action.type) {
        case 'move': {
            const data = action.data as Position;
            player.position.x += data.x;
            player.position.y += data.y;
            player.position.z += data.z;
            break;
        }
        case 'teleport': {
            const data = action.data as Position;
            player.position = { ...data };
            break;
        }
        // 可以添加更多操作类型
    }
}

export const {
    setLocalPlayer,
    predictAction,
    reconcileServerState,
    cleanupPendingActions,
    togglePrediction,
    toggleReconciliation,
    updateOtherPlayer,
    updateInterpolationProgress,
    removeOtherPlayer,
    toggleInterpolation,
    updateLatency,
} = gameSlice.actions;

export default gameSlice.reducer;
