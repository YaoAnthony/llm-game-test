import { Modal, Descriptions, Divider, Space, Statistic, Tag, Typography } from "antd";
import type { ModalProps } from "antd";

export interface WorldInfoModalData {
    worldId: string;
    timeOfDay: string;
    tick: number;
    formattedClock: string;
    speedMultiplier: number;
    tickIntervalMs: number;
    isRunning: boolean;
    weatherCurrent: string;
    weatherDescription: string;
    autoSaveIntervalMs: number;
}

export interface WorldInfoModalProps extends Pick<ModalProps, "open" | "onCancel"> {
    data: WorldInfoModalData | null;
    loading?: boolean;
    onCancel?: () => void;
}

const formatAutoSave = (milliseconds: number) => {
    if (!milliseconds) return "未配置";
    if (milliseconds < 1000) return `${milliseconds} ms`;
    const seconds = milliseconds / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
    const minutes = Math.floor(seconds / 60);
    const remainSeconds = Math.round(seconds % 60);
    return `${minutes} 分 ${remainSeconds} 秒`;
};

const WorldInfoModal = ({ open, onCancel, data, loading }: WorldInfoModalProps) => (
    <Modal
        title="世界状态详情"
        open={open}
        onCancel={onCancel}
        footer={null}
        width={560}
        destroyOnClose
    >
        {loading ? (
            <Typography.Paragraph>加载中...</Typography.Paragraph>
        ) : data ? (
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Descriptions
                    bordered
                    column={1}
                    items={[
                        {
                            key: "worldId",
                            label: "World ID",
                            children: <Typography.Text strong>{data.worldId}</Typography.Text>,
                        },
                        {
                            key: "timeOfDay",
                            label: "昼夜阶段",
                            children: (
                                <Space>
                                    <Tag color="blue">{data.timeOfDay}</Tag>
                                    <Typography.Text type="secondary">{data.formattedClock}</Typography.Text>
                                </Space>
                            ),
                        },
                        {
                            key: "tick",
                            label: "当前 Tick",
                            children: <Typography.Text>{data.tick}</Typography.Text>,
                        },
                        {
                            key: "speed",
                            label: "时间流速",
                            children: `${data.speedMultiplier}x (${data.tickIntervalMs} ms / tick)`,
                        },
                        {
                            key: "status",
                            label: "世界心跳",
                            children: data.isRunning ? "运行中" : "已暂停",
                        },
                        {
                            key: "autosave",
                            label: "自动存档间隔",
                            children: formatAutoSave(data.autoSaveIntervalMs),
                        },
                    ]}
                />

                <Divider style={{ margin: "12px 0" }} />

                <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                        天气
                    </Typography.Title>
                    <Space size="middle">
                        <Statistic title="当前天气" value={data.weatherCurrent} />
                        <Typography.Text type="secondary">{data.weatherDescription}</Typography.Text>
                    </Space>
                </Space>
            </Space>
        ) : (
            <Typography.Paragraph type="secondary">暂无世界数据。</Typography.Paragraph>
        )}
    </Modal>
);

export default WorldInfoModal;
