/**
 * ⚠️ DEPRECATED - 此文件中的优化功能当前未被使用
 * 
 * 这些是为高级网络优化设计的功能：
 * - 客户端预测 (Client-side Prediction)
 * - 服务端和解 (Server Reconciliation)  
 * - 实体插值 (Entity Interpolation)
 * 
 * 当前项目使用简单的 REST API + WebSocket 广播模式，不需要这些复杂的优化。
 * 如果未来需要实现这些功能，需要：
 * 1. 在 store.ts 中注册 gameSlice reducer
 * 2. 实现服务端的操作确认机制
 * 3. 使用 GameController.tsx 组件替代当前的 Game/index.tsx
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import type { Player, Position } from '../api/gameApi';

/**
 * 占位类型 - 保持接口兼容性
 */
export interface ClientPlayerState {
    enablePrediction: boolean;
    enableReconciliation: boolean;
}

/**
 * ⚠️ STUB - 返回假数据以保持兼容性
 */
export function useClientPrediction(_playerId: string | null) {
    return {
        predictMove: (_delta: Position) => null,
        predictTeleport: (_position: Position) => null,
        handleServerUpdate: (_serverState: Player, _acknowledgedActionId: string, _serverTimestamp: number) => {},
        localPlayer: {
            enablePrediction: false,
            enableReconciliation: false,
        } as ClientPlayerState,
        latency: 0,
    };
}

/**
 * ⚠️ STUB - 返回假数据以保持兼容性
 */
export function useInterpolation() {
    return {
        updatePlayer: (_player: Player, _enableInterpolation?: boolean) => {},
        getInterpolatedPosition: (_playerId: string): Position | null => null,
        otherPlayers: {},
    };
}

/**
 * ⚠️ STUB - 返回假数据以保持兼容性
 */
export function useNetworkStats() {
    return {
        latency: 0,
        pendingActionsCount: 0,
        reconciliationCount: 0,
        enablePrediction: false,
        enableReconciliation: false,
    };
}

/* ==================== 原始实现（已注释） ====================

import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import {
    predictAction,
    reconcileServerState,
    cleanupPendingActions,
    updateOtherPlayer,
    updateInterpolationProgress,
    updateLatency,
    type PredictedAction,
} from '../slices/gameSlice';
import type { Player, Position } from '../api/gameApi';

function generateActionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useClientPrediction(playerId: string | null) {
    const dispatch = useDispatch<AppDispatch>();
    const localPlayer = useSelector((state: RootState) => state.game.localPlayer);
    const latencyRef = useRef<number>(0);

    const predictMove = useCallback((delta: Position) => {
        if (!playerId || !localPlayer.enablePrediction) {
            return null;
        }

        const actionId = generateActionId();
        const action: PredictedAction = {
            actionId,
            type: 'move',
            data: delta,
            timestamp: Date.now(),
            applied: false,
        };

        dispatch(predictAction(action));

        return actionId;
    }, [playerId, localPlayer.enablePrediction, dispatch]);

    const predictTeleport = useCallback((position: Position) => {
        if (!playerId || !localPlayer.enablePrediction) {
            return null;
        }

        const actionId = generateActionId();
        const action: PredictedAction = {
            actionId,
            type: 'teleport',
            data: position,
            timestamp: Date.now(),
            applied: false,
        };

        dispatch(predictAction(action));

        return actionId;
    }, [playerId, localPlayer.enablePrediction, dispatch]);

    const handleServerUpdate = useCallback((
        serverState: Player,
        acknowledgedActionId: string,
        serverTimestamp: number
    ) => {
        const latency = Date.now() - serverTimestamp;
        latencyRef.current = latency;
        dispatch(updateLatency(latency));

        dispatch(reconcileServerState({
            serverState,
            acknowledgedActionId,
        }));
    }, [dispatch]);

    useEffect(() => {
        const interval = setInterval(() => {
            dispatch(cleanupPendingActions());
        }, 1000);

        return () => clearInterval(interval);
    }, [dispatch]);

    return {
        predictMove,
        predictTeleport,
        handleServerUpdate,
        localPlayer,
        latency: latencyRef.current,
    };
}

export function useInterpolation() {
    const dispatch = useDispatch<AppDispatch>();
    const otherPlayers = useSelector((state: RootState) => state.game.otherPlayers);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const lastUpdateTimeRef = useRef<number>(Date.now());

    const updatePlayer = useCallback((player: Player, enableInterpolation = true) => {
        dispatch(updateOtherPlayer({ player, enableInterpolation }));
    }, [dispatch]);

    const getInterpolatedPosition = useCallback((playerId: string): Position | null => {
        const playerState = otherPlayers[playerId];
        if (!playerState || !playerState.enableInterpolation) {
            return playerState?.player.position || null;
        }

        const { previousPosition, targetPosition, interpolationProgress } = playerState;

        if (!previousPosition || interpolationProgress >= 1) {
            return targetPosition;
        }

        return {
            x: lerp(previousPosition.x, targetPosition.x, interpolationProgress),
            y: lerp(previousPosition.y, targetPosition.y, interpolationProgress),
            z: lerp(previousPosition.z, targetPosition.z, interpolationProgress),
        };
    }, [otherPlayers]);

    useEffect(() => {
        const INTERPOLATION_DURATION = 100;

        const animate = () => {
            const now = Date.now();
            const deltaTime = now - lastUpdateTimeRef.current;
            lastUpdateTimeRef.current = now;

            Object.entries(otherPlayers).forEach(([playerId, playerState]) => {
                if (playerState.enableInterpolation && playerState.interpolationProgress < 1) {
                    const progressIncrement = deltaTime / INTERPOLATION_DURATION;
                    const newProgress = Math.min(playerState.interpolationProgress + progressIncrement, 1);
                    
                    dispatch(updateInterpolationProgress({
                        playerId,
                        progress: newProgress,
                    }));
                }
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [otherPlayers, dispatch]);

    return {
        updatePlayer,
        getInterpolatedPosition,
        otherPlayers,
    };
}

export function useNetworkStats() {
    const stats = useSelector((state: RootState) => state.game.stats);
    const localPlayer = useSelector((state: RootState) => state.game.localPlayer);

    return {
        latency: stats.latency,
        pendingActionsCount: stats.pendingActionsCount,
        reconciliationCount: stats.reconciliationCount,
        enablePrediction: localPlayer.enablePrediction,
        enableReconciliation: localPlayer.enableReconciliation,
    };
}

function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

==================== 原始实现结束 ==================== */
