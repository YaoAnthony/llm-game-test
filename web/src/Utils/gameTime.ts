/**
 * 时间转换工具
 * 游戏设定：1天 = 24分钟 = 1440秒 = 1440000毫秒
 * 1小时 = 1分钟 = 60秒
 */

export const GAME_TIME_CONFIG = {
    // 1天在现实中的时长（毫秒）
    REAL_DAY_DURATION: 24 * 60 * 1000, // 24分钟
    // 1小时在现实中的时长（毫秒）
    REAL_HOUR_DURATION: 60 * 1000, // 1分钟
    // 游戏中的1天有多少小时
    HOURS_PER_DAY: 24,
    // 游戏中的1小时有多少分钟
    MINUTES_PER_HOUR: 60,
};

/**
 * 将游戏 tick 转换为游戏内的天数、小时、分钟
 * @param tick 游戏 tick 数
 * @param tickIntervalMs 每个 tick 的毫秒数（默认 50ms）
 * @returns 游戏内时间
 */
export function tickToGameTime(tick: number, tickIntervalMs: number = 50) {
    // 计算总的游戏时间（毫秒）
    const totalGameTimeMs = tick * tickIntervalMs;
    
    // 计算天数
    const days = Math.floor(totalGameTimeMs / GAME_TIME_CONFIG.REAL_DAY_DURATION);
    
    // 剩余时间
    const remainingMs = totalGameTimeMs % GAME_TIME_CONFIG.REAL_DAY_DURATION;
    
    // 计算小时
    const hours = Math.floor(remainingMs / GAME_TIME_CONFIG.REAL_HOUR_DURATION);
    
    // 计算分钟
    const minutes = Math.floor(
        (remainingMs % GAME_TIME_CONFIG.REAL_HOUR_DURATION) / 1000 / 60
    );
    
    return {
        days,
        hours,
        minutes,
        totalDays: days + hours / 24,
    };
}

/**
 * 格式化游戏时间为字符串
 * @param tick 游戏 tick 数
 * @param tickIntervalMs 每个 tick 的毫秒数
 * @returns 格式化的时间字符串，如 "第3天 14:30"
 */
export function formatGameTime(tick: number, tickIntervalMs: number = 50): string {
    const { days, hours, minutes } = tickToGameTime(tick, tickIntervalMs);
    
    const hourStr = hours.toString().padStart(2, '0');
    const minuteStr = minutes.toString().padStart(2, '0');
    
    return `第${days + 1}天 ${hourStr}:${minuteStr}`;
}

/**
 * 获取时段中文名称
 * @param timeOfDay 时段
 * @returns 中文名称
 */
export function getTimeOfDayText(timeOfDay: string): string {
    const timeMap: Record<string, string> = {
        dawn: '黎明',
        day: '白天',
        dusk: '黄昏',
        night: '夜晚',
    };
    
    return timeMap[timeOfDay] || timeOfDay;
}

/**
 * 获取天气中文名称
 * @param weather 天气类型
 * @returns 中文名称
 */
export function getWeatherText(weather: string): string {
    const weatherMap: Record<string, string> = {
        clear: '晴朗',
        rain: '下雨',
        storm: '暴风雨',
        snow: '下雪',
        fog: '起雾',
    };
    
    return weatherMap[weather] || weather;
}

/**
 * 计算当前时间段的进度（0-1）
 * @param tick 游戏 tick 数
 * @param tickIntervalMs 每个 tick 的毫秒数
 * @returns 0-1 的进度值
 */
export function getTimeProgress(tick: number, tickIntervalMs: number = 50): number {
    const totalGameTimeMs = tick * tickIntervalMs;
    const progress = (totalGameTimeMs % GAME_TIME_CONFIG.REAL_DAY_DURATION) / GAME_TIME_CONFIG.REAL_DAY_DURATION;
    return progress;
}

/**
 * 根据时间进度获取天空颜色
 * @param progress 时间进度（0-1）
 * @returns CSS 渐变色字符串
 */
export function getSkyGradient(progress: number): string {
    // 0-0.25: 夜晚 -> 黎明
    if (progress < 0.25) {
        const alpha = progress / 0.25;
        return `linear-gradient(to bottom, 
            rgb(${25 + alpha * 100}, ${25 + alpha * 80}, ${50 + alpha * 130}),
            rgb(${50 + alpha * 100}, ${50 + alpha * 100}, ${80 + alpha * 120})
        )`;
    }
    // 0.25-0.5: 黎明 -> 白天
    else if (progress < 0.5) {
        const alpha = (progress - 0.25) / 0.25;
        return `linear-gradient(to bottom,
            rgb(${125 + alpha * 10}, ${105 + alpha * 40}, ${180 + alpha * 55}),
            rgb(${150 + alpha * 35}, ${150 + alpha * 35}, ${200 + alpha * 35})
        )`;
    }
    // 0.5-0.75: 白天 -> 黄昏
    else if (progress < 0.75) {
        const alpha = (progress - 0.5) / 0.25;
        return `linear-gradient(to bottom,
            rgb(${135 - alpha * 40}, ${145 - alpha * 60}, ${235 - alpha * 135}),
            rgb(${185 - alpha * 5}, ${185 - alpha * 30}, ${235 - alpha * 100})
        )`;
    }
    // 0.75-1: 黄昏 -> 夜晚
    else {
        const alpha = (progress - 0.75) / 0.25;
        return `linear-gradient(to bottom,
            rgb(${95 - alpha * 70}, ${85 - alpha * 60}, ${100 - alpha * 50}),
            rgb(${180 - alpha * 130}, ${155 - alpha * 105}, ${135 - alpha * 55})
        )`;
    }
}
