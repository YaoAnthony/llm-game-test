import type {
  MysticalInteractionContext,
  MysticalInteractionResult,
  MysticalObjectInteraction,
  SerializedMysticalObject,
} from "../types/environment.js";

type LegacyAction = {
  id: string;
  label?: string;
  verb?: string;
  description?: string;
  requires?: string[];
};

function fromLegacyAction(action: LegacyAction): MysticalObjectInteraction {
  const interaction: MysticalObjectInteraction = {
    id: action.id,
    label: action.label ?? action.id,
    mcpFunctions: ["interact"],
  };
  if (action.verb) {
    interaction.verb = action.verb;
  }
  if (action.description) {
    interaction.description = action.description;
  }
  if (action.requires && action.requires.length > 0) {
    interaction.requires = [...action.requires];
  }
  return interaction;
}

function normalizeInteractions(
  interactions: MysticalObjectInteraction[] | undefined,
): MysticalObjectInteraction[] | undefined {
  if (!interactions) return undefined;
  return interactions.map((interaction) => ({
    ...interaction,
    mcpFunctions: interaction.mcpFunctions?.length ? interaction.mcpFunctions : ["interact"],
  }));
}

function ensureState(data: SerializedMysticalObject & { actions?: LegacyAction[] }) {
  if (!data.state) {
    data.state = {};
  }

  if (!data.interactions && Array.isArray(data.actions) && data.actions.length > 0) {
    data.interactions = data.actions.map(fromLegacyAction);
  }

  const normalized = normalizeInteractions(data.interactions);
  if (normalized) {
    data.interactions = normalized;
  }

  return data;
}

export abstract class MysticalObject {
  protected data: SerializedMysticalObject;

  constructor(data: SerializedMysticalObject) {
    const ensured = ensureState({ ...data });
    this.data = ensured;

    if (!this.data.interactions || this.data.interactions.length === 0) {
      const defaults = normalizeInteractions(this.interactionsBlueprint()) ?? [];
      this.data.interactions = defaults;
    }
  }

  get type() {
    return this.data.type;
  }

  get name() {
    return this.data.name;
  }

  get pos() {
    return this.data.pos;
  }

  get interactVerb() {
    return this.data.interactVerb ?? "use";
  }

  get description() {
    return this.data.description;
  }

  get state() {
    return this.data.state!;
  }

  protected updateState(partial: Record<string, unknown>) {
    this.data.state = { ...this.data.state, ...partial };
  }

  protected interactionsBlueprint(): MysticalObjectInteraction[] {
    return this.data.interactions ?? [];
  }

  protected availableInteractions(): MysticalObjectInteraction[] {
    return this.data.interactions ?? [];
  }

  abstract interact(context: MysticalInteractionContext): Promise<MysticalInteractionResult> | MysticalInteractionResult;

  toJSON(): SerializedMysticalObject {
    return {
      ...this.data,
      state: { ...this.state },
      interactions: this.availableInteractions(),
    };
  }
}

class AncientOak extends MysticalObject {
  protected override interactionsBlueprint(): MysticalObjectInteraction[] {
    return [
      {
        id: "commune",
        label: "与橡树交流",
        verb: "commune",
        description: "将你的手放在树干上，倾听树灵的低语。",
        mcpFunctions: ["interact"],
        resultPreviews: [
          {
            id: "vision-river",
            label: "听到森林的方向指引",
            description: "树灵描述河流尽头的晶石。",
            resultType: "message",
          },
          {
            id: "warmth",
            label: "获得治愈的温暖",
            description: "橡树给予力量使你恢复精神。",
            resultType: "message",
          },
          {
            id: "memory-glow",
            label: "获得森林的记忆",
            description: "听见光亮指引安全道路的传说。",
            resultType: "message",
          },
        ],
      },
    ];
  }

  interact(context: MysticalInteractionContext): MysticalInteractionResult {
    const interactionId = context.actionId ?? "commune";
    const whispers = [
      {
        id: "vision-river",
        message: "树灵告诉你，河流的尽头藏着遗失的晶石。",
      },
      {
        id: "warmth",
        message: "你感受到一股温暖的力量，治愈了你的疲惫。",
      },
      {
        id: "memory-glow",
        message: "远古橡树分享了森林的记忆：光亮指向安全的道路。",
      },
    ];
    const choice = whispers[Math.floor(Math.random() * whispers.length)] ?? whispers[0]!;
    return {
      ok: true,
      message: choice.message,
      interactionId,
      resultId: choice.id,
      resultType: "message",
      state: this.state,
      availableInteractions: this.availableInteractions(),
    };
  }
}

