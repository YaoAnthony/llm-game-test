import type { WeatherType } from "../../types/weather.js";

/**
 * 定义天气状态机：
 * 结构类似 Minecraft 里不同天气之间切换的概率表。
 * Record<当前天气, Array<[下一种天气, 出现概率]>>。
 */
const WEATHER_TRANSITIONS: Record<WeatherType, [WeatherType, number][]> = {
    clear: [
        ["clear", 0.6],
        ["rain", 0.2],
        ["fog", 0.1],
        ["storm", 0.05],
        ["snow", 0.05],
    ],
    rain: [
        ["rain", 0.5],
        ["clear", 0.3],
        ["storm", 0.15],
        ["fog", 0.05],
    ],
    storm: [
        ["storm", 0.4],
        ["rain", 0.4],
        ["clear", 0.2],
    ],
    snow: [
        ["snow", 0.5],
        ["clear", 0.3],
        ["fog", 0.2],
    ],
    fog: [
        ["fog", 0.5],
        ["clear", 0.3],
        ["rain", 0.2],
    ],
};

/**
 * 将天气代码转成可读的中文描述，方便 UI 展示。
 * @param weather 输入：WeatherType。
 * @returns 输出：中文描述字符串，例如 "阳光明媚"。
 */
export function describeWeather(weather: WeatherType): string {
    switch (weather) {
        case "clear":
            return "阳光明媚";
        case "rain":
            return "小雨淅沥";
        case "storm":
            return "雷声轰鸣";
        case "snow":
            return "雪花纷飞";
        case "fog":
            return "雾气弥漫";
        default:
            return "未知天气";
    }
}

/**
 * 根据当前天气，按权重随机下一个天气。
 * @param current 输入：当前天气代码。
 * @returns 输出：下一帧天气。
 * 内部流程：
 * 1. 读取 WEATHER_TRANSITIONS[current] 对应的概率表。
 * 2. 掷一个 0-1 的随机数，落入哪个区间就切换到哪种天气。
 * 3. 若出现浮点误差导致没有匹配，回退到最后一项（保证总有结果）。
 */
export function getNextWeather(current: WeatherType): WeatherType {
    const transitions = WEATHER_TRANSITIONS[current] ?? WEATHER_TRANSITIONS.clear;
    const roll = Math.random();
    let sum = 0;
    for (const [next, prob] of transitions) {
        sum += prob;
        if (roll <= sum) return next;
    }
    // Due to floating point inaccuracies, the loop might not return.
    // As a fallback, return the last possible weather state.
    // This should be safe as the transitions arrays are not empty.
    const lastTransition = transitions[transitions.length - 1];
    return lastTransition ? lastTransition[0] : "clear";
}