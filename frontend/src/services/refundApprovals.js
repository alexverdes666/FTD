import api from "./api";
import { store } from "../store/store";

// Get API URL
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
};

// Get auth token for image URLs
const getAuthToken = () => {
  const state = store.getState();
  return state.auth.token;
};

// Get evidence image URL with auth token (for <img> tags)
export const getRefundApprovalImageUrl = (imageId) => {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  return `${apiUrl}/refund-approval-images/${imageId}?token=${encodeURIComponent(token)}`;
};

// Get evidence image thumbnail URL with auth token (for <img> tags)
export const getRefundApprovalImageThumbnailUrl = (imageId) => {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  return `${apiUrl}/refund-approval-images/${imageId}/thumbnail?token=${encodeURIComponent(token)}`;
};

export const refundApprovalsService = {
  // Create approval request
  createApprovalRequest: async (refundAssignmentId, notes = "") => {
    const response = await api.post("/refund-approvals", {
      refundAssignmentId,
      notes,
    });
    return response.data;
  },

  // Get pending approvals
  getPendingApprovals: async () => {
    const response = await api.get("/refund-approvals/pending");
    return response.data;
  },

  // Get all approvals (admin)
  getAllApprovals: async (params = {}) => {
    const { status, page = 1, limit = 20 } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (status && status !== "all") {
      queryParams.append("status", status);
    }
    const response = await api.get(`/refund-approvals?${queryParams}`);
    return response.data;
  },

  // Get approval by ID
  getApprovalById: async (id) => {
    const response = await api.get(`/refund-approvals/${id}`);
    return response.data;
  },

  // Process decision (approve/reject)
  processDecision: async (id, decision, notes = "", evidenceImageIds = [], adminReviewerId = null) => {
    const payload = {
      decision,
      notes,
      evidenceImageIds,
    };
    if (adminReviewerId) {
      payload.adminReviewerId = adminReviewerId;
    }
    const response = await api.put(`/refund-approvals/${id}/decision`, payload);
    return response.data;
  },

  // Get approval counts
  getApprovalCounts: async () => {
    const response = await api.get("/refund-approvals/counts");
    return response.data;
  },

  // Get superior lead manager
  getSuperiorLeadManager: async () => {
    const response = await api.get("/refund-approvals/superior-manager");
    return response.data;
  },

  // Set superior lead manager
  setSuperiorLeadManager: async (userId) => {
    const response = await api.put("/refund-approvals/superior-manager", {
      userId,
    });
    return response.data;
  },

  // Get admin users (for superior to select which admin to send approval to)
  getAdminUsers: async () => {
    const response = await api.get("/refund-approvals/admins");
    return response.data;
  },

  // Upload evidence image
  uploadEvidenceImage: async (file, approvalId = null) => {
    const formData = new FormData();
    formData.append("image", file);
    if (approvalId) {
      formData.append("approvalId", approvalId);
    }
    const response = await api.post(
      "/refund-approval-images/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  // Get images for an approval
  getApprovalImages: async (approvalId) => {
    const response = await api.get(
      `/refund-approval-images/approval/${approvalId}`
    );
    return response.data;
  },
};
