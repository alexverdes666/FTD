import { createSlice } from '@reduxjs/toolkit';
const initialState = {
  leads: [],
  isLoading: false,
  error: null,
};
const leadsSlice = createSlice({
  name: 'leads',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
});
export const { clearError } = leadsSlice.actions;
export default leadsSlice.reducer;