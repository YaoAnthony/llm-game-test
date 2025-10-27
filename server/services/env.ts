import { EnvironmentModel } from "../models/Environment.js";
import type { TEnvironment } from "../models/Environment.js";
import { createMysticalObject, serializeMysticalObjects } from "./mysticalObjects.js";
import type { SerializedMysticalObject } from "../types/environment.js";

// ============ 基础工具 ============
export function inBounds(env: TEnvironment, x: number, y: number) {
    return x >= 0 && y >= 0 && x < env.width && y < env.height;
}

export function hasObstacle(env: TEnvironment, x: number, y: number) {
    return env.obstacles.some((c) => c.x === x && c.y === y);
}

export function findObjectAt(env: TEnvironment, x: number, y: number): SerializedMysticalObject | undefined {
    return env.objects?.find((o) => o.pos && o.pos.x === x && o.pos.y === y) as SerializedMysticalObject | undefined;
}

const buildDefaultEnvironment = (seed?: Partial<TEnvironment>) => {
    const width = 20;
    const height = 16;

    const obstacleSet = new Set<string>();
    const addObstacle = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const key = `${x},${y}`;
        obstacleSet.add(key);
    };

    // Forest perimeter
    for (let x = 0; x < width; x++) {
        addObstacle(x, 0);
        addObstacle(x, height - 1);
    }
    for (let y = 1; y < height - 1; y++) {
        addObstacle(0, y);
        addObstacle(width - 1, y);
    }

    // Enchanted river meandering from north-west to south-east
    for (let y = 2; y < height - 2; y++) {
        const offset = (y % 4) - 1; // -1,0,1,2 pattern
        const riverX = 5 + offset;
        addObstacle(riverX, y);
        addObstacle(riverX + 1, y);
    }

    // Fallen tree barrier near the upper glade (horizontal line)
    for (let x = 8; x <= 14; x++) {
        addObstacle(x, 4);
    }

    // Dense mushroom grove (cluster of obstacles) with a hidden path
    const groveCenters = [
        { cx: 12, cy: 9 },
        { cx: 14, cy: 10 },
        { cx: 11, cy: 12 },
    ];
    for (const { cx, cy } of groveCenters) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                addObstacle(cx + dx, cy + dy);
            }
        }
    }
    // carve a narrow trail through the grove
    obstacleSet.delete("12,11");
    obstacleSet.delete("13,10");

    const uniqueObstacles = Array.from(obstacleSet, (key) => {
        const [x, y] = key.split(",").map(Number) as [number, number];
        return { x, y };
    });

    const mysticalObjects = serializeMysticalObjects([
        createMysticalObject({
            type: "ancient_oak",
            name: "远古橡树",
            pos: { x: 3, y: 3 },
            interactVerb: "commune",
            description: "一株散发着银绿色光辉的巨大橡树，树干上刻满古老的符文。",
        }),
        createMysticalObject({
            type: "crystal_shrine",
            name: "水晶祭坛",
            pos: { x: 7, y: 8 },
            interactVerb: "pray",
            description: "透明的祭坛上漂浮着碎星，轻触即可听见远处的钟鸣。",
            state: { charges: 2 },
        }),
        createMysticalObject({
            type: "mushroom_circle",
            name: "蘑菇圈",
            pos: { x: 13, y: 11 },
            interactVerb: "dance",
            description: "蘑菇天然排成一圈，中央飘着细碎的月光。",
        }),
        createMysticalObject({
            type: "coffee_machine",
            name: "魔法咖啡机",
            pos: { x: 2, y: 6 },
            interactVerb: "brew",
            description: "一台老旧的咖啡机，蒸汽中带着甘草与可可的香味。",
            state: { cups: 3 },
        }),
        createMysticalObject({
            type: "table",
            name: "苔藓桌",
            pos: { x: 10, y: 6 },
            interactVerb: "examine",
            description: "桌面覆盖着厚厚的苔藓，角落里压着几张泛黄的纸。",
            state: { clues: ["桌面上有一张写着“右转避开倒下的大树”的纸条。", "角落里放着一颗闪亮的露珠水晶。"] },
        }),
    ]);

    return {
        width,
        height,
        player: { x: 2, y: 2 },
        obstacles: uniqueObstacles,
        objects: mysticalObjects,
        ...seed,
    };
};

type EnsureEnvOptions = { reset?: boolean; seed?: Partial<TEnvironment> | undefined };

