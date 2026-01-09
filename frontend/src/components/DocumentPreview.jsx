import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Modal, IconButton, Portal, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';

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

const DocumentPreview = ({ url, type, children, forceImage = false }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  
  // Get the direct image URL
  const directUrl = getDirectImageUrl(url);

  // Reset loading/error state when URL changes or preview opens
  useEffect(() => {
    if (showPreview && directUrl) {
      setImageLoading(true);
      setImageError(false);
    }
  }, [showPreview, directUrl]);

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
    setShowModal(true);
  };

  const handleCloseModal = (event) => {
    if (event) {
      event.stopPropagation();
    }
    setShowModal(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    console.error('Image failed to load:', directUrl, '(original:', url, ')');
    setImageLoading(false);
    setImageError(true);
  };

  const isImage = forceImage || url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url?.startsWith('data:image/') || url?.includes('cloudinary') || url?.includes('imgur') || url?.includes('blob') || url?.includes('s3.');

  const renderContent = (inModal = false) => {
    const styles = inModal ? {
      maxWidth: '100%',
      maxHeight: 'calc(90vh - 100px)',
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
          {renderContent(true)}
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default DocumentPreview;
