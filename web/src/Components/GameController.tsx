/**
 * ⚠️ DEPRECATED - 此组件未被使用
 * 
 * 这是一个演示性的游戏控制器组件，展示了如何使用：
 * - 客户端预测 (Client-side Prediction)
 * - 服务端和解 (Server Reconciliation)
 * - 实体插值 (Entity Interpolation)
 * 
 * 当前项目使用 Pages/Game/index.tsx 作为主游戏界面。
 * 如果需要启用此组件，需要：
 * 1. 在 store.ts 中注册 gameSlice reducer
 * 2. 取消注释 useGameOptimization.ts 中的实现代码
 * 3. 实现服务端的操作确认和状态同步协议
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setLocalPlayer, togglePrediction, toggleReconciliation, removeOtherPlayer } from '../Redux/slices/gameSlice';
import { useClientPrediction, useInterpolation, useNetworkStats } from '../Redux/hooks/useGameOptimization';
import type { Player, Position } from '../Redux/api/gameApi';
import type { AppDispatch } from '../Redux/store';
import { useWebSocket } from '../Context/WebSocketContext';
import type { WebSocketMessage } from '@shared/websocket';

interface GameControllerProps {
    playerId: string;
    initialPlayer: Player;
}

/**
 * 游戏控制器组件
 * 演示如何使用客户端预测、和解、插值系统
 */
export default function GameController({ playerId, initialPlayer }: GameControllerProps) {
    const dispatch = useDispatch<AppDispatch>();
    
    // 使用自定义 Hooks
    const { predictMove, localPlayer } = useClientPrediction(playerId);
    const { updatePlayer, getInterpolatedPosition, otherPlayers } = useInterpolation();
    const stats = useNetworkStats();

    const { connectionStatus, lastMessage, sendMessage } = useWebSocket();

    useEffect(() => {
        if (connectionStatus === 'connected') {
            dispatch(setLocalPlayer(initialPlayer));
        }
    }, [connectionStatus, dispatch, initialPlayer]);

    /**
     * 处理 WebSocket 消息
     */
    const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
        switch (message.type) {
            case 'world_update': {
                console.log('🌍 World tick update:', message.data);
                break;
            }

            case 'player_update': {
                const player = message.data;
                if (player.id === playerId) {
                    dispatch(setLocalPlayer(player));
                } else {
                    updatePlayer(player, true);
                }
                break;
            }

            case 'player_move': {
                const { player } = message.data;
                if (player.id === playerId) {
                    dispatch(setLocalPlayer(player));
                } else {
                    updatePlayer(player, true);
                }
                break;
            }

            case 'player_join': {
                const player = message.data;
                if (player.id !== playerId) {
                    updatePlayer(player, true);
                }
                break;
            }

            case 'player_leave': {
                const { playerId: leavingId } = message.data;
                dispatch(removeOtherPlayer(leavingId));
                break;
            }

            case 'system': {
                console.log('ℹ️ System message:', message.data);
                break;
            }
        }
    }, [dispatch, playerId, updatePlayer]);

    useEffect(() => {
        if (lastMessage) {
            handleWebSocketMessage(lastMessage);
        }
    }, [lastMessage, handleWebSocketMessage]);

    /**
     * 处理键盘输入（移动）
     */
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (connectionStatus !== 'connected') {
            return;
        }

        const moveSpeed = 1;
        let delta: Position | null = null;

        switch (event.key) {
            case 'w':
            case 'W':
            case 'ArrowUp':
                delta = { x: 0, y: 0, z: -moveSpeed };
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                delta = { x: 0, y: 0, z: moveSpeed };
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                delta = { x: -moveSpeed, y: 0, z: 0 };
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                delta = { x: moveSpeed, y: 0, z: 0 };
                break;
        }

        if (delta) {
            // 1. 客户端预测（立即移动）
            const actionId = predictMove(delta);

            // 2. 发送到服务端
            if (actionId) {
                sendMessage({
                    type: 'player_move_command',
                    playerId,
                    actionId,
                    delta,
                    timestamp: Date.now(),
                    predicted: localPlayer.enablePrediction,
                });
            }
        }
    }, [connectionStatus, sendMessage, playerId, predictMove, localPlayer.enablePrediction]);

    // 监听键盘事件
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    /**
     * 渲染玩家
     */
    const renderPlayers = () => {
        const players: React.ReactElement[] = [];

        // 渲染本地玩家（使用预测状态）
        if (localPlayer.predictedState) {
            const pos = localPlayer.predictedState.position;
            players.push(
                <div
                    key="local"
                    className="player local-player"
                    style={{
                        position: 'absolute',
                        left: `${pos.x * 10}px`,
                        top: `${pos.z * 10}px`,
                        width: '20px',
                        height: '20px',
                        backgroundColor: 'blue',
                        border: '2px solid white',
                        borderRadius: '50%',
                    }}
                    title={`${localPlayer.predictedState.name} (You)`}
                />
            );
        }

        // 渲染其他玩家（使用插值位置）
        const playerStates = Object.values(otherPlayers) as Array<(typeof otherPlayers)[string]>;
        playerStates.forEach((playerState) => {
            const pos = getInterpolatedPosition(playerState.player.id);
            if (pos) {
                players.push(
                    <div
                        key={playerState.player.id}
                        className="player other-player"
                        style={{
                            position: 'absolute',
                            left: `${pos.x * 10}px`,
                            top: `${pos.z * 10}px`,
                            width: '20px',
                            height: '20px',
                            backgroundColor: 'red',
                            borderRadius: '50%',
                        }}
                        title={playerState.player.name}
                    />
                );
            }
        });

        return players;
    };

    return (
        <div className="game-controller">
            {/* 游戏画布 */}
            <div
                className="game-canvas"
                style={{
                    position: 'relative',
                    width: '800px',
                    height: '600px',
                    backgroundColor: '#90EE90',
                    border: '2px solid #333',
                }}
            >
                {renderPlayers()}
            </div>

            {/* 控制面板 */}
            <div className="control-panel" style={{ marginTop: '20px' }}>
                <h3>Network Optimization</h3>
                
                <div>
                    <label>
                        <input
                            type="checkbox"
                            checked={localPlayer.enablePrediction}
                            onChange={() => dispatch(togglePrediction())}
                        />
                        Enable Client Prediction
                    </label>
                </div>

                <div>
                    <label>
                        <input
                            type="checkbox"
                            checked={localPlayer.enableReconciliation}
                            onChange={() => dispatch(toggleReconciliation())}
                        />
                        Enable Server Reconciliation
                    </label>
                </div>

                <div style={{ marginTop: '10px' }}>
                    <h4>Statistics</h4>
                    <p>Latency: {stats.latency}ms</p>
                    <p>Pending Actions: {stats.pendingActionsCount}</p>
                    <p>Reconciliation Count: {stats.reconciliationCount}</p>
                </div>

                <div style={{ marginTop: '10px' }}>
                    <h4>Controls</h4>
                    <p>W/↑: Move Forward</p>
                    <p>S/↓: Move Backward</p>
                    <p>A/←: Move Left</p>
                    <p>D/→: Move Right</p>
                </div>
            </div>
        </div>
    );
}
