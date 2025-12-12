import { createSlice } from '@reduxjs/toolkit';
const initialState = {
  sidebarOpen: true,
  theme: 'light',
  notifications: [],
};
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    addNotification: (state, action) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
  },
});
export const {
  toggleSidebar,
  setSidebarOpen,
  toggleTheme,
  addNotification,
  removeNotification,
} = uiSlice.actions;
export default uiSlice.reducer;