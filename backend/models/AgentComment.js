const mongoose = require("mongoose");

const agentCommentSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["client_network", "client_broker"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    comment: {
      type: String,
      required: [true, "Comment is required"],
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["working_ok", "shaving", "playing_games", "other"],
      required: function() {
        return !this.isReply; // Status is only required for top-level comments, not replies
      },
    },
    // New fields for threaded comments
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentComment",
      default: null,
    },
    isReply: {
      type: Boolean,
      default: false,
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: {
      type: Date,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for replies
agentCommentSchema.virtual('replies', {
  ref: 'AgentComment',
  localField: '_id',
  foreignField: 'parentComment',
  options: { sort: { createdAt: 1 } }
});





// Indexes for efficient querying
agentCommentSchema.index({ agent: 1, createdAt: -1 });
agentCommentSchema.index({ targetType: 1, targetId: 1 });
agentCommentSchema.index({ status: 1 });
agentCommentSchema.index({ isResolved: 1 });
agentCommentSchema.index({ createdAt: -1 });
agentCommentSchema.index({ parentComment: 1 }); // New index for threaded comments

// Static method to get comments with target details
agentCommentSchema.statics.getCommentsWithTargets = async function (filters = {}, options = {}) {
  const { skip = 0, limit = null } = options;
  
  // Only get top-level comments (not replies)
  const baseFilters = { ...filters, parentComment: null };
  
  let query = this.find(baseFilters)
    .populate("agent", "fullName email")
    .populate("resolvedBy", "fullName email")
    .populate({
      path: 'replies',
      populate: {
        path: 'agent',
        select: 'fullName email'
      }
    })
    .sort({ createdAt: -1 });
  
  if (skip > 0) {
    query = query.skip(skip);
  }
  
  if (limit) {
    query = query.limit(limit);
  }
  
  const comments = await query;

  // Manually populate target data
  const ClientNetwork = mongoose.model("ClientNetwork");
  const ClientBroker = mongoose.model("ClientBroker");

  const commentsWithTargets = await Promise.all(comments.map(async (comment) => {
    try {
      const commentObj = comment.toObject();
      
      if (comment.targetType === "client_network") {
        const target = await ClientNetwork.findById(comment.targetId).select("name description isActive");
        commentObj.target = target ? target.toObject() : { name: "Deleted Network", description: "", isActive: false };
      } else if (comment.targetType === "client_broker") {
        const target = await ClientBroker.findById(comment.targetId).select("name description isActive");
        commentObj.target = target ? target.toObject() : { name: "Deleted Broker", description: "", isActive: false };
      }
      
      return commentObj;
    } catch (error) {
      console.error(`Error populating target for comment ${comment._id}:`, error);
      const commentObj = comment.toObject();
      commentObj.target = { 
        name: `Unknown ${comment.targetType === "client_network" ? "Network" : "Broker"}`, 
        description: "", 
        isActive: false 
      };
      return commentObj;
    }
  }));

  return commentsWithTargets;
};

// Static method to get comments by target (updated for threaded comments)
agentCommentSchema.statics.getCommentsByTarget = async function (targetType, targetId) {
  const comments = await this.find({ 
    targetType, 
    targetId,
    parentComment: null // Only get top-level comments
  })
    .populate("agent", "fullName email")
    .populate("resolvedBy", "fullName email")
    .populate({
      path: 'replies',
      populate: {
        path: 'agent',
        select: 'fullName email'
      }
    })
    .sort({ createdAt: -1 });

  // Manually populate target data
  const ClientNetwork = mongoose.model("ClientNetwork");
  const ClientBroker = mongoose.model("ClientBroker");

  const commentsWithTargets = await Promise.all(comments.map(async (comment) => {
    try {
      const commentObj = comment.toObject();
      
      if (comment.targetType === "client_network") {
        const target = await ClientNetwork.findById(comment.targetId).select("name description isActive");
        commentObj.target = target ? target.toObject() : { name: "Deleted Network", description: "", isActive: false };
      } else if (comment.targetType === "client_broker") {
        const target = await ClientBroker.findById(comment.targetId).select("name description isActive");
        commentObj.target = target ? target.toObject() : { name: "Deleted Broker", description: "", isActive: false };
      }
      
      return commentObj;
    } catch (error) {
      console.error(`Error populating target for comment ${comment._id}:`, error);
      const commentObj = comment.toObject();
      commentObj.target = { 
        name: `Unknown ${comment.targetType === "client_network" ? "Network" : "Broker"}`, 
        description: "", 
        isActive: false 
      };
      return commentObj;
    }
  }));

  return commentsWithTargets;
};

// Static method to get unresolved comments count
agentCommentSchema.statics.getUnresolvedCount = function (targetType, targetId) {
  return this.countDocuments({
    targetType,
    targetId,
    isResolved: false,
    parentComment: null, // Only count top-level comments
  });
};

module.exports = mongoose.model("AgentComment", agentCommentSchema);
