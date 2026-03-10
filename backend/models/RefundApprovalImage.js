const mongoose = require("mongoose");

const refundApprovalImageSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    originalSize: {
      type: Number,
      required: true,
    },
    processedSize: {
      type: Number,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    // Store image in chunks to avoid 16MB document size limit
    chunks: [
      {
        data: {
          type: String,
          required: true,
        },
        index: {
          type: Number,
          required: true,
        },
      },
    ],
    chunkCount: {
      type: Number,
      required: true,
    },
    chunkSize: {
      type: Number,
      required: true,
    },
    // Thumbnail stored as base64
    thumbnail: {
      type: String,
      required: true,
    },
    // Hash for deduplication
    hash: {
      type: String,
      required: true,
      index: true,
    },
    // Compression info
    compression: {
      quality: Number,
      format: String,
      resized: Boolean,
      maxWidth: Number,
      maxHeight: Number,
    },
    // Reference to approval
    approvalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RefundApproval",
      default: null,
      index: true,
    },
    // Who uploaded
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Usage tracking
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
refundApprovalImageSchema.index({ hash: 1, uploadedBy: 1 });
refundApprovalImageSchema.index({ approvalId: 1, createdAt: -1 });
refundApprovalImageSchema.index({ uploadedBy: 1, createdAt: -1 });

// Virtual for URL
refundApprovalImageSchema.virtual("url").get(function () {
  return `/api/refund-approval-images/${this._id}`;
});

// Virtual for thumbnail URL
refundApprovalImageSchema.virtual("thumbnailUrl").get(function () {
  return `/api/refund-approval-images/${this._id}/thumbnail`;
});

// Virtual for formatted size
refundApprovalImageSchema.virtual("formattedSize").get(function () {
  const bytes = this.processedSize;
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
});

// Static method to chunk image data
refundApprovalImageSchema.statics.chunkImageData = function (
  buffer,
  chunkSize
) {
  const base64Data = buffer.toString("base64");
  const chunks = [];

  for (let i = 0; i < base64Data.length; i += chunkSize) {
    chunks.push({
      data: base64Data.substring(i, i + chunkSize),
      index: Math.floor(i / chunkSize),
    });
  }

  return {
    chunks,
    chunkCount: chunks.length,
  };
};

// Instance method to reconstruct image data
refundApprovalImageSchema.methods.reconstructImageData = function () {
  const sortedChunks = this.chunks.sort((a, b) => a.index - b.index);
  const base64Data = sortedChunks.map((chunk) => chunk.data).join("");
  return Buffer.from(base64Data, "base64");
};

// Static method to find duplicate
refundApprovalImageSchema.statics.findDuplicate = async function (
  hash,
  uploadedBy
) {
  return this.findOne({ hash, uploadedBy });
};

// Static method to get images by approval ID
refundApprovalImageSchema.statics.getImagesByApprovalId = function (
  approvalId
) {
  return this.find({ approvalId })
    .select("-chunks")
    .sort({ createdAt: -1 })
    .populate("uploadedBy", "fullName email");
};

// Ensure virtuals are included in JSON
refundApprovalImageSchema.set("toJSON", { virtuals: true });
refundApprovalImageSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model(
  "RefundApprovalImage",
  refundApprovalImageSchema
);
