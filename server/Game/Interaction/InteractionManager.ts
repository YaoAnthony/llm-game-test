

/**
 * InteractionManager 负责处理玩家与世界的交互事件。
 * 可把它想象成 Minecraft 里的服务器事件总线：
 * - 玩家攻击、开箱子、与 NPC 对话等都将在这里集中调度。
 * - 当前暂为空实现，后续可注入各类 handler。
 */
export default class InteractionManager {


    /**
     * 未来可以通过构造函数注入依赖（如世界、AgentManager）。
     */
    constructor() {
        
    }
}