import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // Cached leads data
  leads: [],
  totalLeads: 0,
  // Track when data was last fetched for stale-while-revalidate
  lastFetched: null,
  // Current pagination/filter state for cache validation
  cachedPage: 0,
  cachedRowsPerPage: 50,
  cachedFilters: null,
  // Loading and error states
  isLoading: false,
  isBackgroundRefresh: false,
  error: null,
};

const leadsSlice = createSlice({
  name: "leads",
  initialState,
  reducers: {
    // Set leads data (from API response)
    setLeads: (state, action) => {
      const { leads, totalLeads, page, rowsPerPage, filters } = action.payload;
      state.leads = leads;
      state.totalLeads = totalLeads;
      state.cachedPage = page;
      state.cachedRowsPerPage = rowsPerPage;
      state.cachedFilters = filters;
      state.lastFetched = Date.now();
      state.isLoading = false;
      state.isBackgroundRefresh = false;
      state.error = null;
    },
    // Start loading (initial load or cache miss)
    startLoading: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    // Start background refresh (cache hit, fetching fresh data)
    startBackgroundRefresh: (state) => {
      state.isBackgroundRefresh = true;
    },
    // Stop loading/refresh
    stopLoading: (state) => {
      state.isLoading = false;
      state.isBackgroundRefresh = false;
    },
    // Set error
    setError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
      state.isBackgroundRefresh = false;
    },
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    // Clear cache (useful for logout or manual refresh)
    clearCache: (state) => {
      state.leads = [];
      state.totalLeads = 0;
      state.lastFetched = null;
      state.cachedPage = 0;
      state.cachedRowsPerPage = 50;
      state.cachedFilters = null;
    },
    // Update a single lead in the cache
    updateLeadInCache: (state, action) => {
      const updatedLead = action.payload;
      const index = state.leads.findIndex((l) => l._id === updatedLead._id);
      if (index !== -1) {
        state.leads[index] = updatedLead;
      }
    },
    // Remove a lead from cache
    removeLeadFromCache: (state, action) => {
      const leadId = action.payload;
      state.leads = state.leads.filter((l) => l._id !== leadId);
      state.totalLeads = Math.max(0, state.totalLeads - 1);
    },
  },
});

export const {
  setLeads,
  startLoading,
  startBackgroundRefresh,
  stopLoading,
  setError,
  clearError,
  clearCache,
  updateLeadInCache,
  removeLeadFromCache,
} = leadsSlice.actions;

// Selectors
export const selectLeads = (state) => state.leads.leads;
export const selectTotalLeads = (state) => state.leads.totalLeads;
export const selectLeadsLoading = (state) => state.leads.isLoading;
export const selectLeadsBackgroundRefresh = (state) =>
  state.leads.isBackgroundRefresh;
export const selectLeadsError = (state) => state.leads.error;
export const selectLeadsLastFetched = (state) => state.leads.lastFetched;
export const selectCachedPagination = (state) => ({
  page: state.leads.cachedPage,
  rowsPerPage: state.leads.cachedRowsPerPage,
  filters: state.leads.cachedFilters,
});

// Helper to check if cache is valid for current request
// Takes the leads slice state directly (not full Redux state)
export const isCacheValid = (leadsState, page, rowsPerPage, filters) => {
  const { cachedPage, cachedRowsPerPage, cachedFilters, lastFetched, leads } =
    leadsState;

  // No cache if no data or never fetched
  if (!lastFetched || leads.length === 0) return false;

  // Check if pagination matches
  if (cachedPage !== page || cachedRowsPerPage !== rowsPerPage) return false;

  // Check if filters match (deep comparison)
  if (JSON.stringify(cachedFilters) !== JSON.stringify(filters)) return false;

  return true;
};

export default leadsSlice.reducer;