class CrystalShrine extends MysticalObject {
  protected override interactionsBlueprint(): MysticalObjectInteraction[] {
    return [
      {
        id: "pray",
        label: "向水晶祭坛祈祷",
        verb: "pray",
        description: "闭上眼睛，让星光照耀你的心。",
        mcpFunctions: ["interact"],
        resultPreviews: [
          {
            id: "starlight-blessing",
            label: "获得星芒赐福",
            description: "提升灵感与创造力。",
            resultType: "message",
          },
          {
            id: "out-of-charge",
            label: "祭坛失去能量",
            description: "祭坛暂时无响应，需要等待充能。",
            resultType: "error",
          },
        ],
      },
    ];
  }

  interact(context: MysticalInteractionContext): MysticalInteractionResult {
    const interactionId = context.actionId ?? "pray";
    const charges = (this.state.charges as number | undefined) ?? 2;
    if (charges <= 0) {
      return {
        ok: false,
        message: "水晶黯淡无光，需要时间重新充能。",
        interactionId,
        resultId: "out-of-charge",
        resultType: "error",
        state: this.state,
        availableInteractions: this.availableInteractions(),
      };
    }
    this.updateState({ charges: charges - 1 });
    return {
      ok: true,
      message: "星芒落入你的掌心，你感到灵感涌现。",
      interactionId,
      resultId: "starlight-blessing",
      resultType: "message",
      state: this.state,
      availableInteractions: this.availableInteractions(),
    };
  }
}

class MushroomCircle extends MysticalObject {
  protected override interactionsBlueprint(): MysticalObjectInteraction[] {
    return [
      {
        id: "dance",
        label: "在蘑菇圈中起舞",
        verb: "dance",
        description: "随月光起舞，聆听精灵的笑声。",
        mcpFunctions: ["interact"],
        resultPreviews: [
          {
            id: "dance-light",
            label: "蘑菇闪耀微光",
            description: "舞步触发蘑菇圈的回应。",
            resultType: "message",
          },
          {
            id: "dance-fragrance",
            label: "芬芳围绕",
            description: "精灵陪伴你的舞步。",
            resultType: "message",
          },
          {
            id: "dance-weightless",
            label: "跳跃时间",
            description: "舞毕后感到轻盈仿佛穿越时间。",
            resultType: "message",
          },
        ],
      },
    ];
  }

  interact(context: MysticalInteractionContext): MysticalInteractionResult {
    const interactionId = context.actionId ?? "dance";
    const step = ((this.state.step as number | undefined) ?? 0) + 1;
    this.updateState({ step });
    const messages = [
      {
        id: "dance-light",
        message: "你随着旋律旋转，脚下的蘑菇发出了微光。",
      },
      {
        id: "dance-fragrance",
        message: "精灵们陪伴着你的舞步，带来了一阵清新的芬芳。",
      },
      {
        id: "dance-weightless",
        message: "舞步结束，你感到轻盈，仿佛跳过了时间。",
      },
    ];
    const choice = messages[(step - 1) % messages.length] ?? messages[0]!;
    return {
      ok: true,
      message: choice.message,
      interactionId,
      resultId: choice.id,
      resultType: "message",
      state: this.state,
      availableInteractions: this.availableInteractions(),
    };
  }
}

class CoffeeMachine extends MysticalObject {
  protected override interactionsBlueprint(): MysticalObjectInteraction[] {
    return [
      {
        id: "brew",
        label: "冲泡咖啡",
        verb: "brew",
        description: "按下按钮，倾听咖啡流淌的声音。",
        mcpFunctions: ["interact"],
        resultPreviews: [
          {
            id: "fresh-coffee",
            label: "获得一杯咖啡",
            description: "咖啡机产出一杯热咖啡并加入背包。",
            resultType: "inventory",
            payloadExample: { item: "coffee", amount: 1 },
          },
          {
            id: "machine-empty",
            label: "咖啡机空了",
            description: "咖啡机需要补充咖啡豆。",
            resultType: "error",
          },
        ],
      },
      {
        id: "inspect",
        label: "检查库存",
        verb: "inspect",
        description: "看看还有多少咖啡可以分享。",
        mcpFunctions: ["interact"],
        resultPreviews: [
          {
            id: "inventory-status",
            label: "了解剩余杯数",
            description: "返回咖啡机的剩余杯数。",
            resultType: "message",
          },
        ],
      },
    ];
  }

