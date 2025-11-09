/**
 * Agent 行为队列系统
 * 用于管理 Agent（玩家和 NPC）的行为队列
 * 防止并发行为冲突，确保行为按顺序执行
 */

/**
 * 行为类型
 */
export enum ActionType {
    MOVE = 'move',
    INTERACT = 'interact',
    ATTACK = 'attack',
    USE_ITEM = 'use_item',
    SPEAK = 'speak',
    IDLE = 'idle',
}

/**
 * 行为优先级
 */
export enum ActionPriority {
    CRITICAL = 0,  // 关键行为（如死亡、强制传送）
    HIGH = 1,      // 高优先级（如战斗、紧急逃跑）
    NORMAL = 2,    // 普通优先级（如移动、交互）
    LOW = 3,       // 低优先级（如闲逛、对话）
}

/**
 * Agent 行为接口
 */
export interface AgentAction {
    /** 行为 ID */
    id: string;
    /** Agent ID */
    agentId: string;
    /** 行为类型 */
    type: ActionType;
    /** 目标数据 */
    target?: any;
    /** 优先级 */
    priority: ActionPriority;
    /** 创建时间戳 */
    timestamp: number;
    /** 是否可取消 */
    cancellable: boolean;
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 执行函数 */
    execute: () => Promise<ActionResult>;
}

/**
 * 行为执行结果
 */
export interface ActionResult {
    /** 是否成功 */
    success: boolean;
    /** 结果消息 */
    message?: string;
    /** 附加数据 */
    data?: any;
}

/**
 * Agent 行为队列管理器
 * 每个 Agent 维护自己的行为队列
 */
export class AgentActionQueue {
    /** Agent 行为队列：agentId -> 行为队列 */
    private queues: Map<string, AgentAction[]> = new Map();
    
    /** 正在执行的行为：agentId -> 当前行为 */
    private executing: Map<string, AgentAction> = new Map();
    
    /** 执行锁：防止同一 Agent 并发执行多个行为 */
    private locks: Map<string, Promise<void>> = new Map();

    /**
     * 将行为加入队列
     * @param action 行为对象
     * @returns 是否成功加入
     */
    async enqueue(action: AgentAction): Promise<boolean> {
        // 获取该 Agent 的队列
        let queue = this.queues.get(action.agentId);
        if (!queue) {
            queue = [];
            this.queues.set(action.agentId, queue);
        }

        // 检查队列长度（防止内存泄漏）
        if (queue.length >= 100) {
            console.warn(`⚠️ Agent ${action.agentId} action queue is full (${queue.length})`);
            return false;
        }

        // 按优先级插入队列
        this.insertByPriority(queue, action);

        // 尝试执行队列
        this.processQueue(action.agentId);

        return true;
    }

    /**
     * 取消指定 Agent 的某个行为
     * @param agentId Agent ID
     * @param actionId 行为 ID
     * @returns 是否成功取消
     */
    cancel(agentId: string, actionId: string): boolean {
        const queue = this.queues.get(agentId);
        if (!queue) return false;

        // 查找并移除队列中的行为
        const index = queue.findIndex(a => a.id === actionId);
        if (index !== -1) {
            const action = queue[index];
            if (action && action.cancellable) {
                queue.splice(index, 1);
                console.log(`🚫 Action ${actionId} cancelled for agent ${agentId}`);
                return true;
            }
        }

        // 检查是否是正在执行的行为
        const executing = this.executing.get(agentId);
        if (executing && executing.id === actionId) {
            if (executing.cancellable) {
                // 标记为已取消（实际执行会检查这个标记）
                console.log(`🚫 Executing action ${actionId} marked for cancellation`);
                return true;
            }
        }

        return false;
    }

    /**
     * 清空指定 Agent 的所有行为
     * @param agentId Agent ID
     */
    clearAll(agentId: string): void {
        this.queues.delete(agentId);
        this.executing.delete(agentId);
        this.locks.delete(agentId);
        console.log(`🗑️ Cleared all actions for agent ${agentId}`);
    }

    /**
     * 获取指定 Agent 的队列信息
     * @param agentId Agent ID
     * @returns 队列统计
     */
    getQueueInfo(agentId: string): { queueSize: number; isExecuting: boolean; currentAction?: string } {
        const queue = this.queues.get(agentId) || [];
        const executing = this.executing.get(agentId);
        
        const result: { queueSize: number; isExecuting: boolean; currentAction?: string } = {
            queueSize: queue.length,
            isExecuting: !!executing,
        };
        
        if (executing) {
            result.currentAction = executing.type as string;
        }
        
        return result;
    }

    /**
     * 处理 Agent 的行为队列
     * @param agentId Agent ID
     */
    private async processQueue(agentId: string): Promise<void> {
        // 如果已经在执行，直接返回
        const lock = this.locks.get(agentId);
        if (lock) {
            return;
        }

        // 创建执行锁
        const executionPromise = this.executeNextAction(agentId);
        this.locks.set(agentId, executionPromise);

        try {
            await executionPromise;
        } finally {
            this.locks.delete(agentId);
        }
    }

    /**
     * 执行下一个行为
     * @param agentId Agent ID
     */
    private async executeNextAction(agentId: string): Promise<void> {
        while (true) {
            const queue = this.queues.get(agentId);
            if (!queue || queue.length === 0) {
                this.executing.delete(agentId);
                break;
            }

            // 取出队首行为
            const action = queue.shift()!;
            this.executing.set(agentId, action);

            try {
                // 检查超时
                if (action.timeout) {
                    const age = Date.now() - action.timestamp;
                    if (age > action.timeout) {
                        console.warn(`⏰ Action ${action.id} timed out (${age}ms > ${action.timeout}ms)`);
                        continue;
                    }
                }

                // 执行行为
                const result = await action.execute();
                
                if (!result.success) {
                    console.warn(`❌ Action ${action.id} failed: ${result.message}`);
                }
            } catch (err) {
                console.error(`💥 Error executing action ${action.id}:`, err);
            } finally {
                this.executing.delete(agentId);
            }
        }
    }

    /**
     * 按优先级插入行为到队列
     * @param queue 队列
     * @param action 行为
     */
    private insertByPriority(queue: AgentAction[], action: AgentAction): void {
        // 找到第一个优先级更低的位置
        let insertIndex = queue.length;
        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            if (item && item.priority > action.priority) {
                insertIndex = i;
                break;
            }
        }
        queue.splice(insertIndex, 0, action);
    }

    /**
     * 获取全局统计信息
     */
    getGlobalStats(): { totalQueues: number; totalActions: number; totalExecuting: number } {
        let totalActions = 0;
        for (const queue of this.queues.values()) {
            totalActions += queue.length;
        }

        return {
            totalQueues: this.queues.size,
            totalActions,
            totalExecuting: this.executing.size,
        };
    }
}

/**
 * 全局行为队列管理器单例
 */
export const globalActionQueue = new AgentActionQueue();
