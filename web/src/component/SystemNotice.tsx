import { Alert } from "antd";

export default function SystemNotice() {
  return (
    <div className="w-full max-w-5xl mx-auto py-3">
      <Alert
        message="W / A / S / D 可以直接控制移动；底部聊天框可让 GPT 按你指令导航。"
        type="info"
        showIcon
      />
    </div>
  );
}