  interact(context: MysticalInteractionContext): MysticalInteractionResult {
    const interactionId = context.actionId ?? "brew";
    const cups = (this.state.cups as number | undefined) ?? 3;

    if (interactionId !== "brew" && interactionId !== "inspect") {
      return {
        ok: false,
        message: "咖啡机对这个操作没有反应。试试 brew 或 inspect。",
        interactionId,
        resultId: "unknown-action",
        resultType: "error",
        state: this.state,
        availableInteractions: this.availableInteractions(),
      };
    }

    if (interactionId === "inspect") {
      return {
        ok: true,
        message: cups > 0 ? `咖啡机还有 ${cups} 杯咖啡。` : "咖啡机已经空了，需要补充咖啡豆。",
        interactionId,
        resultId: "inventory-status",
        resultType: "message",
        state: this.state,
        availableInteractions: this.availableInteractions(),
        data: { remainingCups: cups },
      };
    }

    if (cups <= 0) {
      return {
        ok: false,
        message: "你按下按钮，但只有空气。也许试试 inspect 看看需要补充什么。",
        interactionId,
        resultId: "machine-empty",
        resultType: "error",
        state: this.state,
        availableInteractions: this.availableInteractions(),
        data: { remainingCups: cups },
      };
    }

    this.updateState({ cups: cups - 1 });
    return {
      ok: true,
      message: cups - 1 === 0 ? "最后一杯咖啡倾倒而出，香气弥漫。" : "你拿到了一杯热腾腾的咖啡。",
      interactionId,
      resultId: "fresh-coffee",
      resultType: "inventory",
      consumed: true,
      state: this.state,
      availableInteractions: this.availableInteractions(),
      events: [{ type: "inventory", payload: { item: "coffee", amount: 1 } }],
      data: { remainingCups: cups - 1 },
    };
  }
}

class MossyTable extends MysticalObject {
  protected override interactionsBlueprint(): MysticalObjectInteraction[] {
    return [
      {
        id: "examine",
        label: "仔细检查桌面",
        verb: "examine",
        description: "检查桌面，看看遗留了什么线索。",
        mcpFunctions: ["interact"],
        resultPreviews: [
          {
            id: "clue-note",
            label: "发现纸条",
            description: "获得前进方向的线索。",
            resultType: "message",
          },
        ],
      },
    ];
  }

  interact(context: MysticalInteractionContext): MysticalInteractionResult {
    const interactionId = context.actionId ?? "examine";
    const clues = (this.state.clues as string[] | undefined) ?? [
      "桌面上有一张写着“右转避开倒下的大树”的纸条。",
      "角落里放着一颗闪亮的露珠水晶。",
    ];
    const message = clues[0] ?? "桌子上只剩下斑驳的苔藓。";
    return {
      ok: true,
      message,
      interactionId,
      resultId: "clue-note",
      resultType: "message",
      state: this.state,
      availableInteractions: this.availableInteractions(),
      data: { clues },
    };
  }
}

class DefaultMysticalObject extends MysticalObject {
  protected override interactionsBlueprint(): MysticalObjectInteraction[] {
    return [
      {
        id: "use",
        label: "使用",
        verb: "use",
        description: "尝试与物体互动。",
        mcpFunctions: ["interact"],
        resultPreviews: [
          {
            id: "generic-response",
            label: "默认回应",
            description: "物体发出轻微回应。",
            resultType: "message",
          },
        ],
      },
    ];
  }

  interact(context: MysticalInteractionContext): MysticalInteractionResult {
    const interactionId = context.actionId ?? "use";
    return {
      ok: true,
      message: `${this.name} ${this.interactVerb ?? "use"}`,
      interactionId,
      resultId: "generic-response",
      resultType: "message",
      state: this.state,
      availableInteractions: this.availableInteractions(),
    };
  }
}

const registry: Record<string, new (data: SerializedMysticalObject) => MysticalObject> = {
  ancient_oak: AncientOak,
  crystal_shrine: CrystalShrine,
  mushroom_circle: MushroomCircle,
  coffee_machine: CoffeeMachine,
  table: MossyTable,
};

export function createMysticalObject(data: SerializedMysticalObject): MysticalObject {
  const Ctor = registry[data.type] ?? DefaultMysticalObject;
  return new Ctor(data);
}

export function hydrateMysticalObjects(objects: SerializedMysticalObject[] | undefined | null): MysticalObject[] {
  if (!objects) return [];
  return objects.map((obj) => createMysticalObject(obj));
}

export function serializeMysticalObjects(objects: MysticalObject[]): SerializedMysticalObject[] {
  return objects.map((obj) => obj.toJSON());
}
