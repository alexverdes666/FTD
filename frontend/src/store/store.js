import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import { combineReducers } from "@reduxjs/toolkit";
import authSlice from "./slices/authSlice";
import ordersSlice from "./slices/ordersSlice";
import leadsSlice from "./slices/leadsSlice";
import usersSlice from "./slices/usersSlice";
import uiSlice from "./slices/uiSlice";
import chatSlice from "./slices/chatSlice";
import notificationSlice from "./slices/notificationSlice";
const persistConfig = {
  key: "root",
  storage,
  whitelist: ["auth", "leads"],
};
const rootReducer = combineReducers({
  auth: authSlice,
  orders: ordersSlice,
  leads: leadsSlice,
  users: usersSlice,
  ui: uiSlice,
  chat: chatSlice,
  notifications: notificationSlice,
});
const persistedReducer = persistReducer(persistConfig, rootReducer);
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
  devTools: process.env.NODE_ENV !== "production",
});
export const persistor = persistStore(store);
