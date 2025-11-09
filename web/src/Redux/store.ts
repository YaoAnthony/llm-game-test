import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { gameApi } from "./api/gameApi";
import worldReducer from "./slices/worldSlice";

export const store = configureStore({
	reducer: {
		[gameApi.reducerPath]: gameApi.reducer,
		world: worldReducer,
	},
	middleware: (getDefaultMiddleware) => (
		getDefaultMiddleware().concat(gameApi.middleware)
	),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
