const mongoose = require('mongoose');

const fineImageSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  mimetype: {
    type: String,
    required: true
  },
  originalSize: {
    type: Number,
    required: true
  },
  processedSize: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  // Store image in chunks to avoid 16MB document size limit
  chunks: [{
    data: {
      type: String,
      required: true
    },
    index: {
      type: Number,
      required: true
    }
  }],
  chunkCount: {
    type: Number,
    required: true
  },
  chunkSize: {
    type: Number,
    required: true
  },
  // Thumbnail stored as base64
  thumbnail: {
    type: String,
    required: true
  },
  // Hash for deduplication
  hash: {
    type: String,
    required: true,
    index: true
  },
  // Compression info
  compression: {
    quality: Number,
    format: String,
    resized: Boolean,
    maxWidth: Number,
    maxHeight: Number
  },
  // Reference to fine
  fineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentFine',
    default: null,
    index: true
  },
  // Who uploaded
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
fineImageSchema.index({ hash: 1, uploadedBy: 1 });
fineImageSchema.index({ fineId: 1, createdAt: -1 });
fineImageSchema.index({ uploadedBy: 1, createdAt: -1 });

// Virtual for URL
fineImageSchema.virtual('url').get(function() {
  return `/api/fine-images/${this._id}`;
});

// Virtual for thumbnail URL
fineImageSchema.virtual('thumbnailUrl').get(function() {
  return `/api/fine-images/${this._id}/thumbnail`;
});

// Virtual for formatted size
fineImageSchema.virtual('formattedSize').get(function() {
  const bytes = this.processedSize;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
});

// Static method to chunk image data
fineImageSchema.statics.chunkImageData = function(buffer, chunkSize) {
  const base64Data = buffer.toString('base64');
  const chunks = [];

  for (let i = 0; i < base64Data.length; i += chunkSize) {
    chunks.push({
      data: base64Data.substring(i, i + chunkSize),
      index: Math.floor(i / chunkSize)
    });
  }

  return {
    chunks,
    chunkCount: chunks.length
  };
};

// Instance method to reconstruct image data
fineImageSchema.methods.reconstructImageData = function() {
  const sortedChunks = this.chunks.sort((a, b) => a.index - b.index);
  const base64Data = sortedChunks.map(chunk => chunk.data).join('');
  return Buffer.from(base64Data, 'base64');
};

// Instance method to increment usage count
fineImageSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

// Static method to find duplicate
fineImageSchema.statics.findDuplicate = async function(hash, uploadedBy) {
  return this.findOne({ hash, uploadedBy });
};

// Static method to cleanup unused images
fineImageSchema.statics.cleanupUnused = async function(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));

  const result = await this.deleteMany({
    usageCount: 0,
    fineId: null,
    createdAt: { $lt: cutoffDate }
  });

  return result.deletedCount;
};

// Static method to get images by fine ID
fineImageSchema.statics.getImagesByFineId = function(fineId) {
  return this.find({ fineId })
    .select('-chunks')
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'fullName email');
};

// Ensure virtuals are included in JSON
fineImageSchema.set('toJSON', { virtuals: true });
fineImageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FineImage', fineImageSchema);
