import { EnvironmentModel,  } from "../models/Environment.js";
import type { TEnvironment } from "../models/Environment.js";

// ============ 基础工具 ============
export function inBounds(env: TEnvironment, x: number, y: number) {
    return x >= 0 && y >= 0 && x < env.width && y < env.height;
}

export function hasObstacle(env: TEnvironment, x: number, y: number) {
    return env.obstacles.some((c) => c.x === x && c.y === y);
}

export function findObjectAt(env: TEnvironment, x: number, y: number) {
    return env.objects.find((o) => o.pos && o.pos.x === x && o.pos.y === y);
}

const buildDefaultEnvironment = (seed?: Partial<TEnvironment>) => ({
    width: 15,
    height: 12,
    player: { x: 1, y: 1 },
    obstacles: [
        // 示例：围一圈墙
        // 顶部/底部
        ...Array.from({ length: 10 }, (_, x) => ({ x, y: 0 })),
        ...Array.from({ length: 7 }, (_, x) => ({ x, y: 7 })),
        ...Array.from({ length: 1 }, (_, x) => ({ x: x + 8, y: 7 })),
        // 左右
        ...Array.from({ length: 8 }, (_, y) => ({ x: 0, y })),
        ...Array.from({ length: 8 }, (_, y) => ({ x: 9, y })),
        // 房间内一条小隔断（示例）
        { x: 4, y: 3 },
        { x: 4, y: 4 },
    ],
    objects: [
        { type: "coffee_machine", name: "咖啡机", pos: { x: 4, y: 2 }, interactVerb: "use" },
        { type: "table", name: "桌子", pos: { x: 5, y: 5 }, interactVerb: "examine" },
    ],
    ...seed,
});

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
  object?: { type: string; name: string }; // 可选，但出现时不能是 undefined
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
            objects: env.objects.map((o) => ({ type: o.type, name: o.name, pos: o.pos })),
        };
    }
    const { x: px, y: py } = env.player;

    const cells: SenseCell[] = [];


    for (let y = Math.max(0, py - radius); y <= Math.min(env.height - 1, py + radius); y++) {
        for (let x = Math.max(0, px - radius); x <= Math.min(env.width - 1, px + radius); x++) {
            const obj = findObjectAt(env, x, y);

            cells.push({
            x,
            y,
            blocked: hasObstacle(env, x, y),
            me: x === px && y === py,
            ...(obj ? { object: { type: obj.type, name: obj.name } } : {}), // ✅ 没有就不出现
            });
        }
    }

    const payload = {
        room: { width: env.width, height: env.height },
        player: { x: px, y: py },
        cells,
        objects: env.objects.map((o) => ({ type: o.type, name: o.name, pos: o.pos })),
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
export async function interactService() {
    console.log("[ENV] interactService invoked");
    const env = await ensureEnv();
    if (!env.player) {
        console.log("[ENV] interactService: player missing");
        return { ok: false, message: "Player does not exist." };
    }
    const obj = findObjectAt(env, env.player.x, env.player.y);
    if (!obj) {
        console.log(`[ENV] interactService: nothing at (${env.player.x},${env.player.y})`);
        return { ok: false, message: "Nothing to interact here." };
    }
    if (obj.type === "coffee_machine") {
        console.log("[ENV] interactService: used coffee machine");
        return { ok: true, message: "☕ 你使用了咖啡机，获得一杯咖啡！" };
    }
    if (obj.type === "table") {
        console.log("[ENV] interactService: examined table");
        return { ok: true, message: "🪑 你仔细观察了桌子，上面有一些灰尘。" };
    }

    console.log(`[ENV] interactService: interacted with ${obj.type}`);
    return { ok: true, message: `You ${obj.interactVerb || "use"} the ${obj.name}.` };
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
