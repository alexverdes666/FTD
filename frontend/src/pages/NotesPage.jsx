import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Paper,
  IconButton,
  TextField,
  Menu,
  MenuItem,
  Fab,
  Typography,
} from "@mui/material";
import {
  Close as CloseIcon,
  Palette as PaletteIcon,
  NoteAdd as NoteAddIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import { toast } from "react-hot-toast";

const NotesPage = () => {
  const [notes, setNotes] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [activeNoteId, setActiveNoteId] = useState(null); // Track which note is being interacted with

  // View state: translation (x, y) and scale for infinite canvas effect
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Connection state
  const [tempConnection, setTempConnection] = useState(null);

  // Fetch notes on mount
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await api.get("/sticky-notes");
        if (response.data.success) {
          setNotes(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch notes", error);
        toast.error("Failed to load notes");
      }
    };
    fetchNotes();
  }, []);

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
            img.onload = async () => {
              const aspectRatio = img.naturalWidth / img.naturalHeight;
              const maxWidth = 400;
              let width = Math.min(maxWidth, img.naturalWidth);
              let height = width / aspectRatio;

              // Create a new image note with proper aspect ratio
              const newNoteData = {
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

              try {
                const response = await api.post("/sticky-notes", newNoteData);
                if (response.data.success) {
                  setNotes((prevNotes) => [...prevNotes, response.data.data]);
                }
              } catch (error) {
                console.error("Failed to save image note", error);
                toast.error("Failed to save image note");
              }
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
    if (e.target.closest(".sticky-note") || e.target.closest(".connection-handle")) return;

    if (e.button === 0) {
      // Left click
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  };

  const getCanvasCoordinates = (clientX, clientY) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
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

    if (tempConnection) {
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        setTempConnection(prev => ({ ...prev, endPoint: coords }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (tempConnection) {
        setTempConnection(null);
    }
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

  const addNote = async (initialPosition) => {
    let position;
    
    // Check if initialPosition is a coordinates object (has x property)
    // If it's an event (from click handler) or undefined, calculate center
    if (initialPosition && typeof initialPosition.x === 'number') {
      position = initialPosition;
    } else {
      // Calculate center of viewport
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerCoords = getCanvasCoordinates(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
        // Center the note (default width/height is 250)
        position = {
          x: centerCoords.x - 125,
          y: centerCoords.y - 125,
        };
      } else {
        position = {
          x: 100 + notes.length * 30,
          y: 100 + notes.length * 30,
        };
      }
    }

    const newNoteData = {
      type: "text",
      text: "",
      color: "#FFF740", // Default Classic Yellow
      width: 250,
      height: 250,
      fontSize: 16,
      isBold: false,
      textAlign: "left",
      position: position,
      connections: [],
    };

    try {
      const response = await api.post("/sticky-notes", newNoteData);
      if (response.data.success) {
        setNotes([...notes, response.data.data]);
        handleCloseContextMenu();
      }
    } catch (error) {
      console.error("Failed to create note", error);
      toast.error("Failed to create note");
    }
  };

  // Updates local state immediately for UI responsiveness
  const updateNote = useCallback((id, updates) => {
    setNotes((prevNotes) =>
      prevNotes.map((note) => (note.id === id ? { ...note, ...updates } : note))
    );
  }, []);

  // Persists changes to the database
  const saveNote = useCallback(async (id, updates) => {
    try {
      const response = await api.put(`/sticky-notes/${id}`, updates);
      if (response.data.success) {
        // refined: removed toast success message as per user request
      }
    } catch (error) {
      console.error("Failed to save note", error);
      toast.error("Failed to save note");
    }
  }, []);

  const deleteNote = async (id) => {
    try {
      await api.delete(`/sticky-notes/${id}`);
      setNotes(notes.filter((note) => note.id !== id));
    } catch (error) {
      console.error("Failed to delete note", error);
      toast.error("Failed to delete note");
    }
  };

  const bringToFront = (id) => {
    setActiveNoteId(id);
  };

  // Connection Logic
  const handleConnectionStart = (e, noteId, handle) => {
    e.stopPropagation();
    e.preventDefault();
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    setTempConnection({
      startNoteId: noteId,
      startHandle: handle,
      endPoint: coords
    });
  };

  const handleConnectionComplete = async (e, targetNoteId, targetHandle) => {
    e.stopPropagation();
    e.preventDefault();

    if (!tempConnection) return;
    if (tempConnection.startNoteId === targetNoteId) {
        setTempConnection(null);
        return;
    }

    const startNote = notes.find(n => n.id === tempConnection.startNoteId);
    if (!startNote) return;

    // Create new connection object
    const newConnection = {
        targetId: targetNoteId,
        sourceHandle: tempConnection.startHandle,
        targetHandle: targetHandle
    };

    // Check if connection already exists
    const exists = startNote.connections?.some(
        c => c.targetId === targetNoteId && 
             c.sourceHandle === tempConnection.startHandle && 
             c.targetHandle === targetHandle
    );

    if (!exists) {
        const updatedConnections = [...(startNote.connections || []), newConnection];
        updateNote(startNote.id, { connections: updatedConnections });
        await saveNote(startNote.id, { connections: updatedConnections });
    }

    setTempConnection(null);
  };

  const getHandlePosition = (note, side) => {
    if (!note) return { x: 0, y: 0 };
    const y = note.position.y + note.height / 2;
    const x = side === 'left' ? note.position.x : note.position.x + note.width;
    return { x, y };
  };

  const generatePath = (start, end, startSide, endSide) => {
     // Orthogonal routing: Horizontal -> Vertical -> Horizontal
     // This mimics "move up and down but not vertically" (step behavior)
     const offset = 30; // Distance to go out before turning

     let path = `M ${start.x} ${start.y}`;

     // Calculate intermediate points
     // Strategy: Go out from start handle, then go vertical to match end handle Y, then go horizontal to end handle.
     // If end handle is on the "wrong" side (e.g. Right -> Right), we need extra steps.
     
     // Determine "out" direction
     const startDir = startSide === 'left' ? -1 : 1;
     const endDir = endSide === 'left' ? -1 : 1;

     const p1 = { x: start.x + offset * startDir, y: start.y };
     const p2 = { x: end.x + offset * endDir, y: end.y };

     // Middle X for vertical segment
     let midX = (p1.x + p2.x) / 2;

     // Simple orthogonal path:
     // Start -> P1 -> (midX, P1.y) -> (midX, P2.y) -> P2 -> End
     
     // However, if we are connecting close notes or overlapping, simple midpoint might be weird.
     // But for "Upload Labs" style, usually it's strict steps.
     
     path += ` L ${p1.x} ${p1.y}`;
     path += ` L ${midX} ${p1.y}`;
     path += ` L ${midX} ${p2.y}`;
     path += ` L ${p2.x} ${p2.y}`;
     path += ` L ${end.x} ${end.y}`;

     return path;
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
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: "100%",
            minWidth: "2000px",
            minHeight: "2000px",
          }}
        >
          {/* SVG Connections Layer */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
              zIndex: 0
            }}
          >
            {/* Existing Connections */}
            {notes.map(note => (
                note.connections && note.connections.map((conn, idx) => {
                    const targetNote = notes.find(n => n.id === conn.targetId);
                    if (!targetNote) return null;
                    const startPos = getHandlePosition(note, conn.sourceHandle);
                    const endPos = getHandlePosition(targetNote, conn.targetHandle);
                    return (
                        <path
                            key={`${note.id}-${idx}`}
                            d={generatePath(startPos, endPos, conn.sourceHandle, conn.targetHandle)}
                            stroke="#333"
                            strokeWidth="4"
                            fill="none"
                        />
                    );
                })
            ))}
            
            {/* Temporary Connection */}
            {tempConnection && (() => {
                const startNote = notes.find(n => n.id === tempConnection.startNoteId);
                if (!startNote) return null;
                const startPos = getHandlePosition(startNote, tempConnection.startHandle);
                const endPos = tempConnection.endPoint;
                // Guess end side based on relative position or just use opposite of start?
                // For drawing, we can assume 'right' if cursor is to right, etc.
                // Or just assume 'right' for end if unknown.
                // Actually, let's just use the logic:
                const endSide = endPos.x > startPos.x ? 'left' : 'right';
                
                return (
                    <path
                        d={generatePath(startPos, endPos, tempConnection.startHandle, endSide)}
                        stroke="#333"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray="5,5"
                    />
                );
            })()}
          </svg>

          <AnimatePresence>
            {notes.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                scale={view.scale}
                onUpdate={updateNote}
                onSave={saveNote}
                onDelete={deleteNote}
                onBringToFront={bringToFront}
                isActive={activeNoteId === note.id}
                onConnectionStart={handleConnectionStart}
                onConnectionComplete={handleConnectionComplete}
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
        <MenuItem 
          onClick={() => {
            if (contextMenu) {
              const coords = getCanvasCoordinates(contextMenu.mouseX, contextMenu.mouseY);
              addNote(coords);
            }
          }}
        >
          <NoteAddIcon sx={{ mr: 1 }} /> Add Note
        </MenuItem>
      </Menu>

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
  onSave,
  onDelete,
  onBringToFront,
  isActive,
  onConnectionStart,
  onConnectionComplete,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [isDraggingNote, setIsDraggingNote] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState(() => {
    return note.position || { x: 0, y: 0 };
  });
  const [dimensions, setDimensions] = useState({
    width: note.width,
    height: note.height,
  });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartNotePos = useRef({ x: 0, y: 0 });
  const resizeDimensions = useRef({ width: note.width, height: note.height });

  useEffect(() => {
    if (!isResizing) {
      setDimensions({ width: note.width, height: note.height });
      resizeDimensions.current = { width: note.width, height: note.height };
    }
  }, [note.width, note.height, isResizing]);

  useEffect(() => {
    if (!isDraggingNote) {
      setPosition(note.position || { x: 0, y: 0 });
    }
  }, [note.position, isDraggingNote]);

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    onUpdate(note.id, { color: newColor });
  };

  const handleColorSave = (e) => {
    const newColor = e.target.value;
    onSave(note.id, { color: newColor });
  };

  const handleFontSizeChange = (delta) => {
    const currentSize = note.fontSize || 16;
    const newSize = Math.max(8, Math.min(72, currentSize + delta));
    onUpdate(note.id, { fontSize: newSize });
    onSave(note.id, { fontSize: newSize });
  };

  const handleBoldToggle = () => {
    const newBold = !note.isBold;
    onUpdate(note.id, { isBold: newBold });
    onSave(note.id, { isBold: newBold });
  };

  const handleAlignToggle = () => {
    const newAlign = note.textAlign === "center" ? "left" : "center";
    onUpdate(note.id, { textAlign: newAlign });
    onSave(note.id, { textAlign: newAlign });
  };

  const handleNoteDragStart = (e) => {
    if (
      e.target.tagName === "TEXTAREA" ||
      e.target.tagName === "INPUT" ||
      e.target.tagName === "BUTTON" ||
      e.target.closest("button") || 
      e.target.closest(".MuiIconButton-root") ||
      e.target.closest(".connection-handle") // Don't drag note when clicking handle
    ) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    onBringToFront(note.id);
    setIsDraggingNote(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartNotePos.current = { ...position };
  };

  useEffect(() => {
    if (!isDraggingNote) return;

    const handleMouseMove = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDraggingNote) return;

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
      if (!isDraggingNote) return;

      setIsDraggingNote(false);

      const deltaX = (e.clientX - dragStartPos.current.x) / scale;
      const deltaY = (e.clientY - dragStartPos.current.y) / scale;
      
      const finalPosition = {
        x: dragStartNotePos.current.x + deltaX,
        y: dragStartNotePos.current.y + deltaY,
      };

      onUpdate(note.id, { position: finalPosition });
      onSave(note.id, { position: finalPosition });
    };

    const handleMouseLeave = (e) => {
      if (e.relatedTarget === null && isDraggingNote) {
        setIsDraggingNote(false);
        const deltaX = (e.clientX - dragStartPos.current.x) / scale;
        const deltaY = (e.clientY - dragStartPos.current.y) / scale;
        const finalPosition = {
          x: dragStartNotePos.current.x + deltaX,
          y: dragStartNotePos.current.y + deltaY,
        };
        onUpdate(note.id, { position: finalPosition });
        onSave(note.id, { position: finalPosition });
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { capture: true });
    window.addEventListener("mouseup", handleMouseUp, { capture: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove, { capture: true });
      window.removeEventListener("mouseup", handleMouseUp, { capture: true });
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isDraggingNote, scale, note.id, onUpdate, onSave]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onBringToFront(note.id);
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;

    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaX = (moveEvent.clientX - startX) / scale;
      const deltaY = (moveEvent.clientY - startY) / scale;

      let newWidth = Math.max(200, startWidth + deltaX);
      let newHeight = Math.max(150, startHeight + deltaY);

      if (note.type === "image" && note.aspectRatio) {
        const widthBasedHeight = newWidth / note.aspectRatio;
        const heightBasedWidth = newHeight * note.aspectRatio;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          newHeight = widthBasedHeight;
        } else {
          newWidth = heightBasedWidth;
        }

        if (newWidth < 100) {
          newWidth = 100;
          newHeight = newWidth / note.aspectRatio;
        }
        if (newHeight < 100) {
          newHeight = 100;
          newWidth = newHeight * note.aspectRatio;
        }
      }

      resizeDimensions.current = { width: newWidth, height: newHeight };
      setDimensions({ width: newWidth, height: newHeight });
      onUpdate(note.id, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = (upEvent) => {
      upEvent.preventDefault();

      const finalUpdates = {
        width: resizeDimensions.current.width,
        height: resizeDimensions.current.height,
      };

      onUpdate(note.id, finalUpdates);
      onSave(note.id, finalUpdates);

      setIsResizing(false);

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };

    const handleMouseLeave = (leaveEvent) => {
      if (leaveEvent.relatedTarget === null) {
        const finalUpdates = {
          width: resizeDimensions.current.width,
          height: resizeDimensions.current.height,
        };

        onUpdate(note.id, finalUpdates);
        onSave(note.id, finalUpdates);

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
      className="sticky-note"
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
          : "grab",
        boxShadow: note.type === "image" ? "none" : undefined,
        border: note.type === "image" ? "none" : undefined,
        background: note.type === "image" ? "transparent" : undefined,
        userSelect: "none",
        touchAction: "none",
        zIndex: isActive ? 1000 : 1,
      }}
      onMouseDown={handleNoteDragStart}
    >
      {/* Connection Handles */}
      <Box
         className="connection-handle left"
         onMouseDown={(e) => onConnectionStart(e, note.id, 'left')}
         onMouseUp={(e) => onConnectionComplete(e, note.id, 'left')}
         sx={{
           position: 'absolute',
           left: -8,
           top: '50%',
           transform: 'translateY(-50%)',
           width: 16,
           height: 16,
           borderRadius: '50%',
           border: '2px solid #666',
           bgcolor: 'white',
           cursor: 'crosshair',
           zIndex: 1100,
           transition: 'transform 0.2s',
           '&:hover': { transform: 'translateY(-50%) scale(1.2)', bgcolor: '#ddd' }
         }}
       />

       <Box
         className="connection-handle right"
         onMouseDown={(e) => onConnectionStart(e, note.id, 'right')}
         onMouseUp={(e) => onConnectionComplete(e, note.id, 'right')}
         sx={{
           position: 'absolute',
           right: -8,
           top: '50%',
           transform: 'translateY(-50%)',
           width: 16,
           height: 16,
           borderRadius: '50%',
           border: '2px solid #666',
           bgcolor: 'white',
           cursor: 'crosshair',
           zIndex: 1100,
           transition: 'transform 0.2s',
           '&:hover': { transform: 'translateY(-50%) scale(1.2)', bgcolor: '#ddd' }
         }}
       />

      {note.type === "image" ? (
        <>
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
              userSelect: "none",
            }}
          >
            <img
              src={note.imageData}
              alt="Pasted content"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "fill",
                pointerEvents: "none",
                display: "block",
                border: "none",
                userSelect: "none",
                WebkitUserDrag: "none",
              }}
              draggable={false}
            />

            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete(note.id);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
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
            <IconButton
              size="small"
              onClick={() => handleFontSizeChange(2)}
              title="Increase font size"
            >
              <ArrowUpIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleFontSizeChange(-2)}
              title="Decrease font size"
            >
              <ArrowDownIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleBoldToggle}
              title="Toggle Bold"
            >
              <Typography sx={{ fontWeight: "bold" }}>B</Typography>
            </IconButton>
            <IconButton
              size="small"
              onClick={handleAlignToggle}
              title="Toggle Center"
              sx={{ width: "auto", borderRadius: 1, px: 0.5 }}
            >
              <Typography variant="caption">center</Typography>
            </IconButton>
            <IconButton size="small" sx={{ position: "relative", overflow: "hidden" }}>
              <PaletteIcon fontSize="small" />
              <input
                type="color"
                value={note.color}
                onChange={handleColorChange}
                onBlur={handleColorSave}
                style={{
                  opacity: 0,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  cursor: "pointer",
                }}
              />
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
            onBlur={() => onSave(note.id, { text: note.text })}
            InputProps={{
              disableUnderline: true,
            }}
            inputProps={{
              style: {
                fontSize: note.fontSize || 16,
                fontWeight: note.isBold ? "bold" : "normal",
                textAlign: note.textAlign || "left",
                lineHeight: 1.5,
              },
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
        </Paper>
      )}
    </motion.div>
  );
};

export default NotesPage;