import { AbstractAgent } from "./AbstractAgent";
import type { Position, PlayerAttributes, PlayerSnapshot } from "../../../types/agent.js";

/**
 * 玩家操作记录（用于客户端预测和服务端和解）
 */
interface PlayerAction {
    /** 操作唯一 ID（客户端生成） */
    actionId: string;
    /** 操作类型 */
    type: 'move' | 'interact' | 'teleport';
    /** 操作数据 */
    data: any;
    /** 客户端时间戳 */
    timestamp: number;
    /** 是否已被服务端确认 */
    serverAck: boolean;
}

/**
 * PlayerAgent 代表一个在线玩家实体。
 * 继承自 AbstractAgent 的记忆和背包系统，
 * 并添加位置、属性等游戏特有的数据。
 * 
 * 支持网络优化：
 * - 客户端预测：记录未确认的操作
 * - 服务端和解：重新应用未确认操作
 */
export default class PlayerAgent extends AbstractAgent {
    private name: string;
    private position: Position;
    private attributes: PlayerAttributes;
    private readonly joinedAt: string;
    private lastActiveAt: string;
    
    /** 脏数据回调：当数据变化时通知 AgentManager */
    private onDirty?: () => void;

    /** 未确认的操作列表（用于和解） */
    private pendingActions: PlayerAction[] = [];
    
    /** 是否启用客户端预测 */
    public enablePrediction: boolean = true;
    
    /** 是否启用服务端和解 */
    public enableReconciliation: boolean = true;
    
    /** 最大未确认操作数（防止内存泄漏） */
    private readonly MAX_PENDING_ACTIONS = 100;

    /**
     * 创建新玩家
     * @param id 玩家唯一 ID
     * @param name 玩家名称
     * @param spawnPosition 出生点坐标（默认原点）
     * @param repository 数据持久化仓库
     */
    constructor(
        id: string,
        name: string,
        spawnPosition: Position = { x: 0, y: 0, z: 0 },
        repository: any
    ) {
        // 调用父类构造函数，暂时传入简化的参数
        super({
            id,
            repository,
            initialStatus: "idle",
            memory: { upsert: () => {}, remove: () => {}, list: () => [] } as any,
            inventory: { upsert: () => {}, remove: () => {}, list: () => [] } as any,
        });

        this.name = name;
        this.position = { ...spawnPosition };
        this.attributes = {
            name,
            level: 1,
            health: 100,
            maxHealth: 100,
            experience: 0,
        };
        
        const now = new Date().toISOString();
        this.joinedAt = now;
        this.lastActiveAt = now;
    }

    // ===== 位置相关 =====

    /**
     * 设置脏数据回调
     * @param callback 当数据变化时调用
     */
    setDirtyCallback(callback: () => void): void {
        this.onDirty = callback;
    }

    /**
     * 标记为脏数据
     */
    private markDirty(): void {
        if (this.onDirty) {
            this.onDirty();
        }
    }

    /**
     * 获取当前位置
     */
    getPosition(): Position {
        return { ...this.position };
    }

    /**
     * 移动到新位置（相对移动）
     */
    move(dx: number, dy: number, dz: number): Position {
        this.position.x += dx;
        this.position.y += dy;
        this.position.z += dz;
        this.updateActivity();
        this.markDirty(); // 标记为脏数据
        return this.getPosition();
    }

    /**
     * 传送到指定位置（绝对位置）
     */
    teleport(x: number, y: number, z: number): Position {
        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
        this.updateActivity();
        this.markDirty(); // 标记为脏数据
        return this.getPosition();
    }

