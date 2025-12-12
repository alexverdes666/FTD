import React, { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardMedia,
  IconButton,
  Typography,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Skeleton,
  Tooltip,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Error as ErrorIcon,
  Image as ImagePlaceholderIcon
} from '@mui/icons-material';
import chatService from '../services/chatService';

const ChatImageMessage = ({ 
  message, 
  isOwnMessage = false,
  onImageClick,
  showInfo = true,
  maxWidth = 300,
  maxHeight = 200
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showImageInfo, setShowImageInfo] = useState(false);
  const [imageInfo, setImageInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const imageRef = useRef();

  // Extract image data from message
  const attachment = message.attachment;
  const imageId = attachment?.filename;
  const thumbnailUrl = imageId ? chatService.getThumbnailUrl(imageId) : null;
  const fullImageUrl = imageId ? chatService.getImageUrl(imageId) : null;

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  const handleImageClick = () => {
    if (onImageClick) {
      onImageClick(message, fullImageUrl);
    } else {
      setShowFullscreen(true);
    }
  };

  const handleDownload = async () => {
    if (!fullImageUrl || !attachment) return;

    try {
      const response = await fetch(fullImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName || 'image';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const handleShowInfo = async () => {
    if (!imageId) return;

    setLoadingInfo(true);
    try {
      const response = await chatService.getImageInfo(imageId);
      setImageInfo(response.data);
      setShowImageInfo(true);
    } catch (error) {
      console.error('Error loading image info:', error);
    } finally {
      setLoadingInfo(false);
    }
  };

  if (!attachment || !imageId) {
    return (
      <Alert severity="error" variant="outlined" sx={{ maxWidth: 200 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon fontSize="small" />
          <Typography variant="body2">
            Image not found
          </Typography>
        </Box>
      </Alert>
    );
  }

  return (
    <>
      <Card
        sx={{
          maxWidth,
          cursor: 'pointer',
          transition: 'transform 0.2s ease',
          '&:hover': {
            transform: 'scale(1.02)'
          }
        }}
        onClick={handleImageClick}
      >
        <Box sx={{ position: 'relative' }}>
          {/* Loading skeleton */}
          {!imageLoaded && (
            <Skeleton
              variant="rectangular"
              width="100%"
              height={maxHeight}
              animation="wave"
            />
          )}

          {/* Error state */}
          {imageError && (
            <Box
              sx={{
                width: '100%',
                height: maxHeight,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.100',
                color: 'text.secondary'
              }}
            >
              <ImagePlaceholderIcon sx={{ fontSize: 48, mb: 1 }} />
              <Typography variant="caption">
                Image failed to load
              </Typography>
            </Box>
          )}

          {/* Main image */}
          {thumbnailUrl && !imageError && (
            <CardMedia
              component="img"
              ref={imageRef}
              image={thumbnailUrl}
              alt={attachment.originalName || 'Chat image'}
              onLoad={handleImageLoad}
              onError={handleImageError}
              sx={{
                maxHeight,
                objectFit: 'cover',
                display: imageLoaded ? 'block' : 'none'
              }}
            />
          )}

          {/* Overlay buttons */}
          {imageLoaded && !imageError && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                display: 'flex',
                gap: 0.5,
                opacity: 0,
                transition: 'opacity 0.2s ease',
                '.MuiCard-root:hover &': {
                  opacity: 1
                }
              }}
            >
              <Tooltip title="View full size">
                <IconButton
                  size="small"
                  sx={{
                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.8)'
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullscreen(true);
                  }}
                >
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Download">
                <IconButton
                  size="small"
                  sx={{
                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.8)'
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {showInfo && (
                <Tooltip title="Image info">
                  <IconButton
                    size="small"
                    sx={{
                      bgcolor: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.8)'
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShowInfo();
                    }}
                    disabled={loadingInfo}
                  >
                    {loadingInfo ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <InfoIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}

          {/* File size chip */}
          {attachment.size && imageLoaded && !imageError && (
            <Chip
              label={chatService.formatFileSize(attachment.size)}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                bgcolor: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                fontSize: '0.75rem'
              }}
            />
          )}
        </Box>

        {/* Caption */}
        {message.content && message.content !== `📷 ${attachment.originalName}` && (
          <Box sx={{ p: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {message.content}
            </Typography>
          </Box>
        )}
      </Card>

      {/* Fullscreen Dialog */}
      <Dialog
        open={showFullscreen}
        onClose={() => setShowFullscreen(false)}
        maxWidth={false}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.9)',
            boxShadow: 'none',
            borderRadius: 0,
            m: 0,
            maxWidth: '100vw',
            maxHeight: '100vh'
          }
        }}
        TransitionProps={{
          timeout: 300
        }}
      >
        <DialogContent
          sx={{
            p: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            position: 'relative'
          }}
        >
          <IconButton
            onClick={() => setShowFullscreen(false)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.7)'
              },
              zIndex: 1
            }}
          >
            <CloseIcon />
          </IconButton>

          {fullImageUrl && (
            <img
              src={fullImageUrl}
              alt={attachment.originalName || 'Chat image'}
              style={{
                maxWidth: '95vw',
                maxHeight: '95vh',
                objectFit: 'contain'
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Image Info Dialog */}
      <Dialog
        open={showImageInfo}
        onClose={() => setShowImageInfo(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogContent>
          {imageInfo && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Image Information
              </Typography>
              
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
                <Typography variant="body2">
                  <strong>Original Name:</strong>
                </Typography>
                <Typography variant="body2">
                  {imageInfo.originalName}
                </Typography>

                <Typography variant="body2">
                  <strong>Format:</strong>
                </Typography>
                <Typography variant="body2">
                  {imageInfo.mimetype}
                </Typography>

                <Typography variant="body2">
                  <strong>Dimensions:</strong>
                </Typography>
                <Typography variant="body2">
                  {imageInfo.width} × {imageInfo.height}
                </Typography>

                <Typography variant="body2">
                  <strong>File Size:</strong>
                </Typography>
                <Typography variant="body2">
                  {imageInfo.formattedSize}
                </Typography>

                <Typography variant="body2">
                  <strong>Uploaded:</strong>
                </Typography>
                <Typography variant="body2">
                  {new Date(imageInfo.createdAt).toLocaleString()}
                </Typography>

                {imageInfo.compression?.resized && (
                  <>
                    <Typography variant="body2">
                      <strong>Resized:</strong>
                    </Typography>
                    <Typography variant="body2">
                      Yes ({imageInfo.compression.quality}% quality)
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImageInfo(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ChatImageMessage; 