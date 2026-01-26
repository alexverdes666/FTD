const mongoose = require("mongoose");
const leadSchema = new mongoose.Schema(
  {
    leadType: {
      type: String,
      enum: ["ftd", "filler", "cold"],
      required: [true, "Lead type is required"],
    },
    orderedAs: {
      type: String,
      enum: ["ftd", "filler", "cold", null],
      default: null,
      // DEPRECATED: This field is no longer used. 
      // orderedAs is now tracked per-order in Order.leadsMetadata[]
      // This ensures each order independently tracks how leads were ordered,
      // preventing issues when the same lead appears in multiple orders
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    prefix: {
      type: String,
      trim: true,
    },
    newEmail: {
      type: String,
      required: [true, "New email is required"],
      trim: true,
      lowercase: true,
    },
    oldEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    newPhone: {
      type: String,
      trim: true,
      required: [true, "New phone is required"],
    },
    oldPhone: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    assignedAgentAt: {
      type: Date,
    },
    assignedSimCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SimCard",
      default: null,
      index: true,
    },
    assignedSimCardAt: {
      type: Date,
    },
    assignedSimCardBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    depositConfirmed: {
      type: Boolean,
      default: false,
    },
    depositConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    depositConfirmedAt: {
      type: Date,
      default: null,
    },
    depositPSP: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PSP",
      default: null,
    },
    depositHistory: [
      {
        action: {
          type: String,
          enum: ["confirmed", "unconfirmed"],
          required: true,
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        performedAt: {
          type: Date,
          default: Date.now,
        },
        psp: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PSP",
        },
      },
    ],
    // Shaved tracking - when brand didn't show the deposit
    shaved: {
      type: Boolean,
      default: false,
    },
    shavedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    shavedAt: {
      type: Date,
      default: null,
    },
    shavedRefundsManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    shavedManagerAssignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    shavedManagerAssignedAt: {
      type: Date,
      default: null,
    },
    shavedHistory: [
      {
        action: {
          type: String,
          enum: ["shaved", "unshaved", "manager_assigned", "manager_changed"],
          required: true,
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        performedAt: {
          type: Date,
          default: Date.now,
        },
        refundsManager: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        notes: String,
      },
    ],
    lastUsedInOrder: {
      type: Date,
      default: null,
      index: true, // Index for efficient cooldown period queries
    },
    campaign: {
      type: String,
      trim: true,
    },
    clientBroker: {
      type: String,
      trim: true,
    },
    clientNetwork: {
      type: String,
      trim: true,
    },
    ourNetwork: {
      type: String,
      trim: true,
    },
    assignedClientBrokers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ClientBroker",
      },
    ],
    clientBrokerHistory: [
      {
        clientBroker: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClientBroker",
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        intermediaryClientNetwork: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClientNetwork",
        },
        domain: {
          type: String,
          trim: true,
        },
      },
    ],
    clientNetworkHistory: [
      {
        clientNetwork: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClientNetwork",
          required: true,
        },
        clientBroker: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClientBroker",
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        domain: {
          type: String,
          trim: true,
        },
      },
    ],
    campaignHistory: [
      {
        campaign: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Campaign",
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        performance: {
          status: {
            type: String,
            enum: ["active", "contacted", "converted", "inactive"],
            default: "active",
          },
          contactedAt: {
            type: Date,
          },
          convertedAt: {
            type: Date,
          },
          notes: {
            type: String,
            trim: true,
          },
        },
      },
    ],
    ourNetworkHistory: [
      {
        ourNetwork: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "OurNetwork",
          required: true,
        },
        clientBroker: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClientBroker",
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        domain: {
          type: String,
          trim: true,
        },
      },
    ],
    gender: {
      type: String,
      enum: ["male", "female", "not_defined"],
      default: "not_defined",
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    socialMedia: {
      facebook: { type: String, trim: true },
      twitter: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      instagram: { type: String, trim: true },
      telegram: { type: String, trim: true },
      whatsapp: { type: String, trim: true },
    },
    comments: [
      {
        text: {
          type: String,
          required: true,
        },
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // DEPRECATED: Use orderCallTracking instead for per-order call tracking
    // Kept for backward compatibility with existing data
    callNumber: {
      type: String,
      default: null,
      sparse: true,
      validate: {
        validator: function(v) {
          return v === null || v === undefined || ["1st", "2nd", "3rd", "4th", "5th"].includes(v);
        },
        message: 'Call number must be 1st, 2nd, 3rd, 4th, 5th, or null'
      }
    },
    // DEPRECATED: Use orderCallTracking instead for per-order call tracking
    // Kept for backward compatibility with existing data
    callHistory: [
      {
        callNumber: {
          type: String,
          enum: ["1st", "2nd", "3rd", "4th", "5th", "cleared"],
          required: true,
        },
        recordedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        recordedAt: {
          type: Date,
          default: Date.now,
        },
        notes: {
          type: String,
          trim: true,
        },
      },
    ],
    // Track call numbers per order (for agents working multiple orders with same lead)
    orderCallTracking: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          required: true,
        },
        callNumber: {
          type: String,
          enum: ["1st", "2nd", "3rd", "4th", "5th", null],
          default: null,
        },
        verified: {
          type: Boolean,
          default: false,
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Track comments per order (for agents working multiple orders with same lead)
    orderComments: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    dob: { type: Date },
    address: {
      type: String,
    },
    documents: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    sin: {
      type: String,
      trim: true,
      sparse: true,
      // SIN is now optional for all lead types
    },
    source: String,
    submissionMode: {
      type: String,
      enum: ["internal", "external", "dual"],
      default: "internal",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["active", "contacted", "converted", "inactive"],
      default: "active",
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    fingerprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fingerprint",
      sparse: true,
      index: true,
    },
    deviceType: {
      type: String,
      enum: ["windows", "android", "ios", "mac"],
      sparse: true,
      index: true,
    },
    proxyAssignments: [
      {
        proxy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Proxy",
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          required: true,
        },
        assignedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["active", "completed", "failed"],
          default: "active",
        },
        completedAt: {
          type: Date,
        },
      },
    ],
    browserSession: {
      cookies: [
        {
          name: { type: String, required: true },
          value: { type: String, required: true },
          domain: { type: String },
          path: { type: String, default: "/" },
          expires: { type: Date },
          httpOnly: { type: Boolean, default: false },
          secure: { type: Boolean, default: false },
          sameSite: {
            type: String,
            enum: ["Strict", "Lax", "None"],
            default: "Lax",
          },
        },
      ],
      localStorage: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      sessionStorage: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      userAgent: {
        type: String,
        trim: true,
      },
      viewport: {
        width: { type: Number, default: 1366 },
        height: { type: Number, default: 768 },
      },
      sessionId: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      lastAccessedAt: {
        type: Date,
        default: Date.now,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
      metadata: {
        domain: { type: String, trim: true },
        success: { type: Boolean, default: false },
        notes: { type: String, trim: true },
      },
    },
    sessionHistory: [
      {
        sessionId: {
          type: String,
          required: true,
          index: true,
        },
        cookies: [
          {
            name: { type: String, required: true },
            value: { type: String, required: true },
            domain: { type: String },
            path: { type: String, default: "/" },
            expires: { type: Date },
            httpOnly: { type: Boolean, default: false },
            secure: { type: Boolean, default: false },
            sameSite: {
              type: String,
              enum: ["Strict", "Lax", "None"],
              default: "Lax",
            },
          },
        ],
        localStorage: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        sessionStorage: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        userAgent: {
          type: String,
          trim: true,
        },
        viewport: {
          width: { type: Number, default: 1366 },
          height: { type: Number, default: 768 },
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        lastAccessedAt: {
          type: Date,
          default: Date.now,
        },
        isActive: {
          type: Boolean,
          default: false,
        },
        metadata: {
          domain: { type: String, trim: true },
          success: { type: Boolean, default: false },
          notes: { type: String, trim: true },
          orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
          },
          assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      },
    ],
    currentSessionId: {
      type: String,
      sparse: true,
      index: true,
    },
    // Admin action audit log for tracking lead additions, removals, and edits to orders
    adminActions: [
      {
        action: {
          type: String,
          enum: ["added_to_order", "removed_from_order", "lead_type_changed", "agent_changed", "order_ftd_swapped"],
          required: true,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        performedAt: {
          type: Date,
          default: Date.now,
        },
        ipAddress: {
          type: String,
          trim: true,
        },
        details: {
          type: String,
          trim: true,
        },
        previousValue: {
          type: mongoose.Schema.Types.Mixed,
        },
        newValue: {
          type: mongoose.Schema.Types.Mixed,
        },
      },
    ],
    // IPQS (IP Quality Score) validation results for email and phone
    ipqsValidation: {
      email: {
        success: { type: Boolean },
        valid: { type: Boolean },
        disposable: { type: Boolean },
        honeypot: { type: Boolean },
        spam_trap_score: { type: String },
        recent_abuse: { type: Boolean },
        fraud_score: { type: Number },
        suspect: { type: Boolean },
        catch_all: { type: Boolean },
        generic: { type: Boolean },
        common: { type: Boolean },
        dns_valid: { type: Boolean },
        smtp_score: { type: Number },
        overall_score: { type: Number },
        deliverability: { type: String },
        leaked: { type: Boolean },
        first_name: { type: String },
        sanitized_email: { type: String },
        domain_age: { type: mongoose.Schema.Types.Mixed },
        first_seen: { type: mongoose.Schema.Types.Mixed },
        message: { type: String },
        request_id: { type: String },
        error: { type: String },
      },
      phone: {
        success: { type: Boolean },
        valid: { type: Boolean },
        active: { type: Boolean },
        fraud_score: { type: Number },
        recent_abuse: { type: Boolean },
        VOIP: { type: Boolean },
        prepaid: { type: Boolean },
        risky: { type: Boolean },
        active_status: { type: String },
        line_type: { type: String },
        carrier: { type: String },
        country: { type: String },
        region: { type: String },
        city: { type: String },
        timezone: { type: String },
        zip_code: { type: String },
        dialing_code: { type: Number },
        do_not_call: { type: Boolean },
        leaked: { type: Boolean },
        spammer: { type: Boolean },
        name: { type: String },
        formatted: { type: String },
        local_format: { type: String },
        message: { type: String },
        request_id: { type: String },
        error: { type: String },
      },
      summary: {
        emailStatus: {
          type: String,
          enum: ['clean', 'low_risk', 'medium_risk', 'high_risk', 'invalid', 'unknown']
        },
        phoneStatus: {
          type: String,
          enum: ['clean', 'low_risk', 'medium_risk', 'high_risk', 'invalid', 'unknown']
        },
        overallRisk: {
          type: String,
          enum: ['clean', 'low_risk', 'medium_risk', 'high_risk', 'invalid', 'unknown']
        },
        emailFraudScore: { type: Number },
        phoneFraudScore: { type: Number },
      },
      validatedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
leadSchema.index({ assignedAgent: 1, leadType: 1, "documents.status": 1 });
leadSchema.index({ leadType: 1 });
leadSchema.index({ country: 1 });
leadSchema.index({ assignedAgent: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ client: 1 }, { sparse: true });
leadSchema.index({ assignedClientBrokers: 1 });
leadSchema.index({ newEmail: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ assignedAgentAt: -1 });
leadSchema.index({ firstName: 1, lastName: 1 });
leadSchema.index({ createdBy: 1 });
leadSchema.index({ updatedAt: -1 });
leadSchema.index({ "clientBrokerHistory.clientBroker": 1 });
leadSchema.index({ "clientBrokerHistory.orderId": 1 });
leadSchema.index({
  "clientBrokerHistory.clientBroker": 1,
  "clientBrokerHistory.orderId": 1,
});
leadSchema.index({ "clientBrokerHistory.assignedAt": -1 });
leadSchema.index({ "clientNetworkHistory.clientNetwork": 1 });
leadSchema.index({ "clientNetworkHistory.orderId": 1 });
leadSchema.index({
  "clientNetworkHistory.clientNetwork": 1,
  "clientNetworkHistory.orderId": 1,
});
leadSchema.index({ "clientNetworkHistory.assignedAt": -1 });
leadSchema.index({ "ourNetworkHistory.ourNetwork": 1 });
leadSchema.index({ "ourNetworkHistory.orderId": 1 });
leadSchema.index({
  "ourNetworkHistory.ourNetwork": 1,
  "ourNetworkHistory.orderId": 1,
});
leadSchema.index({ "ourNetworkHistory.assignedAt": -1 });
leadSchema.index({ "campaignHistory.campaign": 1 });
leadSchema.index({ "campaignHistory.orderId": 1 });
leadSchema.index({
  "campaignHistory.campaign": 1,
  "campaignHistory.orderId": 1,
});
leadSchema.index({ "campaignHistory.assignedAt": -1 });
leadSchema.index({ leadType: 1, assignedAgent: 1, status: 1 });
leadSchema.index({ assignedAgent: 1, status: 1 });
leadSchema.index({ prefix: 1 });
leadSchema.index({ "browserSession.sessionId": 1 });
leadSchema.index({ "browserSession.isActive": 1 });
leadSchema.index({ "browserSession.createdAt": -1 });
leadSchema.index({ "browserSession.lastAccessedAt": -1 });
leadSchema.index({ currentSessionId: 1 });
leadSchema.index({ "sessionHistory.sessionId": 1 });
leadSchema.index({ "sessionHistory.isActive": 1 });
leadSchema.index({ "sessionHistory.createdAt": -1 });
leadSchema.index({ callNumber: 1 });
leadSchema.index({ "callHistory.callNumber": 1 });
leadSchema.index({ "callHistory.recordedAt": -1 });
leadSchema.index(
  {
    firstName: "text",
    lastName: "text",
    newEmail: "text",
    newPhone: "text",
    client: "text",
  },
  {
    weights: {
      firstName: 10,
      lastName: 10,
      newEmail: 5,
      newPhone: 5,
      client: 3,
    },
    name: "lead_search_index",
  }
);
leadSchema.virtual("fullName").get(function () {
  return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
});
leadSchema.pre("save", function (next) {
  if (this.address && typeof this.address === "object") {
    try {
      const { street = "", city = "", postalCode = "" } = this.address;
      this.address = `${street}, ${city} ${postalCode}`.trim();
    } catch (err) {
      this.address = JSON.stringify(this.address);
    }
  }
  next();
});
leadSchema.statics.findAvailableLeads = function (
  leadType,
  count,
  documentStatus = null
) {
  const query = {
    leadType,
    assignedAgent: null,
  };
  if (leadType === "ftd" && documentStatus && Array.isArray(documentStatus)) {
    query["documents.status"] = { $in: documentStatus };
  }
  return this.find(query).limit(count);
};
leadSchema.statics.getLeadStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: {
          leadType: "$leadType",
          isAssigned: { $cond: [{ $ne: ["$assignedAgent", null] }, true, false] },
        },
        count: { $sum: 1 },
      },
    },
  ]);
};
leadSchema.methods.isAssignedToClientBroker = function (clientBrokerId) {
  return this.assignedClientBrokers.some(
    (brokerId) => brokerId.toString() === clientBrokerId.toString()
  );
};
leadSchema.methods.assignClientBroker = function (
  clientBrokerId,
  assignedBy,
  orderId,
  intermediaryClientNetwork = null,
  domain = null
) {
  const alreadyAssigned = this.isAssignedToClientBroker(clientBrokerId);

  if (!alreadyAssigned) {
    this.assignedClientBrokers.push(clientBrokerId);
  }

  const historyEntry = {
    clientBroker: clientBrokerId,
    assignedBy: assignedBy,
    orderId: orderId,
    intermediaryClientNetwork: intermediaryClientNetwork,
    domain: domain,
    assignedAt: new Date(),
  };

  this.clientBrokerHistory.push(historyEntry);
};
leadSchema.methods.unassignClientBroker = function (clientBrokerId) {
  const index = this.assignedClientBrokers.findIndex(
    (brokerId) => brokerId.toString() === clientBrokerId.toString()
  );
  if (index > -1) {
    this.assignedClientBrokers.splice(index, 1);
  }
};
leadSchema.methods.getAssignedClientBrokers = function () {
  return this.assignedClientBrokers.map((id) => id.toString());
};
leadSchema.methods.getClientBrokerHistory = function () {
  return this.clientBrokerHistory;
};
leadSchema.statics.canAssignToClientBroker = function (leadId, clientBrokerId) {
  return this.findById(leadId).then((lead) => {
    if (!lead) return false;
    return !lead.isAssignedToClientBroker(clientBrokerId);
  });
};
leadSchema.methods.isAssignedToClientNetwork = function (
  clientNetworkId,
  orderId = null
) {
  const isAssigned = this.clientNetworkHistory.some((history) => {
    const networkMatch =
      history.clientNetwork.toString() === clientNetworkId.toString();
    if (orderId) {
      return (
        networkMatch &&
        history.orderId &&
        history.orderId.toString() === orderId.toString()
      );
    }
    return networkMatch;
  });

  return isAssigned;
};
leadSchema.methods.addClientNetworkAssignment = function (
  clientNetworkId,
  assignedBy,
  orderId
) {
  if (this.isAssignedToClientNetwork(clientNetworkId, orderId)) {
    throw new Error(
      "Lead is already assigned to this client network in this order"
    );
  }
  this.clientNetworkHistory.push({
    clientNetwork: clientNetworkId,
    assignedBy: assignedBy,
    orderId: orderId,
  });
};
leadSchema.methods.getClientNetworkHistory = function () {
  return this.clientNetworkHistory;
};
leadSchema.methods.getAssignedClientNetworks = function () {
  return [
    ...new Set(
      this.clientNetworkHistory.map((history) =>
        history.clientNetwork.toString()
      )
    ),
  ];
};
leadSchema.methods.isAssignedToOurNetwork = function (
  ourNetworkId,
  orderId = null
) {
  const isAssigned = this.ourNetworkHistory.some((history) => {
    const networkMatch =
      history.ourNetwork.toString() === ourNetworkId.toString();
    if (orderId) {
      return (
        networkMatch &&
        history.orderId &&
        history.orderId.toString() === orderId.toString()
      );
    }
    return networkMatch;
  });

  return isAssigned;
};
leadSchema.methods.addOurNetworkAssignment = function (
  ourNetworkId,
  assignedBy,
  orderId
) {
  if (this.isAssignedToOurNetwork(ourNetworkId, orderId)) {
    throw new Error(
      "Lead is already assigned to this our network in this order"
    );
  }
  this.ourNetworkHistory.push({
    ourNetwork: ourNetworkId,
    assignedBy: assignedBy,
    orderId: orderId,
  });
};
leadSchema.methods.getOurNetworkHistory = function () {
  return this.ourNetworkHistory;
};
leadSchema.methods.getAssignedOurNetworks = function () {
  return [
    ...new Set(
      this.ourNetworkHistory.map((history) => history.ourNetwork.toString())
    ),
  ];
};
leadSchema.methods.isAssignedToCampaign = function (
  campaignId,
  orderId = null
) {
  const isAssigned = this.campaignHistory.some((history) => {
    const campaignMatch = history.campaign.toString() === campaignId.toString();
    if (orderId) {
      return (
        campaignMatch &&
        history.orderId &&
        history.orderId.toString() === orderId.toString()
      );
    }
    return campaignMatch;
  });

  return isAssigned;
};
leadSchema.methods.addCampaignAssignment = function (
  campaignId,
  assignedBy,
  orderId
) {
  if (this.isAssignedToCampaign(campaignId, orderId)) {
    throw new Error("Lead is already assigned to this campaign in this order");
  }
  this.campaignHistory.push({
    campaign: campaignId,
    assignedBy: assignedBy,
    orderId: orderId,
  });
};
leadSchema.methods.getCampaignHistory = function () {
  return this.campaignHistory;
};
leadSchema.methods.getAssignedCampaigns = function () {
  return [
    ...new Set(
      this.campaignHistory.map((history) => history.campaign.toString())
    ),
  ];
};
leadSchema.methods.updateCampaignPerformance = function (
  campaignId,
  orderId,
  performanceData
) {
  const assignment = this.campaignHistory.find(
    (history) =>
      history.campaign.toString() === campaignId.toString() &&
      history.orderId &&
      history.orderId.toString() === orderId.toString()
  );
  if (assignment) {
    Object.assign(assignment.performance, performanceData);
  } else {
    throw new Error("Campaign assignment not found for this lead and order");
  }
};
leadSchema.methods.assignFingerprint = async function (deviceType, createdBy) {
  const Fingerprint = require("./Fingerprint");
  if (!deviceType) {
    throw new Error("deviceType is required for fingerprint assignment");
  }
  if (!createdBy) {
    throw new Error("createdBy is required for fingerprint assignment");
  }
  if (this.fingerprint) {
    throw new Error("Lead already has a fingerprint assigned");
  }
  try {
    console.log(
      `[DEBUG] Creating fingerprint for lead ${this._id} with deviceType: ${deviceType}`
    );
    const fingerprint = await Fingerprint.createForLead(
      this._id,
      deviceType,
      createdBy
    );
    this.fingerprint = fingerprint._id;
    this.deviceType = deviceType;
    console.log(
      `[DEBUG] Successfully assigned fingerprint ${fingerprint.deviceId} to lead ${this._id}`
    );
    return fingerprint;
  } catch (error) {
    console.error(`Error assigning fingerprint to lead ${this._id}:`, error);
    throw error;
  }
};
leadSchema.methods.getFingerprint = async function () {
  if (!this.fingerprint) {
    return null;
  }
  const Fingerprint = require("./Fingerprint");
  return await Fingerprint.findById(this.fingerprint);
};
leadSchema.methods.updateDeviceType = async function (
  newDeviceType,
  createdBy
) {
  const Fingerprint = require("./Fingerprint");
  if (this.deviceType === newDeviceType) {
    return await this.getFingerprint();
  }
  if (this.fingerprint) {
    await Fingerprint.findByIdAndDelete(this.fingerprint);
  }
  const fingerprint = await Fingerprint.createForLead(
    this._id,
    newDeviceType,
    createdBy
  );
  this.fingerprint = fingerprint._id;
  this.deviceType = newDeviceType;
  return fingerprint;
};
leadSchema.methods.assignProxy = function (proxyId, orderId) {
  const existingAssignment = this.proxyAssignments.find(
    (assignment) =>
      assignment.orderId.toString() === orderId.toString() &&
      assignment.status === "active"
  );
  if (existingAssignment) {
    return false;
  }
  this.proxyAssignments.push({
    proxy: proxyId,
    orderId: orderId,
    assignedAt: new Date(),
    status: "active",
  });
  return true;
};
leadSchema.methods.getActiveProxy = function (orderId) {
  const assignment = this.proxyAssignments.find(
    (assignment) =>
      assignment.orderId.toString() === orderId.toString() &&
      assignment.status === "active"
  );
  return assignment ? assignment.proxy : null;
};
leadSchema.methods.completeProxyAssignment = function (
  orderId,
  status = "completed"
) {
  const assignment = this.proxyAssignments.find(
    (assignment) =>
      assignment.orderId.toString() === orderId.toString() &&
      assignment.status === "active"
  );
  if (assignment) {
    assignment.status = status;
    assignment.completedAt = new Date();
    return true;
  }
  return false;
};
leadSchema.methods.getProxyAssignments = function () {
  return this.proxyAssignments;
};
leadSchema.methods.hasActiveProxyAssignments = function () {
  return this.proxyAssignments.some(
    (assignment) => assignment.status === "active"
  );
};
leadSchema.statics.findByDeviceType = function (deviceType, options = {}) {
  const query = { deviceType };
  if (options.leadType) {
    query.leadType = options.leadType;
  }
  if (options.assignedAgent !== undefined) {
    query.assignedAgent = options.assignedAgent;
  }
  if (options.status) {
    query.status = options.status;
  }
  return this.find(query);
};
leadSchema.statics.getDeviceTypeStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: {
          deviceType: "$deviceType",
          leadType: "$leadType",
        },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.deviceType",
        totalCount: { $sum: "$count" },
        byLeadType: {
          $push: {
            leadType: "$_id.leadType",
            count: "$count",
          },
        },
      },
    },
  ]);
};
leadSchema.statics.generateSessionId = function () {
  const crypto = require("crypto");
  const timestamp = Date.now().toString();
  const randomBytes = crypto.randomBytes(16).toString("hex");
  return `session_${timestamp}_${randomBytes}`;
};
leadSchema.methods.storeBrowserSession = function (
  sessionData,
  orderId = null,
  assignedBy = null
) {
  const { sessionId } = sessionData;

  if (!sessionId) {
    throw new Error("A valid sessionId must be provided in the session data.");
  }

  if (!sessionData || typeof sessionData !== "object") {
    throw new Error("Session data is required and must be an object");
  }

  const session = {
    ...sessionData,
    sessionId: sessionId,
    isActive: true,
    lastAccessedAt: new Date(),
    metadata: {
      ...sessionData.metadata,
      orderId: orderId,
      assignedBy: assignedBy,
    },
  };

  if (this.browserSession && this.browserSession.sessionId) {
    this.deactivateCurrentSession();
  }

  this.browserSession = session;
  this.sessionHistory.push(session);
  this.currentSessionId = sessionId;

  return sessionId;
};
leadSchema.methods.getCurrentBrowserSession = function () {
  if (!this.browserSession || !this.browserSession.isActive) {
    return null;
  }
  return this.browserSession;
};
leadSchema.methods.getSessionById = function (sessionId) {
  if (this.browserSession && this.browserSession.sessionId === sessionId) {
    return this.browserSession;
  }
  return (
    this.sessionHistory.find((session) => session.sessionId === sessionId) ||
    null
  );
};
leadSchema.methods.updateSessionAccess = function (sessionId = null) {
  const targetSessionId = sessionId || this.currentSessionId;
  if (!targetSessionId) {
    return false;
  }
  if (
    this.browserSession &&
    this.browserSession.sessionId === targetSessionId
  ) {
    this.browserSession.lastAccessedAt = new Date();
  }
  const historySession = this.sessionHistory.find(
    (session) => session.sessionId === targetSessionId
  );
  if (historySession) {
    historySession.lastAccessedAt = new Date();
  }
  return true;
};
leadSchema.methods.deactivateCurrentSession = function () {
  if (this.browserSession && this.browserSession.isActive) {
    this.browserSession.isActive = false;
    const historySession = this.sessionHistory.find(
      (session) => session.sessionId === this.browserSession.sessionId
    );
    if (historySession) {
      historySession.isActive = false;
    }
  }
};
leadSchema.methods.activateSession = function (sessionId) {
  const session = this.getSessionById(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  this.deactivateCurrentSession();
  this.browserSession = {
    ...session,
    isActive: true,
    lastAccessedAt: new Date(),
  };
  this.currentSessionId = sessionId;
  const historySession = this.sessionHistory.find(
    (s) => s.sessionId === sessionId
  );
  if (historySession) {
    historySession.isActive = true;
    historySession.lastAccessedAt = new Date();
  }
  return session;
};
leadSchema.methods.hasActiveBrowserSession = function () {
  return (
    this.browserSession &&
    this.browserSession.isActive &&
    this.browserSession.sessionId
  );
};
leadSchema.methods.validateSessionData = function (sessionId = null) {
  const session = sessionId
    ? this.getSessionById(sessionId)
    : this.getCurrentBrowserSession();
  if (!session) {
    return { valid: false, reason: "Session not found" };
  }
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (session.createdAt < thirtyDaysAgo) {
    return { valid: false, reason: "Session expired" };
  }
  if (!session.cookies || !Array.isArray(session.cookies)) {
    return { valid: false, reason: "Invalid cookies data" };
  }
  return { valid: true, session: session };
};
leadSchema.methods.getAllSessions = function () {
  const sessions = [...this.sessionHistory];
  if (this.browserSession && this.browserSession.sessionId) {
    const existsInHistory = sessions.some(
      (s) => s.sessionId === this.browserSession.sessionId
    );
    if (!existsInHistory) {
      sessions.push(this.browserSession);
    }
  }
  return sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};
leadSchema.methods.clearExpiredSessions = function (daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  this.sessionHistory = this.sessionHistory.filter(
    (session) => session.createdAt >= cutoffDate
  );
  if (this.browserSession && this.browserSession.createdAt < cutoffDate) {
    this.browserSession = {};
    this.currentSessionId = null;
  }
};
leadSchema.statics.findLeadsWithActiveSessions = function (options = {}) {
  const query = {
    "browserSession.isActive": true,
    "browserSession.sessionId": { $exists: true, $ne: null },
  };
  if (options.leadType) {
    query.leadType = options.leadType;
  }
  if (options.assignedAgent) {
    query.assignedAgent = options.assignedAgent;
  }
  return this.find(query);
};
leadSchema.statics.findLeadsWithExpiredSessions = function (daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return this.find({
    $or: [
      { "browserSession.createdAt": { $lt: cutoffDate } },
      { "sessionHistory.createdAt": { $lt: cutoffDate } },
    ],
  });
};
// DEPRECATED: Use updateOrderCallNumber instead
// Kept for backward compatibility with existing data
leadSchema.methods.updateCallNumber = function (callNumber, recordedBy, notes = "") {
  this.callNumber = callNumber;
  this.callHistory.push({
    callNumber: callNumber,
    recordedBy: recordedBy,
    recordedAt: new Date(),
    notes: notes
  });
  return this;
};

// DEPRECATED: Use orderCallTracking instead
leadSchema.methods.getCallHistory = function () {
  return this.callHistory.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
};

// DEPRECATED: Use getOrderCallNumber instead
leadSchema.methods.getCurrentCallNumber = function () {
  return this.callNumber;
};

// DEPRECATED: Legacy method
leadSchema.methods.hasCallNumber = function (callNumber) {
  return this.callHistory.some(call => call.callNumber === callNumber);
};

// DEPRECATED: Legacy method
leadSchema.statics.getLeadsByCallNumber = function (callNumber, filters = {}) {
  const query = { callNumber: callNumber, ...filters };
  return this.find(query);
};

// Order-specific call number tracking methods
leadSchema.methods.updateOrderCallNumber = function (orderId, callNumber, updatedBy, verified) {
  const existingTracking = this.orderCallTracking.find(
    (tracking) => tracking.orderId.toString() === orderId.toString()
  );

  if (existingTracking) {
    existingTracking.callNumber = callNumber;
    if (verified !== undefined) {
      existingTracking.verified = verified;
    }
    existingTracking.updatedBy = updatedBy;
    existingTracking.updatedAt = new Date();
  } else {
    this.orderCallTracking.push({
      orderId: orderId,
      callNumber: callNumber,
      verified: verified !== undefined ? verified : false,
      updatedBy: updatedBy,
      updatedAt: new Date(),
    });
  }

  return this;
};

leadSchema.methods.getOrderCallNumber = function (orderId) {
  const tracking = this.orderCallTracking.find(
    (tracking) => tracking.orderId.toString() === orderId.toString()
  );
  return tracking ? tracking.callNumber : null;
};

leadSchema.methods.getOrderVerified = function (orderId) {
  const tracking = this.orderCallTracking.find(
    (tracking) => tracking.orderId.toString() === orderId.toString()
  );
  return tracking ? tracking.verified : false;
};

leadSchema.methods.getAllOrderCallTracking = function () {
  return this.orderCallTracking;
};

// Order-specific comment tracking methods
leadSchema.methods.addOrderComment = function (orderId, text, authorId) {
  this.orderComments.push({
    orderId: orderId,
    text: text,
    author: authorId,
    createdAt: new Date(),
  });
  return this;
};

leadSchema.methods.getOrderComments = function (orderId) {
  return this.orderComments
    .filter((comment) => comment.orderId.toString() === orderId.toString())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

leadSchema.methods.getAllOrderComments = function () {
  return this.orderComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// Agent assignment methods
leadSchema.methods.assignToAgent = function (agentId, allowReassignment = false) {
  if (this.leadType !== 'ftd' && this.leadType !== 'filler') {
    throw new Error('Only FTD and Filler leads can be assigned to agents');
  }
  
  // Track the previous agent if this is a reassignment
  const previousAgent = this.assignedAgent;
  const isReassignment = previousAgent && previousAgent.toString() !== agentId.toString();
  
  // Update the assignment
  this.assignedAgent = agentId;
  this.assignedAgentAt = new Date();
  
  return {
    lead: this,
    isReassignment,
    previousAgent
  };
};

leadSchema.methods.unassignFromAgent = function () {
  this.assignedAgent = null;
  this.assignedAgentAt = null;
  return this;
};

leadSchema.methods.isAssignedToAgent = function (agentId) {
  if (!this.assignedAgent) return false;
  return this.assignedAgent.toString() === agentId.toString();
};

leadSchema.statics.findByAssignedAgent = function (agentId, filters = {}) {
  const query = { assignedAgent: agentId, ...filters };
  return this.find(query);
};

// Archive methods
leadSchema.methods.archive = function (userId) {
  this.isArchived = true;
  this.archivedAt = new Date();
  this.archivedBy = userId;
  this.status = "inactive"; // Set status to inactive when archived
  return this;
};

leadSchema.methods.unarchive = function () {
  this.isArchived = false;
  this.archivedAt = null;
  this.archivedBy = null;
  return this;
};

leadSchema.statics.findArchived = function (filters = {}) {
  const query = { isArchived: true, ...filters };
  return this.find(query);
};

leadSchema.statics.findNonArchived = function (filters = {}) {
  const query = { isArchived: { $ne: true }, ...filters };
  return this.find(query);
};

module.exports = mongoose.model("Lead", leadSchema);
