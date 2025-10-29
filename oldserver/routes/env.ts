// server/routes/env.ts
import { Router } from "express";
import { senseService, moveWithCollision, interactService, resetEnv, ensureEnv, ensureEnvDoc } from "../services/env.js";
import { createMysticalObject } from "../services/mysticalObjects.js";
import type { SerializedMysticalObject } from "../types/environment.js";

export default function envRouter() {
    const router = Router();

    router.get("/", async (_req, res) => {
        try {
            const env = await ensureEnv();
            const normalizedObjects = (env.objects ?? []).map((obj: any) => {
                const raw = (typeof obj?.toObject === "function" ? obj.toObject() : obj) as SerializedMysticalObject;
                return createMysticalObject(raw).toJSON();
            });

            res.json({
                width: env.width,
                height: env.height,
                player: env.player ?? null,
                obstacles: env.obstacles ?? [],
                objects: normalizedObjects,
            });
        } catch (err) {
            console.error("Env snapshot failed", err);
            res.status(500).json({ message: "Failed to load environment" });
        }
    });

    router.get("/sense", async (req, res) => {
        const r = Number(req.query.r ?? 1);
        const data = await senseService(Math.max(0, Math.min(3, r)));
        res.json(data);
    });

    router.post("/move", async (req, res) => {
        const { dx, dy } = req.body ?? {};
        const result = await moveWithCollision(dx, dy);
        res.json(result);
    });

    router.post("/interact", async (req, res) => {
        const actionIdRaw = req.body?.actionId;
        const actionId = typeof actionIdRaw === "string" && actionIdRaw.length > 0 ? actionIdRaw : undefined;
        const result = await interactService(actionId);
        res.json(result);
    });

    router.post("/reset", async (_req, res) => {
        const env = await resetEnv();
        res.json({ ok: true, env });
    });

    router.post("/restart", async (_req, res) => {
        try {
            const doc = await ensureEnvDoc({ reset: true });
            res.json({ ok: true, env: doc.toObject() });
        } catch (err) {
            console.error("Env restart failed", err);
            res.status(500).json({ ok: false, message: "Failed to restart environment" });
        }
    });

    return router;
}
