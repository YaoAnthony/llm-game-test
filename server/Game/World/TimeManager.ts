import { TimeOfDay } from "../../types/weather.js";
import type { GameTimeSnapshot, StartTimeConfig } from "../../types/game.js";

/**
 * 时间管理器
 * 负责处理日夜循环、季节变化等时间相关的逻辑。
 *
 * 可以把它想象成《我的世界》服务端里的“世界时钟”：
 * - 每推进 1 个 tick，就像 MC 内部每 1/20 秒的全局心跳。
 * - 240 个 tick 组成一个“昼夜循环”，你可以按需调整以模拟更短或更长的一天。
 *
 * 设计目标：
 * 1. **全局共享** —— 所有玩家看到同一条时间线。
 * 2. **可持久化** —— 将时间状态写入 MongoDB 后，可在服务器重启时恢复。
 * 3. **抗漂移** —— 以内置的真实时间（Date.now）推进，避免 setInterval 漂移导致的误差。
 */
export default class TimeManager {
    private tick: number; // 当前服务器 tick（类似 MC 世界 tick）
    private timeOfDay: TimeOfDay; // 当前时间段（黎明/白天/黄昏/夜晚）
    private readonly listeners: Array<(timeOfDay: TimeOfDay) => void> = [];

    private readonly tickIntervalMs: number; // 每个 tick 对应的真实毫秒数（默认 1000ms）
    private speedMultiplier: number; // 类似 MC /time set daySpeed——可加速或减速时间流逝
    private readonly ticksPerDay: number; // 一个昼夜由多少个 tick 组成（默认 240）

    private lastUpdatedAt: number; // 上一次推进 tick 时的真实时间戳（毫秒）
    
    private isActive: boolean = false; // 标记时间系统是否激活

    /**
     * @param snapshot 输入：可选的数据库快照，类似服务器重启后读到的 level.dat 时间信息。
     * @param config 输入：可选的启动配置，例如自定义 tick 周期或时间倍速。
     * 构造函数会根据 snapshot 恢复世界钟；若没有快照，则按默认配置起新世界。
     */
    constructor(snapshot?: Partial<GameTimeSnapshot>, config: StartTimeConfig = {}) {
        this.tickIntervalMs = snapshot?.tickIntervalMs ?? config.tickIntervalMs ?? 1000; // 默认 1 秒推进 1 tick
        this.speedMultiplier = snapshot?.speedMultiplier ?? config.speedMultiplier ?? 1;
        this.ticksPerDay = 240; // 默认 240 tick = 1 天，可理解为 MC 中“12 分钟”的压缩版

        this.tick = snapshot?.tick ?? 0;
        this.timeOfDay = snapshot?.timeOfDay ?? this.resolvePeriod(this.tick);

        const parsed = snapshot?.lastUpdatedAt ? Date.parse(snapshot.lastUpdatedAt) : NaN;
        this.lastUpdatedAt = Number.isFinite(parsed) ? parsed : Date.now();
    }

    /**
     * 启动自动推进循环。
     * 相当于在 MC 服务器里开启一个后台时钟，按既定速率不断触发“世界心跳”。
     */
    start() {
        if (this.isActive) return;
        this.lastUpdatedAt = Date.now();
        this.isActive = true;
    }

    /** 停止自动推进 —— 类似暂停服务器时间 */
    stop() {
        this.isActive = false;
    }

    /**
     * @returns 输出：布尔值，true 代表世界钟正在运行。
     * 可类比检测 Minecraft 服务器的 `isDedicatedServerRunning()`。
     */
    isRunning() {
        return this.isActive;
    }

    /**
     * 手动推进时间（由 Game 主循环调用）
     * @param deltaTime 输入：距离上次更新的毫秒数（由游戏循环传入）
     */
    advance(deltaTime: number) {
        if (!this.isActive) return;
        
        // 根据 deltaTime 和 speedMultiplier 计算推进的 tick 数
        const scaledElapsed = deltaTime * this.speedMultiplier;
        const ticksToAdvance = Math.floor(scaledElapsed / this.tickIntervalMs);
        
        if (ticksToAdvance <= 0) return;

        this.applyTickAdvance(ticksToAdvance);
    }

