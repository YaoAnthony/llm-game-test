import React, { useEffect, useRef } from 'react';
import { Card, Spin } from 'antd';
import type { Tile } from '@shared/terrain';

interface Player {
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
}

interface WorldRendererProps {
    width?: number;
    height?: number;
    tiles?: Tile[][]; // ✅ 使用 shared 的 Tile 类型
    players?: Player[]; // 所有玩家（包括当前玩家）
    currentPlayerId?: string; // 当前控制的玩家 ID（用于高亮）
    timeProgress?: number; // 0-1, 时间进度
}

/**
 * 世界渲染组件
 * 使用 Canvas 2D 渲染游戏世界地形（支持 Emoji 符号渲染）
 */
const WorldRenderer: React.FC<WorldRendererProps> = ({
    width = 800,
    height = 600,
    tiles,
    players = [],
    currentPlayerId,
    timeProgress = 0.5,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 瓦片配置：emoji 符号 + 颜色
    const getTileConfig = React.useCallback((type: string): { symbol: string; color: string } => {
        const configs: Record<string, { symbol: string; color: string }> = {
            GRASS: { symbol: '🌱', color: '#90EE90' },
            DIRT: { symbol: '🟫', color: '#8B4513' },
            WATER: { symbol: '💧', color: '#4169E1' },
            STONE: { symbol: '⬜', color: '#808080' },
            SAND: { symbol: '🟨', color: '#F4A460' },
            TREE: { symbol: '🌲', color: '#228B22' },
            ROCK: { symbol: '🪨', color: '#696969' },
            FARMLAND: { symbol: '🟫', color: '#654321' },
            WALL: { symbol: '🧱', color: '#A0522D' },
            VOID: { symbol: '⬛', color: '#000000' },
        };

        return configs[type] || { symbol: '❓', color: '#9e9e9e' };
    }, []);

    // 调整颜色亮度（用于昼夜效果）
    const adjustBrightness = React.useCallback((color: string, factor: number): string => {
        const rgb = parseInt(color.slice(1), 16);
        const r = Math.min(255, Math.floor(((rgb >> 16) & 0xff) * factor));
        const g = Math.min(255, Math.floor(((rgb >> 8) & 0xff) * factor));
        const b = Math.min(255, Math.floor((rgb & 0xff) * factor));
        return `rgb(${r}, ${g}, ${b})`;
    }, []);

    // 渲染世界
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !tiles) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        // 根据时间调整整体亮度（昼夜循环）
        const dayBrightness = 0.6 + Math.sin(timeProgress * Math.PI * 2) * 0.4;

        const mapHeight = tiles.length;
        const mapWidth = tiles[0]?.length || 0;
        
        const tileWidth = width / mapWidth;
        const tileHeight = height / mapHeight;

        // 渲染地形
        tiles.forEach((row: Tile[], y: number) => {
            row.forEach((tile: Tile, x: number) => {
                const config = getTileConfig(tile.type);
                const color = config.color;
                
                // 应用昼夜光照效果
                const adjustedColor = adjustBrightness(color, dayBrightness);
                ctx.fillStyle = adjustedColor;
                
                ctx.fillRect(
                    x * tileWidth,
                    y * tileHeight,
                    tileWidth,
                    tileHeight
                );
                
                // 绘制边框
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(
                    x * tileWidth,
                    y * tileHeight,
                    tileWidth,
                    tileHeight
                );
                
                // ✅ 绘制 Emoji 符号（如果瓦片足够大）
                if (tileWidth >= 16 && tileHeight >= 16) {
                    const fontSize = Math.min(tileWidth, tileHeight) * 0.7;
                    ctx.font = `${fontSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // Emoji 不受昼夜亮度影响
                    ctx.fillText(
                        config.symbol,
                        x * tileWidth + tileWidth / 2,
                        y * tileHeight + tileHeight / 2
                    );
                }
            });
        });

        // 渲染所有玩家
        if (players && players.length > 0) {
            players.forEach(player => {
                const playerX = player.position.x * tileWidth;
                const playerY = player.position.z * tileHeight; // 注意：使用 z 作为 2D 的 y
                
                const isCurrentPlayer = player.id === currentPlayerId;

                // 绘制玩家背景圆圈
                ctx.fillStyle = isCurrentPlayer ? '#1890ff' : '#52c41a'; // 当前玩家蓝色，其他玩家绿色
                ctx.beginPath();
                ctx.arc(playerX + tileWidth / 2, playerY + tileHeight / 2, 10, 0, Math.PI * 2);
                ctx.fill();

                // 绘制玩家边框
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // 绘制玩家图标
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(isCurrentPlayer ? '👤' : '🧑', playerX + tileWidth / 2, playerY + tileHeight / 2);

                // 绘制玩家名字
                ctx.font = '12px Arial';
                ctx.fillStyle = '#000000';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.strokeText(player.name, playerX + tileWidth / 2, playerY + tileHeight / 2 - 15);
                ctx.fillText(player.name, playerX + tileWidth / 2, playerY + tileHeight / 2 - 15);
            });
        }
    }, [tiles, players, currentPlayerId, timeProgress, width, height, getTileConfig, adjustBrightness]);

    if (!tiles) {
        return (
            <Card style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin tip="加载世界中..." />
            </Card>
        );
    }

    return (
        <div style={{ border: '2px solid #d9d9d9', borderRadius: '8px', overflow: 'hidden' }}>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{ display: 'block' }}
            />
        </div>
    );
};

export default WorldRenderer;