    /**
     * 计算与另一个位置的距离
     */
    distanceTo(target: Position): number {
        const dx = this.position.x - target.x;
        const dy = this.position.y - target.y;
        const dz = this.position.z - target.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // ===== 属性相关 =====

    /**
     * 获取玩家名称
     */
    getName(): string {
        return this.name;
    }

    /**
     * 获取玩家属性
     */
    getAttributes(): PlayerAttributes {
        return { ...this.attributes };
    }

    /**
     * 受到伤害
     */
    takeDamage(amount: number): void {
        this.attributes.health = Math.max(0, this.attributes.health - amount);
        this.updateActivity();
        this.markDirty(); // 标记为脏数据
        
        if (this.attributes.health === 0) {
            this.setStatus("offline");
        }
    }

    /**
     * 恢复生命值
     */
    heal(amount: number): void {
        this.attributes.health = Math.min(
            this.attributes.maxHealth,
            this.attributes.health + amount
        );
        this.updateActivity();
        this.markDirty(); // 标记为脏数据
    }

    /**
     * 增加经验值（可触发升级）
     */
    gainExperience(amount: number): void {
        this.attributes.experience += amount;
        this.updateActivity();
        this.markDirty(); // 标记为脏数据

        // 简单升级逻辑：每100经验升1级
        const newLevel = Math.floor(this.attributes.experience / 100) + 1;
        if (newLevel > this.attributes.level) {
            this.levelUp(newLevel);
        }
    }

    /**
     * 升级
     */
    private levelUp(newLevel: number): void {
        this.attributes.level = newLevel;
        this.attributes.maxHealth += 10;
        this.attributes.health = this.attributes.maxHealth;
        this.markDirty(); // 标记为脏数据
        // TODO: 触发升级事件
    }

    // ===== 时间戳 =====

    /**
     * 更新最后活跃时间
     */
    private updateActivity(): void {
        this.lastActiveAt = new Date().toISOString();
    }

    /**
     * 获取加入时间
     */
    getJoinedAt(): string {
        return this.joinedAt;
    }

    /**
     * 获取最后活跃时间
     */
    getLastActiveAt(): string {
        return this.lastActiveAt;
    }

    // ===== 网络优化：客户端预测 + 服务端和解 =====

    /**
     * 记录客户端预测的操作（用于和解）
     * @param actionId 客户端生成的操作 ID
     * @param type 操作类型
     * @param data 操作数据
     */
    recordPredictedAction(actionId: string, type: PlayerAction['type'], data: any): void {
        if (!this.enableReconciliation) {
            return; // 未启用和解，不记录
        }

        // 检查是否超过最大限制
        if (this.pendingActions.length >= this.MAX_PENDING_ACTIONS) {
            console.warn(`⚠️ Player ${this.getId()} has too many pending actions (${this.pendingActions.length})`);
            // 移除最旧的操作
            this.pendingActions.shift();
        }

        this.pendingActions.push({
            actionId,
            type,
            data,
            timestamp: Date.now(),
            serverAck: false,
        });
    }

    /**
     * 服务端和解：重新应用未确认的操作
     * @param acknowledgedActionId 服务端已确认的操作 ID
     * @returns 和解后的状态快照
     */
    reconcile(acknowledgedActionId: string): PlayerSnapshot {
        if (!this.enableReconciliation || this.pendingActions.length === 0) {
            return this.toSnapshot();
        }

        // 1. 找到已确认的操作索引
        const ackIndex = this.pendingActions.findIndex(
            a => a.actionId === acknowledgedActionId
        );

        if (ackIndex === -1) {
            // 找不到对应操作，可能已经清理，直接返回当前状态
            return this.toSnapshot();
        }

        // 2. 标记已确认的操作
        for (let i = 0; i <= ackIndex; i++) {
            const action = this.pendingActions[i];
            if (action) {
                action.serverAck = true;
            }
        }

        // 3. 过滤出未确认的操作
        const unacknowledgedActions = this.pendingActions.slice(ackIndex + 1);

        if (unacknowledgedActions.length > 0) {
            console.log(`🔄 Reconciling ${unacknowledgedActions.length} unacknowledged actions for player ${this.getId()}`);
        }

        // 4. 重新应用未确认的操作
        for (const action of unacknowledgedActions) {
            switch (action.type) {
                case 'move':
                    // 解构移动数据
                    const { x, y, z } = action.data;
                    this.move(x, y, z);
                    break;
                case 'teleport':
                    // 解构传送数据
                    const { x: tx, y: ty, z: tz } = action.data;
                    this.teleport(tx, ty, tz);
                    break;
                // 其他操作类型...
            }
        }

        // 5. 清理已确认的操作
        this.pendingActions = this.pendingActions.filter(a => !a.serverAck);

        // 6. 清理过期操作（超过 5 秒）
        this.cleanupOldActions();

        return this.toSnapshot();
    }

    /**
     * 清理过期的未确认操作
     */
    private cleanupOldActions(): void {
        const now = Date.now();
        const beforeCount = this.pendingActions.length;
        
        this.pendingActions = this.pendingActions.filter(
            a => now - a.timestamp < 5000  // 保留 5 秒内的操作
        );

        const removedCount = beforeCount - this.pendingActions.length;
        if (removedCount > 0) {
            console.warn(`🗑️ Cleaned up ${removedCount} old actions for player ${this.getId()}`);
        }
    }

    /**
     * 获取未确认操作数量（用于监控）
     */
    getPendingActionsCount(): number {
        return this.pendingActions.length;
    }

    /**
     * 清空所有未确认操作（用于重置）
     */
    clearPendingActions(): void {
        this.pendingActions = [];
    }

    // ===== 序列化 =====

    /**
     * 生成完整的玩家快照（用于 API 响应）
     */
    toSnapshot(): PlayerSnapshot {
        return {
            id: this.getId(),
            name: this.name,
            position: this.getPosition(),
            status: this.getStatus(),
            attributes: this.getAttributes(),
            joinedAt: this.joinedAt,
            lastActiveAt: this.lastActiveAt,
        };
    }

    /**
     * 从快照恢复玩家状态（用于数据库加载）
     */
    static fromSnapshot(snapshot: PlayerSnapshot, repository: any): PlayerAgent {
        const player = new PlayerAgent(
            snapshot.id,
            snapshot.name,
            snapshot.position,
            repository
        );

        player.position = { ...snapshot.position };
        player.attributes = { ...snapshot.attributes };
        player.setStatus(snapshot.status);
        (player as any).joinedAt = snapshot.joinedAt;
        (player as any).lastActiveAt = snapshot.lastActiveAt;

        return player;
    }
}