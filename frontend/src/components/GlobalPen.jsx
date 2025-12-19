import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Paper, MenuItem, ListItemIcon, ListItemText, Portal } from '@mui/material';
import CreateIcon from '@mui/icons-material/Create';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

const GlobalPen = () => {
  const [contextMenu, setContextMenu] = useState(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Define handleCopy with useCallback so it can be used in useEffect
  const handleCopy = useCallback(async () => {
    // Note: checking isProcessing here inside useCallback might use stale closure if not in deps,
    // but ref is better for lock.
    if (document.body.getAttribute('data-is-processing') === 'true') return;
    document.body.setAttribute('data-is-processing', 'true');
    setIsProcessing(true);

    try {
      // Capture only the viewport
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
      });

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

      if (!blob) {
        toast.error('Failed to generate image');
        return;
      }

      // Ensure document has focus before writing to clipboard
      if (!document.hasFocus()) {
        window.focus();
      }

      try {
        await navigator.clipboard.write([
            new ClipboardItem({
                [blob.type]: blob
            })
        ]);
        toast.success('Copied to clipboard!');
      } catch (err) {
        console.error('Clipboard write failed:', err);
        // Fallback for NotAllowedError (focus issue)
        if (err.name === 'NotAllowedError') {
             toast.error('Please click on the page and try again.');
        } else {
             toast.error('Failed to copy to clipboard');
        }
      }

    } catch (error) {
      console.error('Screenshot failed:', error);
      toast.error('Failed to capture screen');
    } finally {
      setIsProcessing(false);
      document.body.removeAttribute('data-is-processing');
    }
  }, []);

  // Handle right-click to show menu
  useEffect(() => {
    const handleContextMenu = (event) => {
      if (isDrawingMode) return; 

      event.preventDefault();
      setContextMenu(
        contextMenu === null
          ? {
              mouseX: event.clientX + 2,
              mouseY: event.clientY - 6,
            }
          : null,
      );
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [contextMenu, isDrawingMode]);

  // Handle Keyboard Shortcuts (ESC and Ctrl+C)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isDrawingMode) {
            setIsDrawingMode(false);
            setContextMenu(null);
        } else if (contextMenu) {
            setContextMenu(null);
        }
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C')) {
          if (isDrawingMode) {
              event.preventDefault(); // Prevent default copy behavior
              handleCopy();
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawingMode, contextMenu, handleCopy]);

  // Close menu on click elsewhere
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Initialize Canvas
  useEffect(() => {
    if (isDrawingMode) {
      // Disable scrolling
      document.body.style.overflow = 'hidden';

      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'red'; // Default color
        ctx.lineWidth = 3;
        contextRef.current = ctx;

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 3;
        };
        
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            // Re-enable scrolling when cleaning up (unmount or mode change)
            document.body.style.overflow = '';
        };
      }
    } else {
        // Ensure scrolling is re-enabled if mode is false
        document.body.style.overflow = '';
    }
  }, [isDrawingMode]);

  const startDrawing = ({ nativeEvent }) => {
    if (!isDrawingMode) return;
    const { clientX, clientY } = nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(clientX, clientY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    if (!isDrawingMode) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing || !isDrawingMode) return;
    const { clientX, clientY } = nativeEvent;
    contextRef.current.lineTo(clientX, clientY);
    contextRef.current.stroke();
  };

  const handleEnableDrawing = () => {
    setIsDrawingMode(true);
    setContextMenu(null);
  };

  if (!contextMenu && !isDrawingMode) return null;

  return (
    <Portal>
        {/* Context Menu */}
        {contextMenu && (
            <Paper
                sx={{
                    position: 'fixed',
                    top: contextMenu.mouseY,
                    left: contextMenu.mouseX,
                    zIndex: 9999,
                    width: 200,
                }}
                elevation={3}
            >
                <MenuItem onClick={handleEnableDrawing}>
                    <ListItemIcon>
                        <CreateIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Draw on Screen</ListItemText>
                </MenuItem>
            </Paper>
        )}

        {/* Drawing Canvas Overlay */}
        {isDrawingMode && (
            <Box
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9998,
                    cursor: 'crosshair',
                    pointerEvents: 'auto',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Darken screen slightly
                }}
            >
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseUp={finishDrawing}
                    onMouseMove={draw}
                    onMouseLeave={finishDrawing}
                    style={{
                        display: 'block',
                        width: '100%',
                        height: '100%',
                    }}
                />
            </Box>
        )}
    </Portal>
  );
};

export default GlobalPen;
