// server/Game/index.ts
import WeatherManager from "./World/WeatherManager";
import WorldManager from "./World/WorldManager";
import TimeManager from "./World/TimeManager";

import InteractionManager from "./Interaction/InteractionManager";
import AgentManager from "./AgentFactory/AgentManager";
import { GameWorldStateModel } from "../Models/GameWorldState.js";
import type { GameWorldStateDocument } from "../Models/GameWorldState.js";
import { WorldMapModel } from "../Models/WorldMap.js";
import type { GameTimeSnapshot } from "../types/game.js";

//utils
import { TimeOfDay } from "../types/weather.js";
import { describeWeather } from "./World/utils.js";

// Service Layer
import { PlayerService } from "./Services/PlayerService.js";
import { PlayerRepository } from "./Repositories/PlayerRepository.js";

// types


/**
 * 《我的世界》式的“主世界控制台”。
 * - 负责统筹整个服务器世界（天气、时间、玩家、交互等）。
 * - 启动时会从 MongoDB 取回某个 worldId 对应的“存档”（类似 level.dat），
 *   恢复世界钟并让所有玩家看到统一的昼夜变化。
 */
export default class Game {
    /** 全局唯一的 Game 实例，就像单个 Minecraft 服务器进程。 */
    private static instance: Game;
    /** worldId：对应哪一个世界存档。输入：字符串，通常来自环境变量。 */
    private gameId: string;

    /** 天气管理器 -> 类似控制《我的世界》里的下雨/雷暴逻辑。 */
    private weatherManager: WeatherManager;
    /** 世界管理器 -> 管理地形/环境，占位以便后续挂接地形等系统。 */
    private worldManager: WorldManager;
    /** 时间管理器 -> 世界心跳，推进世界 tick。 */
    private timeManager: TimeManager;
    /** 交互管理器 -> 玩家与方块、NPC 的交互中心。 */
    private interactionManager: InteractionManager;
    /** Agent 管理器 -> 管理所有"冒险家/玩家"实体。 */
    private agentManager: AgentManager;

    /** 玩家服务 -> 处理玩家相关的业务逻辑（使用 Repository 模式） */
    private playerService: PlayerService;

    // ⚠️ 架构重构：移除独立的 saveTimer，改为在游戏循环中定期检查
    // private saveTimer: ReturnType<typeof setInterval> | null = null;
    
    /** 游戏主循环定时器（统一管理所有系统更新） */
    private gameLoopTimer: ReturnType<typeof setInterval> | null = null;
    /** 游戏主循环间隔（毫秒）。默认 50ms = 20 TPS (Ticks Per Second) */
    private readonly gameLoopIntervalMs = 50;
    /** 上次更新时间戳 */
    private lastUpdateTime: number = Date.now();
    /** 上次自动存档时间戳 */
    private lastSaveTime: number = Date.now();
    /** 自动存档间隔（毫秒）。默认 60_000ms = 现实 1 分钟。 */
    private readonly autoSaveIntervalMs = 60_000;
    /** Tick 事件监听器列表 */
    private tickListeners: Array<() => void> = [];

    /**
     * 获取单例。
     * @param id worldId（输入）——希望加载的世界编号，例如 "main-overworld"。
     * @returns Game 实例（输出）——全局共享的服务器控制台。
     */
    static getInstance(id: string): Game {
        if (!Game.instance) {
            Game.instance = new Game(id);
        }
        return Game.instance;
    }

    /**
     * 构造函数：一般不会直接调用，请通过 getInstance 入口。
     * @param gameId 输入，代表要操作的世界存档主键。
     */
    private constructor(gameId: string) {
        this.gameId = gameId; // 用于加载存档

        // 检查gameId对应的存档是否存在，若存在则加载，否则初始化新游戏


        // 初始化游戏状态（ 从MongoDB加载对应的数据）

        // 启动时间管理器(如果数据库有时间，则从数据库加载，否则初始化默认时间)
        // 使用 50ms 的 tick 间隔以匹配游戏循环的 20 TPS
        this.timeManager = new TimeManager(undefined, { tickIntervalMs: 50 });
        this.weatherManager = new WeatherManager();

        // 监听时间变化以更新天气
        this.timeManager.onPeriodChange(period => {
            this.weatherManager.update(period);

            // 这里可以添加更多基于时间变化的逻辑
        });

        // 初始化环境（ 从MongoDB加载对应的数据）
        this.worldManager = new WorldManager(this.gameId, 50, 50); // 创建 50x50 的世界

        // 初始化玩家列表
        this.agentManager = new AgentManager();
        
        // 初始化玩家服务（使用 Repository + Service 模式）
        const playerRepository = new PlayerRepository();
        this.playerService = new PlayerService(this.gameId, this.agentManager, playerRepository);
        
        // 初始化交互系统（需要依赖 worldManager 和 agentManager）
        this.interactionManager = new InteractionManager(this.worldManager, this.agentManager);

    }

