import api from "./api";

export const refundsService = {
  // Get all refund assignments for the refunds manager
  getRefundAssignments: async (params = {}) => {
    const { status, page = 1, limit = 20, startDate, endDate, search } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status && status !== "all") {
      queryParams.append("status", status);
    }

    if (startDate) {
      queryParams.append("startDate", startDate);
    }

    if (endDate) {
      queryParams.append("endDate", endDate);
    }

    if (search && search.trim()) {
      queryParams.append("search", search.trim());
    }

    const response = await api.get(`/refunds?${queryParams}`);
    return response.data;
  },

  // Get refund statistics
  getRefundStats: async () => {
    const response = await api.get("/refunds/stats");
    return response.data;
  },

  // Update refund status
  updateRefundStatus: async (assignmentId, statusData) => {
    const response = await api.put(
      `/refunds/${assignmentId}/status`,
      statusData
    );
    return response.data;
  },

  // Get all available refunds managers
  getRefundsManagers: async () => {
    const response = await api.get("/refunds/managers");
    return response.data;
  },

  // Get refund assignment status for an order
  getOrderRefundAssignmentStatus: async (orderId) => {
    const response = await api.get(`/refunds/order/${orderId}/status`);
    return response.data;
  },

  // Assign FTD leads to refunds manager
  assignToRefundsManager: async (assignmentData) => {
    const response = await api.post("/refunds/assign", assignmentData);
    return response.data;
  },

  // Get specific refund assignment
  getRefundAssignmentById: async (assignmentId) => {
    const response = await api.get(`/refunds/${assignmentId}`);
    return response.data;
  },

  // Get FTD leads for an order (used for assignment)
  getFTDLeadsForOrder: async (orderId) => {
    const response = await api.get(`/orders/${orderId}/ftd-leads`);
    return response.data;
  },

  // Import CSV refunds from file
  importCSVRefunds: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/refunds/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Create manual refund
  createManualRefund: async (refundData) => {
    const response = await api.post("/refunds/manual", refundData);
    return response.data;
  },

  // Delete refund assignment
  deleteRefundAssignment: async (assignmentId) => {
    const response = await api.delete(`/refunds/${assignmentId}`);
    return response.data;
  },

  // Toggle PSP Email status
  togglePspEmail: async (assignmentId) => {
    const response = await api.patch(`/refunds/${assignmentId}/psp-email`);
    return response.data;
  },

  // Mark entire group as fraud
  markGroupAsFraud: async (email, fraudReason) => {
    const response = await api.post("/refunds/group/mark-fraud", {
      email,
      fraudReason,
    });
    return response.data;
  },

  // Upload documents for a group
  uploadGroupDocuments: async (email, documentData) => {
    const payload = {
      email,
      ...documentData,
    };

    const response = await api.post("/refunds/group/upload-documents", payload);
    return response.data;
  },
};

export const REFUND_STATUSES = [
  { value: "new", label: "New", color: "default" },
  { value: "uploaded", label: "Uploaded", color: "info" },
  { value: "initial_email", label: "Initial Email", color: "info" },
  { value: "request_approved", label: "Request Approved", color: "primary" },
  { value: "docs_sent", label: "Docs Sent", color: "primary" },
  { value: "threatening_email", label: "Threatening Email", color: "warning" },
  { value: "review_posted", label: "Review Posted", color: "secondary" },
  { value: "review_dispute", label: "Review Dispute", color: "primary" },
  { value: "review_removed", label: "Review Removed", color: "success" },
  { value: "refunded_checked", label: "Refunded (Check)", color: "success" },
  { value: "refund_complete", label: "Refund Complete", color: "success" },
  { value: "rejected", label: "Rejected", color: "error" },
  { value: "fraud", label: "Fraud", color: "error" },
];

export const getStatusColor = (status) => {
  const statusConfig = REFUND_STATUSES.find((s) => s.value === status);
  return statusConfig ? statusConfig.color : "default";
};

export const getStatusLabel = (status) => {
  const statusConfig = REFUND_STATUSES.find((s) => s.value === status);
  return statusConfig ? statusConfig.label : status;
};
