/**
 * WebSocket Context
 * 
 * 功能：
 * 1. 管理与服务器的 WebSocket 连接
 * 2. 接收服务器推送的实时数据（世界状态、玩家移动等）
 * 3. 将接收到的数据分发到 Redux store
 * 4. 自动重连机制
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WebSocketMessage } from '@shared/websocket';

/**
 * WebSocket Context 值类型
 */
interface WebSocketContextValue {
    isConnected: boolean;
    connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
    lastMessage: WebSocketMessage | null;
    sendMessage: (message: Record<string, unknown>) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

/**
 * WebSocket Provider Props
 */
interface WebSocketProviderProps {
    children: ReactNode;
    url?: string; // WebSocket 服务器地址，默认 ws://localhost:4000/ws
}

/**
 * WebSocket Provider 组件
 */
export const WebSocketProvider = ({ children, url = 'ws://localhost:4000/ws' }: WebSocketProviderProps) => {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const reconnectAttemptsRef = useRef(0);
    
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<WebSocketContextValue['connectionStatus']>('disconnected');
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

    const MAX_RECONNECT_ATTEMPTS = 10;
    const RECONNECT_DELAY = 3000; // 3 秒

    /**
     * 连接 WebSocket 服务器
     */
    const connect = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('🔌 WebSocket already connected');
            return;
        }

        console.log('🔌 Connecting to WebSocket server:', url);
        setConnectionStatus('connecting');

        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            // 连接成功
            ws.onopen = () => {
                console.log('✅ [WS] WebSocket connected successfully');
                console.log('✅ [WS] ReadyState:', ws.readyState);
                setIsConnected(true);
                setConnectionStatus('connected');
                reconnectAttemptsRef.current = 0;
            };

            // 接收消息
            ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    
                    // 只记录非 world_update 的消息（减少刷屏）
                    if (message.type !== 'world_update') {
                        console.log('📨 [WS] Message received:', message.type, message.data);
                    }
                    
                    setLastMessage(message);
                    handleMessage(message);
                } catch (error) {
                    console.error('❌ [WS] Failed to parse message:', error);
                }
            };

            // 连接关闭
            ws.onclose = (event) => {
                console.log('🔌 [WS] Connection closed');
                console.log('🔌 [WS] Close code:', event.code);
                console.log('🔌 [WS] Close reason:', event.reason || 'No reason provided');
                console.log('🔌 [WS] Clean close:', event.wasClean);
                
                setIsConnected(false);
                setConnectionStatus('disconnected');
                
                // 如果是正常关闭（1000）或组件卸载，不重连
                if (event.code === 1000 || !wsRef.current) {
                    console.log('🔌 [WS] Normal close, not reconnecting');
                    wsRef.current = null;
                    return;
                }
                
                wsRef.current = null;

                // 尝试重连
                if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttemptsRef.current++;
                    console.log(`🔄 [WS] Reconnecting... (Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
                    
                    reconnectTimeoutRef.current = window.setTimeout(() => {
                        connect();
                    }, RECONNECT_DELAY);
                } else {
                    console.error('❌ [WS] Max reconnect attempts reached');
                    setConnectionStatus('error');
                }
            };

            // 连接错误
            ws.onerror = (error) => {
                console.error('❌ [WS] WebSocket error:', error);
                console.error('❌ [WS] Current readyState:', ws.readyState);
                setConnectionStatus('error');
            };

        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
            setConnectionStatus('error');
        }
    };

    /**
     * 处理接收到的消息
     */
    const handleMessage = (message: WebSocketMessage) => {
        switch (message.type) {
            case 'world_update':
                // 世界状态更新 - 在组件中自行处理
                console.log('🌍 World update received:', message.data);
                break;

            case 'player_move':
                // 玩家移动事件
                console.log('🏃 Player moved:', message.data.player.id, message.data.player.position);
                // TODO: 更新玩家位置到 Redux
                break;

            case 'player_join':
                // 玩家加入事件
                console.log('👋 Player joined:', message.data);
                // TODO: 添加玩家到 Redux
                break;

            case 'player_leave':
                // 玩家离开事件
                console.log('👋 Player left:', message.data.playerId);
                // TODO: 从 Redux 移除玩家
                break;

            case 'system':
                console.log('ℹ️ System message:', message.data);
                break;

            default:
                console.log('📨 Unknown message type:', message.type);
        }
    };

    /**
     * 发送消息到服务器
     */
    const sendMessage = (message: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
            console.log('📤 Sent WebSocket message:', message);
        } else {
            console.warn('⚠️ WebSocket not connected, cannot send message');
        }
    };

    /**
     * 组件挂载时连接 WebSocket
     */
    useEffect(() => {
        // 防止重复连接
        if (wsRef.current?.readyState === WebSocket.OPEN || 
            wsRef.current?.readyState === WebSocket.CONNECTING) {
            console.log('🔌 WebSocket already exists, skipping connection');
            return;
        }

        connect();

        // 组件卸载时清理连接
        return () => {
            console.log('🧹 Cleaning up WebSocket connection');
            
            // 清理重连定时器
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            
            // 关闭 WebSocket 连接
            if (wsRef.current) {
                // 先设置为 null 避免 onclose 触发重连
                const ws = wsRef.current;
                wsRef.current = null;
                
                // 关闭连接
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close(1000, 'Component unmounting'); // 正常关闭
                }
            }
            
            // 重置状态
            setIsConnected(false);
            setConnectionStatus('disconnected');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 只在组件挂载时连接一次

    const contextValue: WebSocketContextValue = {
        isConnected,
        connectionStatus,
        lastMessage,
        sendMessage,
    };

    return (
        <WebSocketContext.Provider value={contextValue}>
            {children}
        </WebSocketContext.Provider>
    );
};

/**
 * 使用 WebSocket Context 的 Hook
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useWebSocket = (): WebSocketContextValue => {
    const context = useContext(WebSocketContext);
    
    if (!context) {
        throw new Error('useWebSocket must be used within WebSocketProvider');
    }
    
    return context;
};
