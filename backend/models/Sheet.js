const mongoose = require('mongoose');

const sheetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    default: 'Untitled Sheet',
    trim: true
  },
  // 2D array of cell values - each row is an array, each cell can be any type
  data: {
    type: [[mongoose.Schema.Types.Mixed]],
    default: () => {
      // Create a default 50x26 grid (like A-Z columns, 50 rows)
      const rows = [];
      for (let i = 0; i < 50; i++) {
        rows.push(new Array(26).fill(''));
      }
      return rows;
    }
  },
  // Column definitions
  columns: [{
    title: { type: String },
    width: { type: Number, default: 100 },
    type: { type: String, default: 'text' }
  }],
  // Cell styles stored by "row:col" key for sparse storage
  // Example: { "0:0": { backgroundColor: "#ff0000", fontWeight: "bold" } }
  styles: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Sheet metadata
  meta: {
    zoom: { type: Number, default: 100, min: 25, max: 200 },
    frozenRows: { type: Number, default: 0 },
    frozenCols: { type: Number, default: 0 },
    defaultColWidth: { type: Number, default: 100 },
    defaultRowHeight: { type: Number, default: 25 }
  },
  // Track if this sheet was imported from another collection
  sourceType: {
    type: String,
    enum: ['manual', 'leads', 'orders'],
    default: 'manual'
  },
  // Store the query/filters used when importing (for reference)
  sourceQuery: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // When the data was last imported (for imported sheets)
  lastImportedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient user queries
sheetSchema.index({ user: 1, updatedAt: -1 });
sheetSchema.index({ user: 1, name: 1 });

// Virtual for 'id' to match frontend expectations
sheetSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Method to update cell data
sheetSchema.methods.updateCell = function(row, col, value) {
  // Ensure the row exists
  while (this.data.length <= row) {
    this.data.push(new Array(this.data[0]?.length || 26).fill(''));
  }
  // Ensure the column exists in this row
  while (this.data[row].length <= col) {
    this.data[row].push('');
  }
  this.data[row][col] = value;
  return this;
};

// Method to update cell style
sheetSchema.methods.updateCellStyle = function(row, col, style) {
  const key = `${row}:${col}`;
  if (!this.styles) {
    this.styles = {};
  }
  this.styles[key] = { ...this.styles[key], ...style };
  return this;
};

// Method to get cell style
sheetSchema.methods.getCellStyle = function(row, col) {
  const key = `${row}:${col}`;
  return this.styles?.[key] || {};
};

// Method to resize the grid
sheetSchema.methods.resizeGrid = function(rows, cols) {
  // Adjust rows
  while (this.data.length < rows) {
    this.data.push(new Array(cols).fill(''));
  }
  if (this.data.length > rows) {
    this.data = this.data.slice(0, rows);
  }
  // Adjust columns in each row
  for (let i = 0; i < this.data.length; i++) {
    while (this.data[i].length < cols) {
      this.data[i].push('');
    }
    if (this.data[i].length > cols) {
      this.data[i] = this.data[i].slice(0, cols);
    }
  }
  return this;
};

// Static method to find sheets by user
sheetSchema.statics.findByUser = function(userId, options = {}) {
  const query = { user: userId };
  if (options.sourceType) {
    query.sourceType = options.sourceType;
  }
  return this.find(query).sort({ updatedAt: -1 });
};

module.exports = mongoose.model('Sheet', sheetSchema);
