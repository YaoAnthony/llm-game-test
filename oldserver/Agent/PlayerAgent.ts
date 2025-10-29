import Agent from "./AbstratAgent.js";
import type { AgentOptions, AgentSnapshot } from "./types/index.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
	senseService,
	moveWithCollision,
	moveToTarget,
	interactService,
} from "../services/env.js";
import { getStateService } from "../utils/index.js";
import { GameState } from "../models/GameState.js";
import type { ItemDocument } from "../models/Item.js";

type Position = { x: number; y: number };


type PersistPayload = {
	action: string;
	params?: Record<string, unknown>;
	result?: unknown;
	steps?: Array<{ index: number; total: number; pos: Position; ok: boolean; reason?: string | null }>;
};

const isPosition = (value: unknown): value is Position =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as any).x === "number" &&
	typeof (value as any).y === "number";

const toPlainMetadata = (metadata: unknown): Record<string, unknown> | undefined => {
	if (!metadata) return undefined;
	if (metadata instanceof Map) {
		return Object.fromEntries(metadata.entries());
	}
	if (typeof metadata === "object") {
		return metadata as Record<string, unknown>;
	}
	return undefined;
};

export default class PlayerAgent extends Agent {
	private position: Position | null;
	private readonly defaultSenseRadius: number;
	private readonly hydrationPromise: Promise<void>;

	constructor(options: PlayerAgentOptions) {
		super(options);
		this.position = options.initialPosition ?? null;
		this.defaultSenseRadius = Math.max(0, options.defaultSenseRadius ?? 1);

		this.hydrationPromise = (async () => {
			try {
				await this.bootstrap(options);
			} catch (err) {
				console.error("[PlayerAgent] Failed to hydrate from repository", err);
			}
		})();
	}

	public getPosition() {
		return this.position;
	}

	private async ensureHydrated() {
		await this.hydrationPromise;
	}

	private async bootstrap(_options: AgentOptions) {
		const snapshot = await this.loadSnapshotFromRepository();
		if (snapshot) {
			return;
		}

		await this.syncFromGameState();

		if (!this.position) {
			try {
				const state = await getStateService();
				this.position = { x: state.x, y: state.y };
			} catch (err) {
				console.error("[PlayerAgent] Failed to resolve initial position", err);
			}
		}

		const extra: Record<string, unknown> = {
			action: "bootstrap",
			timestamp: new Date().toISOString(),
		};
		if (this.position) {
			extra.position = this.position;
		}
		await this.update(extra);
	}

	private async syncFromGameState() {
		try {
			const doc = await GameState.findOne()
				.populate<{ player: { inventory: Array<{ item: ItemDocument | null; quantity: number }> } }>({
					path: "player.inventory.item",
				})
				.exec();

			if (!doc?.player) return;

			const { x, y, inventory } = doc.player;
			if (typeof x === "number" && typeof y === "number") {
				this.position = { x, y };
			}

			for (const entry of inventory ?? []) {
				const itemDoc = entry.item as ItemDocument | null | undefined;
				const numericQuantity = Number(entry.quantity ?? 0);
				const quantity = Number.isFinite(numericQuantity) ? numericQuantity : 0;
				if (!itemDoc || quantity <= 0) continue;

				const metadata = toPlainMetadata(itemDoc.metadata);
				const metadataPayload = metadata && Object.keys(metadata).length > 0 ? metadata : undefined;
				this.addInventory({
					id: itemDoc.itemId,
					label: itemDoc.name,
					quantity,
					description: itemDoc.description,
					...(metadataPayload ? { metadata: metadataPayload } : {}),
					createdAt: itemDoc.createdAt?.toISOString() ?? new Date().toISOString(),
					updatedAt: itemDoc.updatedAt?.toISOString() ?? new Date().toISOString(),
				});
			}
		} catch (err) {
			console.error("[PlayerAgent] Failed to synchronize from GameState", err);
		}
	}

	protected override registerTools(server: McpServer): void {
		server.registerTool(
			"sense",
			{
				title: "Sense around",
				description: "感知玩家周围的网格信息。",
				inputSchema: { radius: z.number().min(0).max(3).optional() },
				outputSchema: {},
			},
			async ({ radius }) => {
				await this.ensureHydrated();
				const r = Math.max(0, Math.min(3, radius ?? this.defaultSenseRadius));
				const data = await senseService(r);
				this.captureSense(data);
				await this.persist({ action: "sense", params: { radius: r }, result: data });
				return this.formatToolResult(data);
			},
		);

		server.registerTool(
			"get-state",
			{
				title: "Get current player state",
				description: "获取玩家位置（持久化状态）。",
				inputSchema: {},
				outputSchema: { x: z.number(), y: z.number() },
			},
			async () => {
				await this.ensureHydrated();
				const data = await getStateService();
				this.position = { x: data.x, y: data.y };
				await this.persist({ action: "get-state", result: data });
				return this.formatToolResult(data);
			},
		);

		server.registerTool(
			"move-safe",
			{
				title: "Move one step with collision handling",
				description: "在四个方向移动一步，包含碰撞检测。",
				inputSchema: { dx: z.number(), dy: z.number() },
				outputSchema: {},
			},
			async ({ dx, dy }) => {
				await this.ensureHydrated();
				const result = await moveWithCollision(dx, dy);
				if (result.pos) {
					this.position = { ...result.pos };
				}
				await this.persist({ action: "move-safe", params: { dx, dy }, result });
				return this.formatToolResult(result);
			},
		);

		server.registerTool(
			"move-to",
			{
				title: "Move to target coordinate via shortest path",
				description: "自动规划多步移动，逐步走到指定坐标。",
				inputSchema: { x: z.number(), y: z.number() },
				outputSchema: {},
			},
			async ({ x, y }) => {
				await this.ensureHydrated();
				const steps: PersistPayload["steps"] = [];
				const result = await moveToTarget(x, y, {
					onStep: async ({ index, total, pos, result: moveResult }) => {
						this.position = { ...pos };
						steps.push({
							index,
							total,
							pos: { ...pos },
							ok: moveResult.ok,
							reason: moveResult.reason ?? null,
						});
					},
				});
				if (result.pos) {
					this.position = { ...result.pos };
				}
				await this.persist({
					action: "move-to",
					params: { x, y },
					result,
					steps,
				});
				return this.formatToolResult({ ...result, steps });
			},
		);

		server.registerTool(
			"interact",
			{
				title: "Interact with current tile object",
				description: "与当前所在格子的神秘物体进行互动。",
				inputSchema: { actionId: z.string().optional() },
				outputSchema: {},
			},
			async ({ actionId }) => {
				await this.ensureHydrated();
				const result = await interactService(actionId);
				this.captureInteraction(result);
				await this.persist({ action: "interact", params: { actionId }, result });
				return this.formatToolResult(result);
			},
		);
	}

