const mongoose = require('mongoose');

const chatImageSchema = new mongoose.Schema({
  // Original image metadata
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  
  mimetype: {
    type: String,
    required: true,
    enum: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  },
  
  originalSize: {
    type: Number,
    required: true
  },
  
  // Processed image metadata
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
  
  // Image data stored as chunks
  chunks: [{
    index: {
      type: Number,
      required: true
    },
    data: {
      type: String, // Base64 encoded chunk
      required: true
    }
  }],
  
  // Total number of chunks
  chunkCount: {
    type: Number,
    required: true
  },
  
  // Chunk size in bytes (for reconstruction)
  chunkSize: {
    type: Number,
    default: 16384 // 16KB per chunk
  },
  
  // Thumbnail for quick preview (small Base64 image)
  thumbnail: {
    type: String,
    required: true
  },
  
  // Image hash for deduplication
  hash: {
    type: String,
    required: true,
    index: true
  },
  
  // Compression settings used
  compression: {
    quality: {
      type: Number,
      default: 85
    },
    format: {
      type: String,
      enum: ['jpeg', 'png', 'webp', 'gif'],
      default: 'jpeg'
    },
    resized: {
      type: Boolean,
      default: false
    },
    maxWidth: Number,
    maxHeight: Number
  },
  
  // Who uploaded the image
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  
  lastUsed: {
    type: Date,
    default: Date.now
  },
  
  // Expiry for cleanup (optional)
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
chatImageSchema.index({ uploadedBy: 1, createdAt: -1 });
chatImageSchema.index({ hash: 1, uploadedBy: 1 });
chatImageSchema.index({ createdAt: -1 });
chatImageSchema.index({ usageCount: -1 });

// Virtual for file URL
chatImageSchema.virtual('url').get(function() {
  return `/api/chat/images/${this._id}`;
});

// Virtual for thumbnail URL  
chatImageSchema.virtual('thumbnailUrl').get(function() {
  return `/api/chat/images/${this._id}/thumbnail`;
});

// Virtual for formatted size
chatImageSchema.virtual('formattedSize').get(function() {
  const size = this.processedSize;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
});

// Static method to find duplicate images
chatImageSchema.statics.findDuplicate = function(hash, uploadedBy) {
  return this.findOne({ hash, uploadedBy });
};

// Static method to chunk image data
chatImageSchema.statics.chunkImageData = function(imageBuffer, chunkSize = 16384) {
  const chunks = [];
  const base64Data = imageBuffer.toString('base64');
  
  for (let i = 0; i < base64Data.length; i += chunkSize) {
    chunks.push({
      index: Math.floor(i / chunkSize),
      data: base64Data.slice(i, i + chunkSize)
    });
  }
  
  return {
    chunks,
    chunkCount: chunks.length,
    totalSize: base64Data.length
  };
};

// Method to reconstruct image data from chunks
chatImageSchema.methods.reconstructImageData = function() {
  // Sort chunks by index to ensure correct order
  const sortedChunks = this.chunks.sort((a, b) => a.index - b.index);
  
  // Concatenate all chunk data
  const base64Data = sortedChunks.map(chunk => chunk.data).join('');
  
  // Convert back to buffer
  return Buffer.from(base64Data, 'base64');
};

// Method to increment usage count
chatImageSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Method to create thumbnail data URL
chatImageSchema.methods.getThumbnailDataUrl = function() {
  return `data:${this.mimetype};base64,${this.thumbnail}`;
};

// Method to get full image data URL
chatImageSchema.methods.getImageDataUrl = function() {
  const imageBuffer = this.reconstructImageData();
  const base64Data = imageBuffer.toString('base64');
  return `data:${this.mimetype};base64,${base64Data}`;
};

// Pre-save middleware to validate chunks
chatImageSchema.pre('save', function(next) {
  // Ensure chunks are properly indexed
  if (this.chunks && this.chunks.length > 0) {
    this.chunks.forEach((chunk, index) => {
      if (chunk.index !== index) {
        return next(new Error('Chunk indices are not sequential'));
      }
    });
    
    if (this.chunks.length !== this.chunkCount) {
      return next(new Error('Chunk count mismatch'));
    }
  }
  
  next();
});

// Static method for cleanup of unused images
chatImageSchema.statics.cleanupUnused = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    usageCount: 0,
    createdAt: { $lt: cutoffDate }
  });
  
  return result.deletedCount;
};

module.exports = mongoose.model('ChatImage', chatImageSchema); 