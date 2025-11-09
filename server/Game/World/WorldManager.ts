
import {
    TerrainType,
    Tile,
    WorldMap,
    Position2D,
    Rectangle,
    TileConfig,
    VisibleTile,
} from "../../types/terrain.js";

/**
 * 世界管理器 - 负责地形和环境管理
 * 类比 Minecraft 的 World 对象 + 星露谷物语的地图系统
 * 
 * 核心功能：
 * - 地形数据存储和查询
 * - 碰撞检测
 * - 视野范围查询
 * - 地形修改（耕地、种植等）
 */
export default class WorldManager {
    /** 当前世界地图 */
    private worldMap: WorldMap;

    /** 瓦片静态配置表 */
    private readonly tileConfigs: Map<TerrainType, TileConfig>;

    /** 脏数据标记：记录哪些瓦片被修改 */
    private dirtyTiles: Set<string> = new Set();

    /** 世界 ID */
    private readonly worldId: string;

    /** 地图宽度 */
    public readonly width: number;

    /** 地图高度 */
    public readonly height: number;

    /**
     * 构造函数
     * @param worldId 世界 ID
     * @param width 地图宽度（默认 50）
     * @param height 地图高度（默认 50）
     * @param seed 随机种子（可选）
     */
    constructor(worldId: string, width: number = 50, height: number = 50, seed?: number) {
        this.worldId = worldId;
        this.width = width;
        this.height = height;
        
        // 初始化瓦片配置表
        this.tileConfigs = this.initTileConfigs();

        // 生成默认世界
        this.worldMap = this.generateDefaultWorld(width, height, seed);

        console.log(`🗺️  World map initialized (${width}x${height})`);
    }

    // ==================== 初始化方法 ====================

    /**
     * 初始化瓦片配置表
     * 定义每种瓦片的物理属性和视觉表现
     */
    private initTileConfigs(): Map<TerrainType, TileConfig> {
        const configs = new Map<TerrainType, TileConfig>();

        configs.set('GRASS', {
            type: 'GRASS',
            walkable: true,
            tillable: true,
            harvestable: false,
            transparent: true,
            description: "柔软的草地，可以耕种",
            symbol: "🌱",
            color: "#90EE90",
        });

        configs.set('DIRT', {
            type: 'DIRT',
            walkable: true,
            tillable: true,
            harvestable: false,
            transparent: true,
            description: "泥土地面",
            symbol: "🟫",
            color: "#8B4513",
        });

        configs.set('WATER', {
            type: 'WATER',
            walkable: false,
            tillable: false,
            harvestable: false,
            transparent: true,
            description: "清澈的水体，无法通过",
            symbol: "💧",
            color: "#4169E1",
        });

        configs.set('STONE', {
            type: 'STONE',
            walkable: true,
            tillable: false,
            harvestable: false,
            transparent: true,
            description: "坚硬的石头地面",
            symbol: "⬜",
            color: "#808080",
        });

        configs.set('SAND', {
            type: 'SAND',
            walkable: true,
            tillable: false,
            harvestable: false,
            transparent: true,
            description: "松软的沙地",
            symbol: "🟨",
            color: "#F4A460",
        });

        configs.set('TREE', {
            type: 'TREE',
            walkable: false,
            tillable: false,
            harvestable: true,
            transparent: false,
            description: "茂密的树木，可以砍伐",
            symbol: "🌲",
            color: "#228B22",
        });

        configs.set('ROCK', {
            type: 'ROCK',
            walkable: false,
            tillable: false,
            harvestable: true,
            transparent: false,
            description: "大石头，可以采集",
            symbol: "🪨",
            color: "#696969",
        });

        configs.set('FARMLAND', {
            type: 'FARMLAND',
            walkable: true,
            tillable: false, // 已经是耕地了
            harvestable: false,
            transparent: true,
            description: "已耕种的农田",
            symbol: "🟫",
            color: "#654321",
        });

        configs.set('WALL', {
            type: 'WALL',
            walkable: false,
            tillable: false,
            harvestable: false,
            transparent: false,
            description: "坚固的墙壁",
            symbol: "🧱",
            color: "#A0522D",
        });

        configs.set('VOID', {
            type: 'VOID',
            walkable: false,
            tillable: false,
            harvestable: false,
            transparent: true,
            description: "世界边界外",
            symbol: "⬛",
            color: "#000000",
        });

        return configs;
    }

