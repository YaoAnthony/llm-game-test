// web/src/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4000",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

export type AgentStreamEvent =
  | { type: "status"; message: string }
  | { type: "action"; action: string; args?: Record<string, unknown> }
  | { type: "step"; pos?: { x: number; y: number } | null; ok?: boolean; info?: string; hint?: string | null }
  | { type: "completion"; summary?: string; pos?: { x: number; y: number } | null }
  | { type: "error"; message: string };

export type EnvironmentData = {
  width: number;
  height: number;
  player: { x: number; y: number } | null;
  obstacles: Array<{ x: number; y: number }>;
  objects: Array<{ type: string; name: string; pos?: { x: number; y: number } | null }>;
};

// 获取状态（REST）
export async function getState(): Promise<{ x: number; y: number }> {
  const { data } = await api.get("/api/state");
  return data; // { x, y }
}

// 移动角色（REST）
export async function movePlayer(
  dx: number,
  dy: number
): Promise<{ x: number; y: number }> {
  const { data } = await api.post("/api/move", { dx, dy });
  return data; // { x, y }
}
export async function sendAgentCommand(command: string): Promise<{ pos?: { x: number; y: number }; reply?: string }> {
  const { data } = await api.post("/agent/command", { command });
  return data;
}


export async function streamAgentCommand(
  command: string,
  onEvent: (event: AgentStreamEvent) => void
): Promise<{ summary?: string; pos?: { x: number; y: number } | null }> {
  const response = await fetch("http://localhost:4000/agent/command-stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ command }),
  });

  if (!response.ok || !response.body) {
    throw new Error("无法建立指令流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const finalState: { summary?: string; pos?: { x: number; y: number } | null } = {};

  const emit = (eventType: string, payload: unknown) => {
    try {
      switch (eventType) {
        case "status":
          onEvent({ type: "status", message: String((payload as any)?.message ?? "") });
          break;
        case "action":
          onEvent({
            type: "action",
            action: String((payload as any)?.payload?.action ?? (payload as any)?.action ?? "unknown"),
            args:
              ((payload as any)?.payload?.args as Record<string, unknown> | undefined) ??
              ((payload as any)?.args as Record<string, unknown> | undefined),
          });
          break;
        case "step":
          onEvent({
            type: "step",
            pos:
              ((payload as any)?.payload?.pos as { x: number; y: number } | null | undefined) ??
              ((payload as any)?.pos as { x: number; y: number } | null | undefined) ??
              null,
            ok:
              ((payload as any)?.payload?.ok as boolean | undefined) ??
              ((payload as any)?.ok as boolean | undefined),
            info:
              ((payload as any)?.payload?.info as string | undefined) ??
              ((payload as any)?.info as string | undefined),
            hint:
              ((payload as any)?.payload?.hint as string | null | undefined) ??
              ((payload as any)?.hint as string | null | undefined) ??
              null,
          });
          break;
        case "completion":
          finalState.summary =
            ((payload as any)?.payload?.summary as string | undefined) ??
            ((payload as any)?.summary as string | undefined) ??
            finalState.summary;
          finalState.pos =
            ((payload as any)?.payload?.pos as { x: number; y: number } | null | undefined) ??
            ((payload as any)?.pos as { x: number; y: number } | null | undefined) ??
            finalState.pos ?? null;
          onEvent({
            type: "completion",
            summary: finalState.summary,
            pos: finalState.pos ?? null,
          });
          break;
        case "error":
          onEvent({ type: "error", message: String((payload as any)?.message ?? "未知错误") });
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("处理 SSE 事件失败", err);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let delimiterIndex = buffer.indexOf("\n\n");
    while (delimiterIndex !== -1) {
      const rawEvent = buffer.slice(0, delimiterIndex);
      buffer = buffer.slice(delimiterIndex + 2);
      if (rawEvent.trim().length === 0) {
        delimiterIndex = buffer.indexOf("\n\n");
        continue;
      }

      let eventType = "message";
      const dataLines: string[] = [];
      for (const line of rawEvent.split(/\n/)) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5));
        }
      }

      const dataString = dataLines.join("\n").trim();
      if (dataString) {
        try {
          const payload = JSON.parse(dataString);
          emit(eventType, payload);
        } catch (err) {
          console.error("解析 SSE 数据失败", err, dataString);
        }
      }

      delimiterIndex = buffer.indexOf("\n\n");
    }
  }

  return finalState;
}

export async function fetchEnvironment(): Promise<EnvironmentData> {
  const { data } = await api.get("/api/env");
  return data;
}

export async function restartEnvironment(): Promise<EnvironmentData> {
  const { data } = await api.post("/api/env/restart");
  if (data?.env) {
    return data.env as EnvironmentData;
  }
  return data as EnvironmentData;
}


// web/src/api.ts 里也可以加
export async function startAgent() {
  await axios.post("http://localhost:4000/agent/start");
}

export async function stopAgent() {
  await axios.post("http://localhost:4000/agent/stop");
}