// ============ 初始化/获取 ============
export async function ensureEnvDoc(options?: EnsureEnvOptions) {
    const reset = options?.reset ?? false;
    const seed = options?.seed;

    let doc = await EnvironmentModel.findOne();
    if (!doc) {
        doc = new EnvironmentModel(buildDefaultEnvironment(seed));
        await doc.save();
        return doc;
    }


    if (reset) {
        doc.set(buildDefaultEnvironment(seed));
        await doc.save();
        return doc;
    }

    return doc;
}

export async function ensureEnv() {
  const doc = await ensureEnvDoc();
  return doc.toObject();
}
type SenseCell = {
    x: number;
    y: number;
    blocked: boolean;
    me: boolean;
    object?: Omit<SerializedMysticalObject, "pos">;
};


// ============ 感知 ============
export async function senseService(radius = 1) {
    console.log(`[ENV] senseService invoked with radius=${radius}`);
    const env = await ensureEnv();
    if (!env.player) {
        console.log("[ENV] senseService: player missing, returning empty sense result");
        // No player, return an empty sense response
        return {
            room: { width: env.width, height: env.height },
            player: null,
            cells: [],
            objects: (env.objects ?? []).map((o) => createMysticalObject(o as SerializedMysticalObject).toJSON()),
        };
    }
    const { x: px, y: py } = env.player;

    const cells: SenseCell[] = [];


    for (let y = Math.max(0, py - radius); y <= Math.min(env.height - 1, py + radius); y++) {
        for (let x = Math.max(0, px - radius); x <= Math.min(env.width - 1, px + radius); x++) {
            const obj = findObjectAt(env, x, y) as SerializedMysticalObject | undefined;
            const objectData = obj ? createMysticalObject(obj).toJSON() : undefined;
            let objectForCell: Omit<SerializedMysticalObject, "pos"> | undefined;
            if (objectData) {
                const { pos: _ignoredPos, ...rest } = objectData;
                objectForCell = rest;
            }
            cells.push({
                x,
                y,
                blocked: hasObstacle(env, x, y),
                me: x === px && y === py,
                ...(objectForCell ? { object: objectForCell } : {}),
            });
        }
    }

    const payload = {
        room: { width: env.width, height: env.height },
        player: { x: px, y: py },
        cells,
        objects: (env.objects ?? []).map((o) => createMysticalObject(o as SerializedMysticalObject).toJSON()),
    };
    console.log(`[ENV] senseService → player=(${px},${py}) cells=${cells.length}`);
    return payload;
}

// ============ 移动（带碰撞） ============
const DIRECTIONS = [
    { dx: 1, dy: 0, label: "向右" },
    { dx: -1, dy: 0, label: "向左" },
    { dx: 0, dy: 1, label: "向上" },
    { dx: 0, dy: -1, label: "向下" },
] as const;

function describeSuggestions(env: TEnvironment, x: number, y: number, exclude?: { dx: number; dy: number }) {
    const available = DIRECTIONS.filter(({ dx, dy }) => {
        if (exclude && dx === exclude.dx && dy === exclude.dy) return false;
        const nx = x + dx;
        const ny = y + dy;
        return inBounds(env, nx, ny) && !hasObstacle(env, nx, ny);
    });
    if (available.length === 0) {
        return {
            hint: "附近被障碍包围，请先使用 sense(radius=2) 探查后再规划路径。",
            suggestions: [] as Array<{ dx: number; dy: number; label: string }>,
        };
    }
    const hint = `可以尝试：${available
        .map(({ label, dx, dy }) => `${label}(dx:${dx}, dy:${dy})`)
        .join("，")}`;
    return {
        hint,
        suggestions: available.map((d) => ({ dx: d.dx, dy: d.dy, label: d.label })),
    };
}