	protected override async onAfterHydrate(snapshot: AgentSnapshot) {
		const extra = snapshot.extra && typeof snapshot.extra === "object" ? snapshot.extra : undefined;
		let resolvedPosition: Position | null = null;

		if (extra) {
			const primary = (extra as any).position;
			const fallback = (extra as any)?.result?.pos;
			if (isPosition(primary)) {
				resolvedPosition = { ...primary };
			} else if (isPosition(fallback)) {
				resolvedPosition = { ...fallback };
			}
		}

		if (resolvedPosition) {
			this.position = resolvedPosition;
			return;
		}

		if (!this.position) {
			try {
				const state = await getStateService();
				this.position = { x: state.x, y: state.y };
			} catch (err) {
				console.error("[PlayerAgent] Failed to infer position during hydration", err);
			}
		}
	}

	private captureSense(sense: Awaited<ReturnType<typeof senseService>>) {
		if (sense.player) {
			this.position = { ...sense.player };
		}
		for (const obj of sense.objects ?? []) {
			if (!obj.pos) continue;
			const id = `${obj.type}:${obj.pos.x}:${obj.pos.y}`;
			const fragment: {
				id: string;
				label: string;
				position: Position;
				objectType?: string;
				detail?: string;
			} = {
				id,
				label: obj.name ?? obj.type ?? "未知对象",
				position: { x: obj.pos.x, y: obj.pos.y },
			};

			if (obj.type) {
				fragment.objectType = obj.type;
			}
			if (typeof obj.description === "string" && obj.description.length > 0) {
				fragment.detail = obj.description;
			}

			this.remember(fragment);
		}
	}

	private captureInteraction(result: Awaited<ReturnType<typeof interactService>>) {
		const object = (result as any)?.object as {
			name?: string;
			type?: string;
			description?: string;
			pos?: Position | null;
		} | null;
		if (object?.pos) {
			const id = `${object.type ?? object.name ?? "object"}:${object.pos.x}:${object.pos.y}`;
			const fragment: {
				id: string;
				label: string;
				position: Position;
				objectType?: string;
				detail?: string;
			} = {
				id,
				label: object.name ?? object.type ?? "未知对象",
				position: { ...object.pos },
			};

			if (object.type) {
				fragment.objectType = object.type;
			}
			if (typeof object.description === "string" && object.description.length > 0) {
				fragment.detail = object.description;
			}

			this.remember(fragment);
			this.position = { ...object.pos };
		}

		const events = (result as any)?.events as Array<{ type: string; payload?: Record<string, unknown> }> | undefined;
		if (!events) return;
	    for (const event of events) {
			if (event.type !== "inventory") continue;
			const itemId = String(event.payload?.item ?? "unknown-item");
			const amountRaw = event.payload?.amount;
			const delta = typeof amountRaw === "number" ? amountRaw : Number(amountRaw ?? 0) || 0;
			const inventory = this.listInventory();
			const existing = inventory.find((item) => item.id === itemId);
			const quantity = Math.max(0, (existing?.quantity ?? 0) + delta);
			if (quantity <= 0) {
				this.removeInventory(itemId);
				continue;
			}
			const nextRecord: {
				id: string;
				label: string;
				quantity: number;
				description?: string;
				metadata?: Record<string, unknown>;
			} = {
				id: itemId,
				label: String(event.payload?.label ?? existing?.label ?? itemId),
				quantity,
			};

			const descriptionPayload = event.payload?.description;
			const metadataPayload = event.payload?.metadata;

			if (typeof descriptionPayload === "string") {
				nextRecord.description = descriptionPayload;
			} else if (existing?.description) {
				nextRecord.description = existing.description;
			}

			if (metadataPayload && typeof metadataPayload === "object") {
				nextRecord.metadata = metadataPayload as Record<string, unknown>;
			} else if (existing?.metadata) {
				nextRecord.metadata = existing.metadata;
			}

			this.addInventory(nextRecord);
		}
	}

	private async persist(payload: PersistPayload) {
		try {
			this.setStatus("active");
			await this.update({
				...payload,
				position: this.position,
				timestamp: new Date().toISOString(),
			});
		} catch (err) {
			console.error("[PlayerAgent] Failed to persist state", err);
		} finally {
			this.setStatus("idle");
		}
	}

	private formatToolResult<T>(data: T) {
		return {
			content: [{ type: "text" as const, text: JSON.stringify(data) }],
			structuredContent: data,
		};
	}
}
