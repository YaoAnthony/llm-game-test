/**
 * 地形系统类型定义
 * 类比 Minecraft 的方块系统和星露谷物语的瓦片系统
 */

// ✅ 核心类型从 shared 导入（基础地形类型）
export type { TerrainType, Tile, TileState, Position2D, TileConfig } from '../../shared/terrain.js';

// ✅ 服务器特定的地形类型（用于服务器端逻辑）
import type { TerrainType, Tile, Position2D, TileConfig } from '../../shared/terrain.js';

/**
 * 矩形区域
 * 用于查询可见范围或特定区域
 */
export interface Rectangle {
    x: number;      // 左上角 x
    y: number;      // 左上角 y
    width: number;  // 宽度
    height: number; // 高度
}

/**
 * 世界地图
 * 存储完整的地形数据
 */
export interface WorldMap {
    /** 地图宽度 */
    width: number;
    /** 地图高度 */
    height: number;
    /** 瓦片数据：tiles[y][x] 二维数组 */
    tiles: Tile[][];
    /** 地图元数据 */
    metadata: {
        name: string;
        createdAt: Date;
        seed?: number; // 随机种子（用于程序化生成）
    };
}

/**
 * 可见瓦片信息
 * 用于返回查询结果
 */
export interface VisibleTile {
    pos: Position2D;
    tile: Tile;
    config: TileConfig;
}

/**
 * 地形变化事件
 * 用于通知其他系统地形发生了变化
 */
export interface TerrainChangeEvent {
    position: Position2D;
    oldType: TerrainType;
    newType: TerrainType;
    timestamp: Date;
}