export async function moveWithCollision(dx: number, dy: number) {
    console.log(`[ENV] moveWithCollision requested dx=${dx}, dy=${dy}`);
    const doc = await ensureEnvDoc();
    dx = Math.max(-1, Math.min(1, Math.trunc(dx)));
    dy = Math.max(-1, Math.min(1, Math.trunc(dy)));
    console.log(`[ENV] moveWithCollision normalized to dx=${dx}, dy=${dy}`);

    // 只允许四方向一步
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
        console.log("[ENV] moveWithCollision rejected: invalid step size");
        const suggestions = doc.player
            ? describeSuggestions(doc, doc.player.x, doc.player.y)
            : { hint: undefined, suggestions: [] };
        return {
            ok: false,
            reason: "Only 4-direction single steps allowed.",
            pos: doc.player,
            hint: suggestions.hint,
            suggestions: suggestions.suggestions,
        };
    }

    if (!doc.player) {
        console.log("[ENV] moveWithCollision rejected: player missing");
        return { ok: false, reason: "Player does not exist.", pos: null };
    }

    const nx = doc.player.x + dx;
    const ny = doc.player.y + dy;

    if (!inBounds(doc, nx, ny)) {
        console.log(`[ENV] moveWithCollision blocked: (${nx},${ny}) out of bounds`);
        const suggestions = describeSuggestions(doc, doc.player.x, doc.player.y, { dx, dy });
        return {
            ok: false,
            reason: "Out of bounds.",
            pos: doc.player,
            hint: suggestions.hint,
            suggestions: suggestions.suggestions,
        };
    }
    if (hasObstacle(doc, nx, ny)) {
        console.log(`[ENV] moveWithCollision blocked: obstacle at (${nx},${ny})`);
        const suggestions = describeSuggestions(doc, doc.player.x, doc.player.y, { dx, dy });
        return {
            ok: false,
            reason: "Blocked by obstacle.",
            pos: doc.player,
            hint: suggestions.hint,
            suggestions: suggestions.suggestions,
        };
    }

    doc.player.x = nx;
    doc.player.y = ny;
    doc.markModified("player");
    await doc.save();
    console.log(`[ENV] moveWithCollision succeeded → pos=(${doc.player.x},${doc.player.y})`);
    return { ok: true, pos: doc.player };
}

// ============ 交互 ============
export async function interactService(actionId?: string) {
    console.log("[ENV] interactService invoked", actionId ? `action=${actionId}` : "");
    const doc = await ensureEnvDoc();
    if (!doc.player) {
        console.log("[ENV] interactService: player missing");
        return { ok: false, message: "Player does not exist." };
    }

    const { x, y } = doc.player;
    const index = doc.objects.findIndex((o) => o.pos?.x === x && o.pos?.y === y);
    if (index === -1) {
        console.log(`[ENV] interactService: nothing at (${x},${y})`);
        return { ok: false, message: "Nothing to interact here." };
    }

    const objDoc: any = doc.objects[index];
    const rawObject = (typeof objDoc.toObject === "function" ? objDoc.toObject() : objDoc) as SerializedMysticalObject;
    const mysticalObject = createMysticalObject(rawObject);
    const envSnapshot = doc.toObject() as TEnvironment;
    const context: { env: TEnvironment; actionId?: string } = actionId
        ? { env: envSnapshot, actionId }
        : { env: envSnapshot };
    const result = await mysticalObject.interact(context);
    const serialized = mysticalObject.toJSON();

    doc.objects.set(index, serialized as any);
    doc.markModified("objects");
    await doc.save();

    console.log(`[ENV] interactService: ${serialized.type} responded`);
    return {
        ...result,
        object: serialized,
    };
}

// ============ 重置 ============
export async function resetEnv(seed?: Partial<TEnvironment>) {
    const doc = await ensureEnvDoc({ reset: true, seed });
    return doc.toObject();
}

// ============ 可选：最短路 BFS ============
export function planPathBFS(env: TEnvironment, start: { x: number; y: number }, goal: { x: number; y: number }) {
    const key = (x: number, y: number) => `${x},${y}`;
    const q: Array<{ x: number; y: number }> = [start];
    const prev = new Map<string, string | null>();
    prev.set(key(start.x, start.y), null);

    const dirs = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
    ];

    while (q.length) {
        const cur = q.shift()!;
        if (cur.x === goal.x && cur.y === goal.y) {
            // 回溯路径
            const path: { x: number; y: number }[] = [];
            let k: string | null = key(cur.x, cur.y);
            while (k) {
                const [sx, sy] = k.split(",").map(Number) as [number, number];
                path.push({ x: sx, y: sy });
                k = prev.get(k) ?? null;
            }
            path.reverse();
            return path; // 包含起点与终点
        }

        for (const d of dirs) {
            const nx = cur.x + d.dx;
            const ny = cur.y + d.dy;
            const nk = key(nx, ny);
            if (prev.has(nk)) continue;
            if (!inBounds(env, nx, ny)) continue;
            if (hasObstacle(env, nx, ny)) continue;
            prev.set(nk, key(cur.x, cur.y));
            q.push({ x: nx, y: ny });
        }
    }

    return null; // 无路可达
}
