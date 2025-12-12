import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Avatar,
  Divider,
  Stack,
  Card,
  CardContent,
  TextField,
  IconButton,
  Collapse,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Assignment as AssignIcon,
  CheckCircle as ResolveIcon,
  Comment as CommentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { selectUser } from '../store/slices/authSlice';
import ticketsService from '../services/tickets';

const TicketDetailDialog = ({ 
  open, 
  onClose, 
  ticketId, 
  onTicketUpdate 
}) => {
  const user = useSelector(selectUser);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  
  // Image upload states
  const [uploadingImages, setUploadingImages] = useState(false);
  const [commentImages, setCommentImages] = useState([]);
  const [commentImageIds, setCommentImageIds] = useState([]);
  
  // Ticket images state
  const [ticketImages, setTicketImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // Load ticket details
  useEffect(() => {
    if (open && ticketId) {
      loadTicketDetails();
      loadTicketImages();
    }
  }, [open, ticketId]);

  const loadTicketDetails = async () => {
    try {
      setLoading(true);
      const response = await ticketsService.getTicket(ticketId);
      setTicket(response.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load ticket details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const loadTicketImages = async () => {
    try {
      setLoadingImages(true);
      const response = await ticketsService.getTicketImages(ticketId);
      if (response.success) {
        setTicketImages(response.data);
      }
    } catch (error) {
      console.error('Failed to load ticket images:', error);
      // Don't show error toast as this is not critical
    } finally {
      setLoadingImages(false);
    }
  };

  const handleCommentImageSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Validate file types
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast.error('Only JPEG, PNG, GIF, and WebP images are allowed');
      return;
    }

    // Validate file sizes (50MB max per file)
    const maxSize = 50 * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast.error('Image files must be under 50MB');
      return;
    }

    setUploadingImages(true);
    const newImageIds = [];

    try {
      for (const file of files) {
        const response = await ticketsService.uploadTicketImage(file, ticketId);
        if (response.success) {
          newImageIds.push(response.data._id);
          setCommentImages(prev => [...prev, {
            id: response.data._id,
            name: file.name,
            url: ticketsService.getTicketImageThumbnailUrl(response.data._id)
          }]);
        }
      }
      setCommentImageIds(prev => [...prev, ...newImageIds]);
      toast.success(`${files.length} image(s) uploaded successfully`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveCommentImage = async (imageId) => {
    try {
      await ticketsService.deleteTicketImage(imageId);
      setCommentImages(prev => prev.filter(img => img.id !== imageId));
      setCommentImageIds(prev => prev.filter(id => id !== imageId));
      toast.success('Image removed');
    } catch (error) {
      toast.error('Failed to remove image');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    try {
      setAddingComment(true);
      const response = await ticketsService.addComment(ticketId, {
        message: newComment.trim(),
        isInternal: false,
        imageIds: commentImageIds
      });
      setTicket(response.data);
      setNewComment('');
      setCommentImages([]);
      setCommentImageIds([]);
      
      // Reload images to show newly attached ones
      await loadTicketImages();
      
      toast.success('Comment added successfully');
      
      // Notify parent of update
      if (onTicketUpdate) {
        onTicketUpdate(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };


  const isAdmin = user?.role === 'admin';
  const isTicketOwner = ticket && ticket.createdBy._id === user?._id;

  if (!ticket && loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </DialogContent>
      </Dialog>
    );
  }

  if (!ticket) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">
            Ticket Details
          </Typography>
          {ticketsService.isTicketOverdue(ticket) && (
            <ScheduleIcon color="warning" />
          )}
        </Box>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Ticket Header */}
          <Box>
            <Typography variant="h5" gutterBottom>
              {ticket.title}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
              <Chip
                label={ticketsService.formatTicketStatus(ticket.status)}
                color={ticketsService.getStatusColor(ticket.status)}
                size="small"
              />
              <Chip
                label={ticketsService.formatTicketPriority(ticket.priority)}
                color={ticketsService.getPriorityColor(ticket.priority)}
                size="small"
              />
              <Chip
                label={ticketsService.formatTicketCategory(ticket.category)}
                variant="outlined"
                size="small"
              />
              {ticket.tags && ticket.tags.map(tag => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>

          {/* Ticket Info */}
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {ticket.createdBy.fullName?.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {ticket.createdBy.fullName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Created {ticketsService.formatTimeAgo(ticket.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssignIcon fontSize="small" color="action" />
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        Admin Handled
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Support Team
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Divider />

                <Typography variant="body1">
                  {ticket.description}
                </Typography>

                {/* Display ticket images (not associated with comments) */}
                {ticketImages.filter(img => img.commentIndex === null).length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      Attachments:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      {ticketImages
                        .filter(img => img.commentIndex === null)
                        .map((img) => (
                          <Card 
                            key={img._id} 
                            variant="outlined" 
                            sx={{ 
                              width: 120, 
                              height: 120,
                              cursor: 'pointer',
                              '&:hover': { boxShadow: 2 }
                            }}
                            onClick={() => window.open(ticketsService.getTicketImageUrl(img._id), '_blank')}
                          >
                            <CardContent sx={{ p: 0, height: '100%' }}>
                              <Box
                                component="img"
                                src={ticketsService.getTicketImageThumbnailUrl(img._id)}
                                alt={img.originalName}
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                              />
                            </CardContent>
                          </Card>
                        ))}
                    </Stack>
                  </Box>
                )}

                {ticket.dueDate && (
                  <Alert 
                    severity={ticketsService.isTicketOverdue(ticket) ? 'warning' : 'info'}
                    sx={{ mt: 2 }}
                  >
                    Due: {new Date(ticket.dueDate).toLocaleDateString()} at {new Date(ticket.dueDate).toLocaleTimeString()}
                  </Alert>
                )}

                {ticket.resolution && ticket.status === 'resolved' && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Resolved by {ticket.resolution.resolvedBy.fullName}
                    </Typography>
                    <Typography variant="body2">
                      {ticketsService.formatTimeAgo(ticket.resolution.resolvedAt)}
                    </Typography>
                    {ticket.resolution.resolutionNote && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {ticket.resolution.resolutionNote}
                      </Typography>
                    )}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Comments Section */}
          <Box>
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={() => setShowComments(!showComments)}
            >
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CommentIcon />
                Comments ({ticket.comments?.length || 0})
              </Typography>
              {showComments ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>

            <Collapse in={showComments}>
              <Stack spacing={2} sx={{ mt: 2 }}>
                {ticket.comments && ticket.comments.length > 0 ? (
                  ticket.comments.map((comment, index) => (
                    <Card key={index} variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24 }}>
                              {comment.user.fullName?.charAt(0)}
                            </Avatar>
                            <Typography variant="body2" fontWeight={600}>
                              {comment.user.fullName}
                            </Typography>
                            {comment.isInternal && (
                              <Chip label="Internal" size="small" color="warning" />
                            )}
                          </Box>
                          <Typography variant="caption" color="textSecondary">
                            {ticketsService.formatTimeAgo(comment.createdAt)}
                          </Typography>
                        </Box>
                        <Typography variant="body2">
                          {comment.message}
                        </Typography>
                        
                        {/* Display comment images */}
                        {ticketImages.filter(img => img.commentIndex === index).length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                              {ticketImages
                                .filter(img => img.commentIndex === index)
                                .map((img) => (
                                  <Card 
                                    key={img._id} 
                                    variant="outlined" 
                                    sx={{ 
                                      width: 80, 
                                      height: 80,
                                      cursor: 'pointer',
                                      '&:hover': { boxShadow: 2 }
                                    }}
                                    onClick={() => window.open(ticketsService.getTicketImageUrl(img._id), '_blank')}
                                  >
                                    <CardContent sx={{ p: 0, height: '100%' }}>
                                      <Box
                                        component="img"
                                        src={ticketsService.getTicketImageThumbnailUrl(img._id)}
                                        alt={img.originalName}
                                        sx={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover'
                                        }}
                                      />
                                    </CardContent>
                                  </Card>
                                ))}
                            </Stack>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                    No comments yet
                  </Typography>
                )}

                {/* Add Comment */}
                {(isTicketOwner || isAdmin) && ticket.status !== 'closed' && (
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <TextField
                          multiline
                          rows={3}
                          placeholder="Add a comment..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          fullWidth
                        />
                        
                        {/* Image Upload for Comment */}
                        <Box>
                          <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="comment-image-upload"
                            multiple
                            type="file"
                            onChange={handleCommentImageSelect}
                            disabled={uploadingImages}
                          />
                          <label htmlFor="comment-image-upload">
                            <Button
                              variant="outlined"
                              component="span"
                              size="small"
                              startIcon={uploadingImages ? <CircularProgress size={16} /> : <ImageIcon />}
                              disabled={uploadingImages}
                            >
                              {uploadingImages ? 'Uploading...' : 'Attach Images'}
                            </Button>
                          </label>
                          
                          {/* Display selected comment images */}
                          {commentImages.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                                {commentImages.map((img) => (
                                  <Card key={img.id} variant="outlined" sx={{ position: 'relative', width: 60, height: 60 }}>
                                    <CardContent sx={{ p: 0, height: '100%', position: 'relative' }}>
                                      <Box
                                        component="img"
                                        src={img.url}
                                        alt={img.name}
                                        sx={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover'
                                        }}
                                      />
                                      <IconButton
                                        size="small"
                                        onClick={() => handleRemoveCommentImage(img.id)}
                                        sx={{
                                          position: 'absolute',
                                          top: 0,
                                          right: 0,
                                          bgcolor: 'background.paper',
                                          padding: '2px',
                                          '&:hover': { bgcolor: 'error.light' }
                                        }}
                                      >
                                        <CloseIcon fontSize="small" sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </CardContent>
                                  </Card>
                                ))}
                              </Stack>
                            </Box>
                          )}
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Button
                            variant="contained"
                            onClick={handleAddComment}
                            disabled={addingComment || !newComment.trim()}
                            startIcon={addingComment ? <CircularProgress size={16} /> : <CommentIcon />}
                          >
                            {addingComment ? 'Adding...' : 'Add Comment'}
                          </Button>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Stack>
            </Collapse>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TicketDetailDialog;
