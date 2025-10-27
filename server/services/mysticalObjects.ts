import type {
  MysticalInteractionContext,
  MysticalInteractionResult,
  MysticalObjectAction,
  SerializedMysticalObject,
} from "../types/environment.js";

function ensureState(data: SerializedMysticalObject) {
  if (!data.state) {
    data.state = {};
  }
  return data;
}

export abstract class MysticalObject {
  protected data: SerializedMysticalObject;

  constructor(data: SerializedMysticalObject) {
    this.data = ensureState({ ...data });
    if (!this.data.actions) {
      this.data.actions = this.availableActions();
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

  protected availableActions(): MysticalObjectAction[] {
    return this.data.actions ?? [];
  }

  abstract interact(context: MysticalInteractionContext): Promise<MysticalInteractionResult> | MysticalInteractionResult;

  toJSON(): SerializedMysticalObject {
    return {
      ...this.data,
      state: { ...this.state },
      actions: this.availableActions(),
    };
  }
}

class AncientOak extends MysticalObject {
  protected availableActions(): MysticalObjectAction[] {
    return [
      {
        id: "commune",
        label: "与橡树交流",
        verb: "commune",
        description: "将你的手放在树干上，倾听树灵的低语。",
      },
    ];
  }

  interact(_context: MysticalInteractionContext): MysticalInteractionResult {
    const whispers = [
      "树灵告诉你，河流的尽头藏着遗失的晶石。",
      "你感受到一股温暖的力量，治愈了你的疲惫。",
      "远古橡树分享了森林的记忆：光亮指向安全的道路。",
    ];
    const index = Math.floor(Math.random() * whispers.length);
    const message = whispers[index] ?? "橡树静默无言。";
    return {
      ok: true,
      message,
      state: this.state,
      availableActions: this.availableActions(),
    };
  }
}

class CrystalShrine extends MysticalObject {
  protected availableActions(): MysticalObjectAction[] {
    return [
      {
        id: "pray",
        label: "向水晶祭坛祈祷",
        verb: "pray",
        description: "闭上眼睛，让星光照耀你的心。",
      },
    ];
  }

  interact(_context: MysticalInteractionContext): MysticalInteractionResult {
    const charges = (this.state.charges as number | undefined) ?? 2;
    if (charges <= 0) {
      return {
        ok: false,
        message: "水晶黯淡无光，需要时间重新充能。",
        state: this.state,
        availableActions: this.availableActions(),
      };
    }
    this.updateState({ charges: charges - 1 });
    return {
      ok: true,
      message: "星芒落入你的掌心，你感到灵感涌现。",
      state: this.state,
      availableActions: this.availableActions(),
    };
  }
}

class MushroomCircle extends MysticalObject {
  protected availableActions(): MysticalObjectAction[] {
    return [
      {
        id: "dance",
        label: "在蘑菇圈中起舞",
        verb: "dance",
        description: "随月光起舞，聆听精灵的笑声。",
      },
    ];
  }

  interact(_context: MysticalInteractionContext): MysticalInteractionResult {
    const step = ((this.state.step as number | undefined) ?? 0) + 1;
    this.updateState({ step });
    const messages = [
      "你随着旋律旋转，脚下的蘑菇发出了微光。",
      "精灵们陪伴着你的舞步，带来了一阵清新的芬芳。",
      "舞步结束，你感到轻盈，仿佛跳过了时间。",
    ];
    const msg = messages[(step - 1) % messages.length] ?? "蘑菇们静静矗立，没有回应。";
    return {
      ok: true,
      message: msg,
      state: this.state,
      availableActions: this.availableActions(),
    };
  }
}

class CoffeeMachine extends MysticalObject {
  protected availableActions(): MysticalObjectAction[] {
    return [
      {
        id: "brew",
        label: "冲泡咖啡",
        verb: "brew",
        description: "按下按钮，倾听咖啡流淌的声音。",
      },
      {
        id: "inspect",
        label: "检查库存",
        verb: "inspect",
        description: "看看还有多少咖啡可以分享。",
      },
    ];
  }

  interact(context: MysticalInteractionContext): MysticalInteractionResult {
    const action = context.actionId ?? "brew";
    const cups = (this.state.cups as number | undefined) ?? 3;

    if (action !== "brew" && action !== "inspect") {
      return {
        ok: false,
        message: "咖啡机对这个操作没有反应。试试 brew 或 inspect。",
        state: this.state,
        availableActions: this.availableActions(),
      };
    }

    if (action === "inspect") {
      return {
        ok: true,
        message: cups > 0 ? `咖啡机还有 ${cups} 杯咖啡。` : "咖啡机已经空了，需要补充咖啡豆。",
        state: this.state,
        availableActions: this.availableActions(),
      };
    }

    if (cups <= 0) {
      return {
        ok: false,
        message: "你按下按钮，但只有空气。也许试试 inspect 看看需要补充什么。",
        state: this.state,
        availableActions: this.availableActions(),
      };
    }

    this.updateState({ cups: cups - 1 });
    return {
      ok: true,
      message: cups - 1 === 0 ? "最后一杯咖啡倾倒而出，香气弥漫。" : "你拿到了一杯热腾腾的咖啡。",
      consumed: true,
      state: this.state,
      availableActions: this.availableActions(),
      events: [{ type: "inventory", payload: { item: "coffee", amount: 1 } }],
    };
  }
}

class MossyTable extends MysticalObject {
  protected availableActions(): MysticalObjectAction[] {
    return [
      {
        id: "examine",
        label: "仔细检查桌面",
        verb: "examine",
        description: "检查桌面，看看遗留了什么线索。",
      },
    ];
  }

  interact(_context: MysticalInteractionContext): MysticalInteractionResult {
    const clues = (this.state.clues as string[] | undefined) ?? [
      "桌面上有一张写着“右转避开倒下的大树”的纸条。",
      "角落里放着一颗闪亮的露珠水晶。",
    ];
    const message = clues[0] ?? "桌子上只剩下斑驳的苔藓。";
    return {
      ok: true,
      message,
      state: this.state,
      availableActions: this.availableActions(),
    };
  }
}

class DefaultMysticalObject extends MysticalObject {
  interact(_context: MysticalInteractionContext): MysticalInteractionResult {
    return {
      ok: true,
      message: `${this.name} ${this.interactVerb ?? "use"}`,
      state: this.state,
      availableActions: this.availableActions(),
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
