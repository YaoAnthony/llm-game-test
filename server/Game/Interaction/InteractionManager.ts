

import WorldManager from "../World/WorldManager.js";
import AgentManager from "../AgentFactory/AgentManager.js";
import type { Position2D } from "../../types/terrain.js";
import type { Position } from "../../types/agent.js";

/**
 * 交互类型枚举
 * 定义玩家可以执行的所有交互动作
 */
export enum InteractionType {
    TILL = "till",         // 耕地
    PLANT = "plant",       // 种植
    HARVEST = "harvest",   // 收获作物
    WATER = "water",       // 浇水
    CHOP = "chop",         // 砍树
    MINE = "mine",         // 挖矿/采集石头
    LOOK = "look",         // 查看周围环境
}

/**
 * 交互请求接口
 */
export interface InteractionRequest {
    /** 发起交互的玩家 ID */
    playerId: string;
    /** 交互类型 */
    type: InteractionType;
    /** 目标位置（2D 坐标） */
    target: Position2D;
    /** 额外数据（如种植的作物 ID） */
    data?: any;
}

/**
 * 交互结果接口
 */
export interface InteractionResult {
    /** 是否成功 */
    success: boolean;
    /** 结果消息 */
    message: string;
    /** 世界变化数据（可选） */
    changes?: {
        position: Position2D;
        action: string;
        [key: string]: any;
    };
    /** 获得的物品（可选） */
    rewards?: string[];
}

/**
 * InteractionManager 负责处理玩家与世界的交互事件。
 * 可把它想象成 Minecraft 里的服务器事件总线：
 * - 玩家攻击、开箱子、与 NPC 对话等都将在这里集中调度。
 * - 验证玩家权限和距离
 * - 调用 WorldManager 修改地形
 * - 给予玩家奖励
 * - 支持并发安全的交互队列
 */
export default class InteractionManager {
    private worldManager: WorldManager;
    private agentManager: AgentManager;

    /** 最大交互距离（格子） */
    private readonly MAX_INTERACTION_DISTANCE = 1.5;

    /** 交互队列：每个位置维护一个 Promise 链，确保串行化 */
    private interactionQueues: Map<string, Promise<InteractionResult>> = new Map();

    /** 正在处理的交互计数（用于监控） */
    private processingCount = 0;

    /**
     * 构造函数，注入依赖
     * @param worldManager 世界管理器
     * @param agentManager 玩家管理器
     */
    constructor(worldManager: WorldManager, agentManager: AgentManager) {
        this.worldManager = worldManager;
        this.agentManager = agentManager;
    }

    /**
     * 处理交互请求（异步版本，支持队列）
     * 这是主入口函数，所有交互都会经过这里
     * @param request 交互请求
     * @returns 交互结果的 Promise
     */
    async handleInteractionAsync(request: InteractionRequest): Promise<InteractionResult> {
        const posKey = `${request.target.x},${request.target.y}`;
        
        // 等待该位置之前的交互完成
        const previousPromise = this.interactionQueues.get(posKey);
        if (previousPromise) {
            try {
                await previousPromise;
            } catch (err) {
                // 忽略之前的错误，继续处理当前请求
            }
        }
        
        // 创建当前交互的 Promise
        const currentPromise = this.processInteraction(request);
        this.interactionQueues.set(posKey, currentPromise);
        
        try {
            this.processingCount++;
            return await currentPromise;
        } finally {
            this.processingCount--;
            // 如果是最后一个交互，清理队列
            if (this.interactionQueues.get(posKey) === currentPromise) {
                this.interactionQueues.delete(posKey);
            }
        }
    }

    /**
     * 实际处理交互的内部方法
     * @param request 交互请求
     * @returns 交互结果
     */
    private async processInteraction(request: InteractionRequest): Promise<InteractionResult> {
        // 1. 验证玩家存在
        const player = this.agentManager.getPlayer(request.playerId);
        if (!player) {
            return { success: false, message: "玩家不存在" };
        }

        // 2. 将 3D 位置转换为 2D 地图坐标
        const playerPos = this.to2D(player.getPosition());

        // 3. 检查距离（玩家必须在目标附近）
        const distance = this.calculateDistance(playerPos, request.target);
        if (distance > this.MAX_INTERACTION_DISTANCE) {
            return {
                success: false,
                message: `距离太远（${distance.toFixed(1)} > ${this.MAX_INTERACTION_DISTANCE}）`,
            };
        }

        // 4. 根据交互类型分发到具体处理函数
        switch (request.type) {
            case InteractionType.TILL:
                return this.handleTill(request.target);

            case InteractionType.PLANT:
                return this.handlePlant(request.target, request.data?.cropId);

            case InteractionType.WATER:
                return this.handleWater(request.target);

            case InteractionType.CHOP:
            case InteractionType.MINE:
                return this.handleHarvest(request.target, request.type);

            case InteractionType.LOOK:
                return this.handleLook(playerPos);

            default:
                return { success: false, message: "未知的交互类型" };
        }
    }