    /** 兼容旧接口：单步推进，相当于 `/time add 1`。 */
    update() {
        this.advance(1);
    }

    /**
     * 注册日夜切换的监听器。
     * @param cb 输入：回调函数，参数为新的 TimeOfDay（输出）。
     * 用法就像给 Minecraft 注册一个事件：当从白天切夜晚时触发通知。
     */
    onPeriodChange(cb: (timeOfDay: TimeOfDay) => void) {
        this.listeners.push(cb);
    }

    /**
     * @returns 输出：当前世界 tick。（可给调试 HUD 使用。）
     */
    getCurrentTime(): number {
        return this.tick;
    }

    /**
     * @returns 输出：当前处于的时间段（黎明/白天/黄昏/夜晚）。
     */
    getTimeOfDay(): TimeOfDay {
        return this.timeOfDay;
    }

    /**
     * @returns 输出：时间流速倍率。
     * 等同于服务器现在采用的“时间倍速”，便于前端展示或同步。
     */
    getSpeedMultiplier(): number {
        return this.speedMultiplier;
    }

    /**
     * @returns 输出：每个 tick 对应的真实毫秒数。
     * 例如 1000 表示现实 1 秒推进一次世界心跳。
     */
    getTickIntervalMs(): number {
        return this.tickIntervalMs;
    }

    /**
     * @param multiplier 输入：新的时间流速倍率，>0。
     * 会立即重置 lastUpdatedAt，避免因速度切换导致时间跳跃。
     * 可以理解为指令 `/time set` 调整世界时间速度。
     */
    setSpeed(multiplier: number) {
        if (multiplier <= 0) throw new Error("Speed multiplier must be positive");
        this.speedMultiplier = multiplier;
        this.lastUpdatedAt = Date.now();
    }

    /**
     * @returns 输出：GameTimeSnapshot。
     * 用于将当前世界钟写入 MongoDB，类似 MC 将 level.dat serialize。
     */
    toSnapshot(): GameTimeSnapshot {
        return {
            tick: this.tick,
            timeOfDay: this.timeOfDay,
            speedMultiplier: this.speedMultiplier,
            tickIntervalMs: this.tickIntervalMs,
            lastUpdatedAt: new Date(this.lastUpdatedAt).toISOString(),
        };
    }

    /**
     * 从数据库快照恢复状态，类似服务器读入 level.dat 的世界时间。
     * @param snapshot 输入：数据库读取的 GameTimeSnapshot。
     */
    restore(snapshot: GameTimeSnapshot) {
        this.tick = snapshot.tick;
        this.timeOfDay = snapshot.timeOfDay;
        this.speedMultiplier = snapshot.speedMultiplier;
        this.lastUpdatedAt = Date.parse(snapshot.lastUpdatedAt) || Date.now();
        // tickIntervalMs 在构造器阶段已经固定，不允许运行时修改
        this.applyTickAdvance(0); // 确保监听器同步最新周期
    }

    /**
     * 真正做 tick 累加的内部助手。
     * @param delta 输入：需要推进的 tick 数。
     * 会更新 tick、重算 timeOfDay，并在跨越昼夜边界时通知监听器。
     */
    private applyTickAdvance(delta: number) {
        if (delta <= 0) return;

        const prevPeriod = this.timeOfDay;
        this.tick += delta;
        this.timeOfDay = this.resolvePeriod(this.tick);

        if (this.timeOfDay !== prevPeriod) {
            this.listeners.forEach((fn) => fn(this.timeOfDay));
        }
    }

    /**
     * 根据 tick 计算当前处于哪个时间段。
     * @param tick 输入：世界 tick。
     * @returns 输出：TimeOfDay。
     * 逻辑类似 MC 将一天分成四个阶段并根据 tick 范围决定太阳高度。
     */
    private resolvePeriod(tick: number): TimeOfDay {
        const periodLength = this.ticksPerDay / 4; // 4 个时间段平均划分
        const normalized = ((tick % this.ticksPerDay) + this.ticksPerDay) % this.ticksPerDay;

        if (normalized < periodLength) return TimeOfDay.Dawn;
        if (normalized < periodLength * 2) return TimeOfDay.Day;
        if (normalized < periodLength * 3) return TimeOfDay.Dusk;
        return TimeOfDay.Night;
    }
}