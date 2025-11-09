/**
 * 地形系统类型定义
 * 共享给服务器和客户端使用
 */

/**
 * 地形瓦片类型
 */
export type TerrainType = 
  | 'GRASS'
  | 'DIRT'
  | 'WATER'
  | 'STONE'
  | 'SAND'
  | 'TREE'
  | 'ROCK'
  | 'FARMLAND'
  | 'WALL'
  | 'VOID';

/**
 * 瓦片动态状态
 */
export interface TileState {
  /** 是否已耕种 */
  tilled?: boolean;
  /** 种植的作物 ID */
  crop?: string;
  /** 作物生长阶段 (0-4) */
  growthStage?: number;
  /** 是否浇水 (灌溉状态) */
  watered?: boolean;
  /** 耐久度 (用于采集类资源，如树木、岩石) */
  durability?: number;
  /** 最后交互时间 */
  lastInteractedAt?: string;
  /** 其他扩展字段 */
  [key: string]: unknown;
}

/**
 * 单个地形瓦片
 */
export interface Tile {
  /** 瓦片类型 */
  type: TerrainType;
  /** 动态状态（可选） */
  state?: TileState;
  /** 自定义元数据（扩展用） */
  metadata?: Record<string, unknown>;
  /** 版本号 - 用于乐观锁并发控制 */
  version?: number;
}

/**
 * 二维坐标
 */
export interface Position2D {
  x: number;
  y: number;
}

/**
 * 瓦片配置（用于客户端渲染）
 */
export interface TileConfig {
  type: TerrainType;
  walkable: boolean;
  tillable: boolean;
  harvestable: boolean;
  transparent: boolean;
  description: string;
  symbol: string;
  color: string;
}
