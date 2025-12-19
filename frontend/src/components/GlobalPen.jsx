import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, MenuItem, ListItemIcon, ListItemText, Portal, Typography, IconButton, Tooltip } from '@mui/material';
import CreateIcon from '@mui/icons-material/Create';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

const GlobalPen = () => {
  const [contextMenu, setContextMenu] = useState(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle right-click to show menu
  useEffect(() => {
    const handleContextMenu = (event) => {
      // If we are already in drawing mode, maybe we don't want the menu?
      // Or maybe right click exits drawing mode?
      
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

    // We attach to window to catch it everywhere
    window.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [contextMenu, isDrawingMode]);

  // Handle Esc to cancel
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        if (isDrawingMode) {
            setIsDrawingMode(false);
            setContextMenu(null);
        } else if (contextMenu) {
            setContextMenu(null);
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isDrawingMode, contextMenu]);

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
    if (isDrawingMode && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'red'; // Default color
      ctx.lineWidth = 3;
      contextRef.current = ctx;

      // Handle resize
      const handleResize = () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 3;
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
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

  const handleCopy = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    // Hide controls
    const controls = document.getElementById('global-pen-controls');
    if (controls) controls.style.visibility = 'hidden';

    try {
      // Capture the entire body
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null, // Transparent background if possible, or default
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
            toast.error('Failed to generate image');
            setIsProcessing(false);
            if (controls) controls.style.visibility = 'visible';
            return;
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
            toast.error('Failed to copy to clipboard');
        } finally {
            setIsProcessing(false);
            if (controls) controls.style.visibility = 'visible';
        }
      }, 'image/png');

    } catch (error) {
      console.error('Screenshot failed:', error);
      toast.error('Failed to capture screen');
      setIsProcessing(false);
      if (controls) controls.style.visibility = 'visible';
    }
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
                
                {/* Controls Overlay */}
                <Paper
                    id="global-pen-controls"
                    sx={{
                        position: 'fixed',
                        top: 20,
                        right: 20,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: 1,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        zIndex: 10000, // Above canvas
                    }}
                >
                    <Typography variant="body2" sx={{ mx: 1, userSelect: 'none' }}>
                        Press ESC to exit
                    </Typography>
                    
                    <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(255,255,255,0.3)' }} />
                    
                    <Tooltip title="Copy to Clipboard">
                        <IconButton 
                            onClick={handleCopy} 
                            size="small" 
                            sx={{ color: 'white' }}
                            disabled={isProcessing}
                        >
                            <ContentCopyIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Paper>
            </Box>
        )}
    </Portal>
  );
};

export default GlobalPen;
