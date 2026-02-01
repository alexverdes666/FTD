import api from './api';
import { store } from '../store/store';

// Get all tickets with filtering and pagination
export const getTickets = async (params = {}) => {
  const response = await api.get('/tickets', { params });
  return response.data;
};

// Get single ticket by ID
export const getTicket = async (id) => {
  const response = await api.get(`/tickets/${id}`);
  return response.data;
};

// Create new ticket
export const createTicket = async (ticketData) => {
  const response = await api.post('/tickets', ticketData);
  return response.data;
};

// Update ticket
export const updateTicket = async (id, ticketData) => {
  const response = await api.put(`/tickets/${id}`, ticketData);
  return response.data;
};

// Delete ticket (Admin only)
export const deleteTicket = async (id) => {
  const response = await api.delete(`/tickets/${id}`);
  return response.data;
};

// Add comment to ticket
export const addComment = async (id, commentData) => {
  const response = await api.post(`/tickets/${id}/comments`, commentData);
  return response.data;
};

// Assign ticket to a manager (Admin only)
export const assignTicket = async (id, assignedTo) => {
  const response = await api.put(`/tickets/${id}/assign`, { assignedTo });
  return response.data;
};

// Get assignable users (Admin only)
export const getAssignableUsers = async () => {
  const response = await api.get('/tickets/assignable-users');
  return response.data;
};

// Resolve ticket
export const resolveTicket = async (id, resolutionNote) => {
  const response = await api.put(`/tickets/${id}/resolve`, { resolutionNote });
  return response.data;
};

// Get ticket statistics
export const getTicketStats = async () => {
  const response = await api.get('/tickets/stats');
  return response.data;
};

// Ticket Image APIs
export const uploadTicketImage = async (file, ticketId = null, commentIndex = null) => {
  const formData = new FormData();
  formData.append('image', file);
  if (ticketId) formData.append('ticketId', ticketId);
  if (commentIndex !== null) formData.append('commentIndex', commentIndex);

  const response = await api.post('/ticket-images/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const getTicketImages = async (ticketId) => {
  const response = await api.get(`/ticket-images/ticket/${ticketId}`);
  return response.data;
};

export const deleteTicketImage = async (imageId) => {
  const response = await api.delete(`/ticket-images/${imageId}`);
  return response.data;
};

export const getTicketImageUrl = (imageId) => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const state = store.getState();
  const token = state.auth.token;
  return `${apiUrl}/ticket-images/${imageId}?token=${encodeURIComponent(token)}`;
};

export const getTicketImageThumbnailUrl = (imageId) => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const state = store.getState();
  const token = state.auth.token;
  return `${apiUrl}/ticket-images/${imageId}/thumbnail?token=${encodeURIComponent(token)}`;
};

// Utility functions for formatting and display
export const formatTicketStatus = (status) => {
  const statusMap = {
    open: 'Open',
    in_progress: 'In Progress',
    waiting_response: 'Waiting Response',
    resolved: 'Resolved',
    closed: 'Closed',
    deleted: 'Deleted'
  };
  return statusMap[status] || status;
};

export const getStatusColor = (status) => {
  const colorMap = {
    open: 'info',
    in_progress: 'warning',
    waiting_response: 'secondary',
    resolved: 'success',
    closed: 'default',
    deleted: 'error'
  };
  return colorMap[status] || 'default';
};

export const formatTicketPriority = (priority) => {
  const priorityMap = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent'
  };
  return priorityMap[priority] || priority;
};

export const getPriorityColor = (priority) => {
  const colorMap = {
    low: 'success',
    medium: 'info',
    high: 'warning',
    urgent: 'error'
  };
  return colorMap[priority] || 'default';
};

export const formatTicketCategory = (category) => {
  const categoryMap = {
    leads_request: 'Leads Request',
    salary_issue: 'Salary Issue',
    technical_support: 'Technical Support',
    account_access: 'Account Access',
    payment_issue: 'Payment Issue',
    feature_request: 'Feature Request',
    bug_report: 'Bug Report',
    fine_dispute: 'Fine Dispute',
    other: 'Other'
  };
  return categoryMap[category] || category;
};

