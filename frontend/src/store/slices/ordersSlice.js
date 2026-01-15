import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
const initialState = {
  orders: [],
  currentOrder: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {
    status: '',
    priority: '',
    startDate: '',
    endDate: '',
  },
  // IPQS Validation state
  ipqsValidation: {
    isValidating: false,
    validationResults: {}, // keyed by orderId
    error: null,
  },
};
export const createOrder = createAsyncThunk(
  'orders/createOrder',
  async (orderData, { rejectWithValue }) => {
    try {
      const response = await api.post('/orders', orderData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to create order'
      );
    }
  }
);
export const getOrders = createAsyncThunk(
  'orders/getOrders',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/orders', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch orders'
      );
    }
  }
);
export const getOrderById = createAsyncThunk(
  'orders/getOrderById',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to fetch order'
      );
    }
  }
);

export const changeOrderRequester = createAsyncThunk(
  'orders/changeRequester',
  async ({ orderId, newRequesterId }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/orders/${orderId}/change-requester`, { newRequesterId });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to change requester'
      );
    }
  }
);

// IPQS Lead Validation
export const validateOrderLeads = createAsyncThunk(
  'orders/validateOrderLeads',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/orders/${orderId}/validate-leads`);
      return { orderId, ...response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to validate leads'
      );
    }
  }
);

export const getOrderValidationResults = createAsyncThunk(
  'orders/getOrderValidationResults',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/orders/${orderId}/validation-results`);
      return { orderId, ...response.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to get validation results'
      );
    }
  }
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createOrder.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders.unshift(action.payload);
        state.error = null;
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(getOrders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getOrders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders = action.payload.data;
        state.pagination = action.payload.pagination || state.pagination;
        state.error = null;
      })
      .addCase(getOrders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(getOrderById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getOrderById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentOrder = action.payload;
        state.error = null;
      })
      .addCase(getOrderById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(changeOrderRequester.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(changeOrderRequester.fulfilled, (state, action) => {
        state.isLoading = false;
        // Update in orders list
        const index = state.orders.findIndex(o => o._id === action.payload.order._id);
        if (index !== -1) {
          state.orders[index] = action.payload.order;
        }
        // Update currentOrder if it matches
        if (state.currentOrder && state.currentOrder._id === action.payload.order._id) {
          state.currentOrder = action.payload.order;
        }
        state.error = null;
      })
      .addCase(changeOrderRequester.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // IPQS Validation
      .addCase(validateOrderLeads.pending, (state) => {
        state.ipqsValidation.isValidating = true;
        state.ipqsValidation.error = null;
      })
      .addCase(validateOrderLeads.fulfilled, (state, action) => {
        state.ipqsValidation.isValidating = false;
        state.ipqsValidation.validationResults[action.payload.orderId] = action.payload.data;
        state.ipqsValidation.error = null;
      })
      .addCase(validateOrderLeads.rejected, (state, action) => {
        state.ipqsValidation.isValidating = false;
        state.ipqsValidation.error = action.payload;
      })
      .addCase(getOrderValidationResults.pending, (state) => {
        state.ipqsValidation.isValidating = true;
        state.ipqsValidation.error = null;
      })
      .addCase(getOrderValidationResults.fulfilled, (state, action) => {
        state.ipqsValidation.isValidating = false;
        state.ipqsValidation.validationResults[action.payload.orderId] = action.payload.data;
        state.ipqsValidation.error = null;
      })
      .addCase(getOrderValidationResults.rejected, (state, action) => {
        state.ipqsValidation.isValidating = false;
        state.ipqsValidation.error = action.payload;
      });
  },
});
export const { clearError, setFilters, clearFilters, setPagination } = ordersSlice.actions;
export const selectOrders = (state) => state.orders.orders;
export const selectCurrentOrder = (state) => state.orders.currentOrder;
export const selectOrdersLoading = (state) => state.orders.isLoading;
export const selectOrdersError = (state) => state.orders.error;
export const selectOrdersPagination = (state) => state.orders.pagination;
export const selectOrdersFilters = (state) => state.orders.filters;
// IPQS Validation selectors
export const selectIPQSValidation = (state) => state.orders.ipqsValidation;
export const selectIPQSValidationResults = (orderId) => (state) =>
  state.orders.ipqsValidation.validationResults[orderId] || null;
export const selectIPQSIsValidating = (state) => state.orders.ipqsValidation.isValidating;
export const selectIPQSError = (state) => state.orders.ipqsValidation.error;
export default ordersSlice.reducer;