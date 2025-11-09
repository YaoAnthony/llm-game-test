import PlayerAgent from "./Agent/PlayerAgent.js";
import type { CreatePlayerParams, PlayerSnapshot } from "../../types/agent.js";

/**
 * AgentManager 管理所有"冒险家"实体。
 * 在 Minecraft 类比中，它就像服务器维护的玩家列表/AI 实体控制器：
 * - 负责创建、加载、保存玩家状态。
 * - 管理在线玩家列表。
 */
export default class AgentManager {
    /** 在线玩家映射表 (playerId -> PlayerAgent) */
    private players: Map<string, PlayerAgent> = new Map();
    
    /** 默认出生点 */
    private readonly defaultSpawnPoint = { x: 0, y: 64, z: 0 };
    
    /** 玩家计数器，用于生成唯一 ID */
    private playerIdCounter = 0;

    /** 脏数据标记：记录哪些玩家需要保存 */
    private dirtyPlayers: Set<string> = new Set();

    /**
     * 构造器可在未来注入数据库仓库、AI 服务等依赖。
     */
    constructor() {
        // 初始化代码
    }

    /**
     * 创建新玩家并加入游戏世界
     * @param params 创建参数（名称、出生点等）
     * @returns 新创建的玩家快照
     */
    createPlayer(params: CreatePlayerParams): PlayerSnapshot {
        // 生成唯一 ID
        const playerId = `player_${++this.playerIdCounter}_${Date.now()}`;
        
        // 验证玩家名称
        if (!params.name || params.name.trim().length === 0) {
            throw new Error("Player name cannot be empty");
        }

        // 检查名称是否重复
        for (const player of this.players.values()) {
            if (player.getName() === params.name) {
                throw new Error(`Player name "${params.name}" already exists`);
            }
        }

        // 确定出生点
        const spawnPosition = params.spawnPosition || this.defaultSpawnPoint;

        // 创建玩家实例（暂时使用 null 作为 repository）
        const player = new PlayerAgent(
            playerId,
            params.name,
            spawnPosition,
            null
        );

        // 设置脏数据回调
        player.setDirtyCallback(() => this.markPlayerDirty(playerId));

        // 加入在线列表
        this.players.set(playerId, player);

        console.log(`✅ Player "${params.name}" joined the game (ID: ${playerId})`);

        return player.toSnapshot();
    }

    /**
     * 获取指定玩家
     * @param playerId 玩家 ID
     * @returns PlayerAgent 实例，如果不存在返回 undefined
     */
    getPlayer(playerId: string): PlayerAgent | undefined {
        return this.players.get(playerId);
    }

    /**
     * 移除玩家（玩家离开游戏）
     * @param playerId 玩家 ID
     * @returns 是否成功移除
     */
    removePlayer(playerId: string): boolean {
        const player = this.players.get(playerId);
        if (!player) {
            return false;
        }

        player.setStatus("offline");
        this.players.delete(playerId);

        console.log(`👋 Player "${player.getName()}" left the game (ID: ${playerId})`);

        return true;
    }

    /**
     * 获取所有在线玩家列表
     * @returns 玩家快照数组
     */
    getAllPlayers(): PlayerSnapshot[] {
        return Array.from(this.players.values()).map(player => player.toSnapshot());
    }

    /**
     * 获取在线玩家数量
     */
    getPlayerCount(): number {
        return this.players.size;
    }

    /**
     * 根据名称查找玩家
     * @param name 玩家名称
     * @returns PlayerAgent 实例，如果不存在返回 undefined
     */
    findPlayerByName(name: string): PlayerAgent | undefined {
        for (const player of this.players.values()) {
            if (player.getName() === name) {
                return player;
            }
        }
        return undefined;
    }

    /**
     * 获取指定范围内的玩家列表
     * @param centerX 中心 X 坐标
     * @param centerY 中心 Y 坐标
     * @param centerZ 中心 Z 坐标
     * @param radius 半径
     * @returns 在范围内的玩家快照数组
     */
    getPlayersInRange(centerX: number, centerY: number, centerZ: number, radius: number): PlayerSnapshot[] {
        const center = { x: centerX, y: centerY, z: centerZ };
        const playersInRange: PlayerSnapshot[] = [];

        for (const player of this.players.values()) {
            if (player.distanceTo(center) <= radius) {
                playersInRange.push(player.toSnapshot());
            }
        }

        return playersInRange;
    }

    /**
     * 更新所有玩家（游戏主循环调用）
     * @param deltaTime 距离上次更新的时间（毫秒）
     */
    updateAll(deltaTime: number): void {
        // TODO: 实现玩家 AI 逻辑、状态检查等
        // 例如：检查玩家是否超时离线、更新玩家状态等
        
        for (const player of this.players.values()) {
            // 这里可以添加自动逻辑
            // 例如：生命值自然恢复、饥饿度消耗等
        }
    }

    /**
     * 从数据库快照恢复玩家到在线列表
     * 用于服务器启动时加载玩家数据
     * @param snapshot 玩家快照数据
     */
    restorePlayer(snapshot: PlayerSnapshot): void {
        // 检查是否已存在（防止重复恢复）
        if (this.players.has(snapshot.id)) {
            console.warn(`⚠️  Player ${snapshot.id} already exists in memory, skipping restore`);
            return;
        }

        // 检查名称冲突（允许数据库中有重复名称的历史数据，但内存中只保留第一个）
        const existingPlayer = this.findPlayerByName(snapshot.name);
        if (existingPlayer) {
            console.warn(`⚠️  Player name "${snapshot.name}" already loaded (ID: ${existingPlayer.getId()}), skipping duplicate ${snapshot.id}`);
            return;
        }

        // 使用静态工厂方法从快照创建玩家实例
        const player = PlayerAgent.fromSnapshot(snapshot, null);

        // 设置脏数据回调
        player.setDirtyCallback(() => this.markPlayerDirty(snapshot.id));

        // 加入在线列表
        this.players.set(snapshot.id, player);

        console.log(`📦 Restored player "${snapshot.name}" from database (ID: ${snapshot.id})`);
    }

    /**
     * 标记玩家为脏数据（需要保存）
     * 当玩家数据发生变化时调用
     * @param playerId 玩家 ID
     */
    markPlayerDirty(playerId: string): void {
        this.dirtyPlayers.add(playerId);
    }

    /**
     * 获取所有需要保存的玩家
     * @returns 脏数据玩家列表
     */
    getDirtyPlayers(): PlayerSnapshot[] {
        const dirtyPlayersList: PlayerSnapshot[] = [];
        
        for (const playerId of this.dirtyPlayers) {
            const player = this.players.get(playerId);
            if (player) {
                dirtyPlayersList.push(player.toSnapshot());
            }
        }
        
        return dirtyPlayersList;
    }

    /**
     * 清除脏数据标记
     */
    clearDirtyFlags(): void {
        this.dirtyPlayers.clear();
    }

    /**
     * 清空所有玩家（用于服务器重置）
     */
    clearAll(): void {
        for (const playerId of this.players.keys()) {
            this.removePlayer(playerId);
        }
    }
}