    /**
     * 处理交互请求（同步版本，保持向后兼容）
     * ⚠️ DEPRECATED - 代码重复问题
     * 
     * 架构问题：
     * 1. 与 handleInteractionAsync 有 90% 重复代码
     * 2. 同步版本无法利用队列机制，可能导致并发问题
     * 3. 推荐使用 handleInteractionAsync 替代
     * 
     * @param request 交互请求
     * @returns 交互结果
     */
    handleInteraction(request: InteractionRequest): InteractionResult {
        // 重构建议：直接调用 processInteraction，避免重复代码
        // TODO: 将所有调用点迁移到 handleInteractionAsync 后删除此方法
        
        // 1. 验证玩家存在
        const player = this.agentManager.getPlayer(request.playerId);
        if (!player) {
            return { success: false, message: "玩家不存在" };
        }

        // 2. 将 3D 位置转换为 2D 地图坐标
        const playerPos = this.to2D(player.getPosition());

        // 3. 检查距离（玩家必须在目标附近）
        const distance = this.calculateDistance(playerPos, request.target);
        if (distance > this.MAX_INTERACTION_DISTANCE) {
            return {
                success: false,
                message: `距离太远（${distance.toFixed(1)} > ${this.MAX_INTERACTION_DISTANCE}）`,
            };
        }

        // 4. 根据交互类型分发到具体处理函数
        switch (request.type) {
            case InteractionType.TILL:
                return this.handleTill(request.target);

            case InteractionType.PLANT:
                return this.handlePlant(request.target, request.data?.cropId);

            case InteractionType.WATER:
                return this.handleWater(request.target);

            case InteractionType.CHOP:
            case InteractionType.MINE:
                return this.handleHarvest(request.target, request.type);

            case InteractionType.LOOK:
                return this.handleLook(playerPos);

            default:
                return { success: false, message: "未知的交互类型" };
        }
    }

    // ==================== 交互处理函数 ====================

    /**
     * 处理耕地交互
     * 将草地转换为耕地
     */
    private handleTill(pos: Position2D): InteractionResult {
        if (!this.worldManager.isTillable(pos)) {
            return { success: false, message: "该位置无法耕种" };
        }

        const success = this.worldManager.tillLand(pos);

        if (success) {
            return {
                success: true,
                message: "✅ 成功耕地",
                changes: { position: pos, action: "tilled" },
            };
        }

        return { success: false, message: "❌ 耕地失败" };
    }

    /**
     * 处理种植交互
     * 在耕地上种植作物
     */
    private handlePlant(pos: Position2D, cropId: string): InteractionResult {
        if (!cropId) {
            return { success: false, message: "未指定作物 ID" };
        }

        const tile = this.worldManager.getTile(pos);
        if (tile.type !== "FARMLAND") {
            return { success: false, message: "该位置不是耕地" };
        }

        const success = this.worldManager.plantCrop(pos, cropId);

        if (success) {
            return {
                success: true,
                message: `✅ 成功种植 ${cropId}`,
                changes: { position: pos, action: "planted", cropId },
            };
        }

        return { success: false, message: "❌ 种植失败（可能已有作物）" };
    }

    /**
     * 处理浇水交互
     * 给耕地浇水，加速作物生长
     */
    private handleWater(pos: Position2D): InteractionResult {
        const success = this.worldManager.waterTile(pos);

        if (success) {
            return {
                success: true,
                message: "✅ 成功浇水",
                changes: { position: pos, action: "watered" },
            };
        }

        return { success: false, message: "❌ 该位置无法浇水" };
    }

    /**
     * 处理采集交互（砍树、挖石头）
     * 减少资源耐久度，完全采集后获得掉落物
     */
    private handleHarvest(pos: Position2D, type: InteractionType): InteractionResult {
        if (!this.worldManager.isHarvestable(pos)) {
            return { success: false, message: "该位置无法采集" };
        }

        const result = this.worldManager.harvest(pos);

        if (!result.success) {
            return { success: false, message: "采集失败" };
        }

        const action = type === InteractionType.CHOP ? "砍伐" : "采集";

        if (result.complete && result.drops) {
            return {
                success: true,
                message: `✅ ${action}完成！`,
                changes: { position: pos, action: "harvested" },
                rewards: result.drops,
            };
        } else {
            return {
                success: true,
                message: `⛏️ 正在${action}中...`,
                changes: { position: pos, action: "harvesting" },
            };
        }
    }

    /**
     * 处理查看交互
     * 返回玩家周围环境的描述
     */
    private handleLook(pos: Position2D): InteractionResult {
        const description = this.worldManager.describeView(pos, 3);

        return {
            success: true,
            message: description,
        };
    }

    // ==================== 辅助函数 ====================

    /**
     * 将 3D 位置转换为 2D 地图坐标
     * 忽略 Y 轴（高度），只取 X 和 Z
     */
    private to2D(pos3D: Position): Position2D {
        return {
            x: Math.floor(pos3D.x),
            y: Math.floor(pos3D.z), // 注意：地图的 Y 对应 3D 空间的 Z
        };
    }

    /**
     * 计算两个 2D 坐标之间的欧几里得距离
     */
    private calculateDistance(a: Position2D, b: Position2D): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 游戏循环更新
     * 处理延迟交互、动画等
     * @param deltaTime 距离上次更新的时间（毫秒）
     */
    update(deltaTime: number): void {
        // TODO: 实现延迟交互逻辑
        // - 处理正在进行的采集动画
        // - 作物生长逻辑
        // - 自动触发的交互（如陷阱）
        
        // 清理超时的队列（防止内存泄漏）
        if (this.interactionQueues.size > 1000) {
            console.warn(`⚠️ Interaction queue size is large: ${this.interactionQueues.size}`);
        }
    }

    /**
     * 获取当前队列统计信息（用于监控）
     */
    getQueueStats(): { queueSize: number; processingCount: number } {
        return {
            queueSize: this.interactionQueues.size,
            processingCount: this.processingCount,
        };
    }
}