// server/Game/index.ts
import WeatherManager from "./World/weatherManager";
import WorldManager from "./World/WorldManager";
import TimeManager from "./World/TimeManager";

import InteractionManager from "./Interaction/InteractionManager";
import AgentManager from "./AgentFactory/AgentManager";
import { GameWorldStateModel } from "../Models/GameWorldState.js";
import type { GameWorldStateDocument } from "../Models/GameWorldState.js";
import type { GameTimeSnapshot } from "../Types/game.js";

//utils
import { TimeOfDay } from "../Types/weather.js";
import { describeWeather } from "./World/utils.js";

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
    /** Agent 管理器 -> 管理所有“冒险家/玩家”实体。 */
    private agentManager: AgentManager;

    /** 自动存档的定时器句柄。输出：正在运行的 setInterval；为空表示未启动。 */
    private saveTimer: NodeJS.Timeout | null = null;
    /** 自动存档间隔（毫秒）。默认 60_000ms = 现实 1 分钟。 */
    private readonly autoSaveIntervalMs = 60_000;

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
        this.timeManager = new TimeManager();
        this.weatherManager = new WeatherManager();

        // 监听时间变化以更新天气
        this.timeManager.onPeriodChange(period => {
            this.weatherManager.update(period);

            // 这里可以添加更多基于时间变化的逻辑
        });

        // 初始化环境（ 从MongoDB加载对应的数据）
        this.worldManager = new WorldManager();

        // 初始化玩家列表
        this.interactionManager = new InteractionManager();
        this.agentManager = new AgentManager();

    }

    /**
     * 手动推进一帧世界时间。
     * - 输入：无（通常由调试或内部循环调用）。
     * - 输出：无返回，但会更新 TimeManager 的 tick 和昼夜状态。
     */
    tick() {
        this.timeManager.advance();
    }

    /**
     * 初始化世界：
     * 1. 从 MongoDB 读取 worldId 对应的时间存档。
     * 2. 恢复世界时间并启动自动 tick。
     * 3. 开启自动存档（每分钟写回数据库）。
     */
    async init() {
        await this.loadWorldState();
        this.timeManager.start();
        this.startAutoSave();
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
            meta: {
                autoSaveIntervalMs: this.autoSaveIntervalMs,
            },
        };
    }

    /**
     * 关闭世界：
     * - 停止 tick 循环与自动存档。
     * - 立即把最新世界时间写回 MongoDB，确保不会丢档。
     */
    async shutdown() {
        this.timeManager.stop();
        this.stopAutoSave();
        await this.saveWorldState();
    }

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
     * 开启自动存档，就像 Minecraft 的“自动保存世界”机制。
     * 每隔 autoSaveIntervalMs（默认 1 分钟）写入一次 MongoDB。
     */
    private startAutoSave() {
        if (this.saveTimer) return;
        this.saveTimer = setInterval(() => {
            this.saveWorldState().catch((err) => {
                console.error("Failed to persist world state", err);
            });
        }, this.autoSaveIntervalMs);
    }

    /** 停止自动存档，常用于服务器优雅关停。 */
    private stopAutoSave() {
        if (!this.saveTimer) return;
        clearInterval(this.saveTimer);
        this.saveTimer = null;
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
            tickIntervalMs: doc.tickIntervalMs ?? 1000,
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

}
