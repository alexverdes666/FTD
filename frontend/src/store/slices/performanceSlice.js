import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// Cache durations
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutes for background sync

const initialState = {
  // Performance data cache
  teamStats: null,
  financialMetrics: null,
  leadStats: null,
  orderStats: null,
  agentPerformance: [],

  // Cache metadata
  lastSyncTime: null,
  lastBackgroundSync: null,
  isSyncing: false,
  isLoading: false,
  error: null,

  // Background sync state
  backgroundSyncActive: false,
  syncInProgress: false,
};

// Background sync for performance data
export const backgroundSyncPerformance = createAsyncThunk(
  "performance/backgroundSync",
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const user = state.auth.user;

      if (!user) {
        return rejectWithValue("User not authenticated");
      }

      const now = Date.now();
      const lastSync = state.performance.lastBackgroundSync;

      // Only sync if enough time has passed since last sync
      if (lastSync && now - lastSync < BACKGROUND_SYNC_INTERVAL) {
        return state.performance; // Return current state if too soon
      }

      const today = new Date().toISOString().split("T")[0];
      const results = {};

      if (user.role === "admin") {
        // For admin, fetch all performance data in background
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const targetDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split("T")[0];
        
        const promises = [
          api.get(`/users/team-stats?date=${targetDate}&month=${currentMonth}&year=${currentYear}`),
          api.get("/leads/stats"),
          api.get("/orders/stats"),
          api.get(`/financial/metrics?month=${currentMonth}&year=${currentYear}`),
        ];

        const responses = await Promise.all(promises);
        results.teamStats = responses[0].data.data;
        results.leadStats = responses[1].data.data;
        results.orderStats = responses[2].data.data;
        results.financialMetrics = responses[3].data.data;
      } else if (user.role === "agent" && user.id) {
        // For agents, just sync their performance for the last 30 days
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const response = await api.get(
          `/users/${user.id}/performance?startDate=${startDate}&endDate=${today}`
        );
        results.agentPerformance = response.data.data;
      }

      return {
        ...results,
        lastBackgroundSync: now,
      };
    } catch (error) {
      console.warn("Background sync failed (this is OK):", error.message);
      // Don't reject, just return current state to avoid disrupting UX
      return getState().performance;
    }
  }
);

// Initial load with sync (for page loads)
export const loadPerformanceData = createAsyncThunk(
  "performance/loadData",
  async ({ forceSync = false, month = null, year = null } = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const user = state.auth.user;

      if (!user) {
        return rejectWithValue("User not authenticated");
      }

      const now = Date.now();
      const lastSync = state.performance.lastSyncTime;
      const cachedData = state.performance;

      // Check if the requested month/year matches cached data
      const requestedMonth = month || new Date().getMonth() + 1;
      const requestedYear = year || new Date().getFullYear();
      const cachedMonth = cachedData.financialMetrics?.period?.month;
      const cachedYear = cachedData.financialMetrics?.period?.year;
      const monthYearMatches = cachedMonth === requestedMonth && cachedYear === requestedYear;

      // If we have fresh cached data for the SAME month/year and not forcing sync, return cached data
      if (
        !forceSync &&
        lastSync &&
        now - lastSync < CACHE_DURATION &&
        monthYearMatches &&
        ((user.role === "admin" && cachedData.teamStats) ||
          (user.role === "agent" && cachedData.agentPerformance.length > 0))
      ) {
        console.log(`📋 Returning cached data for ${requestedMonth}/${requestedYear}`);
        return {
          fromCache: true,
          ...cachedData,
        };
      }

      console.log(`🔄 Fetching fresh data for ${requestedMonth}/${requestedYear} (cached was ${cachedMonth}/${cachedYear})`);

      const today = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const results = {};

      if (user.role === "admin") {
        // Calculate the target date based on selected month/year (use first day of selected month)
        const targetDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth() + 1) - 1, 1)
          .toISOString().split("T")[0];
        
        const promises = [
          api.get(`/users/team-stats?date=${targetDate}&month=${month || new Date().getMonth() + 1}&year=${year || new Date().getFullYear()}`),
          api.get("/leads/stats"),
          api.get(`/orders/stats?startDate=${startDate}&endDate=${today}`),
          api.get(`/financial/metrics?month=${month || new Date().getMonth() + 1}&year=${year || new Date().getFullYear()}`),
        ];

        const responses = await Promise.all(promises);
        results.teamStats = responses[0].data.data;
        results.leadStats = responses[1].data.data;
        results.orderStats = responses[2].data.data;
        results.financialMetrics = responses[3].data.data;
      } else if (user.role === "agent" && user.id) {
        const response = await api.get(
          `/users/${user.id}/performance?startDate=${startDate}&endDate=${today}&month=${month || new Date().getMonth() + 1}&year=${year || new Date().getFullYear()}`
        );
        results.agentPerformance = response.data.data;
      }

      return {
        ...results,
        lastSyncTime: now,
        fromCache: false,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to load performance data"
      );
    }
  }
);

