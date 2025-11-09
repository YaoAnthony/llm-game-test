import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { GameWorldSnapshot, WeatherType } from "@shared/game";
import type {
        PlayerSnapshot,
        Position,
        PlayerAttributes,
        CreatePlayerParams,
} from "@shared/player";

export type Player = PlayerSnapshot;
export type GameWorldResponse = GameWorldSnapshot;
export type CreatePlayerRequest = CreatePlayerParams;

export type { WeatherType, Position, PlayerAttributes };

export interface PlayersResponse {
    success: boolean;
    count: number;
    players: Player[];
}

export interface CreatePlayerResponse {
    success: boolean;
    message: string;
    player: Player;
}

export interface MovePlayerRequest {
    playerId: string;
    direction: 'up' | 'down' | 'left' | 'right';
    distance?: number;
}

export interface MovePlayerResponse {
    success: boolean;
    message: string;
    player: Player;
    previousPosition: Position;
    newPosition: Position;
}

const BASE_URL = "http://localhost:4000";

export const gameApi = createApi({
    reducerPath: "gameApi",
    baseQuery: fetchBaseQuery({
        baseUrl: BASE_URL,
    }),
    tagTypes: ["World", "Players"],
    endpoints: (builder) => ({
        getWorldSnapshot: builder.query<GameWorldResponse, void>({
            query: () => "/api/game/world",
            providesTags: ["World"],
            keepUnusedDataFor: 5,
        }),
        
        // 获取所有玩家
        getPlayers: builder.query<PlayersResponse, void>({
            query: () => "/api/players",
            providesTags: ["Players"],
        }),

        // 创建玩家
        createPlayer: builder.mutation<CreatePlayerResponse, CreatePlayerRequest>({
            query: (body) => ({
                url: "/api/players",
                method: "POST",
                body,
            }),
            invalidatesTags: ["Players"],
        }),

        // 删除玩家
        removePlayer: builder.mutation<{ success: boolean }, string>({
            query: (playerId) => ({
                url: `/api/players/${playerId}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Players"],
        }),

        // 移动玩家
        movePlayer: builder.mutation<MovePlayerResponse, MovePlayerRequest>({
            query: ({ playerId, direction, distance = 1 }) => ({
                url: `/api/players/${playerId}/move`,
                method: "POST",
                body: { direction, distance },
            }),
            invalidatesTags: ["Players"],
        }),
    }),
});

export const { 
    useGetWorldSnapshotQuery,
    useGetPlayersQuery,
    useCreatePlayerMutation,
    useRemovePlayerMutation,
    useMovePlayerMutation,
} = gameApi;

