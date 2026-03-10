import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Paper, Typography, Modal, IconButton, Portal, CircularProgress, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import CancelIcon from '@mui/icons-material/Cancel';

// Global image cache to track preloaded images across all DocumentPreview instances
const imageCache = new Map(); // url -> 'loading' | 'loaded' | 'error'
const imageCacheListeners = new Map(); // url -> Set of callbacks

const PreviewPopup = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  zIndex: 1400, // Higher than MUI Dialog (1300) to ensure visibility
  padding: theme.spacing(2),
  maxWidth: '400px',
  maxHeight: '400px',
  minWidth: '200px',
  minHeight: '150px',
  overflow: 'auto',
  boxShadow: theme.shadows[8],
  backgroundColor: theme.palette.background.paper,
  animation: 'fadeIn 0.2s ease-in-out',
  '@keyframes fadeIn': {
    from: {
      opacity: 0,
      transform: 'translateY(-10px)'
    },
    to: {
      opacity: 1,
      transform: 'translateY(0)'
    }
  }
}));

const ModalContent = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  padding: theme.spacing(3),
  maxWidth: '90vw',
  maxHeight: '90vh',
  overflow: 'auto',
  outline: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
}));

const ImagePlaceholder = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: theme.palette.action.focus,
  }
}));

const LoadingContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '150px',
  gap: '8px',
});

const ErrorContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '150px',
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
}));

// Extract Google Drive file ID from various URL formats
const getGoogleDriveFileId = (url) => {
  if (!url) return null;
  
  // Format: https://drive.google.com/file/d/FILE_ID/view
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (fileMatch) return fileMatch[1];
  
  // Format: https://drive.google.com/open?id=FILE_ID
  const openMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (openMatch) return openMatch[1];
  
  // Format: https://drive.google.com/uc?export=view&id=FILE_ID
  const ucMatch = url.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (ucMatch) return ucMatch[1];
  
  // Format: https://drive.google.com/thumbnail?id=FILE_ID
  const thumbMatch = url.match(/drive\.google\.com\/thumbnail\?.*id=([^&]+)/);
  if (thumbMatch) return thumbMatch[1];
  
  return null;
};

// Convert Google Drive sharing URLs to direct image URLs
// Uses Google's lh3.googleusercontent.com CDN which works for embedding
const getDirectImageUrl = (url) => {
  if (!url) return url;
  
  const fileId = getGoogleDriveFileId(url);
  if (fileId) {
    // Use lh3.googleusercontent.com - Google's image CDN
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  
  return url;
};

// Preload an image and update the cache
const preloadImage = (url) => {
  if (!url || imageCache.has(url)) return;
  
  imageCache.set(url, 'loading');
  
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  
  img.onload = () => {
    imageCache.set(url, 'loaded');
    // Notify all listeners
    const listeners = imageCacheListeners.get(url);
    if (listeners) {
      listeners.forEach(cb => cb('loaded'));
      imageCacheListeners.delete(url);
    }
  };
  
  img.onerror = () => {
    imageCache.set(url, 'error');
    // Notify all listeners
    const listeners = imageCacheListeners.get(url);
    if (listeners) {
      listeners.forEach(cb => cb('error'));
      imageCacheListeners.delete(url);
    }
  };
  
  // Start loading with low priority to not block main content
  img.fetchPriority = 'low';
  img.src = url;
};

// Subscribe to image cache updates
const subscribeToImageCache = (url, callback) => {
  if (!imageCacheListeners.has(url)) {
    imageCacheListeners.set(url, new Set());
  }
  imageCacheListeners.get(url).add(callback);
  
  return () => {
    const listeners = imageCacheListeners.get(url);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        imageCacheListeners.delete(url);
      }
    }
  };
};