    /**
     * 手动推进一帧世界时间（调试用）。
     * - 输入：无（通常由调试或内部循环调用）。
     * - 输出：无返回，但会更新 TimeManager 的 tick 和昼夜状态。
     * 
     * ⚠️ 注意：现在由 update() 统一调用 timeManager.advance(deltaTime)
     */
    tick() {
        this.timeManager.advance(this.gameLoopIntervalMs);
    }

    /**
     * 初始化世界：
     * 1. 从 MongoDB 读取 worldId 对应的时间存档。
     * 2. 从 MongoDB 加载玩家数据。
     * 3. 激活时间系统（不启动独立定时器）。
     * 4. 启动统一的游戏主循环（包含时间推进和自动存档）。
     */
    async init() {
        await this.loadWorldState();
        await this.playerService.restoreAllPlayers();
        this.timeManager.start(); // 只激活状态，不启动定时器
        this.startGameLoop(); // 启动统一的游戏循环
    }

    /**
     * 获取当前世界状态快照，常用于 REST API 响应。
     * @returns 输出对象，包含：
     *   - tick：当前全局 tick。
     *   - timeOfDay：世界处于哪个时间段（黎明/白天/黄昏/夜晚）。
     *   - weather：天气管理器给出的天气描述。
     */
    getState() {
        const snapshot = this.getWorldData();
        return {
            tick: snapshot.time.tick,
            timeOfDay: snapshot.time.timeOfDay,
            weather: snapshot.weather.current,
        };
    }

    /**
     * 为前端提供完整的世界快照，方便实时刷新 UI。
     * @returns 输出：
     * ```ts
     * {
     *   worldId: string;
     *   time: {
     *     tick: number;
     *     timeOfDay: TimeOfDay;
     *     speedMultiplier: number;
     *     tickIntervalMs: number;
     *     isRunning: boolean;
     *   };
     *   weather: {
     *     current: WeatherType;
     *     description: string;
     *   };
     *   meta: {
     *     autoSaveIntervalMs: number;
     *   };
     * }
     * ```
     * 类比 Minecraft 的 `/data get storage`，一次性把世界核心数据打包给客户端。
     */
    getWorldData() {
        const currentWeather = this.weatherManager.getWeather();
        const mapData = this.worldManager.getMapData(); // ✅ 获取地形数据

        return {
            worldId: this.gameId,
            time: {
                tick: this.timeManager.getCurrentTime(),
                timeOfDay: this.timeManager.getTimeOfDay(),
                speedMultiplier: this.timeManager.getSpeedMultiplier(),
                tickIntervalMs: this.timeManager.getTickIntervalMs(),
                isRunning: this.timeManager.isRunning(),
            },
            weather: {
                current: currentWeather,
                description: describeWeather(currentWeather),
            },
            map: mapData, // ✅ 添加地图数据
            meta: {
                autoSaveIntervalMs: this.autoSaveIntervalMs,
            },
        };
    }

    /**
     * 关闭世界：
     * - 停止时间系统和游戏主循环。
     * - 立即把最新世界时间和玩家数据写回 MongoDB，确保不会丢档。
     */
    async shutdown() {
        this.timeManager.stop();
        this.stopGameLoop();
        await this.saveWorldState();
        await this.playerService.saveAllPlayers();
        console.log("🛑 Game world shutdown complete");
    }

    // ===== 玩家管理接口 =====
    // ===== 玩家管理接口（委托给 PlayerService）=====

    /**
     * 创建新玩家并加入游戏
     */
    async createPlayer(params: import("../types/agent.js").CreatePlayerParams) {
        return await this.playerService.createPlayer(params);
    }

    /**
     * 获取玩家快照信息
     */
    async getPlayer(playerId: string) {
        return await this.playerService.getPlayer(playerId);
    }

    /**
     * 获取玩家实体（用于操作）
     */
    getPlayerAgent(playerId: string) {
        return this.agentManager.getPlayer(playerId);
    }