// Force refresh (for manual refresh button)
export const refreshPerformanceData = createAsyncThunk(
  "performance/refresh",
  async ({ month = null, year = null } = {}, thunkAPI) => {
    return thunkAPI.dispatch(loadPerformanceData({ 
      forceSync: true, 
      month, 
      year 
    }));
  }
);

const performanceSlice = createSlice({
  name: "performance",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setBackgroundSyncActive: (state, action) => {
      state.backgroundSyncActive = action.payload;
    },
    updateCacheTimestamp: (state) => {
      state.lastSyncTime = Date.now();
    },
  },
  extraReducers: (builder) => {
    builder
      // Background sync
      .addCase(backgroundSyncPerformance.pending, (state) => {
        state.syncInProgress = true;
      })
      .addCase(backgroundSyncPerformance.fulfilled, (state, action) => {
        state.syncInProgress = false;
        if (!action.payload.fromCache) {
          // Only update if we got fresh data
          if (action.payload.teamStats)
            state.teamStats = action.payload.teamStats;
          if (action.payload.leadStats)
            state.leadStats = action.payload.leadStats;
          if (action.payload.orderStats)
            state.orderStats = action.payload.orderStats;
          if (action.payload.financialMetrics)
            state.financialMetrics = action.payload.financialMetrics;
          if (action.payload.agentPerformance)
            state.agentPerformance = action.payload.agentPerformance;
          if (action.payload.lastBackgroundSync)
            state.lastBackgroundSync = action.payload.lastBackgroundSync;
        }
      })
      .addCase(backgroundSyncPerformance.rejected, (state) => {
        state.syncInProgress = false;
        // Don't set error for background sync failures
      })

      // Initial load
      .addCase(loadPerformanceData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadPerformanceData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;

        // Update data
        if (action.payload.teamStats !== undefined)
          state.teamStats = action.payload.teamStats;
        if (action.payload.leadStats !== undefined)
          state.leadStats = action.payload.leadStats;
        if (action.payload.orderStats !== undefined)
          state.orderStats = action.payload.orderStats;
        if (action.payload.financialMetrics !== undefined)
          state.financialMetrics = action.payload.financialMetrics;
        if (action.payload.agentPerformance !== undefined)
          state.agentPerformance = action.payload.agentPerformance;

        // Update timestamps
        if (action.payload.lastSyncTime)
          state.lastSyncTime = action.payload.lastSyncTime;
        if (action.payload.lastBackgroundSync)
          state.lastBackgroundSync = action.payload.lastBackgroundSync;

        state.isSyncing = false;
      })
      .addCase(loadPerformanceData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isSyncing = false;
      })

      // Manual refresh
      .addCase(refreshPerformanceData.pending, (state) => {
        state.isSyncing = true;
        state.error = null;
      })
      .addCase(refreshPerformanceData.fulfilled, (state) => {
        state.isSyncing = false;
      })
      .addCase(refreshPerformanceData.rejected, (state, action) => {
        state.isSyncing = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, setBackgroundSyncActive, updateCacheTimestamp } =
  performanceSlice.actions;

// Selectors
export const selectPerformanceData = (state) => state.performance;
export const selectTeamStats = (state) => state.performance.teamStats;
export const selectFinancialMetrics = (state) => state.performance.financialMetrics;
export const selectLeadStats = (state) => state.performance.leadStats;
export const selectOrderStats = (state) => state.performance.orderStats;
export const selectAgentPerformance = (state) =>
  state.performance.agentPerformance;
export const selectIsLoading = (state) => state.performance.isLoading;
export const selectIsSyncing = (state) => state.performance.isSyncing;
export const selectError = (state) => state.performance.error;
export const selectLastSyncTime = (state) => state.performance.lastSyncTime;
export const selectBackgroundSyncActive = (state) =>
  state.performance.backgroundSyncActive;

export default performanceSlice.reducer;
