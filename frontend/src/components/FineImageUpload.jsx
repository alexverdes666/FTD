import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  LinearProgress,
  Alert,
  Card,
  CardMedia,
  CardActions,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import fineImagesService from '../services/fineImages';

const FineImageUpload = ({
  images = [],
  onImagesChange,
  maxImages = 5,
  disabled = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    // Check max images limit
    if (images.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    setError(null);

    for (const file of files) {
      // Validate file
      const validation = fineImagesService.validateImageFile(file);
      if (!validation.valid) {
        setError(validation.errors[0]);
        continue;
      }

      setUploading(true);
      setUploadProgress(0);

      try {
        const response = await fineImagesService.uploadFineImage(
          file,
          null,
          (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(progress);
          }
        );

        if (response.success) {
          const newImage = response.data;
          onImagesChange([...images, newImage]);
        }
      } catch (err) {
        console.error('Upload error:', err);
        setError(err.response?.data?.message || err.message || 'Upload failed');
      }
    }

    setUploading(false);
    setUploadProgress(0);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async (imageId) => {
    try {
      await fineImagesService.deleteFineImage(imageId);
      onImagesChange(images.filter((img) => img._id !== imageId));
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.response?.data?.message || 'Failed to remove image');
    }
  };

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  const getImageUrl = (image) => {
    if (image.thumbnailUrl) {
      return fineImagesService.getFineImageThumbnailUrl(image._id);
    }
    return fineImagesService.getFineImageUrl(image._id);
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Upload Progress */}
      {uploading && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Uploading... {uploadProgress}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={uploadProgress}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      )}

      {/* Image Gallery */}
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {images.map((image) => (
          <Grid item xs={4} sm={3} key={image._id}>
            <Card sx={{ position: 'relative' }}>
              <CardMedia
                component="img"
                sx={{
                  height: 100,
                  objectFit: 'cover',
                }}
                image={getImageUrl(image)}
                alt={image.originalName}
              />
              <CardActions
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  p: 0.5,
                }}
              >
                <Tooltip title="Remove image">
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveImage(image._id)}
                    disabled={disabled || uploading}
                    sx={{
                      bgcolor: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'rgba(0,0,0,0.7)',
                      },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  textAlign: 'center',
                  p: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {image.originalName}
              </Typography>
            </Card>
          </Grid>
        ))}

        {/* Add Image Button */}
        {images.length < maxImages && (
          <Grid item xs={4} sm={3}>
            <Card
              sx={{
                height: 130,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: disabled || uploading ? 'default' : 'pointer',
                border: '2px dashed',
                borderColor: 'divider',
                bgcolor: 'background.default',
                '&:hover': {
                  borderColor: disabled || uploading ? 'divider' : 'primary.main',
                  bgcolor: disabled || uploading ? 'background.default' : 'action.hover',
                },
              }}
              onClick={disabled || uploading ? undefined : handleSelectClick}
            >
              <Box textAlign="center">
                <AddIcon color={disabled || uploading ? 'disabled' : 'primary'} />
                <Typography
                  variant="caption"
                  display="block"
                  color={disabled || uploading ? 'text.disabled' : 'primary'}
                >
                  Add Image
                </Typography>
              </Box>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Upload Button (alternative) */}
      {images.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <ImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Upload evidence images for this fine
          </Typography>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={handleSelectClick}
            disabled={disabled || uploading}
            size="small"
          >
            Choose Images
          </Button>
          <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
            Supported: JPEG, PNG, GIF, WebP (max 50MB each, up to {maxImages} images)
          </Typography>
        </Box>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />
    </Box>
  );
};

export default FineImageUpload;
