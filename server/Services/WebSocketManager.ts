/**
 * WebSocket 管理器
 * 
 * 功能：
 * 1. 管理所有客户端 WebSocket 连接
 * 2. 广播游戏状态更新到所有连接的客户端
 * 3. 处理客户端消息（可选）
 * 4. 支持订阅特定事件类型
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { WebSocketMessage, PlayerMoveBroadcast } from '../../shared/websocket.js';
import type { WorldTickState } from '../../shared/game.js';
import type { PlayerSnapshot, PlayerId } from '../../shared/player.js';

/**
 * 客户端连接信息
 */
interface ClientConnection {
    ws: WebSocket;
    id: string;
    connectedAt: number;
    playerId?: string; // 可选：关联的玩家 ID
}

export class WebSocketManager {
    private wss: WebSocketServer;
    private clients: Map<string, ClientConnection> = new Map();
    private nextClientId: number = 1;

    constructor(server: Server) {
        // 创建 WebSocket 服务器，附加到现有的 HTTP 服务器
        this.wss = new WebSocketServer({ 
            server,
            path: '/ws' // WebSocket 路径: ws://localhost:4000/ws
        });

        this.setupWebSocketServer();
        console.log('🔌 WebSocket server initialized on path: /ws');
    }

    /**
     * 设置 WebSocket 服务器事件监听
     */
    private setupWebSocketServer(): void {
        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = `client_${this.nextClientId++}`;
            const connection: ClientConnection = {
                ws,
                id: clientId,
                connectedAt: Date.now(),
            };

            // 保存连接
            this.clients.set(clientId, connection);
            console.log(`✅ Client connected: ${clientId} (Total: ${this.clients.size})`);

            // 发送欢迎消息
            this.sendToClient(clientId, {
                type: 'system',
                data: { message: 'Connected to game server', clientId },
                timestamp: Date.now(),
            });

            // 监听客户端消息
            ws.on('message', (message: Buffer) => {
                this.handleClientMessage(clientId, message);
            });

            // 监听连接关闭
            ws.on('close', (code, reason) => {
                this.clients.delete(clientId);
                console.log(`❌ Client disconnected: ${clientId} (Total: ${this.clients.size})`);
                console.log(`   Close code: ${code}, reason: ${reason.toString() || 'No reason provided'}`);
            });

            // 监听错误
            ws.on('error', (error) => {
                console.error(`⚠️ WebSocket error for client ${clientId}:`, error.message);
                console.error(`   Stack:`, error.stack);
                this.clients.delete(clientId);
            });

            // 心跳检测：每 30 秒 ping 一次
            const pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                } else {
                    clearInterval(pingInterval);
                }
            }, 30000);

            ws.on('close', () => clearInterval(pingInterval));
        });
    }

    /**
     * 处理客户端发送的消息
     */
    private handleClientMessage(clientId: string, message: Buffer): void {
        try {
            const data = JSON.parse(message.toString());
            console.log(`📨 Message from ${clientId}:`, data);

            // 这里可以添加客户端消息处理逻辑
            // 例如：客户端请求特定玩家的数据
            if (data.type === 'subscribe_player') {
                const connection = this.clients.get(clientId);
                if (connection) {
                    connection.playerId = data.playerId;
                    console.log(`🔔 Client ${clientId} subscribed to player ${data.playerId}`);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to parse message from ${clientId}:`, error);
        }
    }

    /**
     * 发送消息给特定客户端
     */
    private sendToClient(clientId: string, message: WebSocketMessage): void {
        const connection = this.clients.get(clientId);
        if (connection && connection.ws.readyState === WebSocket.OPEN) {
            try {
                connection.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error(`❌ Failed to send message to ${clientId}:`, error);
            }
        }
    }

    /**
     * 广播消息给所有连接的客户端
     */
    public broadcast(message: WebSocketMessage): void {
        const messageStr = JSON.stringify(message);
        let sentCount = 0;
        let failedCount = 0;

        console.log(`📡 [BROADCAST] Starting broadcast of type '${message.type}' to ${this.clients.size} clients`);

        this.clients.forEach((connection, clientId) => {
            if (connection.ws.readyState === WebSocket.OPEN) {
                try {
                    connection.ws.send(messageStr);
                    sentCount++;
                } catch (error) {
                    failedCount++;
                    console.error(`❌ [BROADCAST] Failed to send to ${clientId}:`, (error as Error).message);
                }
            } else {
                console.warn(`⚠️ [BROADCAST] Client ${clientId} is not ready (state: ${connection.ws.readyState})`);
            }
        });

        // 只记录非 world_update 的广播（减少日志刷屏）
        if (message.type !== 'world_update') {
            console.log(`📡 [BROADCAST] Completed: ${sentCount} sent, ${failedCount} failed (type: ${message.type})`);
        }
    }

    /**
     * 广播世界状态更新
     */
    public broadcastWorldUpdate(worldState: WorldTickState): void {
        this.broadcast({
            type: 'world_update',
            data: worldState,
            timestamp: Date.now(),
        });
    }

    /**
     * 广播玩家移动事件
     */
    public broadcastPlayerMove(payload: PlayerMoveBroadcast): void {
        this.broadcast({
            type: 'player_move',
            data: payload,
            timestamp: Date.now(),
        });
    }

    /**
     * 广播玩家加入事件
     */
    public broadcastPlayerJoin(player: PlayerSnapshot): void {
        this.broadcast({
            type: 'player_join',
            data: player,
            timestamp: Date.now(),
        });
    }

    /**
     * 广播玩家离开事件
     */
    public broadcastPlayerLeave(playerId: PlayerId): void {
        this.broadcast({
            type: 'player_leave',
            data: { playerId },
            timestamp: Date.now(),
        });
    }

    /**
     * 获取当前连接数
     */
    public getConnectionCount(): number {
        return this.clients.size;
    }

    /**
     * 关闭所有连接
     */
    public closeAll(): void {
        console.log('🔌 Closing all WebSocket connections...');
        this.clients.forEach((connection) => {
            connection.ws.close();
        });
        this.clients.clear();
        this.wss.close();
    }
}
