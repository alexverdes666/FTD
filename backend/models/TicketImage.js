const mongoose = require('mongoose');

const ticketImageSchema = new mongoose.Schema({
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
  // Reference to ticket
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    default: null,
    index: true
  },
  // Reference to comment (optional)
  commentIndex: {
    type: Number,
    default: null
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
ticketImageSchema.index({ hash: 1, uploadedBy: 1 });
ticketImageSchema.index({ ticketId: 1, createdAt: -1 });
ticketImageSchema.index({ uploadedBy: 1, createdAt: -1 });

// Virtual for URL
ticketImageSchema.virtual('url').get(function() {
  return `/api/ticket-images/${this._id}`;
});

// Virtual for thumbnail URL
ticketImageSchema.virtual('thumbnailUrl').get(function() {
  return `/api/ticket-images/${this._id}/thumbnail`;
});

// Virtual for formatted size
ticketImageSchema.virtual('formattedSize').get(function() {
  const bytes = this.processedSize;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
});

// Static method to chunk image data
ticketImageSchema.statics.chunkImageData = function(buffer, chunkSize) {
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
ticketImageSchema.methods.reconstructImageData = function() {
  const sortedChunks = this.chunks.sort((a, b) => a.index - b.index);
  const base64Data = sortedChunks.map(chunk => chunk.data).join('');
  return Buffer.from(base64Data, 'base64');
};

// Instance method to increment usage count
ticketImageSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

// Static method to find duplicate
ticketImageSchema.statics.findDuplicate = async function(hash, uploadedBy) {
  return this.findOne({ hash, uploadedBy });
};

// Static method to cleanup unused images
ticketImageSchema.statics.cleanupUnused = async function(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
  
  const result = await this.deleteMany({
    usageCount: 0,
    createdAt: { $lt: cutoffDate }
  });
  
  return result.deletedCount;
};

// Ensure virtuals are included in JSON
ticketImageSchema.set('toJSON', { virtuals: true });
ticketImageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TicketImage', ticketImageSchema);

