import { createSlice } from '@reduxjs/toolkit';
const initialState = {
  users: [],
  isLoading: false,
  error: null,
};
const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
});
export const { clearError } = usersSlice.actions;
export default usersSlice.reducer;