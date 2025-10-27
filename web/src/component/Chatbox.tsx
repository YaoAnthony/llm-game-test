import { useEffect, useRef, useState } from "react";
import { Button, Input, List, Typography } from "antd";

export type ChatMessage = { role: "user" | "assistant" | "system"; text: string };

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  height?: number;
};

export default function ChatBox({
  messages,
  onSend,
  disabled,
  placeholder,
  height = 260,
}: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const displayMessages = messages.filter((m) => m.role !== "system");

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [displayMessages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || disabled || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setInput("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div
        ref={listRef}
        style={{ height, overflowY: "auto", padding: 8, border: "1px solid #f0f0f0", borderRadius: 8, marginBottom: 8 }}
      >
        <List
          dataSource={displayMessages}
          split={false}
          renderItem={(m, i) => (
            <List.Item key={i} style={{ padding: "6px 0" }}>
              <Typography.Text strong type={m.role === "user" ? undefined : "secondary"}>
                {m.role === "user" ? "You" : "GPT"}:
              </Typography.Text>
              <span style={{ marginLeft: 6 }}>{m.text}</span>
            </List.Item>
          )}
        />
      </div>

      <div>
        <Input
          style={{ width: "calc(100% - 96px)" }}
          placeholder={placeholder ?? "e.g. go to (5,2) / move right 3"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={handleSend}
          disabled={disabled || sending}
        />
        <Button type="primary" onClick={handleSend} disabled={disabled || sending}>
          {sending ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
