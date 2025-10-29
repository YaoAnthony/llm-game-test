/**
 * Agent 抽象基类。
 * 可以将它想象成《我的世界》里一名被脚本控制的“冒险家”，
 * 负责同步自身的状态、记忆以及背包，并与游戏世界进行互动。
 */
import type {
    AgentOptions,
    AgentSnapshot,
    AgentStatus,
    AgentRepository,
    AgentMemoryFragment,
    AgentInventoryItem,
} from "../types";


import type { MemoryManager } from "../Memory";
import type { InventoryManager } from "../Inventory";


export class AbstractAgent {
    // 冒险家唯一编号，就像给每个《我的世界》玩家分配的 UUID。
    private readonly id: string;
    // 当前行动状态，类似玩家是否处于“闲置”“挖矿”或“战斗”状态。
    private status: AgentStatus;
    // 持久化仓库，负责把冒险家的资料写回“服务器存档”。
    private readonly repository: AgentRepository;
    // 记忆管理器，对应玩家脑中的“笔记本”，记录遇到的村庄、怪物等信息。
    private readonly memory: MemoryManager;
    // 背包管理器，对标玩家背包格子里的方块和道具。
    private readonly inventory: InventoryManager;


    constructor(opts: AgentOptions & { memory: MemoryManager; inventory: InventoryManager }) {
        // 生成新的冒险家时分配 ID，并给一个初始状态（如果没传则默认为“闲置”）。
        this.id = opts.id;
        this.status = opts.initialStatus ?? "idle";
        this.repository = opts.repository;
        this.memory = opts.memory;
        this.inventory = opts.inventory;


        // 将初始记忆灌入“脑袋”，好比开局就记得出生点或已有的村庄。
        opts.initialMemories?.forEach((f) => this.memory.upsert(f));
        // 把初始物品放入背包，例如开局赠送的木剑和面包。
        opts.initialInventory?.forEach((i) => this.inventory.upsert(i));
    }


    // —— 基础属性 ——
    /**
     * 获取冒险家的唯一编号，方便在“服务器日志”里定位是哪位玩家的操作。
     */
    public getId() { return this.id; }

    /**
     * 查询当前状态，例如判断玩家是在“建造模式”还是“夜间巡逻”。
     */
    public getStatus() { return this.status; }

    /**
     * 更新冒险家的状态，类似指挥玩家切换到“挖矿”或“探索”状态。
     */
    public setStatus(s: AgentStatus) { this.status = s; }


    // —— 记忆操作（委派给 MemoryManager）——
    /**
     * 记录一段新的记忆，例如冒险家遇见的村庄坐标或击败末影龙的战斗细节。
     */
    public remember(fragment: Omit<AgentMemoryFragment, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) {
        return this.memory.upsert(fragment);
    }

    /**
     * 删除指定的记忆，好比玩家觉得某个旧矿洞已经掏空，不再需要记住。
     */
    public forget(memoryId: string) { return this.memory.remove(memoryId); }

    /**
     * 列出记忆清单，可限制数量，比如只取最近的三次冒险纪录。
     */
    public listMemories(limit?: number) { return this.memory.list(limit); }


    // —— 背包操作（委派给 InventoryManager）——
    /**
     * 往背包装入物品，例如打怪掉落的钻石或从箱子里捡到的地图。
     */
    public addInventory(item: Omit<AgentInventoryItem, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) {
        return this.inventory.upsert(item);
    }

    /**
     * 从背包移除物品，比如把多余的圆石扔掉或交给其他玩家。
     */
    public removeInventory(itemId: string) { return this.inventory.remove(itemId); }

    /**
     * 查看背包里的所有道具，等同于打开《我的世界》背包界面浏览物品格。
     */
    public listInventory() { return this.inventory.list(); }


    // —— 序列化 / 持久化 ——
    /**
     * TODO: 在这里实现与持久化相关的逻辑，
     * 例如把冒险家的最新状态存回服务器存档，就像退出游戏前保存世界。
     */
}