const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const clientBrokerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Client broker name is required"],
      trim: true,
      unique: true,
    },
    domain: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      default: () => `autogen-${new mongoose.Types.ObjectId()}`,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    assignedLeads: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lead",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    totalLeadsAssigned: {
      type: Number,
      default: 0,
    },
    lastAssignedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
clientBrokerSchema.index({ name: 1 });
clientBrokerSchema.index({ isActive: 1 });
clientBrokerSchema.index({ assignedLeads: 1 });
clientBrokerSchema.index({ createdBy: 1 });
clientBrokerSchema.index({ lastAssignedAt: -1 });
clientBrokerSchema.virtual("activeLeadsCount").get(function () {
  return this.assignedLeads ? this.assignedLeads.length : 0;
});
clientBrokerSchema.methods.assignLead = function (leadId) {
  if (!this.assignedLeads.includes(leadId)) {
    this.assignedLeads.push(leadId);
    this.totalLeadsAssigned += 1;
    this.lastAssignedAt = new Date();
  }
};
clientBrokerSchema.methods.unassignLead = function (leadId) {
  const index = this.assignedLeads.indexOf(leadId);
  if (index > -1) {
    this.assignedLeads.splice(index, 1);
  }
};
clientBrokerSchema.methods.isLeadAssigned = function (leadId) {
  return this.assignedLeads.includes(leadId);
};
clientBrokerSchema.statics.findAvailableBrokers = function (
  excludeLeadId = null
) {
  const query = { isActive: true };
  if (excludeLeadId) {
    query.assignedLeads = { $ne: excludeLeadId };
  }
  return this.find(query).sort({ totalLeadsAssigned: 1, createdAt: 1 });
};
clientBrokerSchema.statics.getBrokerStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: {
          isActive: "$isActive",
        },
        count: { $sum: 1 },
        totalLeadsAssigned: { $sum: "$totalLeadsAssigned" },
        avgLeadsPerBroker: { $avg: { $size: "$assignedLeads" } },
      },
    },
  ]);
};
clientBrokerSchema.plugin(mongoosePaginate);
module.exports = mongoose.model("ClientBroker", clientBrokerSchema);
