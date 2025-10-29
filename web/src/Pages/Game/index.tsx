import { Alert, Card, Flex, Space, Spin, Statistic, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGetWorldSnapshotQuery } from "../../Redux/api/gameApi";

import { formatTickToTime, resolvePeriod } from "../../Utils/timeUtils";
import WorldHeader from "../../Components/WorldHeader";
import WorldInfoModal from "../../Components/WorldInfoModal";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const Game = () => {
    const { data, isLoading, isFetching, isError, error, refetch } = useGetWorldSnapshotQuery();
    const [visualTick, setVisualTick] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const timeStateRef = useRef<{
        tick: number;
        tickIntervalMs: number;
        speedMultiplier: number;
        isRunning: boolean;
        lastSync: number;
    } | null>(null);

    useEffect(() => {
        if (!data) return;

        timeStateRef.current = {
            tick: data.time.tick,
            tickIntervalMs: data.time.tickIntervalMs,
            speedMultiplier: data.time.speedMultiplier,
            isRunning: data.time.isRunning,
            lastSync: now(),
        };

        setVisualTick(data.time.tick);
    }, [data]);

    useEffect(() => {
        if (typeof window === "undefined") return;

    let frameId = 0;

        const step = () => {
            const snapshot = timeStateRef.current;
            if (snapshot && snapshot.isRunning && snapshot.speedMultiplier > 0 && snapshot.tickIntervalMs > 0) {
                const current = now();
                const elapsed = current - snapshot.lastSync;

                if (elapsed > 0) {
                    const scaledElapsed = elapsed * snapshot.speedMultiplier;
                    const ticksAdvanced = Math.floor(scaledElapsed / snapshot.tickIntervalMs);

                    if (ticksAdvanced > 0) {
                        snapshot.tick += ticksAdvanced;
                        const leftoverScaled = scaledElapsed - ticksAdvanced * snapshot.tickIntervalMs;
                        const leftoverReal = leftoverScaled / snapshot.speedMultiplier;
                        snapshot.lastSync = current - leftoverReal;
                        setVisualTick(snapshot.tick);
                    }
                }
            }

            frameId = window.requestAnimationFrame(step);
        };

        frameId = window.requestAnimationFrame(step);

        return () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, []);

    const summary = useMemo(() => {
        if (!data) return null;
        const { time, weather, meta, worldId } = data;
        const tick = typeof visualTick === "number" ? visualTick : time.tick;
        return {
            worldId,
            timeOfDay: resolvePeriod(tick),
            tick,
            formattedClock: formatTickToTime(tick, time.tickIntervalMs),
            speedMultiplier: time.speedMultiplier,
            isRunning: time.isRunning,
            tickIntervalMs: time.tickIntervalMs,
            weatherCurrent: weather.current,
            weatherDescription: weather.description,
            autoSaveIntervalMs: meta.autoSaveIntervalMs,
        };
    }, [data, visualTick]);

    if (isLoading) {
        return (
            <Flex align="center" justify="center" style={{ minHeight: "50vh" }}>
                <Spin size="large" tip="加载世界数据中..." />
            </Flex>
        );
    }

    if (isError) {
        return (
            <Flex vertical align="center" justify="center" style={{ minHeight: "50vh" }}>
                <Alert
                    type="error"
                    showIcon
                    message="无法加载游戏世界"
                    description={
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                            {JSON.stringify(error, null, 2)}
                        </pre>
                    }
                    action={<a onClick={() => refetch()}>重试</a>}
                />
            </Flex>
        );
    }

    if (!summary) {
        return null;
    }

    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    return (
        <div className="relative bg-white">
            <WorldHeader
                onOpenDetails={handleOpenModal}
                clock={summary.formattedClock}
                timeOfDay={summary.timeOfDay}
                isRunning={summary.isRunning}
                weather={summary.weatherCurrent}
                weatherDescription={summary.weatherDescription}
            />
            <WorldInfoModal
                open={isModalOpen}
                onCancel={handleCloseModal}
                loading={isFetching}
                data={summary}
            />
        </div>
    );
};

export default Game;