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
    const { type, text, imageData, color, width, height, aspectRatio, position } = req.body;

    const note = await StickyNote.create({
      user: req.user.id,
      type,
      text,
      imageData,
      color,
      width,
      height,
      aspectRatio,
      position
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

    note = await StickyNote.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

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