    /**
     * 移除玩家
     */
    async removePlayer(playerId: string) {
        return await this.playerService.removePlayer(playerId);
    }

    /**
     * 获取所有在线玩家
     */
    getAllPlayers() {
        return this.playerService.getAllPlayers();
    }

    /**
     * 获取在线玩家数量
     */
    getPlayerCount() {
        return this.playerService.getPlayerCount();
    }

    /**
     * 获取指定范围内的玩家
     */
    getPlayersInRange(x: number, y: number, z: number, radius: number) {
        return this.playerService.getPlayersInRange({ x, y, z }, radius);
    }

    // ===== 世界管理接口 =====

    /**
     * 获取世界管理器（用于访问地形）
     */
    getWorldManager() {
        return this.worldManager;
    }

    /**
     * 处理玩家交互
     */
    handleInteraction(request: import("./Interaction/InteractionManager.js").InteractionRequest) {
        return this.interactionManager.handleInteraction(request);
    }

    // ===== 私有方法 =====

    /**
     * 从数据库加载世界时间。
     * 输入：this.gameId。
     * - 若找到存档，则调用 TimeManager.restore 恢复 tick。
     * - 若没有存档，则写入一份新世界的默认配置。
     * 输出：无返回值，但内部会更新 TimeManager 和 WeatherManager。
     */
    private async loadWorldState() {
        const doc = await GameWorldStateModel.findOne({ worldId: this.gameId }).lean<GameWorldStateDocument>();

        if (doc?.time) {
            const snapshot = this.toSnapshotFromDocument(doc.time);
            this.timeManager.restore(snapshot);
        } else {
            await this.saveWorldState();
        }

        // 同步一次天气，避免服务器启动后第一帧天气为空
        this.weatherManager.update(this.timeManager.getTimeOfDay());
    }

