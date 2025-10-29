// server/routes/game.ts
import { Router } from "express";
import { getStateService, moveService } from "../services/game.js";

export default function gameRouter() {
    const router = Router();

    router.get("/state", async (_req, res) => {
        try {
        const result = await getStateService();
        res.json(result);
        } catch {
        res.status(500).json({ message: "Failed to get state" });
        }
    });

    router.post("/move", async (req, res) => {
        try {
            const { dx, dy } = req.body ?? {};
            if (typeof dx !== "number" || typeof dy !== "number") {
                return res.status(400).json({ message: "dx/dy must be numbers" });
            }
            const result = await moveService(dx, dy);
            res.json(result);
        } catch (err: any) {
            const reason = err?.result?.reason ?? err?.message ?? "Failed to move";
            const pos = err?.result?.pos ?? null;
            const hint = err?.result?.hint ?? null;
            console.warn("[GAME] move failed", reason, hint);
            res.status(400).json({ message: reason, pos, hint });
        }
    });

    return router;
}
