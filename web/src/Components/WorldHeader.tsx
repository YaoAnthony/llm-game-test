import { Button, Tag } from "antd";
import { CloudOutlined, InfoCircleOutlined } from "@ant-design/icons";

export interface WorldHeaderProps {
    onOpenDetails: () => void;
    clock: string;
    timeOfDay: string;
    isRunning: boolean;
    weather: string;
    weatherDescription?: string;
    title?: string;
}

const statusColorMap: Record<string, string> = {
    dawn: "gold",
    day: "green",
    dusk: "orange",
    night: "blue",
};

const WorldHeader = ({
    onOpenDetails,
    clock,
    timeOfDay,
    isRunning,
    weather,
    weatherDescription,
    title = "世界控制台",
}: WorldHeaderProps) => {
    const color = statusColorMap[timeOfDay] ?? "default";

    return (
        <div className="flex w-full items-center justify-between gap-6">
            <div className="flex items-center gap-3">
                <Button
                    type="primary"
                    icon={<InfoCircleOutlined />}
                    onClick={onOpenDetails}
                    className="flex items-center gap-2"
                >
                    世界详情
                </Button>
                <Tag color={isRunning ? "success" : "default"} className="text-sm">
                    {isRunning ? "运行中" : "已暂停"}
                </Tag>
            </div>

            <div className="flex min-w-40 flex-col items-center text-center">
                <span className="text-4xl font-semibold leading-tight text-slate-900">
                    {clock}
                </span>
                <Tag color={color} className="mt-2 text-base capitalize">
                    {timeOfDay}
                </Tag>
            </div>

            <div className="flex items-center justify-end gap-2 text-right">
                <CloudOutlined className="text-xl text-slate-500" />
                <span className="font-semibold text-slate-800">{weather}</span>
                {weatherDescription && (
                    <span className="text-sm text-slate-500">{weatherDescription}</span>
                )}
            </div>
        </div>
    );
};

export default WorldHeader;
