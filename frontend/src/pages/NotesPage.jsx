import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Paper,
  IconButton,
  TextField,
  Menu,
  MenuItem,
  Fab,
} from "@mui/material";
import {
  Close as CloseIcon,
  Palette as PaletteIcon,
  NoteAdd as NoteAddIcon,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

const NOTE_COLORS = [
  "#FFF740", // Classic Yellow
  "#feff9c", // Pale Yellow
  "#ff65a3", // Pink
  "#7afcff", // Cyan
  "#ff7eb9", // Magenta
  "#e2f0cb", // Green
];

const NotesPage = () => {
  const [notes, setNotes] = useState(() => {
    const savedNotes = localStorage.getItem("sticky_notes");
    return savedNotes ? JSON.parse(savedNotes) : [];
  });
  const [contextMenu, setContextMenu] = useState(null);
  const [activeNoteId, setActiveNoteId] = useState(null); // Track which note is being interacted with

  // View state: translation (x, y) and scale for infinite canvas effect
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("sticky_notes", JSON.stringify(notes));
  }, [notes]);

  // Handle paste event for images
  useEffect(() => {
    const handlePaste = async (e) => {
      // Check if we have clipboard items
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Check if the item is an image
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();

          const blob = item.getAsFile();
          const reader = new FileReader();

          reader.onload = (event) => {
            const imageData = event.target.result;

            // Create temporary image to get natural dimensions
            const img = new Image();
            img.onload = () => {
              const aspectRatio = img.naturalWidth / img.naturalHeight;
              const maxWidth = 400;
              let width = Math.min(maxWidth, img.naturalWidth);
              let height = width / aspectRatio;

              // Create a new image note with proper aspect ratio
              const newNote = {
                id: Date.now(),
                type: "image",
                imageData: imageData,
                width: width,
                height: height,
                aspectRatio: aspectRatio,
                position: {
                  x: 100 + notes.length * 30,
                  y: 100 + notes.length * 30,
                },
              };

              setNotes((prevNotes) => [...prevNotes, newNote]);
            };
            img.src = imageData;
          };

          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [notes.length]);

  const handleContextMenu = (event) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX,
            mouseY: event.clientY,
          }
        : null
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
    if (e.target.closest(".sticky-note")) return;

    if (e.button === 0) {
      // Left click
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      setView((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
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
      scale: newScale,
    });
  };

  const addNote = () => {
    const newNote = {
      id: Date.now(),
      type: "text",
      text: "",
      color: NOTE_COLORS[0],
      width: 250,
      height: 250,
      position: {
        x: 100 + notes.length * 30,
        y: 100 + notes.length * 30,
      },
    };
    setNotes([...notes, newNote]);
    handleCloseContextMenu();
  };

  const updateNote = (id, updates) => {
    setNotes(
      notes.map((note) => (note.id === id ? { ...note, ...updates } : note))
    );
  };

  const deleteNote = (id) => {
    setNotes(notes.filter((note) => note.id !== id));
  };

  const bringToFront = (id) => {
    setActiveNoteId(id);
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
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#eeeeee",
        backgroundImage: "radial-gradient(#d4d4d4 2px, transparent 2px)",
        // Adjust background size and position based on view to simulate infinite canvas
        backgroundSize: `${20 * view.scale}px ${20 * view.scale}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        cursor: isDragging ? "grabbing" : "grab",
      }}
    >
      <motion.div
        style={{
          width: "100%",
          height: "100%",
          transformOrigin: "0 0",
          position: "relative",
          // Apply the pan/zoom transform
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        {/* Notes container with absolute positioning for free movement */}
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: "100%",
            minWidth: "2000px",
            minHeight: "2000px",
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
                onBringToFront={bringToFront}
                isActive={activeNoteId === note.id}
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
        sx={{ position: "fixed", bottom: 32, right: 32 }}
        onClick={addNote}
      >
        <NoteAddIcon />
      </Fab>
    </Box>
  );
};

const StickyNote = ({
  note,
  scale,
  onUpdate,
  onDelete,
  onBringToFront,
  isActive,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isDraggingNote, setIsDraggingNote] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState(() => {
    return note.position || { x: 0, y: 0 };
  });
  // Local state for dimensions during resizing to avoid flickering
  const [dimensions, setDimensions] = useState({
    width: note.width,
    height: note.height,
  });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartNotePos = useRef({ x: 0, y: 0 });
  const resizeDimensions = useRef({ width: note.width, height: note.height });
  const justFinishedResizing = useRef(false);

  // Sync dimensions from props when not resizing
  useEffect(() => {
    if (!isResizing && !justFinishedResizing.current) {
      setDimensions({ width: note.width, height: note.height });
      resizeDimensions.current = { width: note.width, height: note.height };
    }
    // Reset the flag after a frame to allow future syncs
    if (justFinishedResizing.current) {
      const timeout = setTimeout(() => {
        justFinishedResizing.current = false;
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [note.width, note.height, isResizing]);

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

  // Note dragging logic
  const handleNoteDragStart = (e) => {
    // Don't drag when interacting with controls, textareas, inputs, or buttons
    if (
      e.target.tagName === "TEXTAREA" ||
      e.target.tagName === "INPUT" ||
      e.target.tagName === "BUTTON" ||
      e.target.closest("button") || // Check if click is inside a button
      e.target.closest(".MuiIconButton-root") // Check for Material-UI icon buttons
    ) {
      return;
    }

    e.stopPropagation();
    e.preventDefault(); // Prevent default to avoid any browser drag behavior
    onBringToFront(note.id); // Bring this note to front when starting to drag
    setIsDraggingNote(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartNotePos.current = { ...position };
  };

  useEffect(() => {
    if (!isDraggingNote) return;

    const handleMouseMove = (e) => {
      e.preventDefault();
      const deltaX = (e.clientX - dragStartPos.current.x) / scale;
      const deltaY = (e.clientY - dragStartPos.current.y) / scale;

      const newPosition = {
        x: dragStartNotePos.current.x + deltaX,
        y: dragStartNotePos.current.y + deltaY,
      };

      setPosition(newPosition);
      onUpdate(note.id, { position: newPosition });
    };

    const handleMouseUp = (e) => {
      e.preventDefault();
      setIsDraggingNote(false);
    };

    // Also handle mouse leaving the window to prevent stuck drag state
    const handleMouseLeave = (e) => {
      // Only end drag if mouse actually leaves the document
      if (e.relatedTarget === null) {
        setIsDraggingNote(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isDraggingNote, scale, note.id, onUpdate, position]);

  // Resize logic with scale correction
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onBringToFront(note.id); // Bring this note to front when starting to resize
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      // Calculate delta and divide by scale to get "world space" delta
      const deltaX = (moveEvent.clientX - startX) / scale;
      const deltaY = (moveEvent.clientY - startY) / scale;

      let newWidth = Math.max(200, startWidth + deltaX);
      let newHeight = Math.max(150, startHeight + deltaY);

      // For images, maintain aspect ratio
      if (note.type === "image" && note.aspectRatio) {
        // Use the larger delta to determine the new size while maintaining aspect ratio
        const widthBasedHeight = newWidth / note.aspectRatio;
        const heightBasedWidth = newHeight * note.aspectRatio;

        // Choose the dimension that gives the larger overall size
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          newHeight = widthBasedHeight;
        } else {
          newWidth = heightBasedWidth;
        }

        // Ensure minimum sizes are respected
        if (newWidth < 100) {
          newWidth = 100;
          newHeight = newWidth / note.aspectRatio;
        }
        if (newHeight < 100) {
          newHeight = 100;
          newWidth = newHeight * note.aspectRatio;
        }
      }

      // Update local state immediately for smooth resizing
      resizeDimensions.current = { width: newWidth, height: newHeight };
      setDimensions({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = (upEvent) => {
      upEvent.preventDefault();

      // Update parent state first
      onUpdate(note.id, {
        width: resizeDimensions.current.width,
        height: resizeDimensions.current.height,
      });

      // Set flag to prevent sync effect from overwriting
      justFinishedResizing.current = true;
      setIsResizing(false);

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };

    const handleMouseLeave = (leaveEvent) => {
      // Only end resize if mouse actually leaves the document
      if (leaveEvent.relatedTarget === null) {
        // Update parent state first
        onUpdate(note.id, {
          width: resizeDimensions.current.width,
          height: resizeDimensions.current.height,
        });

        // Set flag to prevent sync effect from overwriting
        justFinishedResizing.current = true;
        setIsResizing(false);

        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("mouseleave", handleMouseLeave);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseLeave);
  };

  return (
    <motion.div
      className="sticky-note" // Added class for click detection
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        opacity: { duration: 0.2 },
        scale: { type: "spring", stiffness: 300, damping: 25 },
      }}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        position: "absolute",
        left: position.x,
        top: position.y,
        cursor: isDraggingNote
          ? "grabbing"
          : note.type === "image"
          ? "grab"
          : "grab",
        // Remove all visual effects for images to keep them completely clean
        boxShadow: note.type === "image" ? "none" : undefined,
        border: note.type === "image" ? "none" : undefined,
        background: note.type === "image" ? "transparent" : undefined,
        userSelect: "none", // Prevent text selection during drag
        touchAction: "none", // Prevent touch scrolling during drag
        zIndex: isActive ? 1000 : 1, // Active note gets higher z-index
      }}
      // Prevent drag propagation to container (pan) when interacting with note
      onMouseDown={handleNoteDragStart}
      // Ensure mouseup is captured even if it happens on this element
      onMouseUp={(e) => {
        if (isDraggingNote) {
          e.stopPropagation();
          e.preventDefault();
          setIsDraggingNote(false);
        }
      }}
    >
      {note.type === "image" ? (
        // Image with controls - single container to prevent nesting issues
        <>
          {/* Pure image without any background */}
          <Box
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            sx={{
              width: "100%",
              height: "100%",
              position: "relative",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              overflow: "hidden",
              userSelect: "none", // Prevent text selection during drag
            }}
          >
            <img
              src={note.imageData}
              alt="Pasted content"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "fill",
                pointerEvents: "none", // Image itself doesn't capture events
                display: "block",
                border: "none",
                userSelect: "none",
                WebkitUserDrag: "none", // Prevent default image drag in webkit
              }}
              draggable={false} // Prevent default browser drag
            />

            {/* Close button for images - positioned exactly at top right corner */}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete(note.id);
              }}
              onMouseDown={(e) => {
                e.stopPropagation(); // Prevent drag when clicking close button
              }}
              sx={{
                position: "absolute",
                top: 0,
                right: 0,
                width: `${24 / scale}px`,
                height: `${24 / scale}px`,
                bgcolor: "rgba(0, 0, 0, 0.6)",
                color: "white",
                zIndex: 10,
                padding: 0,
                minWidth: "unset",
                borderRadius: `0 0 0 ${4 / scale}px`,
                opacity: isHovered ? 1 : 0,
                transition: "opacity 0.2s ease-in-out",
                pointerEvents: isHovered ? "auto" : "none",
                "&:hover": {
                  bgcolor: "rgba(0, 0, 0, 0.8)",
                },
              }}
            >
              <CloseIcon sx={{ fontSize: `${16 / scale}px` }} />
            </IconButton>

            {/* Resize Handle for images - positioned exactly at bottom right corner */}
            <Box
              onMouseDown={handleResizeStart}
              sx={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: `${24 / scale}px`,
                height: `${24 / scale}px`,
                cursor: "nwse-resize",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(0, 0, 0, 0.6)",
                borderRadius: `${4 / scale}px 0 0 0`,
                zIndex: 10,
                opacity: isHovered ? 1 : 0,
                transition: "opacity 0.2s ease-in-out",
                pointerEvents: isHovered ? "auto" : "none",
                "&:hover": {
                  bgcolor: "rgba(0, 0, 0, 0.8)",
                  opacity: 1,
                },
              }}
            >
              <Box
                sx={{
                  width: 0,
                  height: 0,
                  borderStyle: "solid",
                  borderWidth: `0 0 ${12 / scale}px ${12 / scale}px`,
                  borderColor: "transparent transparent white transparent",
                }}
              />
            </Box>
          </Box>
        </>
      ) : (
        // Text notes with Paper wrapper
        <Paper
          elevation={3}
          sx={{
            width: "100%",
            height: "100%",
            bgcolor: note.color,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            transition: isResizing ? "none" : "box-shadow 0.2s",
            "&:hover": {
              boxShadow: 6,
            },
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              p: 0.5,
              bgcolor: "rgba(0,0,0,0.05)",
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
              overflowY: "auto",
              "& .MuiInputBase-root": {
                height: "100%",
                alignItems: "flex-start",
              },
            }}
          />

          {/* Resize Handle for text notes */}
          <Box
            onMouseDown={handleResizeStart}
            sx={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 20,
              height: 20,
              cursor: "nwse-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.5,
              "&:hover": { opacity: 1 },
              zIndex: 10,
            }}
          >
            <Box
              sx={{
                width: 0,
                height: 0,
                borderStyle: "solid",
                borderWidth: "0 0 10px 10px",
                borderColor:
                  "transparent transparent rgba(0,0,0,0.3) transparent",
              }}
            />
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => handleColorClose()}
          >
            <Box sx={{ display: "flex", p: 1, gap: 1 }}>
              {NOTE_COLORS.map((color) => (
                <Box
                  key={color}
                  onClick={() => handleColorClose(color)}
                  sx={{
                    width: 24,
                    height: 24,
                    bgcolor: color,
                    borderRadius: "50%",
                    cursor: "pointer",
                    border: "1px solid #ccc",
                  }}
                />
              ))}
            </Box>
          </Menu>
        </Paper>
      )}
    </motion.div>
  );
};

export default NotesPage;
