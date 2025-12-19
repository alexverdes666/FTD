const mongoose = require('mongoose');

const stickyNoteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Frontend uses Date.now() for ID, but we should use _id for DB operations.
  // We can keep a client-side ID if needed, but typically _id is enough.
  // However, to minimize frontend refactoring, we might want to map _id to id or just use _id.
  
  type: {
    type: String,
    enum: ['text', 'image'],
    default: 'text'
  },
  text: {
    type: String,
    default: ''
  },
  imageData: {
    type: String, // Base64 string
    // Store image data directly if it's not too huge.
    // If we wanted to use chunking like ChatImage, we'd need a more complex schema,
    // but for "sticky notes" usually screenshots are manageable.
    // We'll trust the 16MB document limit for now.
  },
  color: {
    type: String,
    default: '#FFF740'
  },
  width: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  aspectRatio: {
    type: Number
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  zIndex: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for 'id' to match frontend expectation if we want to replace _id usage seamlessly
stickyNoteSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

module.exports = mongoose.model('StickyNote', stickyNoteSchema);

