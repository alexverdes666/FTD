import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  IconButton, 
  Fab, 
  TextField,
  Menu,
  MenuItem
} from '@mui/material';
import { 
  Add as AddIcon, 
  Close as CloseIcon, 
  Palette as PaletteIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const NOTE_COLORS = [
  '#FFF740', // Classic Yellow
  '#feff9c', // Pale Yellow
  '#ff65a3', // Pink
  '#7afcff', // Cyan
  '#ff7eb9', // Magenta
  '#e2f0cb', // Green
];

const NotesPage = () => {
  const [notes, setNotes] = useState(() => {
    const savedNotes = localStorage.getItem('sticky_notes');
    return savedNotes ? JSON.parse(savedNotes) : [];
  });
  const containerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('sticky_notes', JSON.stringify(notes));
  }, [notes]);

  const addNote = () => {
    const newNote = {
      id: Date.now(),
      text: '',
      x: Math.random() * (window.innerWidth - 400),
      y: Math.random() * (window.innerHeight - 400),
      color: NOTE_COLORS[0],
      width: 250,
      height: 250,
      zIndex: notes.length + 1
    };
    setNotes([...notes, newNote]);
  };

  const updateNote = (id, updates) => {
    setNotes(notes.map(note => 
      note.id === id ? { ...note, ...updates } : note
    ));
  };

  const deleteNote = (id) => {
    setNotes(notes.filter(note => note.id !== id));
  };

  const bringToFront = (id) => {
    const maxZ = Math.max(...notes.map(n => n.zIndex || 0), 0);
    updateNote(id, { zIndex: maxZ + 1 });
  };

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        width: '100%', 
        height: 'calc(100vh - 100px)', 
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#f0f0f0',
        borderRadius: 2,
        border: '1px dashed #ccc'
      }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h4" color="textSecondary">
          Sticky Notes
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Drag notes around, double click to edit text.
        </Typography>
      </Box>

      {notes.map((note) => (
        <StickyNote 
          key={note.id} 
          note={note} 
          onUpdate={updateNote}
          onDelete={deleteNote}
          onFocus={() => bringToFront(note.id)}
          containerRef={containerRef}
        />
      ))}

      <Fab 
        color="primary" 
        aria-label="add" 
        sx={{ position: 'absolute', bottom: 32, right: 32 }}
        onClick={addNote}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

const StickyNote = ({ note, onUpdate, onDelete, onFocus, containerRef }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleColorClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleColorClose = (color) => {
    setAnchorEl(null);
    if (color) {
      onUpdate(note.id, { color });
    }
  };

  return (
    <motion.div
      drag
      dragConstraints={containerRef}
      dragMomentum={false}
      initial={{ x: note.x, y: note.y, scale: 0 }}
      animate={{ x: note.x, y: note.y, scale: 1 }}
      onDragEnd={(e, info) => {
        onUpdate(note.id, { 
          x: note.x + info.offset.x, 
          y: note.y + info.offset.y 
        });
      }}
      style={{
        position: 'absolute',
        zIndex: note.zIndex,
      }}
      onMouseDown={onFocus}
    >
      <Paper
        elevation={3}
        sx={{
          width: note.width,
          height: note.height,
          bgcolor: note.color,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: 6
          }
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            p: 0.5,
            bgcolor: 'rgba(0,0,0,0.05)',
            cursor: 'move'
          }}
          className="drag-handle"
        >
          <IconButton size="small" onClick={handleColorClick}>
            <PaletteIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(note.id)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <TextField
          multiline
          fullWidth
          variant="standard"
          placeholder="Type something..."
          value={note.text}
          onChange={(e) => onUpdate(note.id, { text: e.target.value })}
          InputProps={{
            disableUnderline: true,
          }}
          sx={{
            p: 2,
            flexGrow: 1,
            overflowY: 'auto',
            '& .MuiInputBase-root': {
              height: '100%',
              alignItems: 'flex-start'
            }
          }}
        />

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => handleColorClose()}
        >
          <Box sx={{ display: 'flex', p: 1, gap: 1 }}>
            {NOTE_COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => handleColorClose(color)}
                sx={{
                  width: 24,
                  height: 24,
                  bgcolor: color,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  border: '1px solid #ccc'
                }}
              />
            ))}
          </Box>
        </Menu>
      </Paper>
    </motion.div>
  );
};

export default NotesPage;

