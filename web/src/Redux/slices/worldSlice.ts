import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GameWorldResponse, Player } from '../api/gameApi';

/**
 * 世界状态 Slice
 * 管理游戏世界的全局状态：时间、天气、玩家等
 */

export interface WorldState {
    // 世界基本信息
    worldId: string | null;
    tick: number;
    timeOfDay: string;
    weather: string;
    weatherDescription: string;
    
    // 当前操控的玩家
    currentPlayer: Player | null;
    
    // 所有在线玩家（包括自己）- 用于多人显示
    allPlayers: Record<string, Player>;
    
    // 游戏配置
    tickIntervalMs: number;
    speedMultiplier: number;
    isRunning: boolean;
    
    // UI 状态
    loginModalVisible: boolean;
}

const initialState: WorldState = {
    worldId: null,
    tick: 0,
    timeOfDay: 'day',
    weather: 'clear',
    weatherDescription: '晴朗',
    currentPlayer: null,
    allPlayers: {},
    tickIntervalMs: 50,
    speedMultiplier: 1,
    isRunning: false,
    loginModalVisible: false,
};

const worldSlice = createSlice({
    name: 'world',
    initialState,
    reducers: {
        // 更新世界状态（从服务器同步）
        updateWorldState: (state, action: PayloadAction<GameWorldResponse>) => {
            const { worldId, time, weather } = action.payload;
            state.worldId = worldId;
            state.tick = time.tick;
            state.timeOfDay = time.timeOfDay;
            state.tickIntervalMs = time.tickIntervalMs;
            state.speedMultiplier = time.speedMultiplier;
            state.isRunning = time.isRunning;
            state.weather = weather.current;
            state.weatherDescription = weather.description;
        },
        
        // 设置当前玩家
        setCurrentPlayer: (state, action: PayloadAction<Player | null>) => {
            state.currentPlayer = action.payload;
            
            // 同时更新到 allPlayers
            if (action.payload) {
                state.allPlayers[action.payload.id] = action.payload;
                localStorage.setItem('currentPlayerId', action.payload.id);
            } else {
                localStorage.removeItem('currentPlayerId');
            }
        },
        
        // 更新当前玩家状态（位置、属性等）
        updateCurrentPlayer: (state, action: PayloadAction<Partial<Player>>) => {
            if (state.currentPlayer) {
                state.currentPlayer = {
                    ...state.currentPlayer,
                    ...action.payload,
                };
                // 同步到 allPlayers
                state.allPlayers[state.currentPlayer.id] = state.currentPlayer;
            }
        },
        
        // 设置所有玩家（初始加载）
        setAllPlayers: (state, action: PayloadAction<Player[]>) => {
            state.allPlayers = {};
            action.payload.forEach(player => {
                state.allPlayers[player.id] = player;
            });
        },
        
        // 更新单个玩家位置（WebSocket 推送）
        updatePlayerPosition: (state, action: PayloadAction<{ playerId: string; position: { x: number; y: number; z: number } }>) => {
            const { playerId, position } = action.payload;
            const player = state.allPlayers[playerId];
            
            if (player) {
                player.position = position;
                
                // 如果是当前玩家，同步更新
                if (state.currentPlayer?.id === playerId) {
                    state.currentPlayer.position = position;
                }
            }
        },
        
        // 添加玩家（新玩家加入）
        addPlayer: (state, action: PayloadAction<Player>) => {
            state.allPlayers[action.payload.id] = action.payload;
        },
        
        // 移除玩家（玩家离开）
        removePlayer: (state, action: PayloadAction<string>) => {
            delete state.allPlayers[action.payload];
        },
        
        // 显示/隐藏登录 Modal
        setLoginModalVisible: (state, action: PayloadAction<boolean>) => {
            state.loginModalVisible = action.payload;
        },
        
        // 重置世界状态
        resetWorld: () => initialState,
    },
});

export const {
    updateWorldState,
    setCurrentPlayer,
    updateCurrentPlayer,
    setAllPlayers,
    updatePlayerPosition,
    addPlayer,
    removePlayer,
    setLoginModalVisible,
    resetWorld,
} = worldSlice.actions;

export default worldSlice.reducer;

// Selectors
export const selectCurrentPlayer = (state: { world: WorldState }) => state.world.currentPlayer;
export const selectAllPlayers = (state: { world: WorldState }) => state.world.allPlayers;
export const selectWorldId = (state: { world: WorldState }) => state.world.worldId;
export const selectWorldTime = (state: { world: WorldState }) => ({
    tick: state.world.tick,
    timeOfDay: state.world.timeOfDay,
    tickIntervalMs: state.world.tickIntervalMs,
});
export const selectWeather = (state: { world: WorldState }) => ({
    current: state.world.weather,
    description: state.world.weatherDescription,
});
export const selectLoginModalVisible = (state: { world: WorldState }) => state.world.loginModalVisible;