    /**
     * 生成默认世界
     * 创建一个带边界墙的草地世界，随机分布水和树
     * @param width 地图宽度
     * @param height 地图高度
     * @param seed 随机种子
     */
    private generateDefaultWorld(width: number, height: number, seed?: number): WorldMap {
        const tiles: Tile[][] = [];

        // 使用种子初始化随机数（简单实现）
        const random = seed ? this.seededRandom(seed) : Math.random;

        for (let y = 0; y < height; y++) {
            const row: Tile[] = [];
            for (let x = 0; x < width; x++) {
                // 边界是墙
                if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                    row.push({ type: 'WALL' });
                }
                // 随机放置水体（5%）
                else if (random() < 0.05) {
                    row.push({ type: 'WATER' });
                }
                // 随机放置树木（3%）
                else if (random() < 0.03) {
                    row.push({
                        type: 'TREE',
                        state: { durability: 3 }, // 需要砍3次
                    });
                }
                // 随机放置岩石（2%）
                else if (random() < 0.02) {
                    row.push({
                        type: 'ROCK',
                        state: { durability: 5 }, // 需要挖5次
                    });
                }
                // 其余都是草地
                else {
                    row.push({ type: 'GRASS' });
                }
            }
            tiles.push(row);
        }

        return {
            width,
            height,
            tiles,
            metadata: {
                name: "Default World",
                createdAt: new Date(),
                seed: seed || Date.now(),
            },
        };
    }

    /**
     * 简单的种子随机数生成器
     */
    private seededRandom(seed: number): () => number {
        let state = seed;
        return () => {
            state = (state * 9301 + 49297) % 233280;
            return state / 233280;
        };
    }

    // ==================== 查询接口 ====================

    /**
     * 获取指定位置的瓦片
     * @param pos 坐标
     * @returns 瓦片对象，超出边界返回 VOID 瓦片
     */
    getTile(pos: Position2D): Tile {
        if (!this.isInBounds(pos)) {
            return { type: 'VOID' };
        }
        const row = this.worldMap.tiles[pos.y];
        const tile = row?.[pos.x];
        return tile || { type: 'VOID' };
    }

    /**
     * 获取瓦片配置
     * @param type 瓦片类型
     */
    getTileConfig(type: TerrainType): TileConfig | undefined {
        return this.tileConfigs.get(type);
    }

    /**
     * 检查坐标是否在地图内
     */
    isInBounds(pos: Position2D): boolean {
        return (
            pos.x >= 0 &&
            pos.x < this.worldMap.width &&
            pos.y >= 0 &&
            pos.y < this.worldMap.height
        );
    }

    /**
     * 检查位置是否可行走（碰撞检测）
     * @param pos 坐标
     * @returns true = 可通过，false = 碰撞
     */
    isWalkable(pos: Position2D): boolean {
        const tile = this.getTile(pos);
        const config = this.getTileConfig(tile.type);
        return config?.walkable ?? false;
    }

    /**
     * 检查位置是否可耕种
     * @param pos 坐标
     */
    isTillable(pos: Position2D): boolean {
        const tile = this.getTile(pos);
        const config = this.getTileConfig(tile.type);
        return config?.tillable ?? false;
    }

    /**
     * 检查位置是否可采集
     * @param pos 坐标
     */
    isHarvestable(pos: Position2D): boolean {
        const tile = this.getTile(pos);
        const config = this.getTileConfig(tile.type);
        return config?.harvestable ?? false;
    }

    /**
     * 获取可见区域的瓦片
     * 类比 Minecraft 的视野范围查询
     * @param center 中心点（通常是玩家位置）
     * @param radius 视野半径
     * @returns 可见瓦片数组
     */
    getVisibleTiles(center: Position2D, radius: number): VisibleTile[] {
        const result: VisibleTile[] = [];

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const pos = { x: center.x + dx, y: center.y + dy };
                const tile = this.getTile(pos);

                if (tile.type !== 'VOID') {
                    const config = this.getTileConfig(tile.type);
                    if (config) {
                        result.push({ pos, tile, config });
                    }
                }
            }
        }

        return result;
    }

    /**
     * 获取矩形区域的瓦片
     * @param rect 矩形区域
     */
    getTilesInRect(rect: Rectangle): VisibleTile[] {
        const result: VisibleTile[] = [];

        for (let y = rect.y; y < rect.y + rect.height; y++) {
            for (let x = rect.x; x < rect.x + rect.width; x++) {
                const pos = { x, y };
                if (this.isInBounds(pos)) {
                    const tile = this.getTile(pos);
                    const config = this.getTileConfig(tile.type);
                    if (config) {
                        result.push({ pos, tile, config });
                    }
                }
            }
        }

        return result;
    }

    // ==================== 修改接口 ====================

    /**
     * 设置瓦片（带乐观锁版本控制）
     * @param pos 坐标
     * @param tile 新的瓦片数据
     * @param expectedVersion 期望的版本号（用于乐观锁）
     * @returns 是否成功，失败可能是版本冲突或越界
     */
    setTile(pos: Position2D, tile: Tile, expectedVersion?: number): boolean {
        if (!this.isInBounds(pos)) return false;
        
        const row = this.worldMap.tiles[pos.y];
        if (!row) return false;
        
        const currentTile = row[pos.x];
        
        // 乐观锁：检查版本号
        if (expectedVersion !== undefined) {
            const currentVersion = currentTile?.version ?? 0;
            if (currentVersion !== expectedVersion) {
                console.warn(`⚠️ Version conflict at (${pos.x}, ${pos.y}): expected ${expectedVersion}, got ${currentVersion}`);
                return false; // 版本冲突
            }
        }
        
        // 增加版本号
        tile.version = (currentTile?.version ?? 0) + 1;
        
        row[pos.x] = tile;
        
        // 标记为脏数据
        this.markTileDirty(pos);
        
        return true;
    }

    /**
     * 获取瓦片的当前版本号
     * @param pos 坐标
     * @returns 版本号
     */
    getTileVersion(pos: Position2D): number {
        const tile = this.getTile(pos);
        return tile.version ?? 0;
    }

    /**
     * 标记瓦片为脏数据
     */
    private markTileDirty(pos: Position2D): void {
        const key = `${pos.x},${pos.y}`;
        this.dirtyTiles.add(key);
    }

    /**
     * 获取所有脏数据瓦片
     */
    getDirtyTiles(): Array<{ pos: Position2D; tile: Tile }> {
        const result: Array<{ pos: Position2D; tile: Tile }> = [];
        
        for (const key of this.dirtyTiles) {
            const parts = key.split(',');
            if (parts.length !== 2 || !parts[0] || !parts[1]) continue;
            
            const x = parseInt(parts[0], 10);
            const y = parseInt(parts[1], 10);
            
            if (!isNaN(x) && !isNaN(y)) {
                const pos = { x, y };
                const tile = this.getTile(pos);
                result.push({ pos, tile });
            }
        }
        
        return result;
    }

    /**
     * 清除脏数据标记
     */
    clearDirtyFlags(): void {
        this.dirtyTiles.clear();
    }

    /**
     * 检查是否有脏数据
     */
    hasDirtyData(): boolean {
        return this.dirtyTiles.size > 0;
    }

    /**
     * 耕地操作（带并发控制）
     * 将草地转换为耕地
     * @param pos 坐标
     * @returns 是否成功
     */
    tillLand(pos: Position2D): boolean {
        if (!this.isTillable(pos)) return false;

        // 获取当前版本号
        const expectedVersion = this.getTileVersion(pos);

        const success = this.setTile(pos, {
            type: 'FARMLAND',
            state: {
                tilled: true,
                watered: false,
                lastInteractedAt: new Date().toISOString(),
            },
        }, expectedVersion);

        return success;
    }

    /**
     * 种植作物（带并发控制）
     * @param pos 坐标
     * @param cropId 作物 ID
     * @returns 是否成功
     */
    plantCrop(pos: Position2D, cropId: string): boolean {
        const tile = this.getTile(pos);

        // 必须是耕地
        if (tile.type !== 'FARMLAND') return false;

        // 已有作物
        if (tile.state?.crop) return false;

        // 获取当前版本号
        const expectedVersion = tile.version ?? 0;

        // 种植作物
        const newTile: Tile = {
            type: tile.type,
            state: {
                ...tile.state,
                crop: cropId,
                growthStage: 0,
                lastInteractedAt: new Date().toISOString(),
            },
        };

        return this.setTile(pos, newTile, expectedVersion);
    }

    /**
     * 浇水（带并发控制）
     * @param pos 坐标
     * @returns 是否成功
     */
    waterTile(pos: Position2D): boolean {
        const tile = this.getTile(pos);

        // 只能给耕地浇水
        if (tile.type !== 'FARMLAND') return false;

        if (!tile.state) return false;

        // 获取当前版本号
        const expectedVersion = tile.version ?? 0;

        const newTile: Tile = {
            type: tile.type,
            state: {
                ...tile.state,
                watered: true,
                lastInteractedAt: new Date().toISOString(),
            },
        };

        return this.setTile(pos, newTile, expectedVersion);
    }

    /**
     * 采集资源（砍树、挖石头）- 带并发控制
     * @param pos 坐标
     * @returns 采集结果 { success: boolean, complete: boolean, drops?: string[] }
     */
    harvest(pos: Position2D): { success: boolean; complete: boolean; drops?: string[] } {
        if (!this.isHarvestable(pos)) {
            return { success: false, complete: false };
        }

        const tile = this.getTile(pos);
        const expectedVersion = tile.version ?? 0;

        // 减少耐久度
        if (tile.state?.durability !== undefined) {
            const newDurability = tile.state.durability - 1;

            // 耐久度归零，移除该资源
            if (newDurability <= 0) {
                const drops = this.getDrops(tile.type);

                // 替换为草地
                const success = this.setTile(pos, { type: 'GRASS' }, expectedVersion);
                
                if (!success) {
                    return { success: false, complete: false }; // 版本冲突
                }

                return { success: true, complete: true, drops };
            }

            // 更新耐久度
            const newTile: Tile = {
                type: tile.type,
                state: {
                    ...tile.state,
                    durability: newDurability,
                    lastInteractedAt: new Date().toISOString(),
                },
            };

            const success = this.setTile(pos, newTile, expectedVersion);
            
            if (!success) {
                return { success: false, complete: false }; // 版本冲突
            }

            return { success: true, complete: false };
        }

        return { success: false, complete: false };
    }

    /**
     * 获取资源掉落物
     */
    private getDrops(type: TerrainType): string[] {
        switch (type) {
            case 'TREE':
                return ["wood", "wood", "wood"];
            case 'ROCK':
                return ["stone", "stone", "stone", "stone", "stone"];
            default:
                return [];
        }
    }

    // ==================== 输出接口 ====================

    /**
     * 输出玩家视野内的场景描述
     * 类比 MUD 游戏的 "look" 命令
     * @param center 玩家位置
     * @param radius 视野范围
     */
    describeView(center: Position2D, radius: number = 3): string {
        const visible = this.getVisibleTiles(center, radius);

        let description = `你站在 (${center.x}, ${center.y})，环顾四周：\n\n`;

        // 统计可见瓦片类型
        const counts = new Map<TerrainType, number>();
        visible.forEach(({ tile }) => {
            counts.set(tile.type, (counts.get(tile.type) || 0) + 1);
        });

        // 生成描述
        counts.forEach((count, type) => {
            const config = this.getTileConfig(type);
            if (config) {
                description += `${config.symbol} ${config.description} x${count}\n`;
            }
        });

        return description;
    }

    /**
     * 输出 ASCII 地图
     * @param center 中心点
     * @param radius 显示范围
     */
    renderASCII(center?: Position2D, radius: number = 10): string {
        const startX = center ? Math.max(0, center.x - radius) : 0;
        const startY = center ? Math.max(0, center.y - radius) : 0;
        const endX = center
            ? Math.min(this.worldMap.width, center.x + radius + 1)
            : this.worldMap.width;
        const endY = center
            ? Math.min(this.worldMap.height, center.y + radius + 1)
            : this.worldMap.height;

        let map = "";
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if (center && x === center.x && y === center.y) {
                    map += "👤"; // 玩家位置
                } else {
                    const tile = this.getTile({ x, y });
                    const config = this.getTileConfig(tile.type);
                    map += config?.symbol || "❓";
                }
            }
            map += "\n";
        }
        return map;
    }

    /**
     * 获取完整地图数据（用于前端渲染）
     */
    getMapData() {
        return {
            width: this.worldMap.width,
            height: this.worldMap.height,
            tiles: this.worldMap.tiles,
            metadata: this.worldMap.metadata,
        };
    }

    /**
     * 获取地图尺寸
     */
    getSize() {
        return {
            width: this.worldMap.width,
            height: this.worldMap.height,
        };
    }

    /**
     * 游戏循环更新
     * @param deltaTime 距离上次更新的时间（毫秒）
     */
    update(deltaTime: number): void {
        // TODO: 实现动态地形逻辑
        // - 作物生长
        // - 天气对地形的影响（下雨使耕地变湿润）
        // - 资源再生
    }
}