const DocumentPreview = ({ url, type, children, forceImage = false }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Get the direct image URL - memoized to prevent unnecessary recalculations
  const directUrl = useMemo(() => getDirectImageUrl(url), [url]);

  // Check if this URL is considered an image
  const isImage = useMemo(() => {
    return forceImage ||
      url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
      url?.startsWith('data:image/') ||
      url?.includes('cloudinary') ||
      url?.includes('imgur') ||
      url?.includes('blob') ||
      url?.includes('s3.');
  }, [url, forceImage]);

  // Preload image on mount and sync with cache
  useEffect(() => {
    if (!directUrl || !isImage) return;

    // Check if already resolved in cache
    const cachedStatus = imageCache.get(directUrl);
    if (cachedStatus === 'loaded') {
      setImageLoading(false);
      setImageError(false);
      return;
    } else if (cachedStatus === 'error') {
      setImageLoading(false);
      setImageError(true);
      return;
    }

    // Subscribe to cache updates for in-progress or new preloads
    const unsubscribe = subscribeToImageCache(directUrl, (status) => {
      if (status === 'loaded') {
        setImageLoading(false);
        setImageError(false);
      } else if (status === 'error') {
        setImageLoading(false);
        setImageError(true);
      }
    });

    // Start preloading if not already in progress
    if (!cachedStatus) {
      preloadImage(directUrl);
    }

    return unsubscribe;
  }, [directUrl, isImage]);

  const handleMouseEnter = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    let yPos = rect.top;
    let xPos = rect.right + 10;
    if (rect.top + 400 > viewportHeight) {
      yPos = rect.bottom - 400;
    }
    // Ensure popup doesn't go off the right edge
    if (xPos + 400 > viewportWidth) {
      xPos = rect.left - 410;
    }
    setPosition({
      x: xPos,
      y: Math.max(10, yPos),
    });
    setShowPreview(true);
  };

  const handleMouseLeave = () => {
    setShowPreview(false);
  };

  const handleClick = (event) => {
    event.preventDefault();
    // If image failed to load (e.g. password-protected archive), open original URL directly
    if (imageError && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setShowPreview(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setShowModal(true);
  };

  const handleCloseModal = (event) => {
    if (event) {
      event.stopPropagation();
    }
    setShowPreview(false);
    setShowModal(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    setZoom((prev) => {
      const next = Math.min(Math.max(prev + (event.deltaY > 0 ? -0.1 : 0.1), 0.2), 5);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((event) => {
    if (zoom <= 1) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
  }, [zoom, pan]);

  const handleMouseMove = useCallback((event) => {
    if (!isDragging) return;
    event.preventDefault();
    setPan({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach global mouse events during drag to prevent losing the drag when mouse leaves container
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, dragStart]);

  const handleDownload = useCallback(async (event) => {
    event.stopPropagation();
    const downloadUrl = directUrl || url;
    if (!downloadUrl) return;
    try {
      const response = await fetch(downloadUrl, { mode: 'cors', referrerPolicy: 'no-referrer' });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = type || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab if CORS blocks download
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    }
  }, [directUrl, url, type]);

  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageError(false);
    // Update cache
    if (directUrl) {
      imageCache.set(directUrl, 'loaded');
    }
  }, [directUrl]);

  const handleImageError = useCallback(() => {
    console.error('Image failed to load:', directUrl, '(original:', url, ')');
    setImageLoading(false);
    setImageError(true);
    // Update cache
    if (directUrl) {
      imageCache.set(directUrl, 'error');
    }
  }, [directUrl, url]);

  const renderContent = (inModal = false) => {
    const styles = inModal ? {
      maxWidth: '80vw',
      maxHeight: 'calc(85vh - 100px)',
      objectFit: 'contain',
      display: imageLoading ? 'none' : 'block',
    } : {
      maxWidth: '100%',
      maxHeight: '360px',
      objectFit: 'contain',
      display: imageLoading ? 'none' : 'block',
    };

    if (!isImage) {
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom color="text.primary">
            {type} Document
          </Typography>
          <Typography variant="body2" component="div" color="text.primary">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              View Document
            </a>
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        {imageLoading && !imageError && (
          <LoadingContainer>
            <CircularProgress size={24} />
            <Typography variant="caption" color="text.secondary">
              Loading {type}...
            </Typography>
          </LoadingContainer>
        )}
        {imageError && (
          <ErrorContainer>
            <BrokenImageIcon sx={{ fontSize: 48 }} />
            <Typography variant="body2">
              Failed to load image
            </Typography>
            <Typography
              variant="caption"
              component="a"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'primary.main', textDecoration: 'underline' }}
            >
              Open in new tab
            </Typography>
          </ErrorContainer>
        )}
        <img
          key={directUrl} // Force remount when URL changes
          src={directUrl}
          alt={type}
          loading="lazy"
          style={styles}
          onLoad={handleImageLoad}
          onError={handleImageError}
          referrerPolicy="no-referrer"
        />
      </Box>
    );
  };

  // If children are provided, use them; otherwise fall back to default rendering
  const renderTrigger = () => {
    if (children) {
      // Show error badge overlay on children when image failed to load
      if (imageError) {
        return (
          <Tooltip title="Click to open link in new tab" arrow>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              {children}
              <CancelIcon
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  fontSize: 10,
                  color: 'error.main',
                  backgroundColor: 'background.paper',
                  borderRadius: '50%',
                }}
              />
            </Box>
          </Tooltip>
        );
      }
      return children;
    }
    if (isImage) {
      return (
        <ImagePlaceholder>
          <ImageIcon fontSize="small" />
          <Typography variant="body2">
            {type || 'View Image'}
          </Typography>
        </ImagePlaceholder>
      );
    }
    return (
      <Typography variant="body2" color="primary" sx={{ textDecoration: 'underline' }}>
        {type || 'View Document'}
      </Typography>
    );
  };

  return (
    <Box
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      sx={{ display: 'inline-block', cursor: 'pointer' }}
    >
      {renderTrigger()}
      {showPreview && directUrl && (
        <Portal>
          <PreviewPopup
            style={{
              left: position.x,
              top: position.y,
            }}
          >
            {renderContent()}
          </PreviewPopup>
        </Portal>
      )}
      <Modal
        open={showModal}
        onClose={handleCloseModal}
        aria-labelledby="document-preview-modal"
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
      >
        <ModalContent>
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            pb: 1
          }}>
            <Typography variant="h6" component="h2" color="text.primary">
              {type}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {zoom !== 1 && (
                <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                  {Math.round(zoom * 100)}%
                </Typography>
              )}
              <Tooltip title="Download" arrow>
                <IconButton
                  onClick={handleDownload}
                  size="small"
                  sx={{
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <IconButton
                onClick={handleCloseModal}
                size="small"
                sx={{
                  color: 'text.primary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
          <Box
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            sx={{
              overflow: 'hidden',
              maxHeight: 'calc(90vh - 100px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              userSelect: 'none',
            }}
          >
            <Box sx={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}>
              {renderContent(true)}
            </Box>
          </Box>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default React.memo(DocumentPreview);
