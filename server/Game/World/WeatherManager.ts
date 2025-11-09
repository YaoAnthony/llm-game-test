
import { WeatherType, Weather } from "../../types/weather.js";
//util 
import { getNextWeather } from "./utils";

/**
 * Minecraft 风格的天气调度器：
 * - 维护当前世界的天气，如晴天、下雨或雷暴。
 * - 根据时间段和概率生成下一次天气变化。
 */
export default class WeatherManager {
    /** 当前天气状态，默认晴天，相当于世界启动时的 clear sky。 */
    private current: WeatherType = "clear";

    /**
     * 根据世界时间推进天气。
     * @param timeOfDay 输入：当前世界时间段（来自 TimeManager）。
     * 逻辑：
     * - 如果是夜晚，有 10% 概率出现迷雾（可类比 MC 夜间偶尔起雾的效果）。
     * - 否则调用 getNextWeather 依据权重随机天气。
     * 输出：无直接返回，但会更新内部 current。
     */
    update(timeOfDay: string) {
        // 根据时间段调整概率（可简单处理）
        if (timeOfDay === "night" && Math.random() < 0.1)
            this.current = "fog";
        else
            this.current = getNextWeather(this.current);
    }

    /**
     * @returns 输出：当前天气状态，供外部展示或同步给客户端。
     */
    getWeather() {
        return this.current;
    }
}