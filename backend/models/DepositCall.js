const mongoose = require('mongoose');
const { Schema, model } = mongoose;

// Schema for individual call slots (1-10)
const callSlotSchema = new Schema({
  expectedDate: {
    type: Date,
    default: null
  },
  doneDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'pending_approval', 'completed', 'skipped', 'answered', 'rejected'],
    default: 'pending'
  },
  markedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  markedAt: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, { _id: false });

const depositCallSchema = new Schema({
  // Reference to the FTD lead
  leadId: {
    type: Schema.Types.ObjectId,
    ref: 'Lead',
    required: true
  },
  // Reference to the order (optional for custom admin records)
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  // Flag for custom records added manually by admin (not tied to order flow)
  isCustomRecord: {
    type: Boolean,
    default: false
  },
  // Client Broker reference
  clientBrokerId: {
    type: Schema.Types.ObjectId,
    ref: 'ClientBroker',
    default: null
  },
  // Account Manager assigned (affiliate_manager)
  accountManager: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Agent assigned
  assignedAgent: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // FTD Details (denormalized for quick access)
  ftdName: {
    type: String,
    trim: true
  },
  ftdEmail: {
    type: String,
    trim: true
  },
  ftdPhone: {
    type: String,
    trim: true
  },
  // 10 Call slots
  call1: { type: callSlotSchema, default: () => ({}) },
  call2: { type: callSlotSchema, default: () => ({}) },
  call3: { type: callSlotSchema, default: () => ({}) },
  call4: { type: callSlotSchema, default: () => ({}) },
  call5: { type: callSlotSchema, default: () => ({}) },
  call6: { type: callSlotSchema, default: () => ({}) },
  call7: { type: callSlotSchema, default: () => ({}) },
  call8: { type: callSlotSchema, default: () => ({}) },
  call9: { type: callSlotSchema, default: () => ({}) },
  call10: { type: callSlotSchema, default: () => ({}) },
  // Deposit confirmation tracking (synced from Orders page)
  depositConfirmed: {
    type: Boolean,
    default: false
  },
  depositConfirmedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  depositConfirmedAt: {
    type: Date,
    default: null
  },
  // Reference to the auto-approved AgentCallDeclaration created during deposit confirmation
  depositCallDeclaration: {
    type: Schema.Types.ObjectId,
    ref: 'AgentCallDeclaration',
    default: null
  },
  // Overall status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  // Created by
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
// Unique per lead+order, but only when orderId exists (custom records have null orderId)
depositCallSchema.index({ leadId: 1, orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $type: "objectId" } } });
depositCallSchema.index({ accountManager: 1, status: 1 });
depositCallSchema.index({ assignedAgent: 1, status: 1 });
depositCallSchema.index({ clientBrokerId: 1 });
depositCallSchema.index({ status: 1, createdAt: -1 });
depositCallSchema.index({ 'call1.expectedDate': 1 });
depositCallSchema.index({ 'call2.expectedDate': 1 });
depositCallSchema.index({ 'call3.expectedDate': 1 });
depositCallSchema.index({ 'call4.expectedDate': 1 });
depositCallSchema.index({ 'call5.expectedDate': 1 });
depositCallSchema.index({ 'call6.expectedDate': 1 });
depositCallSchema.index({ 'call7.expectedDate': 1 });
depositCallSchema.index({ 'call8.expectedDate': 1 });
depositCallSchema.index({ 'call9.expectedDate': 1 });
depositCallSchema.index({ 'call10.expectedDate': 1 });

// Virtual to get all scheduled calls
depositCallSchema.virtual('scheduledCalls').get(function() {
  const calls = [];
  for (let i = 1; i <= 10; i++) {
    const call = this[`call${i}`];
    if (call && call.expectedDate) {
      calls.push({
        callNumber: i,
        ...call.toObject ? call.toObject() : call
      });
    }
  }
  return calls;
});

// Virtual to get pending approval calls
depositCallSchema.virtual('pendingApprovalCalls').get(function() {
  const calls = [];
  for (let i = 1; i <= 10; i++) {
    const call = this[`call${i}`];
    if (call && call.status === 'pending_approval') {
      calls.push({
        callNumber: i,
        ...call.toObject ? call.toObject() : call
      });
    }
  }
  return calls;
});

// Virtual to get completed calls count
depositCallSchema.virtual('completedCallsCount').get(function() {
  let count = 0;
  for (let i = 1; i <= 10; i++) {
    const call = this[`call${i}`];
    if (call && call.status === 'completed') {
      count++;
    }
  }
  return count;
});

// Method to schedule a call
depositCallSchema.methods.scheduleCall = function(callNumber, expectedDate, userId) {
  if (callNumber < 1 || callNumber > 10) {
    throw new Error('Call number must be between 1 and 10');
  }
  
  const callField = `call${callNumber}`;
  this[callField].expectedDate = expectedDate;
  this[callField].status = 'scheduled';
  this[callField].markedBy = userId;
  this[callField].markedAt = new Date();
  
  return this;
};

