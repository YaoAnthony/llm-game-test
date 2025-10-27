import { useCallback, useEffect, useState } from "react";
import { message } from "antd";
import {
  fetchEnvironment,
  getState,
  movePlayer,
  restartEnvironment,
  streamAgentCommand,
  type AgentStreamEvent,
  type EnvironmentData,
} from "../api";
import type { ChatMessage } from "../component/Chatbox";
import type { MoveLog } from "../component/HistoryPanel";

export type UseGameControllerReturn = {
  pos: { x: number; y: number };
  messages: ChatMessage[];
  agentBusy: boolean;
  history: MoveLog[];
  envData: EnvironmentData | null;
  restartLoading: boolean;
  handleMove: (dx: number, dy: number, note?: string) => Promise<void>;
  onSendToAgent: (text: string) => Promise<void>;
  handleRestartEnv: () => Promise<void>;
};

export function useGameController(): UseGameControllerReturn {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);
  const [history, setHistory] = useState<MoveLog[]>([]);
  const [envData, setEnvData] = useState<EnvironmentData | null>(null);
  const [restartLoading, setRestartLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [initialPos, env] = await Promise.all([getState(), fetchEnvironment()]);
        if (cancelled) return;
        setPos(initialPos);
        setHistory([{ ts: Date.now(), x: initialPos.x, y: initialPos.y, note: "Init" }]);
        setEnvData(env);
      } catch (err) {
        console.error("Init load failed", err);
        message.error("初始化环境失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMove = useCallback(
    async (dx: number, dy: number, note?: string) => {
      console.log("[WEB] handleMove", { dx, dy, note });
      try {
        const p = await movePlayer(dx, dy);
        console.log("[WEB] handleMove result", p);
        setPos(p);
        setHistory((h) => [...h, { ts: Date.now(), x: p.x, y: p.y, note }]);
        setMessages((m) => [...m, { role: "system", text: `Moved to (${p.x}, ${p.y})` }]);
        setEnvData((env) => (env ? { ...env, player: { x: p.x, y: p.y } } : env));
      } catch (e: any) {
        console.error(e);
        const reason: string | undefined = e?.response?.data?.message ?? e?.message;
        setMessages((m) => [...m, { role: "system", text: "⚠️ Move failed." }]);
        if (reason) {
          message.warning(`移动失败：${reason}`);
        }
      }
    },
    []
  );

  const onSendToAgent = useCallback(
    async (text: string) => {
      console.log("[WEB] onSendToAgent", text);
      setMessages((m) => [...m, { role: "user", text }]);
      setAgentBusy(true);
      try {
        const appendMessage = (msg: ChatMessage) => setMessages((m) => [...m, msg]);
        const appendHistory = (entry: MoveLog) => setHistory((h) => [...h, entry]);

        const handleEvent = (event: AgentStreamEvent) => {
          console.log("[WEB] agent event", event);
          if (event.type === "status") {
            appendMessage({ role: "system", text: event.message });
            return;
          }
          if (event.type === "action") {
            const argsText = event.args
              ? `(${Object.entries(event.args)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(", ")})`
              : "";
            appendMessage({ role: "assistant", text: `调用 ${event.action}${argsText}`.trim() });
            return;
          }
          if (event.type === "step") {
            const stepPos = event.pos;
            if (stepPos) {
              setPos(stepPos);
              appendHistory({
                ts: Date.now(),
                x: stepPos.x,
                y: stepPos.y,
                note: event.info ?? "LLM",
              });
              setEnvData((env) => (env ? { ...env, player: { x: stepPos.x, y: stepPos.y } } : env));
            }
            if (event.info && !event.pos) {
              appendMessage({ role: "system", text: event.info });
            }
            if (event.ok === false) {
              appendMessage({ role: "system", text: event.info ?? "移动失败" });
            }
            return;
          }
          if (event.type === "error") {
            appendMessage({ role: "assistant", text: `⚠️ ${event.message}` });
            return;
          }
          if (event.type === "completion") {
            const completionPos = event.pos;
            if (completionPos) {
              setPos(completionPos);
              appendHistory({ ts: Date.now(), x: completionPos.x, y: completionPos.y, note: "完成" });
              setEnvData((env) => (env ? { ...env, player: { x: completionPos.x, y: completionPos.y } } : env));
            }
            if (event.summary) {
              appendMessage({ role: "assistant", text: event.summary });
            }
          }
        };
        console.log("Sending to agent:", text);
        await streamAgentCommand(text, handleEvent);
      } catch (e) {
        console.error(e);
        setMessages((m) => [...m, { role: "assistant", text: "⚠️ Error processing command." }]);
      } finally {
        setAgentBusy(false);
      }
    },
    []
  );

  const handleRestartEnv = useCallback(async () => {
    setRestartLoading(true);
    try {
      const env = await restartEnvironment();
      const player = env.player ?? { x: 0, y: 0 };
      setEnvData(env);
      setPos(player);
      setHistory([{ ts: Date.now(), x: player.x, y: player.y, note: "重置" }]);
      setMessages((m) => [...m, { role: "system", text: "环境已重置到初始状态。" }]);
      message.success("环境已重置");
    } catch (err) {
      console.error("Restart environment failed", err);
      message.error("环境重置失败，请稍后重试");
    } finally {
      setRestartLoading(false);
    }
  }, []);

  return {
    pos,
    messages,
    agentBusy,
    history,
    envData,
    restartLoading,
    handleMove,
    onSendToAgent,
    handleRestartEnv,
  };
}
