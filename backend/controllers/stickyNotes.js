const StickyNote = require('../models/StickyNote');

// @desc    Get all sticky notes for the current user
// @route   GET /api/sticky-notes
// @access  Private
exports.getNotes = async (req, res) => {
  try {
    const notes = await StickyNote.find({ user: req.user.id });
    res.status(200).json({
      success: true,
      data: notes
    });
  } catch (error) {
    console.error('Error fetching sticky notes:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Create a new sticky note
// @route   POST /api/sticky-notes
// @access  Private
exports.createNote = async (req, res) => {
  try {
    const { type, text, imageData, color, width, height, aspectRatio, position, fontSize, isBold, textAlign, connections } = req.body;

    const note = await StickyNote.create({
      user: req.user.id,
      type,
      text,
      imageData,
      color,
      width,
      height,
      aspectRatio,
      fontSize,
      isBold,
      textAlign,
      position,
      connections: connections || []
    });

    res.status(201).json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error creating sticky note:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Update a sticky note
// @route   PUT /api/sticky-notes/:id
// @access  Private
exports.updateNote = async (req, res) => {
  try {
    console.log(`[DEBUG_BACKEND] Updating note ${req.params.id}. Body:`, JSON.stringify(req.body));
    let note = await StickyNote.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Make sure user owns the note
    if (note.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Only update allowed fields to prevent overwriting everything if not passed
    const allowedUpdates = {};
    if (req.body.text !== undefined) allowedUpdates.text = req.body.text;
    if (req.body.color !== undefined) allowedUpdates.color = req.body.color;
    if (req.body.width !== undefined) allowedUpdates.width = req.body.width;
    if (req.body.height !== undefined) allowedUpdates.height = req.body.height;
    if (req.body.fontSize !== undefined) allowedUpdates.fontSize = req.body.fontSize;
    if (req.body.isBold !== undefined) allowedUpdates.isBold = req.body.isBold;
    if (req.body.textAlign !== undefined) allowedUpdates.textAlign = req.body.textAlign;
    if (req.body.connections !== undefined) allowedUpdates.connections = req.body.connections;
    if (req.body.position !== undefined) {
      // Ensure position has x and y
      if (typeof req.body.position.x === 'number' && typeof req.body.position.y === 'number') {
        allowedUpdates.position = {
          x: req.body.position.x,
          y: req.body.position.y
        };
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
       return res.status(400).json({
         success: false,
         message: 'No valid fields to update'
       });
    }

    note = await StickyNote.findByIdAndUpdate(req.params.id, { $set: allowedUpdates }, {
      new: true,
      runValidators: true
    });

    console.log(`[DEBUG_BACKEND] Updated note result:`, JSON.stringify(note));

    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error updating sticky note:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Delete a sticky note
// @route   DELETE /api/sticky-notes/:id
// @access  Private
exports.deleteNote = async (req, res) => {
  try {
    const note = await StickyNote.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Make sure user owns the note
    if (note.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await note.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting sticky note:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

