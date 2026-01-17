const mongoose = require("mongoose");

const leadAuditLogSchema = new mongoose.Schema(
  {
    // Lead reference (may be null if lead was deleted)
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      index: true,
    },
    // Snapshot of lead name at the time of change (preserved even if lead is deleted)
    leadName: {
      type: String,
      required: true,
      trim: true,
    },
    // Snapshot of lead email at the time of change
    leadEmail: {
      type: String,
      trim: true,
    },
    // The field that was changed
    fieldName: {
      type: String,
      required: true,
      trim: true,
    },
    // Human-readable field label
    fieldLabel: {
      type: String,
      required: true,
      trim: true,
    },
    // Previous value (can be any type)
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    // New value (can be any type)
    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    // Human-readable previous value (for display)
    previousValueDisplay: {
      type: String,
      trim: true,
    },
    // Human-readable new value (for display)
    newValueDisplay: {
      type: String,
      trim: true,
    },
    // Who made the change
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Snapshot of user name at the time of change
    changedByName: {
      type: String,
      required: true,
      trim: true,
    },
    // When the change was made
    changedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // IP address of the user who made the change
    ipAddress: {
      type: String,
      trim: true,
    },
    // Human-readable description of the change
    details: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
leadAuditLogSchema.index({ changedAt: -1 });
leadAuditLogSchema.index({ leadId: 1, changedAt: -1 });
leadAuditLogSchema.index({ changedBy: 1, changedAt: -1 });
leadAuditLogSchema.index({ fieldName: 1, changedAt: -1 });

// Static method to create an audit entry
leadAuditLogSchema.statics.createAuditEntry = async function ({
  leadId,
  leadName,
  leadEmail,
  fieldName,
  fieldLabel,
  previousValue,
  newValue,
  previousValueDisplay,
  newValueDisplay,
  changedBy,
  changedByName,
  ipAddress,
}) {
  const details = `The ${fieldLabel.toLowerCase()} of "${leadName}" was changed from "${previousValueDisplay || previousValue || "(empty)"}" to "${newValueDisplay || newValue || "(empty)"}" by ${changedByName}`;

  return this.create({
    leadId,
    leadName,
    leadEmail,
    fieldName,
    fieldLabel,
    previousValue,
    newValue,
    previousValueDisplay,
    newValueDisplay,
    changedBy,
    changedByName,
    ipAddress,
    details,
  });
};

// Static method to get paginated audit logs
leadAuditLogSchema.statics.getAuditLogs = async function ({
  page = 1,
  limit = 50,
  leadId = null,
  changedBy = null,
  fieldName = null,
  startDate = null,
  endDate = null,
}) {
  const query = {};

  if (leadId) {
    query.leadId = leadId;
  }
  if (changedBy) {
    query.changedBy = changedBy;
  }
  if (fieldName) {
    query.fieldName = fieldName;
  }
  if (startDate || endDate) {
    query.changedAt = {};
    if (startDate) {
      query.changedAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.changedAt.$lte = new Date(endDate);
    }
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    this.find(query)
      .sort({ changedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("changedBy", "fullName email")
      .lean(),
    this.countDocuments(query),
  ]);

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

module.exports = mongoose.model("LeadAuditLog", leadAuditLogSchema);
