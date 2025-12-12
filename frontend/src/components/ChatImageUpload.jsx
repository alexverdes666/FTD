import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  LinearProgress,
  Alert,
  TextField,
  Card,
  CardMedia
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  PhotoCamera as PhotoIcon
} from '@mui/icons-material';
import chatService from '../services/chatService';

const ChatImageUpload = ({ 
  open, 
  onClose, 
  onImageUploaded, 
  conversationId,
  showCaption = true 
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    const validation = chatService.validateImageFile(file);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    // Set file and create preview
    setSelectedFile(file);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select an image to upload');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const response = await chatService.uploadImage(selectedFile, {
        conversationId,
        requestOptions: {
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(progress);
          }
        }
      });

      const uploadedImage = {
        ...response.data,
        caption: caption.trim()
      };

      if (onImageUploaded) {
        onImageUploaded(uploadedImage);
      }

      // Reset and close
      handleClose();
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.message || error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption('');
      setError(null);
      setUploadProgress(0);
      onClose();
    }
  };

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ImageIcon />
          Upload Image
        </Box>
        <IconButton onClick={handleClose} disabled={uploading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* File Selection */}
        {!selectedFile && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <PhotoIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Select an image to upload
            </Typography>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={handleSelectClick}
              size="large"
              sx={{ mt: 2 }}
            >
              Choose Image
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
              Supported: JPEG, PNG, GIF, WebP (max 50MB)
            </Typography>
          </Box>
        )}

        {/* Image Preview */}
        {selectedFile && previewUrl && (
          <Box>
            <Card sx={{ mb: 2 }}>
              <CardMedia
                component="img"
                sx={{ 
                  maxHeight: 300,
                  objectFit: 'contain',
                  bgcolor: 'grey.100'
                }}
                image={previewUrl}
                alt="Preview"
              />
            </Card>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {selectedFile.name} ({chatService.formatFileSize(selectedFile.size)})
              </Typography>
              <Button
                size="small"
                onClick={handleSelectClick}
                disabled={uploading}
              >
                Change Image
              </Button>
            </Box>

            {/* Caption Input */}
            {showCaption && (
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Caption (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={uploading}
                placeholder="Add a caption for your image..."
                sx={{ mb: 2 }}
              />
            )}
          </Box>
        )}

        {/* Upload Progress */}
        {uploading && (
          <Box sx={{ mt: 2 }}>
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

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={handleClose} 
          disabled={uploading}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload Image'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChatImageUpload; 