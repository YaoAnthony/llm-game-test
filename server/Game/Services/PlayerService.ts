import AgentManager from "../AgentFactory/AgentManager";
import { PlayerRepository } from "../Repositories/PlayerRepository";
import type { PlayerSnapshot, CreatePlayerParams, Position } from "../../types/agent";

/**
 * PlayerService - 玩家业务逻辑服务
 * 
 * 职责：
 * - 处理所有玩家相关的业务逻辑
 * - 协调 AgentManager 和 PlayerRepository
 * - 提供玩家的 CRUD 接口
 * - 管理玩家的移动、传送等操作
 * 
 * 设计模式：Service Layer Pattern
 */
export class PlayerService {
    constructor(
        private worldId: string,
        private agentManager: AgentManager,
        private playerRepository: PlayerRepository
    ) {}

    /**
     * 创建新玩家
     * @param params 创建参数
     * @returns 玩家快照
     */
    async createPlayer(params: CreatePlayerParams): Promise<PlayerSnapshot> {
        // 使用 AgentManager 创建玩家实例
        const snapshot = this.agentManager.createPlayer(params);

        // 持久化到数据库
        await this.playerRepository.save(snapshot, this.worldId);

        return snapshot;
    }

    /**
     * 根据 ID 获取玩家
     * @param playerId 玩家 ID
     * @returns 玩家快照或 null
     */
    async getPlayer(playerId: string): Promise<PlayerSnapshot | null> {
        // 先从内存查找
        const agent = this.agentManager.getPlayer(playerId);
        if (agent) {
            return agent.toSnapshot();
        }

        // 内存中没有，从数据库查找
        return await this.playerRepository.findById(playerId, this.worldId);
    }

    /**
     * 获取所有在线玩家
     * @returns 玩家快照数组
     */
    getAllPlayers(): PlayerSnapshot[] {
        return this.agentManager.getAllPlayers();
    }

    /**
     * 从数据库加载所有玩家
     * @returns 玩家快照数组
     */
    async loadAllPlayers(): Promise<PlayerSnapshot[]> {
        return await this.playerRepository.findAll(this.worldId);
    }

    /**
     * 移除玩家
     * @param playerId 玩家 ID
     * @returns 是否移除成功
     */
    async removePlayer(playerId: string): Promise<boolean> {
        // 1. 从内存移除
        const removed = this.agentManager.removePlayer(playerId);

        // 2. 从数据库删除
        if (removed) {
            await this.playerRepository.delete(playerId, this.worldId);
        }

        return removed;
    }

    /**
     * 移动玩家（相对位移）
     * @param playerId 玩家 ID
     * @param delta 位移量
     * @returns 新位置或 null
     */
    movePlayer(playerId: string, delta: Partial<Position>): Position | null {
        const agent = this.agentManager.getPlayer(playerId);
        if (!agent) return null;

        const currentPos = agent.getPosition();
        const newPos: Position = {
            x: currentPos.x + (delta.x || 0),
            y: currentPos.y + (delta.y || 0),
            z: currentPos.z + (delta.z || 0),
        };

        // 通过 move 方法移动玩家
        agent.move(
            (delta.x || 0),
            (delta.y || 0),
            (delta.z || 0)
        );

        return newPos;
    }

    /**
     * 传送玩家（绝对位置）
     * @param playerId 玩家 ID
     * @param position 目标位置
     * @returns 新位置或 null
     */
    teleportPlayer(playerId: string, position: Position): Position | null {
        const agent = this.agentManager.getPlayer(playerId);
        if (!agent) return null;

        // 计算位移量
        const current = agent.getPosition();
        const dx = position.x - current.x;
        const dy = position.y - current.y;
        const dz = position.z - current.z;

        // 使用 move 方法实现传送
        agent.move(dx, dy, dz);
        return position;
    }

    /**
     * 获取范围内的玩家
     * @param center 中心位置
     * @param radius 半径
     * @returns 范围内的玩家快照数组
     */
    getPlayersInRange(center: Position, radius: number): PlayerSnapshot[] {
        return this.agentManager.getPlayersInRange(center.x, center.y, center.z, radius);
    }

    /**
     * 保存单个玩家
     * @param playerId 玩家 ID
     */
    async savePlayer(playerId: string): Promise<void> {
        const agent = this.agentManager.getPlayer(playerId);
        if (!agent) return;

        const snapshot = agent.toSnapshot();
        await this.playerRepository.save(snapshot, this.worldId);
    }

    /**
     * 保存所有玩家（批量操作）
     */
    async saveAllPlayers(): Promise<void> {
        const snapshots = this.getAllPlayers();
        await this.playerRepository.saveBatch(snapshots, this.worldId);
    }

    /**
     * 保存脏数据玩家（只保存被修改的玩家）
     */
    async saveDirtyPlayers(): Promise<void> {
        const dirtySnapshots = this.agentManager.getDirtyPlayers();
        await this.playerRepository.saveBatch(dirtySnapshots, this.worldId);
    }

    /**
     * 从数据库恢复玩家到内存
     * @param snapshots 玩家快照数组
     * @returns 恢复的玩家数量
     */
    async restorePlayers(snapshots: PlayerSnapshot[]): Promise<number> {
        let count = 0;
        for (const snapshot of snapshots) {
            // 跳过已经在内存中的
            if (this.agentManager.getPlayer(snapshot.id)) {
                console.log(`⏭️  Skipping already loaded player: ${snapshot.name} (${snapshot.id})`);
                continue;
            }

            // 从快照恢复玩家（保留原 ID，不校验名称冲突）
            try {
                this.agentManager.restorePlayer(snapshot);
                count++;
            } catch (error) {
                console.error(`Failed to restore player ${snapshot.id}:`, error);
            }
        }
        return count;
    }

    /**
     * 从数据库恢复所有玩家到内存
     * @returns 恢复的玩家数量
     */
    async restoreAllPlayers(): Promise<number> {
        const snapshots = await this.playerRepository.findAll(this.worldId);
        return await this.restorePlayers(snapshots);
    }

    /**
     * 获取玩家统计信息
     * @returns 统计数据
     */
    getPlayerStats() {
        const players = this.getAllPlayers();

        if (players.length === 0) {
            return {
                totalPlayers: 0,
                averageLevel: 0,
                averageHealth: 0,
                maxLevel: 0,
            };
        }

        return {
            totalPlayers: players.length,
            averageLevel: players.reduce((sum: number, p: any) => sum + p.attributes.level, 0) / players.length,
            averageHealth: players.reduce((sum: number, p: any) => sum + p.attributes.health, 0) / players.length,
            maxLevel: Math.max(...players.map((p: any) => p.attributes.level)),
        };
    }

    /**
     * 获取玩家数量
     * @returns 玩家数量
     */
    getPlayerCount(): number {
        return this.agentManager.getPlayerCount();
    }
}

