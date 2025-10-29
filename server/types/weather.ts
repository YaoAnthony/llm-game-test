export enum TimeOfDay {
    Dawn = "dawn",
    Day = "day",
    Dusk = "dusk",
    Night = "night",
}

export enum Weather {
    Clear = "clear",
    Rain = "rain",
    Storm = "storm",
    Snow = "snow",
    Fog = "fog",
}

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

export type WeatherType = "clear" | "rain" | "storm" | "snow" | "fog";

