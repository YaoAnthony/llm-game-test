/**
 * 玩家控制器类
 * 负责处理键盘输入（WASD）并控制玩家移动
 * 
 * 简化版本：只负责监听按键，发送移动请求，等待服务器响应
 */

export interface MoveCommand {
    direction: 'up' | 'down' | 'left' | 'right';
    distance: number;
}

export class PlayerController {
    private playerId: string;
    private isActive: boolean = false;
    private moveCallback: (direction: MoveCommand) => Promise<void>;
    private isMoving: boolean = false; // 是否正在移动（等待服务器响应）

    constructor(
        playerId: string,
        moveCallback: (direction: MoveCommand) => Promise<void>
    ) {
        this.playerId = playerId;
        this.moveCallback = moveCallback;
    }

    /**
     * 激活控制器，开始监听键盘事件
     */
    activate(): void {
        if (this.isActive) {
            console.log(`⚠️ Controller already active for player: ${this.playerId}`);
            return;
        }
        
        this.isActive = true;
        console.log(`🎮 Player Controller activated for player: ${this.playerId}`);
        
        // 绑定键盘事件
        window.addEventListener('keydown', this.handleKeyDown);
        console.log(`✅ Keyboard event listeners attached`);
    }

    /**
     * 停用控制器，移除键盘事件监听
     */
    deactivate(): void {
        if (!this.isActive) return;
        
        this.isActive = false;
        console.log(`🛑 Player Controller deactivated for player: ${this.playerId}`);
        
        // 移除键盘事件
        window.removeEventListener('keydown', this.handleKeyDown);
    }

    /**
     * 处理按键按下事件
     */
    private handleKeyDown = async (event: KeyboardEvent): Promise<void> => {
        const key = event.key.toLowerCase();
        
        // 只处理 WASD 键
        if (!['w', 'a', 's', 'd'].includes(key)) {
            return;
        }
        
        console.log(`⌨️ [KEY] Key pressed: ${key}`);
        event.preventDefault(); // 防止页面滚动
        
        // 如果正在移动，忽略新的按键
        if (this.isMoving) {
            console.log(`⏳ [KEY] Still moving, ignoring key: ${key}`);
            return;
        }
        
        // 转换按键为方向
        const direction = this.keyToDirection(key);
        if (!direction) {
            console.warn(`⚠️ [KEY] Failed to convert key to direction: ${key}`);
            return;
        }
        
        console.log(`⌨️ [KEY] Key ${key} → direction ${direction}`);
        
        // 发送移动请求
        await this.move(direction);
    };
    
    /**
     * 将按键转换为方向
     */
    private keyToDirection(key: string): MoveCommand['direction'] | null {
        switch (key) {
            case 'w': return 'up';
            case 's': return 'down';
            case 'a': return 'left';
            case 'd': return 'right';
            default: return null;
        }
    }
    
    /**
     * 发送移动请求
     */
    private async move(direction: MoveCommand['direction']): Promise<void> {
        this.isMoving = true;
        console.log(`🔒 [MOVE] Movement locked, isMoving = true`);
        
        const command: MoveCommand = {
            direction,
            distance: 1,
        };
        
        console.log(`🚀 [MOVE] Sending move request:`, command);
        const startTime = Date.now();
        
        try {
            await this.moveCallback(command);
            const duration = Date.now() - startTime;
            console.log(`✅ [MOVE] Move completed: ${direction} (took ${duration}ms)`);
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [MOVE] Move failed after ${duration}ms:`, error);
        } finally {
            this.isMoving = false;
            console.log(`🔓 [MOVE] Movement unlocked, isMoving = false`);
        }
    }

    /**
     * 获取当前控制的玩家 ID
     */
    getPlayerId(): string {
        return this.playerId;
    }

    /**
     * 检查控制器是否激活
     */
    isControllerActive(): boolean {
        return this.isActive;
    }
}
