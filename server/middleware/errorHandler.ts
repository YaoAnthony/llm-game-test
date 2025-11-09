import type { Request, Response, NextFunction } from "express";

/**
 * 统一错误处理中间件
 */
export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.error("Error:", err);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
}

/**
 * 404 处理中间件
 */
export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.url} not found`,
    });
}
