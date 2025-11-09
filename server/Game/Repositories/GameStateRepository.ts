import { GameWorldStateModel } from "../../Models/GameWorldState";
import type { WeatherType } from "../../types/weather";

/**
 * ⚠️ DEPRECATED - 未使用的代码
 * 
 * 架构问题：
 * 1. GameStateRepository 从未在实际代码中被使用
 * 2. Game.ts 直接使用 GameWorldStateModel 进行数据库操作，绕过了 Repository 层
 * 3. 违反了 Repository Pattern 的设计初衷
 * 
 * 建议：
 * - 要么重构 Game.ts 使用这个 Repository
 * - 要么删除这个未使用的 Repository
 * 
 * 保留原因：可能后续需要完善 Repository 模式
 */

/**
 * GameStateSnapshot - 游戏状态快照
 * 包含时间、天气等非玩家/地形的游戏状态
 */
export interface GameStateSnapshot {
    worldId: string;
    tick: number;
    timeOfDay: string;
    currentWeather: WeatherType;
    lastUpdated: number;
}

/**
 * GameStateRepository - 游戏状态数据访问层
 * 
 * 职责：
 * - 封装游戏状态（时间、天气）的 MongoDB 操作
 * - 提供状态持久化和恢复功能
 * - 支持状态快照管理
 * 
 * 设计模式：Repository Pattern
 * 
 * ⚠️ 当前状态：未被使用，仅作为接口定义保留
 */
export class GameStateRepository {
    /**
     * 加载游戏状态
     * @param worldId 世界 ID
     * @returns 游戏状态快照或 null
     */
    async loadState(worldId: string): Promise<GameStateSnapshot | null> {
        const state = await GameWorldStateModel.findOne({ worldId }).lean();
        if (!state) return null;

        return {
            worldId: state.worldId,
            tick: state.time.tick,
            timeOfDay: state.time.timeOfDay,
            currentWeather: (state.environment as any)?.weather || "clear",
            lastUpdated: state.time.lastUpdatedAt.getTime(),
        };
    }

    /**
     * 保存游戏状态
     * @param snapshot 游戏状态快照
     */
    async saveState(snapshot: GameStateSnapshot): Promise<void> {
        await GameWorldStateModel.findOneAndUpdate(
            { worldId: snapshot.worldId },
            {
                worldId: snapshot.worldId,
                time: {
                    tick: snapshot.tick,
                    timeOfDay: snapshot.timeOfDay,
                    speedMultiplier: 1,
                    tickIntervalMs: 50,
                    lastUpdatedAt: new Date(snapshot.lastUpdated),
                },
                environment: {
                    weather: snapshot.currentWeather,
                },
            },
            { upsert: true, new: true }
        );
    }

    /**
     * 检查游戏状态是否存在
     * @param worldId 世界 ID
     * @returns 是否存在
     */
    async exists(worldId: string): Promise<boolean> {
        const count = await GameWorldStateModel.countDocuments({ worldId });
        return count > 0;
    }

    /**
     * 删除游戏状态
     * @param worldId 世界 ID
     * @returns 是否删除成功
     */
    async delete(worldId: string): Promise<boolean> {
        const result = await GameWorldStateModel.deleteOne({ worldId });
        return result.deletedCount > 0;
    }

    /**
     * 仅更新时间（增量更新）
     * @param worldId 世界 ID
     * @param tick 当前 tick
     * @param timeOfDay 时段
     */
    async updateTime(worldId: string, tick: number, timeOfDay: string): Promise<void> {
        await GameWorldStateModel.findOneAndUpdate(
            { worldId },
            {
                $set: {
                    "time.tick": tick,
                    "time.timeOfDay": timeOfDay,
                    "time.lastUpdatedAt": new Date(),
                }
            }
        );
    }

    /**
     * 仅更新天气（增量更新）
     * @param worldId 世界 ID
     * @param currentWeather 当前天气
     */
    async updateWeather(worldId: string, currentWeather: WeatherType): Promise<void> {
        await GameWorldStateModel.findOneAndUpdate(
            { worldId },
            {
                $set: {
                    "environment.weather": currentWeather,
                    "time.lastUpdatedAt": new Date(),
                }
            }
        );
    }

    /**
     * 获取最后更新时间
     * @param worldId 世界 ID
     * @returns 最后更新时间或 null
     */
    async getLastUpdated(worldId: string): Promise<Date | null> {
        const state = await GameWorldStateModel.findOne(
            { worldId },
            { "time.lastUpdatedAt": 1 }
        ).lean();

        return state ? state.time.lastUpdatedAt : null;
    }

    /**
     * 创建状态快照用于备份
     * @param worldId 世界 ID
     * @returns 快照数据或 null
     */
    async createBackup(worldId: string): Promise<GameStateSnapshot | null> {
        return await this.loadState(worldId);
    }

    /**
     * 从快照恢复状态
     * @param snapshot 快照数据
     */
    async restoreFromBackup(snapshot: GameStateSnapshot): Promise<void> {
        await this.saveState(snapshot);
    }

    /**
     * 批量获取多个世界的状态
     * @param worldIds 世界 ID 数组
     * @returns 状态快照数组
     */
    async loadMultipleStates(worldIds: string[]): Promise<GameStateSnapshot[]> {
        const states = await GameWorldStateModel.find({
            worldId: { $in: worldIds }
        }).lean();

        return states.map((state) => ({
            worldId: state.worldId,
            tick: state.time.tick,
            timeOfDay: state.time.timeOfDay,
            currentWeather: (state.environment as any)?.weather || "clear",
            lastUpdated: state.time.lastUpdatedAt.getTime(),
        }));
    }

    /**
     * 清理过期的游戏状态
     * @param maxAgeMs 最大保留时间（毫秒）
     * @returns 删除的状态数量
     */
    async cleanupOldStates(maxAgeMs: number): Promise<number> {
        const threshold = new Date(Date.now() - maxAgeMs);
        const result = await GameWorldStateModel.deleteMany({
            "time.lastUpdatedAt": { $lt: threshold }
        });
        return result.deletedCount;
    }
}
