import type { ReactNode } from "react";
import type { EnvironmentData } from "../api";

const CELL_SIZE_DEFAULT = 32;

const colors = {
  grid: "#e5e7eb",
  obstacle: "#94a3b8",
  object: "#facc15",
  player: "#1677ff",
  background: "#f9fafb",
};

type Props = {
  env: EnvironmentData | null;
  cellSize?: number;
};

export default function EnvironmentCanvas({ env, cellSize = CELL_SIZE_DEFAULT }: Props) {
  if (!env) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: 200,
          display: "grid",
          placeItems: "center",
          background: colors.background,
          borderRadius: 8,
          border: "1px dashed #cbd5f5",
          color: "#94a3b8",
        }}
      >
        正在载入环境…
      </div>
    );
  }

  const widthPx = env.width * cellSize;
  const heightPx = env.height * cellSize;

  const renderGrid = () => {
    const lines: ReactNode[] = [];
    for (let x = 0; x <= env.width; x++) {
      const posX = x * cellSize;
      lines.push(
        <line
          key={`v-${x}`}
          x1={posX}
          y1={0}
          x2={posX}
          y2={heightPx}
          stroke={colors.grid}
          strokeWidth={1}
        />
      );
    }
    for (let y = 0; y <= env.height; y++) {
      const posY = y * cellSize;
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={posY}
          x2={widthPx}
          y2={posY}
          stroke={colors.grid}
          strokeWidth={1}
        />
      );
    }
    return lines;
  };

  const renderObstacles = () =>
    env.obstacles.map(({ x, y }, index) => (
      <rect
        key={`ob-${index}-${x}-${y}`}
        x={x * cellSize}
        y={y * cellSize}
        width={cellSize}
        height={cellSize}
        fill={colors.obstacle}
        opacity={0.8}
      />
    ));

  const renderObjects = () =>
    env.objects
      .filter((obj) => obj.pos)
      .map((obj, index) => (
        <g key={`obj-${index}-${obj.type}-${obj.pos!.x}-${obj.pos!.y}`}>
          <rect
            x={obj.pos!.x * cellSize + cellSize * 0.15}
            y={obj.pos!.y * cellSize + cellSize * 0.15}
            width={cellSize * 0.7}
            height={cellSize * 0.7}
            fill={colors.object}
            stroke="#b45309"
            strokeWidth={1}
            rx={6}
          />
          <text
            x={obj.pos!.x * cellSize + cellSize / 2}
            y={obj.pos!.y * cellSize + (cellSize * 0.6)}
            textAnchor="middle"
            fontSize={cellSize * 0.32}
            fill="#78350f"
          >
            {obj.name || obj.type}
          </text>
        </g>
      ));

  const renderPlayer = () => {
    if (!env.player) return null;
    const cx = env.player.x * cellSize + cellSize / 2;
    const cy = env.player.y * cellSize + cellSize / 2;
    return (
      <g>
        <circle cx={cx} cy={cy} r={cellSize * 0.3} fill={colors.player} />
        <circle cx={cx} cy={cy} r={cellSize * 0.44} stroke={colors.player} strokeWidth={2} fill="none" opacity={0.3} />
      </g>
    );
  };

  return (
    <div
      style={{
        width: "100%",
        overflow: "auto",
        padding: 8,
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <svg
        width={widthPx}
        height={heightPx}
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        style={{
          maxWidth: "100%",
          height: "auto",
          background: colors.background,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        <rect x={0} y={0} width={widthPx} height={heightPx} fill={colors.background} />
        {renderGrid()}
        {renderObstacles()}
        {renderObjects()}
        {renderPlayer()}
      </svg>
    </div>
  );
}
