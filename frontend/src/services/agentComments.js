import api from "./api";

// Get all comments with filtering
export const getComments = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    const response = await api.get(`/agent-comments?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching comments:", error);
    throw error;
  }
};

// Get comments by specific target
export const getCommentsByTarget = async (targetType, targetId) => {
  try {
    const response = await api.get(`/agent-comments/target/${targetType}/${targetId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching comments by target:", error);
    throw error;
  }
};

// Create a new comment
export const createComment = async (commentData) => {
  try {
    const response = await api.post("/agent-comments", commentData);
    return response.data;
  } catch (error) {
    console.error("Error creating comment:", error);
    throw error;
  }
};

// Create a reply to an existing comment
export const createReply = async (parentCommentId, comment) => {
  try {
    const response = await api.post(`/agent-comments/${parentCommentId}/reply`, { comment });
    return response.data;
  } catch (error) {
    console.error("Error creating reply:", error);
    throw error;
  }
};

// Update a comment
export const updateComment = async (id, commentData) => {
  try {
    const response = await api.put(`/agent-comments/${id}`, commentData);
    return response.data;
  } catch (error) {
    console.error("Error updating comment:", error);
    throw error;
  }
};

// Resolve a comment
export const resolveComment = async (id, resolutionNote) => {
  try {
    const response = await api.patch(`/agent-comments/${id}/resolve`, { resolutionNote });
    return response.data;
  } catch (error) {
    console.error("Error resolving comment:", error);
    throw error;
  }
};

// Delete a comment
export const deleteComment = async (id) => {
  try {
    const response = await api.delete(`/agent-comments/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting comment:", error);
    throw error;
  }
};

// Get comment statistics
export const getCommentStats = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    const response = await api.get(`/agent-comments/stats?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching comment stats:", error);
    throw error;
  }
};

// Helper function to format status for display
export const formatStatus = (status) => {
  const statusMap = {
    working_ok: "Working OK",
    shaving: "Shaving",
    playing_games: "Playing Games",
    other: "Other",
  };
  return statusMap[status] || status;
};

// Helper function to get status color
export const getStatusColor = (status) => {
  const colorMap = {
    working_ok: "success",
    shaving: "warning",
    playing_games: "error",
    other: "info",
  };
  return colorMap[status] || "default";
};

// Helper function to format target type for display
export const formatTargetType = (targetType) => {
  const typeMap = {
    client_network: "Client Network",
    client_broker: "Client Broker",
  };
  return typeMap[targetType] || targetType;
};
