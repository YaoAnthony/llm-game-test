import { Alert } from "antd";

export default function SystemNotice() {
  return (
    <div className="w-full max-w-5xl mx-auto py-3">
      <Alert
        message="W / A / S / D 控制移动，F 键默认交互；右侧面板可选择不同的交互动作，聊天框可让 GPT 按你指令导航。"
        type="info"
        showIcon
      />
    </div>
  );
}
