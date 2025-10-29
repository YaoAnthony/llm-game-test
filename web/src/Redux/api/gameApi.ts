import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type WeatherType = "clear" | "rain" | "storm" | "snow" | "fog" | string;

export interface GameWorldTime {
  tick: number;
  timeOfDay: "dawn" | "day" | "dusk" | "night" | string;
  speedMultiplier: number;
  tickIntervalMs: number;
  isRunning: boolean;
}

export interface GameWorldWeather {
  current: WeatherType;
  description: string;
}

export interface GameWorldMeta {
  autoSaveIntervalMs: number;
}

export interface GameWorldResponse {
  worldId: string;
  time: GameWorldTime;
  weather: GameWorldWeather;
  meta: GameWorldMeta;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export const gameApi = createApi({
    reducerPath: "gameApi",
    baseQuery: fetchBaseQuery({
        baseUrl: BASE_URL,
    }),
    tagTypes: ["World"],
    endpoints: (builder) => ({
        getWorldSnapshot: builder.query<GameWorldResponse, void>({
        query: () => "/api/game/world",
            providesTags: ["World"],
            keepUnusedDataFor: 5,
        }),
    }),
});

export const { useGetWorldSnapshotQuery } = gameApi;