    /**
     * 将当前世界钟保存到数据库。
     * - 输入：无（内部读取 TimeManager）。
     * - 输出：无直接返回，MongoDB 中对应 worldId 的文档会被更新。
     */
    private async saveWorldState() {
        const snapshot = this.timeManager.toSnapshot();

        await GameWorldStateModel.findOneAndUpdate(
            { worldId: this.gameId },
            {
                $set: {
                    time: this.fromSnapshotToDocument(snapshot),
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }


    /**
     * 保存地形脏数据（仅保存发生变化的地形瓦片）
     * 在游戏循环中调用，性能更好
     */
    private async saveDirtyTerrain() {
        try {
            if (!this.worldManager.hasDirtyData()) {
                return; // 没有脏数据，跳过
            }

            const dirtyTiles = this.worldManager.getDirtyTiles();
            
            if (dirtyTiles.length === 0) {
                return;
            }

            // 将脏数据瓦片转换为MongoDB更新操作
            const updateOps = dirtyTiles.map(({ pos, tile }) => ({
                position: pos,
                tileData: tile,
            }));

            // 更新或创建世界地图文档
            await WorldMapModel.findOneAndUpdate(
                { worldId: this.gameId },
                {
                    $set: {
                        dirtyChunks: updateOps,
                        updatedAt: new Date(),
                    },
                    $setOnInsert: {
                        width: this.worldManager.width,
                        height: this.worldManager.height,
                        createdAt: new Date(),
                    },
                },
                { upsert: true, new: true }
            );

            // 清除脏数据标记
            this.worldManager.clearDirtyFlags();
            
            console.log(`🗺️ Saved ${dirtyTiles.length} dirty terrain tiles to database`);
        } catch (err) {
            console.error("❌ Failed to save dirty terrain to database:", err);
        }
    }

    // ⚠️ 已删除 startAutoSave 和 stopAutoSave
    // 自动存档逻辑已整合到 update() 方法中

    /**
     * 启动游戏主循环（统一管理所有系统）
     * 类似 Minecraft 的 20 TPS (Ticks Per Second) 机制
     * 每 50ms 更新一次所有游戏系统
     */
    private startGameLoop() {
        if (this.gameLoopTimer) return;

        this.lastUpdateTime = Date.now();
        this.lastSaveTime = Date.now();

        this.gameLoopTimer = setInterval(() => {
            const now = Date.now();
            const deltaTime = now - this.lastUpdateTime;
            this.lastUpdateTime = now;

            this.update(deltaTime);
        }, this.gameLoopIntervalMs);

        console.log(`🔄 Game loop started (${1000 / this.gameLoopIntervalMs} TPS)`);
    }

    /**
     * 停止游戏主循环
     */
    private stopGameLoop() {
        if (!this.gameLoopTimer) return;
        clearInterval(this.gameLoopTimer);
        this.gameLoopTimer = null;
        console.log("⏸️  Game loop stopped");
    }

    /**
     * 游戏主更新函数（统一驱动所有系统）
     * 在这里驱动所有游戏子系统的更新
     * @param deltaTime 距离上次更新的毫秒数
     */
    private update(deltaTime: number) {
        try {
            // 0. ✅ 推进时间系统（由游戏循环统一驱动）
            this.timeManager.advance(deltaTime);

            // 1. 更新所有玩家（AI 逻辑、状态检查等）
            this.agentManager.updateAll(deltaTime);

            // 2. 更新交互系统（延迟交互、作物生长等）
            this.interactionManager.update(deltaTime);

            // 3. 更新世界系统（地形变化、资源再生等）
            this.worldManager.update(deltaTime);

            // 4. 触发 tick 事件监听器（用于 WebSocket 实时推送等）
            this.emitTick();

            // 5. 保存脏数据（有变化的玩家）
            if (this.agentManager.getDirtyPlayers().length > 0) {
                setImmediate(() => {
                    this.playerService.saveDirtyPlayers().catch(err => {
                        console.error("Failed to save dirty players", err);
                    });
                });
            }

            // 6. 保存脏数据（有变化的地形）
            if (this.worldManager.hasDirtyData()) {
                setImmediate(() => {
                    this.saveDirtyTerrain().catch(err => {
                        console.error("Failed to save dirty terrain", err);
                    });
                });
            }

            // 7. ✅ 定期自动存档（替代独立的 saveTimer）
            const now = Date.now();
            if (now - this.lastSaveTime >= this.autoSaveIntervalMs) {
                this.lastSaveTime = now;
                setImmediate(() => {
                    this.saveWorldState().catch(err => {
                        console.error("Failed to persist world state", err);
                    });
                    this.playerService.saveAllPlayers().catch(err => {
                        console.error("Failed to persist players", err);
                    });
                });
            }

            // TODO: 添加更多系统更新
            // - 物理系统
            // - 碰撞检测
            // - NPC AI
            // - 战斗系统
            // - 任务系统
        } catch (err) {
            console.error("❌ Error in game update loop:", err);
        }
    }

    /**
     * 将 MongoDB 文档中的 time 字段转换为 TimeManager 可理解的快照。
     * @param doc 输入：数据库记录。
     * @returns 输出：GameTimeSnapshot，供 TimeManager 恢复状态。
     */
    private toSnapshotFromDocument(doc: GameWorldStateDocument["time"]): GameTimeSnapshot {
        return {
            tick: doc.tick ?? 0,
            timeOfDay: (doc.timeOfDay as TimeOfDay) ?? TimeOfDay.Day,
            speedMultiplier: doc.speedMultiplier ?? 1,
            tickIntervalMs: doc.tickIntervalMs ?? 50, // 默认 50ms 以匹配游戏循环
            lastUpdatedAt: doc.lastUpdatedAt instanceof Date
                ? doc.lastUpdatedAt.toISOString()
                : new Date(doc.lastUpdatedAt ?? Date.now()).toISOString(),
        };
    }

    /**
     * 将 TimeManager 的快照转换为 MongoDB 可存的对象。
     * @param snapshot 输入：GameTimeSnapshot。
     * @returns 输出：符合 Schema 的对象，用于写入 time 字段。
     */
    private fromSnapshotToDocument(snapshot: GameTimeSnapshot): GameWorldStateDocument["time"] {
        return {
            tick: snapshot.tick,
            timeOfDay: snapshot.timeOfDay,
            speedMultiplier: snapshot.speedMultiplier,
            tickIntervalMs: snapshot.tickIntervalMs,
            lastUpdatedAt: new Date(snapshot.lastUpdatedAt),
        };
    }

    /**
     * 注册 tick 事件监听器
     * @param callback 每个 game tick 触发的回调函数
     */
    public onTick(callback: () => void): void {
        this.tickListeners.push(callback);
    }

    /**
     * 触发所有 tick 事件监听器
     */
    private emitTick(): void {
        this.tickListeners.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error("Error in tick listener:", error);
            }
        });
    }

}
