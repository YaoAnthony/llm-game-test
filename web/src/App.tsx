import { useEffect, useState } from "react";
import { Layout, Card, Typography, theme, Button, Modal } from "antd";

import ChatBox from "./component/Chatbox";
import HistoryPanel from "./component/HistoryPanel";
import SystemNotice from "./component/SystemNotice";
import EnvironmentCanvas from "./game/EnvironmentCanvas";
import { useGameController } from "./hooks/useGameController";

const { Header, Sider, Content, Footer } = Layout;
const CELL_SIZE = 32;

export default function App() {
  const {
    pos,
    messages,
    agentBusy,
    history,
    envData,
    restartLoading,
    interactLoading,
    currentObject,
    handleMove,
    onSendToAgent,
    handleRestartEnv,
    handleInteract,
  } = useGameController();
  const { token } = theme.useToken();
  const [historyVisible, setHistoryVisible] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || el?.isContentEditable) return;

      const map: Record<string, [number, number]> = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0] };
      const delta = map[e.key.toLowerCase()];
      if (delta) {
        e.preventDefault();
        void handleMove(delta[0], delta[1], `WASD: ${e.key.toUpperCase()}`);
        return;
      }

      if (e.key.toLowerCase() === "f" && currentObject && !interactLoading) {
        e.preventDefault();
        void handleInteract();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleMove, handleInteract, currentObject, interactLoading]);

  const contentBg = token.colorBgLayout;

  const canvasWidth = (envData?.width ?? 40) * CELL_SIZE;
  const canvasHeight = (envData?.height ?? 20) * CELL_SIZE;
  const cardWidth = Math.max(640, canvasWidth + 96);
  const cardHeight = Math.max(520, canvasHeight + 200);

  return (
    <>
      <Layout style={{ minWidth: "100vw", minHeight: "100vh" }}>
      <Header
        style={{
          background: contentBg,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button type="primary" onClick={handleRestartEnv} loading={restartLoading}>
            重置环境
          </Button>
          <Button onClick={() => setHistoryVisible(true)}>查看历史</Button>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <SystemNotice />
        </div>
      </Header>

      <Layout>
        <Content
          style={{
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: contentBg,
          }}
        >
          <Card
            style={{
              width: cardWidth,
              height: cardHeight,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 8,
              padding: 24,
            }}
          >
            <Typography.Title level={2} style={{ margin: 0, fontFamily: "monospace" }}>
              ({pos.x}, {pos.y})
            </Typography.Title>
            <Typography.Text type="secondary">W/A/S/D 移动，F 键执行当前格子的交互</Typography.Text>
            <div style={{ marginTop: 16, width: "100%", flex: 1, display: "flex" }}>
              <EnvironmentCanvas env={envData} cellSize={CELL_SIZE} />
            </div>
          </Card>
        </Content>

        <Sider
          width={360}
          theme="light"
          style={{ borderLeft: "1px solid #f0f0f0", padding: 16, background: "#fff" }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <Card title="交互" size="small" style={{ flexShrink: 0 }}>
              {currentObject ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <Typography.Text strong>{currentObject.name}</Typography.Text>
                    <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                      {currentObject.type}
                    </Typography.Text>
                  </div>
                  {currentObject.description ? (
                    <Typography.Paragraph style={{ margin: 0 }}>
                      {currentObject.description}
                    </Typography.Paragraph>
                  ) : null}
                  {currentObject.state && Object.keys(currentObject.state).length > 0 ? (
                    <Typography.Paragraph style={{ margin: 0 }} type="secondary">
                      状态：<Typography.Text code>{JSON.stringify(currentObject.state)}</Typography.Text>
                    </Typography.Paragraph>
                  ) : null}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(currentObject.actions && currentObject.actions.length > 0
                      ? currentObject.actions
                      : [{ id: "__default", label: currentObject.interactVerb ?? "交互" }]
                    ).map((action) => (
                      <Button
                        key={action.id}
                        size="small"
                        type="primary"
                        ghost
                        loading={interactLoading}
                        disabled={interactLoading}
                        onClick={() =>
                          void handleInteract(action.id === "__default" ? undefined : action.id)
                        }
                      >
                        {action.label ?? action.id}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <Typography.Text type="secondary">当前没有可交互的对象。</Typography.Text>
              )}
            </Card>
            <Card title="Chat" size="small">
              <ChatBox
                messages={messages}
                onSend={onSendToAgent}
                disabled={agentBusy}
                placeholder="e.g. go to (5, 2), move right 3…"
                height={220}
              />
            </Card>
          </div>
        </Sider>
      </Layout>

        <Footer style={{ textAlign: "center" }}>LLM Game Demo · Ant Design</Footer>
      </Layout>

      <Modal
        title="History"
        open={historyVisible}
        footer={null}
        width={420}
        onCancel={() => setHistoryVisible(false)}
        destroyOnClose
      >
        <HistoryPanel moves={history} height={360} />
      </Modal>
    </>
  );
}
