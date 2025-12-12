import api from './api';

class AMTargetService {
  // Get all targets (Admin/Lead Manager)
  async getAllTargets(params = {}) {
    try {
      const response = await api.get('/am-targets', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching targets:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch targets');
    }
  }

  // Get own targets (Affiliate Manager)
  async getMyTargets(params = {}) {
    try {
      const response = await api.get('/am-targets/my-targets', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching my targets:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch targets');
    }
  }

  // Get affiliate managers for dropdown
  async getAffiliateManagers() {
    try {
      const response = await api.get('/am-targets/affiliate-managers');
      return response.data;
    } catch (error) {
      console.error('Error fetching affiliate managers:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch affiliate managers');
    }
  }

  // Create target (Admin/Lead Manager)
  async createTarget(targetData) {
    try {
      const response = await api.post('/am-targets', targetData);
      return response.data;
    } catch (error) {
      console.error('Error creating target:', error);
      throw new Error(error.response?.data?.message || 'Failed to create target');
    }
  }

  // Update target
  async updateTarget(targetId, targetData) {
    try {
      const response = await api.put(`/am-targets/${targetId}`, targetData);
      return response.data;
    } catch (error) {
      console.error('Error updating target:', error);
      throw new Error(error.response?.data?.message || 'Failed to update target');
    }
  }

  // Delete target (Admin/Lead Manager)
  async deleteTarget(targetId) {
    try {
      const response = await api.delete(`/am-targets/${targetId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting target:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete target');
    }
  }

  // Validate target data
  validateTargetData(data) {
    const errors = {};

    if (!data.title || !data.title.trim()) {
      errors.title = 'Title is required';
    } else if (data.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    if (data.description && data.description.length > 1000) {
      errors.description = 'Description must be less than 1000 characters';
    }

    if (!data.assignedTo) {
      errors.assignedTo = 'Affiliate manager is required';
    }

    if (!data.dueDate) {
      errors.dueDate = 'Due date is required';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Get status display info
  getStatusInfo(status) {
    const statusMap = {
      pending: {
        label: 'Pending',
        color: 'default',
      },
      in_progress: {
        label: 'In Progress',
        color: 'primary',
      },
      completed: {
        label: 'Completed',
        color: 'success',
      },
    };

    return statusMap[status] || statusMap.pending;
  }

  // Check if target is overdue
  isOverdue(target) {
    return target.status !== 'completed' && new Date() > new Date(target.dueDate);
  }

  // Format target for display
  formatTarget(target) {
    const isOverdue = this.isOverdue(target);
    return {
      ...target,
      formattedDueDate: new Date(target.dueDate).toLocaleDateString(),
      formattedCreatedAt: new Date(target.createdAt).toLocaleDateString(),
      isOverdue,
      daysUntilDue: Math.ceil((new Date(target.dueDate) - new Date()) / (1000 * 60 * 60 * 24)),
    };
  }
}

// Create singleton instance
const amTargetService = new AMTargetService();

export default amTargetService;

