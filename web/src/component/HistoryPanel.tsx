import { useCallback, useEffect, useRef, useState } from "react";
import { Card, List, Tag, Typography } from "antd";

export type MoveLog = { ts: number; x: number; y: number; note?: string };

type Props = {
  moves: MoveLog[];
  /** 面板可视高度（像素），超过则滚动 */
  height?: number;
};

export default function HistoryPanel({ moves, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    if (!stickToBottom) return;
    const el = containerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [moves, stickToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distanceFromBottom <= 8);
  }, []);

  const latestId = moves[moves.length - 1]?.ts;

  return (
  <Card title="History" size="small" variant="outlined">
      <div
        ref={containerRef}
        style={{ maxHeight: height, overflowY: "auto", paddingRight: 4 }}
        onScroll={handleScroll}
      >
        <List
          size="small"
          dataSource={moves}
          renderItem={(m) => (
            <List.Item key={m.ts} style={{ padding: "6px 0" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <Typography.Text type={m.ts === latestId ? undefined : "secondary"}>
                  Pos: <b>({m.x}, {m.y})</b>
                </Typography.Text>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Tag>{new Date(m.ts).toLocaleTimeString()}</Tag>
                  {m.note ? (
                    <Typography.Text type={m.ts === latestId ? undefined : "secondary"}>
                      {m.note}
                    </Typography.Text>
                  ) : null}
                </div>
              </div>
            </List.Item>
          )}
        />
      </div>
    </Card>
  );
}
