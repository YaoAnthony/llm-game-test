import { WorldMapModel } from "../../Models/WorldMap";
import type { Tile } from "../../types/terrain";

/**
 * ⚠️ DEPRECATED - 未使用的代码
 * 
 * 架构问题：
 * 1. WorldRepository 从未在实际代码中被使用
 * 2. Game.ts 和 WorldManager.ts 直接使用 WorldMapModel 进行数据库操作
 * 3. 与 GameStateRepository 存在同样的设计问题
 * 
 * 建议：
 * - 要么重构使用这个 Repository
 * - 要么删除这个未使用的代码
 * 
 * 保留原因：可能后续需要完善 Repository 模式
 */

/**
 * DirtyChunk - 脏数据块
 * 用于增量保存，只保存被修改的区域
 */
export interface DirtyChunk {
    x: number;
    y: number;
    tiles: Tile[];
}

/**
 * WorldRepository - 世界数据访问层
 * 
 * 职责：
 * - 封装所有地形数据的 MongoDB 操作
 * - 支持完整保存和增量保存
 * - 处理大规模地形数据的高效存储
 * 
 * 设计模式：Repository Pattern
 * 
 * ⚠️ 当前状态：未被使用，仅作为接口定义保留
 */
export class WorldRepository {
    /**
     * 加载世界地形数据
     * @param worldId 世界 ID
     * @returns 地形数据或 null
     */
    async loadTerrain(worldId: string): Promise<{ tiles: Tile[][] } | null> {
        const worldMap = await WorldMapModel.findOne({ worldId }).lean();
        if (!worldMap) return null;

        // 解压缩 tilesData
        const tiles: Tile[][] = JSON.parse(worldMap.tilesData);

        return { tiles };
    }

    /**
     * 完整保存世界地形数据
     * @param worldId 世界 ID
     * @param width 地图宽度
     * @param height 地图高度
     * @param tiles 地形数据（二维数组）
     */
    async saveTerrain(
        worldId: string,
        width: number,
        height: number,
        tiles: Tile[][]
    ): Promise<void> {
        // 压缩 tiles 为 JSON 字符串
        const tilesData = JSON.stringify(tiles);

        await WorldMapModel.findOneAndUpdate(
            { worldId },
            {
                worldId,
                width,
                height,
                tilesData,
                lastSavedAt: new Date(),
                metadata: {
                    name: `World-${worldId}`,
                },
            },
            { upsert: true, new: true }
        );
    }

    /**
     * 增量保存脏数据块（性能优化）
     * 只保存被修改的地形块，避免保存整个地图
     * 
     * @param worldId 世界 ID
     * @param dirtyTiles 被修改的 tile 坐标和数据
     */
    async saveDirtyTiles(
        worldId: string,
        dirtyTiles: Array<{ x: number; y: number; tile: Tile }>
    ): Promise<void> {
        if (dirtyTiles.length === 0) return;

        // 构建批量更新操作
        const bulkOps = dirtyTiles.map(({ x, y, tile }) => ({
            updateOne: {
                filter: { worldId },
                update: {
                    $set: {
                        [`tiles.${y}.${x}`]: tile,
                        lastModified: new Date(),
                    }
                }
            }
        }));

        await WorldMapModel.bulkWrite(bulkOps);
    }

    /**
     * 检查世界是否存在
     * @param worldId 世界 ID
     * @returns 是否存在
     */
    async exists(worldId: string): Promise<boolean> {
        const count = await WorldMapModel.countDocuments({ worldId });
        return count > 0;
    }

    /**
     * 删除世界数据
     * @param worldId 世界 ID
     * @returns 是否删除成功
     */
    async delete(worldId: string): Promise<boolean> {
        const result = await WorldMapModel.deleteOne({ worldId });
        return result.deletedCount > 0;
    }

    /**
     * 获取世界地图的元数据（不加载完整地形）
     * @param worldId 世界 ID
     * @returns 元数据或 null
     */
    async getMetadata(worldId: string): Promise<{
        width: number;
        height: number;
        lastSavedAt: Date;
    } | null> {
        const worldMap = await WorldMapModel.findOne(
            { worldId },
            { width: 1, height: 1, lastSavedAt: 1 }
        ).lean();

        if (!worldMap) return null;

        return {
            width: worldMap.width,
            height: worldMap.height,
            lastSavedAt: worldMap.lastSavedAt,
        };
    }

    /**
     * 获取指定区域的地形数据（范围查询）
     * @param worldId 世界 ID
     * @param startX 起始 X 坐标
     * @param startY 起始 Y 坐标
     * @param width 区域宽度
     * @param height 区域高度
     * @returns 区域地形数据
     */
    async getRegion(
        worldId: string,
        startX: number,
        startY: number,
        width: number,
        height: number
    ): Promise<Tile[][] | null> {
        const worldMap = await WorldMapModel.findOne({ worldId }).lean();
        if (!worldMap) return null;

        // 解压缩地形数据
        const tiles: Tile[][] = JSON.parse(worldMap.tilesData);
        const region: Tile[][] = [];

        for (let y = startY; y < startY + height && y < tiles.length; y++) {
            const row: Tile[] = [];
            const tileRow = tiles[y];
            if (!tileRow) continue;
            for (let x = startX; x < startX + width && x < tileRow.length; x++) {
                const tile = tileRow[x];
                if (tile) row.push(tile);
            }
            region.push(row);
        }

        return region;
    }

    /**
     * 批量更新地形（性能优化版）
     * 使用分块策略，避免单次更新过大
     * 
     * @param worldId 世界 ID
     * @param updates 更新数组
     * @param chunkSize 每批次大小
     */
    async saveDirtyTilesInChunks(
        worldId: string,
        updates: Array<{ x: number; y: number; tile: Tile }>,
        chunkSize: number = 100
    ): Promise<void> {
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            await this.saveDirtyTiles(worldId, chunk);
        }
    }

    /**
     * 统计世界中各种地形类型的数量
     * @param worldId 世界 ID
     * @returns 地形类型统计
     */
    async getTerrainStats(worldId: string): Promise<Record<string, number> | null> {
        const worldMap = await WorldMapModel.findOne({ worldId }).lean();
        if (!worldMap) return null;

        // 解压缩地形数据
        const tiles: Tile[][] = JSON.parse(worldMap.tilesData);
        const stats: Record<string, number> = {};

        for (const row of tiles) {
            for (const tile of row) {
                stats[tile.type] = (stats[tile.type] || 0) + 1;
            }
        }

        return stats;
    }
}
