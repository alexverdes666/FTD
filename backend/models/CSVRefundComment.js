const mongoose = require("mongoose");
const { Schema } = mongoose;

const csvRefundCommentSchema = new Schema(
  {
    csvRefundId: {
      type: Schema.Types.ObjectId,
      ref: "CSVRefund",
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    isInternal: {
      type: Boolean,
      default: true, // Comments are internal by default
    },
    editedAt: {
      type: Date,
    },
    editedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient queries
csvRefundCommentSchema.index({ csvRefundId: 1, createdAt: -1 });
csvRefundCommentSchema.index({ author: 1 });

// Virtual to check if comment was edited
csvRefundCommentSchema.virtual("isEdited").get(function () {
  return !!this.editedAt;
});

// Static method to get comments for a CSV refund
csvRefundCommentSchema.statics.getCommentsForCSVRefund = function (csvRefundId) {
  return this.find({ csvRefundId })
    .populate("author", "fullName email role")
    .populate("editedBy", "fullName email")
    .sort({ createdAt: -1 });
};

// Static method to get comment count for CSV refund
csvRefundCommentSchema.statics.getCommentCount = function (csvRefundId) {
  return this.countDocuments({ csvRefundId });
};

module.exports = mongoose.model("CSVRefundComment", csvRefundCommentSchema);