export const getCategoryIcon = (category) => {
  const iconMap = {
    leads_request: 'Groups',
    salary_issue: 'AccountBalance',
    technical_support: 'Build',
    account_access: 'VpnKey',
    payment_issue: 'Payment',
    feature_request: 'Lightbulb',
    bug_report: 'BugReport',
    fine_dispute: 'Gavel',
    other: 'Help'
  };
  return iconMap[category] || 'Help';
};

// Validation helpers
export const validateTicketData = (ticketData) => {
  const errors = {};

  if (!ticketData.title || ticketData.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters long';
  }

  if (!ticketData.description || ticketData.description.trim().length < 10) {
    errors.description = 'Description must be at least 10 characters long';
  }

  if (!ticketData.category) {
    errors.category = 'Category is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Filter and search helpers
export const buildTicketFilters = (filters) => {
  const params = {};

  if (filters.status) params.status = filters.status;
  if (filters.category) params.category = filters.category;
  if (filters.priority) params.priority = filters.priority;
  if (filters.createdBy) params.createdBy = filters.createdBy;
  if (filters.assignedTo) params.assignedTo = filters.assignedTo;
  if (filters.search) params.search = filters.search;
  if (filters.tags && filters.tags.length > 0) params.tags = filters.tags.join(',');
  if (filters.dueDate) params.dueDate = filters.dueDate;

  return params;
};

// Time and date utilities
export const formatTimeAgo = (date) => {
  const now = new Date();
  const then = new Date(date);
  const diffInMs = now - then;

  const minutes = Math.floor(diffInMs / (1000 * 60));
  const hours = Math.floor(diffInMs / (1000 * 60 * 60));
  const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;

  return then.toLocaleDateString();
};

export const formatExactDateTime = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export const formatSmartDateTime = (date) => {
  const d = new Date(date);
  const now = new Date();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  // Check if date is today
  const isToday = d.getDate() === now.getDate() &&
                  d.getMonth() === now.getMonth() &&
                  d.getFullYear() === now.getFullYear();

  if (isToday) {
    return `${hours}:${minutes}`;
  }

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export const isTicketOverdue = (ticket) => {
  if (!ticket.dueDate || ticket.status === 'resolved' || ticket.status === 'closed' || ticket.status === 'deleted') {
    return false;
  }
  
  return new Date(ticket.dueDate) < new Date();
};

// Statistics helpers
export const calculateTicketMetrics = (tickets) => {
  const metrics = {
    total: tickets.length,
    open: 0,
    inProgress: 0,
    resolved: 0,
    overdue: 0,
    byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
    byCategory: {}
  };

  tickets.forEach(ticket => {
    // Count by status
    if (ticket.status === 'open') metrics.open++;
    else if (ticket.status === 'in_progress') metrics.inProgress++;
    else if (ticket.status === 'resolved') metrics.resolved++;

    // Count overdue
    if (isTicketOverdue(ticket)) metrics.overdue++;

    // Count by priority
    if (metrics.byPriority.hasOwnProperty(ticket.priority)) {
      metrics.byPriority[ticket.priority]++;
    }

    // Count by category
    if (!metrics.byCategory[ticket.category]) {
      metrics.byCategory[ticket.category] = 0;
    }
    metrics.byCategory[ticket.category]++;
  });

  return metrics;
};

export default {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  addComment,
  assignTicket,
  getAssignableUsers,
  resolveTicket,
  getTicketStats,
  uploadTicketImage,
  getTicketImages,
  deleteTicketImage,
  getTicketImageUrl,
  getTicketImageThumbnailUrl,
  formatTicketStatus,
  getStatusColor,
  formatTicketPriority,
  getPriorityColor,
  formatTicketCategory,
  getCategoryIcon,
  validateTicketData,
  buildTicketFilters,
  formatTimeAgo,
  formatExactDateTime,
  formatSmartDateTime,
  isTicketOverdue,
  calculateTicketMetrics
};
