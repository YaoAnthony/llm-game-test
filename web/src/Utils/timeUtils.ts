import { TICKS_PER_DAY } from "../Contants";


export const formatTickToTime = (tick: number, tickIntervalMs: number) => {
    const totalMs = tick * tickIntervalMs;
    const totalSeconds = Math.floor(totalMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};


export const resolvePeriod = (tick: number) => {
    const periodLength = TICKS_PER_DAY / 4;
    const normalized = ((tick % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;

    if (normalized < periodLength) return "dawn";
    if (normalized < periodLength * 2) return "day";
    if (normalized < periodLength * 3) return "dusk";
    return "night";
};