import { Router } from "express";
import type Game from "../Game/index.js";
import type { WebSocketManager } from "../Services/WebSocketManager.js";
import type { CreatePlayerParams, MovePlayerParams } from "../types/agent.js";
import { validatePlayerName, validatePosition } from "../utils/validation.js";

export type AgentRouteDeps = {
    game: Game;
    wsManager: WebSocketManager;
};

export function agentRouter({ game, wsManager }: AgentRouteDeps) {
    const router = Router();

    /**
     * 获取所有在线玩家列表
     * GET /api/players
     */
    router.get("/", (_req, res) => {
        try {
            const players = game.getAllPlayers();
            res.json({
                success: true,
                count: players.length,
                players,
            });
        } catch (err) {
            console.error("Failed to get players list", err);
            res.status(500).json({ 
                success: false, 
                message: "Failed to retrieve players list" 
            });
        }
    });

    /**
     * 创建新玩家
     * POST /api/players
     * Body: { name: string, spawnPosition?: { x, y, z } }
     */
    router.post("/", async (req, res) => {
        try {
            const params: CreatePlayerParams = req.body;

            // 验证玩家名称
            const nameValidation = validatePlayerName(params.name);
            if (!nameValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: nameValidation.error,
                });
            }

            // 验证出生点坐标（如果提供）
            if (params.spawnPosition) {
                const { x, y, z } = params.spawnPosition;
                const posValidation = validatePosition(x, y, z);
                if (!posValidation.valid) {
                    return res.status(400).json({
                        success: false,
                        message: posValidation.error,
                    });
                }
            }

            const player = await game.createPlayer(params);
            res.status(201).json({
                success: true,
                message: `Player "${player.name}" created successfully`,
                player,
            });
        } catch (err: any) {
            console.error("Failed to create player", err);
            res.status(400).json({
                success: false,
                message: err.message || "Failed to create player",
            });
        }
    });

    /**
     * 获取指定玩家信息
     * GET /api/players/:playerId
     */
    router.get("/:playerId", async (req, res) => {
        try {
            const { playerId } = req.params;
            const player = await game.getPlayer(playerId);

            if (!player) {
                return res.status(404).json({
                    success: false,
                    message: "Player not found",
                });
            }

            res.json({
                success: true,
                player,
            });
        } catch (err) {
            console.error("Failed to get player", err);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve player information",
            });
        }
    });

    /**
     * 移除玩家（玩家离开游戏）
     * DELETE /api/players/:playerId
     */
    router.delete("/:playerId", async (req, res) => {
        try {
            const { playerId } = req.params;
            const success = await game.removePlayer(playerId);

            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: "Player not found",
                });
            }

            res.json({
                success: true,
                message: "Player removed successfully",
            });
        } catch (err) {
            console.error("Failed to remove player", err);
            res.status(500).json({
                success: false,
                message: "Failed to remove player",
            });
        }
    });

    /**
     * 移动玩家（方向控制）
     * POST /api/players/:playerId/move
     * Body: { direction: 'up' | 'down' | 'left' | 'right', distance?: number }
     */
    router.post("/:playerId/move", async (req, res) => {
        try {
            const { playerId } = req.params;
            const { direction, distance = 1 } = req.body;

            console.log(`🎮 [MOVE] Player ${playerId} wants to move ${direction} (distance: ${distance})`);
            console.log(`🎮 [MOVE] Request body:`, JSON.stringify(req.body));

            const playerAgent = game.getPlayerAgent(playerId);
            if (!playerAgent) {
                console.warn(`⚠️ [MOVE] Player not found: ${playerId}`);
                return res.status(404).json({
                    success: false,
                    message: "Player not found",
                });
            }

            // 将方向转换为坐标增量
            let dx = 0, dy = 0, dz = 0;
            
            switch (direction) {
                case 'up':
                    dz = -distance; // 向上移动（z 减少）
                    console.log(`🎮 [MOVE] Direction: UP, dz = ${dz}`);
                    break;
                case 'down':
                    dz = distance; // 向下移动（z 增加）
                    console.log(`🎮 [MOVE] Direction: DOWN, dz = ${dz}`);
                    break;
                case 'left':
                    dx = -distance; // 向左移动（x 减少）
                    console.log(`🎮 [MOVE] Direction: LEFT, dx = ${dx}`);
                    break;
                case 'right':
                    dx = distance; // 向右移动（x 增加）
                    console.log(`🎮 [MOVE] Direction: RIGHT, dx = ${dx}`);
                    break;
                default:
                    console.error(`❌ [MOVE] Invalid direction: ${direction}`);
                    return res.status(400).json({
                        success: false,
                        message: "Invalid direction. Use: up, down, left, or right",
                    });
            }

            const previousPosition = { ...playerAgent.getPosition() };
            console.log(`🎮 [MOVE] Previous position:`, previousPosition);
            
            const newPosition = playerAgent.move(dx, dy, dz);
            console.log(`🎮 [MOVE] New position:`, newPosition);
            console.log(`✅ [MOVE] Player moved from (${previousPosition.x}, ${previousPosition.z}) to (${newPosition.x}, ${newPosition.z})`);

            // 获取更新后的玩家信息
            console.log(`🎮 [MOVE] Getting updated player data...`);
            const player = await game.getPlayer(playerId);
            console.log(`🎮 [MOVE] Player data retrieved:`, player ? 'OK' : 'NULL');

            // 广播玩家移动事件到所有 WebSocket 客户端
            if (player) {
                console.log(`📡 [MOVE] Broadcasting player move to WebSocket clients...`);
                wsManager.broadcastPlayerMove({
                    player,
                    previousPosition,
                });
                console.log(`📡 [MOVE] Broadcast complete`);
            } else {
                console.warn(`⚠️ [MOVE] Player data is null, skipping broadcast`);
            }

            console.log(`✅ [MOVE] Sending success response`);
            res.json({
                success: true,
                message: "Player moved successfully",
                player,
                previousPosition,
                newPosition,
            });
        } catch (err) {
            console.error("❌ [MOVE] Failed to move player:", err);
            console.error("❌ [MOVE] Error stack:", (err as Error).stack);
            res.status(500).json({
                success: false,
                message: "Failed to move player",
            });
        }
    });

    /**
     * 移动玩家（坐标控制，旧版本）
     * POST /api/players/:playerId/move-by-coords
     * Body: { x?: number, y?: number, z?: number }
     */
    router.post("/:playerId/move-by-coords", (req, res) => {
        try {
            const { playerId } = req.params;
            const params: MovePlayerParams = req.body;

            const playerAgent = game.getPlayerAgent(playerId);
            if (!playerAgent) {
                return res.status(404).json({
                    success: false,
                    message: "Player not found",
                });
            }

            // 相对移动
            const dx = params.x ?? 0;
            const dy = params.y ?? 0;
            const dz = params.z ?? 0;

            const newPosition = playerAgent.move(dx, dy, dz);

            res.json({
                success: true,
                message: "Player moved successfully",
                position: newPosition,
            });
        } catch (err) {
            console.error("Failed to move player", err);
            res.status(500).json({
                success: false,
                message: "Failed to move player",
            });
        }
    });

    /**
     * 传送玩家到指定位置
     * POST /api/players/:playerId/teleport
     * Body: { x: number, y: number, z: number }
     */
    router.post("/:playerId/teleport", (req, res) => {
        try {
            const { playerId } = req.params;
            const { x, y, z } = req.body;

            // 验证坐标
            const posValidation = validatePosition(x, y, z);
            if (!posValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: posValidation.error,
                });
            }

            const playerAgent = game.getPlayerAgent(playerId);
            if (!playerAgent) {
                return res.status(404).json({
                    success: false,
                    message: "Player not found",
                });
            }

            const newPosition = playerAgent.teleport(x, y, z);

            res.json({
                success: true,
                message: "Player teleported successfully",
                position: newPosition,
            });
        } catch (err) {
            console.error("Failed to teleport player", err);
            res.status(500).json({
                success: false,
                message: "Failed to teleport player",
            });
        }
    });

    /**
     * 获取指定范围内的玩家
     * GET /api/players/nearby?x=0&y=0&z=0&radius=100
     */
    router.get("/nearby/search", (req, res) => {
        try {
            const x = parseFloat(req.query.x as string) || 0;
            const y = parseFloat(req.query.y as string) || 0;
            const z = parseFloat(req.query.z as string) || 0;
            const radius = parseFloat(req.query.radius as string) || 100;

            const players = game.getPlayersInRange(x, y, z, radius);

            res.json({
                success: true,
                count: players.length,
                players,
                query: { x, y, z, radius },
            });
        } catch (err) {
            console.error("Failed to search nearby players", err);
            res.status(500).json({
                success: false,
                message: "Failed to search nearby players",
            });
        }
    });

    return router;
}
