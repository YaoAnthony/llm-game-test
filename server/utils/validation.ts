/**
 * 验证环境变量
 */
export function validateEnv() {
    const required = ["MONGO_URI", "OPENAI_API_KEY"];
    const missing: string[] = [];

    for (const key of required) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `❌ Missing required environment variables: ${missing.join(", ")}\n` +
            `Please check your .env file.`
        );
    }

    console.log("✅ Environment variables validated");
}

/**
 * 验证玩家名称
 */
export function validatePlayerName(name: string): { valid: boolean; error?: string } {
    if (!name || typeof name !== "string") {
        return { valid: false, error: "Name is required and must be a string" };
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: "Name cannot be empty" };
    }

    if (trimmed.length > 50) {
        return { valid: false, error: "Name must be 50 characters or less" };
    }

    // 只允许字母、数字、下划线和中文
    const validPattern = /^[\w\u4e00-\u9fa5]+$/;
    if (!validPattern.test(trimmed)) {
        return { valid: false, error: "Name can only contain letters, numbers, underscores, and Chinese characters" };
    }

    return { valid: true };
}

/**
 * 验证坐标
 */
export function validatePosition(x: any, y: any, z: any): { valid: boolean; error?: string } {
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
        return { valid: false, error: "Coordinates (x, y, z) must be numbers" };
    }

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return { valid: false, error: "Coordinates must be finite numbers" };
    }

    // 设置世界边界（可根据需要调整）
    const MAX_COORD = 30000000; // Minecraft 世界边界参考
    if (Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD || Math.abs(z) > MAX_COORD) {
        return { valid: false, error: `Coordinates exceed world boundaries (±${MAX_COORD})` };
    }

    return { valid: true };
}
