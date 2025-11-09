import { PlayerModel } from "../../Models/Player";
import type { PlayerSnapshot } from "../../types/agent";

/**
 * PlayerRepository - 玩家数据访问层
 * 
 * 职责：
 * - 封装所有玩家数据的 MongoDB 操作
 * - 提供统一的数据访问接口
 * - 处理数据映射和转换
 * 
 * 设计模式：Repository Pattern
 */
export class PlayerRepository {
    /**
     * 根据玩家 ID 查找玩家
     * @param playerId 玩家 ID
     * @param worldId 世界 ID
     * @returns 玩家数据或 null
     */
    async findById(playerId: string, worldId: string): Promise<PlayerSnapshot | null> {
        const player = await PlayerModel.findOne({ playerId, worldId }).lean();
        if (!player) return null;

        return {
            id: player.playerId,
            name: player.name,
            position: player.position,
            status: player.status as any,
            attributes: player.attributes,
            joinedAt: player.joinedAt ? player.joinedAt.toISOString() : new Date().toISOString(),
            lastActiveAt: player.lastActiveAt ? player.lastActiveAt.toISOString() : new Date().toISOString(),
        };
    }

    /**
     * 查找世界中的所有玩家
     * @param worldId 世界 ID
     * @returns 玩家数组
     */
    async findAll(worldId: string): Promise<PlayerSnapshot[]> {
        const players = await PlayerModel.find({ worldId }).lean();
        
        return players.map((player) => ({
            id: player.playerId,
            name: player.name,
            position: player.position,
            status: player.status as any,
            attributes: player.attributes,
            joinedAt: player.joinedAt ? player.joinedAt.toISOString() : new Date().toISOString(),
            lastActiveAt: player.lastActiveAt ? player.lastActiveAt.toISOString() : new Date().toISOString(),
        }));
    }

    /**
     * 保存单个玩家数据
     * @param player 玩家快照
     * @param worldId 世界 ID
     */
    async save(player: PlayerSnapshot, worldId: string): Promise<void> {
        await PlayerModel.findOneAndUpdate(
            { playerId: player.id, worldId },
            {
                playerId: player.id,
                worldId,
                name: player.name,
                position: player.position,
                status: player.status,
                attributes: player.attributes,
                lastActiveAt: new Date(player.lastActiveAt),
                $setOnInsert: {
                    joinedAt: new Date(player.joinedAt),
                }
            },
            { upsert: true, new: true }
        );
    }

    /**
     * 批量保存玩家数据（优化性能）
     * @param players 玩家快照数组
     * @param worldId 世界 ID
     */
    async saveBatch(players: PlayerSnapshot[], worldId: string): Promise<void> {
        if (players.length === 0) return;

        const bulkOps = players.map(player => ({
            updateOne: {
                filter: { playerId: player.id, worldId },
                update: {
                    $set: {
                        playerId: player.id,
                        worldId,
                        name: player.name,
                        position: player.position,
                        status: player.status,
                        attributes: player.attributes,
                        lastActiveAt: new Date(player.lastActiveAt),
                    },
                    $setOnInsert: {
                        joinedAt: new Date(player.joinedAt),
                    }
                },
                upsert: true,
            }
        }));

        await PlayerModel.bulkWrite(bulkOps);
    }

    /**
     * 删除玩家
     * @param playerId 玩家 ID
     * @param worldId 世界 ID
     * @returns 是否删除成功
     */
    async delete(playerId: string, worldId: string): Promise<boolean> {
        const result = await PlayerModel.deleteOne({ playerId, worldId });
        return result.deletedCount > 0;
    }

    /**
     * 检查玩家是否存在
     * @param playerId 玩家 ID
     * @param worldId 世界 ID
     * @returns 是否存在
     */
    async exists(playerId: string, worldId: string): Promise<boolean> {
        const count = await PlayerModel.countDocuments({ playerId, worldId });
        return count > 0;
    }

    /**
     * 查找指定范围内的玩家
     * @param worldId 世界 ID
     * @param center 中心位置
     * @param radius 半径
     * @returns 范围内的玩家
     */
    async findInRange(
        worldId: string,
        center: { x: number; y: number; z: number },
        radius: number
    ): Promise<PlayerSnapshot[]> {
        const players = await PlayerModel.find({ worldId }).lean();
        
        return players
            .filter((player) => {
                const dx = player.position.x - center.x;
                const dy = player.position.y - center.y;
                const dz = player.position.z - center.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                return distance <= radius;
            })
            .map((player) => ({
                id: player.playerId,
                name: player.name,
                position: player.position,
                status: player.status as any,
                attributes: player.attributes,
                joinedAt: player.joinedAt ? player.joinedAt.toISOString() : new Date().toISOString(),
                lastActiveAt: player.lastActiveAt ? player.lastActiveAt.toISOString() : new Date().toISOString(),
            }));
    }

    /**
     * 统计世界中的玩家数量
     * @param worldId 世界 ID
     * @returns 玩家数量
     */
    async count(worldId: string): Promise<number> {
        return await PlayerModel.countDocuments({ worldId });
    }

    /**
     * 清理不活跃的玩家（超过指定时间未活动）
     * @param worldId 世界 ID
     * @param inactiveThresholdMs 不活跃阈值（毫秒）
     * @returns 删除的玩家数量
     */
    async cleanupInactive(worldId: string, inactiveThresholdMs: number): Promise<number> {
        const threshold = new Date(Date.now() - inactiveThresholdMs);
        const result = await PlayerModel.deleteMany({
            worldId,
            lastActive: { $lt: threshold }
        });
        return result.deletedCount;
    }
}
