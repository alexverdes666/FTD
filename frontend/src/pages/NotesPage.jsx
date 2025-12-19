import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Paper, 
  IconButton, 
  TextField,
  Menu,
  MenuItem,
  Fab
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Palette as PaletteIcon,
  NoteAdd as NoteAddIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [contextMenu, setContextMenu] = useState(null);
  
  // View state: translation (x, y) and scale for infinite canvas effect
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('sticky_notes', JSON.stringify(notes));
  }, [notes]);

  const handleContextMenu = (event) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX,
            mouseY: event.clientY,
          }
        : null,
    );
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Pan / Zoom Logic
  const handleMouseDown = (e) => {
    // Only pan if clicking on the background (not on a note)
    // We check if the target is the container or one of its direct children that isn't a note
    // Or simpler: check if the click target has a specific class or id, or if it's NOT inside a note
    if (e.target.closest('.sticky-note')) return;

    if (e.button === 0) { // Left click
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      
      setView(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    if (e.ctrlKey) return; 

    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const sensitivity = 0.001;
    const delta = -e.deltaY;
    const factor = Math.exp(delta * sensitivity);
    
    const newScale = Math.min(Math.max(0.1, view.scale * factor), 5);
    
    const scaleRatio = newScale / view.scale;
    const newX = mx - (mx - view.x) * scaleRatio;
    const newY = my - (my - view.y) * scaleRatio;

    setView({
      x: newX,
      y: newY,
      scale: newScale
    });
  };

  const addNote = () => {
    const newNote = {
      id: Date.now(),
      text: '',
      color: NOTE_COLORS[0],
      width: 250,
      height: 250,
    };
    setNotes([...notes, newNote]);
    handleCloseContextMenu();
  };

  const updateNote = (id, updates) => {
    setNotes(notes.map(note => 
      note.id === id ? { ...note, ...updates } : note
    ));
  };

  const deleteNote = (id) => {
    setNotes(notes.filter(note => note.id !== id));
  };

  return (
    <Box 
      ref={containerRef}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      sx={{ 
        width: '100%', 
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#eeeeee',
        backgroundImage: 'radial-gradient(#d4d4d4 2px, transparent 2px)',
        // Adjust background size and position based on view to simulate infinite canvas
        backgroundSize: `${20 * view.scale}px ${20 * view.scale}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: '0 0',
          // Apply the pan/zoom transform
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
        }}
      >
        {/* 
          Inner container for the auto-rearranging layout (Flexbox).
          We use a fixed width or large width so items wrap correctly.
          Since we are scaling, we can use a fixed pixel width that feels "standard" at scale 1.
          Using a large fixed width (e.g. 1500px) centered or just left aligned allows the flex wrap to work.
        */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'flex-start',
            gap: 2,
            padding: 3,
            // Allow the grid to expand, but typical 'page' width for wrapping
            width: '100%', 
            maxWidth: '1800px' // Limit max width so they don't stretch infinitely on huge screens
          }}
        >
          <AnimatePresence>
            {notes.map((note) => (
              <StickyNote 
                key={note.id} 
                note={note} 
                scale={view.scale}
                onUpdate={updateNote}
                onDelete={deleteNote}
              />
            ))}
          </AnimatePresence>
        </Box>
      </motion.div>

      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={addNote}>
          <NoteAddIcon sx={{ mr: 1 }} /> Add Note
        </MenuItem>
      </Menu>

      {/* Floating Action Button */}
      <Fab 
        color="primary" 
        aria-label="add" 
        sx={{ position: 'fixed', bottom: 32, right: 32 }}
        onClick={addNote}
      >
        <NoteAddIcon />
      </Fab>
    </Box>
  );
};

const StickyNote = ({ note, scale, onUpdate, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleColorClick = (event) => {
    event.stopPropagation(); 
    setAnchorEl(event.currentTarget);
  };

  const handleColorClose = (color) => {
    setAnchorEl(null);
    if (color) {
      onUpdate(note.id, { color });
    }
  };

  // Resize logic with scale correction
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = note.width;
    const startHeight = note.height;

    const handleMouseMove = (moveEvent) => {
      // Calculate delta and divide by scale to get "world space" delta
      const deltaX = (moveEvent.clientX - startX) / scale;
      const deltaY = (moveEvent.clientY - startY) / scale;

      const newWidth = Math.max(200, startWidth + deltaX);
      const newHeight = Math.max(150, startHeight + deltaY);
      
      onUpdate(note.id, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <motion.div
      className="sticky-note" // Added class for click detection
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ opacity: { duration: 0.2 }, scale: { type: 'spring', stiffness: 300, damping: 25 } }}
      style={{
        width: note.width,
        height: note.height,
        position: 'relative',
        marginBottom: 16, // Add margin to account for potential overlap during resize animation
        marginRight: 16
      }}
      // Prevent drag propagation to container (pan) when interacting with note
      onMouseDown={(e) => e.stopPropagation()} 
    >
      <Paper
        elevation={3}
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: note.color,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          transition: isResizing ? 'none' : 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: 6
          },
          overflow: 'hidden'
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            p: 0.5,
            bgcolor: 'rgba(0,0,0,0.05)',
          }}
        >
          <IconButton size="small" onClick={handleColorClick}>
            <PaletteIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
          >
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

        {/* Resize Handle */}
        <Box
          onMouseDown={handleResizeStart}
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 20,
            height: 20,
            cursor: 'nwse-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.5,
            '&:hover': { opacity: 1 },
            zIndex: 10
          }}
        >
          <Box sx={{ 
            width: 0, 
            height: 0, 
            borderStyle: 'solid', 
            borderWidth: '0 0 10px 10px', 
            borderColor: 'transparent transparent rgba(0,0,0,0.3) transparent' 
          }} />
        </Box>

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