// Method to mark call as done (pending approval)
depositCallSchema.methods.markCallDone = function(callNumber, userId, notes = '') {
  if (callNumber < 1 || callNumber > 10) {
    throw new Error('Call number must be between 1 and 10');
  }
  
  const callField = `call${callNumber}`;
  this[callField].doneDate = new Date();
  this[callField].status = 'pending_approval';
  this[callField].markedBy = userId;
  this[callField].markedAt = new Date();
  this[callField].notes = notes;
  
  return this;
};

// Method to approve a call
depositCallSchema.methods.approveCall = function(callNumber, userId) {
  if (callNumber < 1 || callNumber > 10) {
    throw new Error('Call number must be between 1 and 10');
  }
  
  const callField = `call${callNumber}`;
  if (this[callField].status !== 'pending_approval') {
    throw new Error('Call is not pending approval');
  }
  
  this[callField].status = 'completed';
  this[callField].approvedBy = userId;
  this[callField].approvedAt = new Date();
  
  return this;
};

// Method to reject a call approval request
depositCallSchema.methods.rejectCall = function(callNumber, userId) {
  if (callNumber < 1 || callNumber > 10) {
    throw new Error('Call number must be between 1 and 10');
  }

  const callField = `call${callNumber}`;
  if (this[callField].status !== 'pending_approval') {
    throw new Error('Call is not pending approval');
  }

  // Reset to scheduled state
  this[callField].status = 'scheduled';
  this[callField].doneDate = null;

  return this;
};

// Method to mark call as answered (final status)
depositCallSchema.methods.markCallAnswered = function(callNumber, userId, notes = '') {
  if (callNumber < 1 || callNumber > 10) {
    throw new Error('Call number must be between 1 and 10');
  }

  const callField = `call${callNumber}`;
  if (this[callField].status !== 'pending_approval') {
    throw new Error('Call is not pending approval');
  }

  this[callField].status = 'answered';
  this[callField].approvedBy = userId;
  this[callField].approvedAt = new Date();
  if (notes) {
    this[callField].notes = notes;
  }

  return this;
};

// Method to mark call as rejected (final status - FTD rejected the call)
depositCallSchema.methods.markCallRejected = function(callNumber, userId, notes = '') {
  if (callNumber < 1 || callNumber > 10) {
    throw new Error('Call number must be between 1 and 10');
  }

  const callField = `call${callNumber}`;
  if (this[callField].status !== 'pending_approval') {
    throw new Error('Call is not pending approval');
  }

  this[callField].status = 'rejected';
  this[callField].approvedBy = userId;
  this[callField].approvedAt = new Date();
  if (notes) {
    this[callField].notes = notes;
  }

  return this;
};

// Static method to get deposit calls with upcoming appointments
depositCallSchema.statics.getUpcomingAppointments = function(startDate, endDate, filters = {}) {
  const query = {
    status: 'active',
    $or: []
  };
  
  // Add date range filter for each call slot
  for (let i = 1; i <= 10; i++) {
    query.$or.push({
      [`call${i}.expectedDate`]: { $gte: startDate, $lte: endDate },
      [`call${i}.status`]: { $in: ['scheduled', 'pending_approval'] }
    });
  }
  
  // Add additional filters
  if (filters.accountManager) {
    query.accountManager = filters.accountManager;
  }
  if (filters.assignedAgent) {
    query.assignedAgent = filters.assignedAgent;
  }
  if (filters.clientBrokerId) {
    query.clientBrokerId = filters.clientBrokerId;
  }
  
  return this.find(query)
    .populate('leadId', 'firstName lastName newEmail newPhone')
    .populate('orderId', 'createdAt plannedDate')
    .populate('clientBrokerId', 'name domain')
    .populate('accountManager', 'fullName email')
    .populate('assignedAgent', 'fullName email');
};

// Static method to get pending approval calls
depositCallSchema.statics.getPendingApprovals = function(accountManagerId = null) {
  const query = {
    status: 'active',
    $or: []
  };
  
  // Check each call slot for pending_approval status
  for (let i = 1; i <= 10; i++) {
    query.$or.push({ [`call${i}.status`]: 'pending_approval' });
  }
  
  if (accountManagerId) {
    query.accountManager = accountManagerId;
  }
  
  return this.find(query)
    .populate('leadId', 'firstName lastName newEmail newPhone')
    .populate('orderId', 'createdAt plannedDate')
    .populate('clientBrokerId', 'name domain')
    .populate('accountManager', 'fullName email')
    .populate('assignedAgent', 'fullName email');
};

module.exports = model('DepositCall', depositCallSchema);

