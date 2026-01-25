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
  Alert,
  CircularProgress,
  alpha,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Assignment as AssignIcon,
  CheckCircle as ResolveIcon,
  Comment as CommentIcon,
  Image as ImageIcon,
  Send as SendIcon
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
  const theme = useTheme();
  const user = useSelector(selectUser);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  
  // Resolve ticket states
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);
  
  // Image upload states
  const [uploadingImages, setUploadingImages] = useState(false);
  const [commentImages, setCommentImages] = useState([]);
  const [commentImageIds, setCommentImageIds] = useState([]);
  
  // Ticket images state
  const [ticketImages, setTicketImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  
  // Image preview state
  const [previewImage, setPreviewImage] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });

  const handleImageMouseEnter = (event, img) => {
    setPreviewPosition({ x: 20, y: 20 });
    setPreviewImage(img);
  };

  const handleImageMouseLeave = () => {
    setPreviewImage(null);
  };

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

  const handleResolveTicket = async () => {
    try {
      setResolving(true);
      const response = await ticketsService.resolveTicket(ticketId, resolutionNote);
      toast.success('Ticket resolved successfully');
      setShowResolveForm(false);
      setResolutionNote('');

      // Update local ticket state with response data
      setTicket(response.data);

      // Notify parent of update with the full updated ticket
      if (onTicketUpdate) {
        onTicketUpdate(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resolve ticket');
    } finally {
      setResolving(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isTicketOwner = ticket && ticket.createdBy._id === user?._id;

  if (!ticket && loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={28} />
        </DialogContent>
      </Dialog>
    );
  }

  if (!ticket) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Ticket Details
          </Typography>
          {ticketsService.isTicketOverdue(ticket) && (
            <ScheduleIcon color="warning" fontSize="small" />
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 1.5 }}>
        <Stack spacing={1.5}>
          {/* Ticket Header */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
              {ticket.title}
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              <Chip
                label={ticketsService.formatTicketStatus(ticket.status)}
                color={ticketsService.getStatusColor(ticket.status)}
                size="small"
                sx={{ height: 22, fontSize: '0.75rem' }}
              />
              <Chip
                label={ticketsService.formatTicketPriority(ticket.priority)}
                color={ticketsService.getPriorityColor(ticket.priority)}
                size="small"
                sx={{ height: 22, fontSize: '0.75rem' }}
              />
              <Chip
                label={ticketsService.formatTicketCategory(ticket.category)}
                variant="outlined"
                size="small"
                sx={{ height: 22, fontSize: '0.75rem' }}
              />
              {ticket.tags && ticket.tags.map(tag => (
                <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.75rem' }} />
              ))}
            </Stack>
          </Box>

          {/* Ticket Info */}
          <Card variant="outlined" sx={{ bgcolor: alpha(theme.palette.background.default, 0.5) }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                      {ticket.createdBy.fullName?.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="caption" fontWeight={600} display="block" lineHeight={1.2}>
                        {ticket.createdBy.fullName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.65rem' }}>
                        {ticketsService.formatExactDateTime(ticket.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AssignIcon sx={{ fontSize: 16 }} color="action" />
                    <Typography variant="caption" fontWeight={600}>Admin Handled</Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 0.5 }} />

                <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                  {ticket.description}
                </Typography>

                {/* Display ticket images (not associated with comments) */}
                {ticketImages.filter(img => img.commentIndex === null).length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight={600}>Attachments:</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      {ticketImages
                        .filter(img => img.commentIndex === null)
                        .map((img) => (
                          <Box 
                            key={img._id} 
                            sx={{ 
                              width: 60, 
                              height: 60,
                              borderRadius: 1,
                              overflow: 'hidden',
                              cursor: 'pointer',
                              border: `1px solid ${theme.palette.divider}`,
                              '&:hover': { boxShadow: 2, borderColor: theme.palette.primary.main }
                            }}
                            onClick={() => window.open(ticketsService.getTicketImageUrl(img._id), '_blank')}
                            onMouseEnter={(e) => handleImageMouseEnter(e, img)}
                            onMouseLeave={handleImageMouseLeave}
                          >
                            <Box
                              component="img"
                              src={ticketsService.getTicketImageThumbnailUrl(img._id)}
                              alt={img.originalName}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </Box>
                        ))}
                    </Stack>
                  </Box>
                )}

                {ticket.dueDate && (
                  <Alert 
                    severity={ticketsService.isTicketOverdue(ticket) ? 'warning' : 'info'}
                    sx={{ py: 0.25, px: 1, '& .MuiAlert-message': { py: 0.5 } }}
                  >
                    <Typography variant="caption">
                      Due: {new Date(ticket.dueDate).toLocaleDateString()} at {new Date(ticket.dueDate).toLocaleTimeString()}
                    </Typography>
                  </Alert>
                )}

                {ticket.resolution && ticket.status === 'resolved' && (
                  <Alert severity="success" sx={{ py: 0.25, px: 1, '& .MuiAlert-message': { py: 0.5 } }}>
                    <Typography variant="caption" fontWeight={600}>
                      Resolved by {ticket.resolution.resolvedBy.fullName}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {ticketsService.formatExactDateTime(ticket.resolution.resolvedAt)}
                    </Typography>
                    {ticket.resolution.resolutionNote && (
                      <Typography variant="caption" display="block" sx={{ mt: 0.25 }}>
                        {ticket.resolution.resolutionNote}
                      </Typography>
                    )}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Comments Section - Chat Bubbles */}
          {ticket.comments && ticket.comments.length > 0 && (
            <Box
              sx={{
                bgcolor: alpha(theme.palette.grey[500], 0.04),
                borderRadius: 1.5,
                p: 1,
                maxHeight: 200,
                overflowY: 'auto',
                '&::-webkit-scrollbar': { width: 4 },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                  borderRadius: 2,
                },
              }}
            >
              <Stack spacing={1}>
                {ticket.comments.map((comment, index) => {
                  const isOwnComment = comment.user._id === user?._id;
                  return (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        flexDirection: isOwnComment ? 'row-reverse' : 'row',
                        gap: 0.75,
                        alignItems: 'flex-start',
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 24,
                          height: 24,
                          bgcolor: isOwnComment 
                            ? theme.palette.primary.main 
                            : theme.palette.secondary.main,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}
                      >
                        {comment.user.fullName?.charAt(0)}
                      </Avatar>
                      
                      <Box
                        sx={{
                          maxWidth: '80%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isOwnComment ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            {comment.user.fullName}
                          </Typography>
                          {comment.isInternal && (
                            <Chip 
                              label="Internal" 
                              size="small" 
                              color="warning" 
                              sx={{ height: 14, fontSize: '0.55rem', '& .MuiChip-label': { px: 0.5 } }} 
                            />
                          )}
                        </Box>
                        
                        <Box
                          sx={{
                            bgcolor: isOwnComment
                              ? theme.palette.primary.main
                              : alpha(theme.palette.grey[500], 0.1),
                            color: isOwnComment ? 'white' : 'text.primary',
                            px: 1.25,
                            py: 0.75,
                            borderRadius: 2,
                            borderTopRightRadius: isOwnComment ? 3 : 16,
                            borderTopLeftRadius: isOwnComment ? 16 : 3,
                            boxShadow: isOwnComment 
                              ? `0 1px 4px ${alpha(theme.palette.primary.main, 0.25)}`
                              : 'none',
                          }}
                        >
                          <Typography variant="caption" sx={{ lineHeight: 1.4, fontSize: '0.75rem' }}>
                            {comment.message}
                          </Typography>
                        </Box>
                        
                        {/* Display comment images */}
                        {ticketImages.filter(img => img.commentIndex === index).length > 0 && (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                            {ticketImages
                              .filter(img => img.commentIndex === index)
                              .map((img) => (
                                <Box 
                                  key={img._id} 
                                  sx={{ 
                                    width: 40, 
                                    height: 40,
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                                    transition: 'all 0.15s ease',
                                    '&:hover': { 
                                      boxShadow: 2,
                                      borderColor: theme.palette.primary.main,
                                      transform: 'scale(1.05)'
                                    }
                                  }}
                                  onClick={() => window.open(ticketsService.getTicketImageUrl(img._id), '_blank')}
                                  onMouseEnter={(e) => handleImageMouseEnter(e, img)}
                                  onMouseLeave={handleImageMouseLeave}
                                >
                                  <Box
                                    component="img"
                                    src={ticketsService.getTicketImageThumbnailUrl(img._id)}
                                    alt={img.originalName}
                                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </Box>
                              ))}
                          </Stack>
                        )}
                        
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ mt: 0.25, fontSize: '0.6rem' }}
                        >
                          {ticketsService.formatExactDateTime(comment.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}

          {/* Add Comment */}
          {(isTicketOwner || isAdmin) && ticket.status !== 'closed' && (
            <Box
              sx={{
                bgcolor: alpha(theme.palette.background.paper, 0.6),
                borderRadius: 1.5,
                p: 1,
                border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              }}
            >
              <Stack spacing={0.75}>
                <TextField
                  multiline
                  rows={1}
                  placeholder="Write a message..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                      fontSize: '0.8rem',
                    },
                    '& .MuiOutlinedInput-input': {
                      py: 0.75,
                    }
                  }}
                />
                
                {/* Image Upload for Comment */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                      <IconButton
                        component="span"
                        size="small"
                        disabled={uploadingImages}
                        sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                      >
                        {uploadingImages ? <CircularProgress size={16} /> : <ImageIcon fontSize="small" />}
                      </IconButton>
                    </label>
                  </Box>
                  
                  <Button
                    variant="contained"
                    onClick={handleAddComment}
                    disabled={addingComment || !newComment.trim()}
                    size="small"
                    endIcon={addingComment ? <CircularProgress size={12} color="inherit" /> : <SendIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      borderRadius: 1.5,
                      px: 1.5,
                      py: 0.25,
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      minHeight: 28,
                    }}
                  >
                    Send
                  </Button>
                </Box>
                
                {/* Display selected comment images */}
                {commentImages.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {commentImages.map((img) => (
                      <Box 
                        key={img.id} 
                        sx={{ position: 'relative', width: 36, height: 36, borderRadius: 0.75, overflow: 'hidden' }}
                      >
                        <Box
                          component="img"
                          src={img.url}
                          alt={img.name}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveCommentImage(img.id)}
                          sx={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            bgcolor: 'error.main',
                            color: 'white',
                            padding: '1px',
                            '&:hover': { bgcolor: 'error.dark' }
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 10 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 1.5, py: 1, gap: 0.5 }}>
        {/* Resolve Ticket Section */}
        {isAdmin && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
          <>
            {!showResolveForm ? (
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<ResolveIcon sx={{ fontSize: 16 }} />}
                onClick={() => setShowResolveForm(true)}
                sx={{
                  mr: 'auto',
                  textTransform: 'none',
                  borderRadius: 1.5,
                  fontSize: '0.75rem',
                  py: 0.5,
                }}
              >
                Resolve
              </Button>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 'auto', flex: 1, maxWidth: '65%' }}>
                <TextField
                  size="small"
                  placeholder="Resolution note..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: '0.75rem' },
                    '& .MuiOutlinedInput-input': { py: 0.5 }
                  }}
                />
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleResolveTicket}
                  disabled={resolving}
                  size="small"
                  sx={{ minWidth: 'auto', px: 1.5, borderRadius: 1.5, textTransform: 'none', fontSize: '0.7rem', py: 0.5 }}
                >
                  {resolving ? <CircularProgress size={14} color="inherit" /> : 'OK'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => { setShowResolveForm(false); setResolutionNote(''); }}
                  size="small"
                  sx={{ minWidth: 'auto', px: 1, borderRadius: 1.5, textTransform: 'none', fontSize: '0.7rem', py: 0.5 }}
                >
                  ✕
                </Button>
              </Box>
            )}
          </>
        )}
        <Button 
          onClick={onClose} 
          variant="contained"
          size="small"
          sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.75rem', py: 0.5 }}
        >
          Close
        </Button>
      </DialogActions>

      {/* Image Preview */}
      {previewImage && (
        <Box
          component="img"
          src={ticketsService.getTicketImageUrl(previewImage._id)}
          alt={previewImage.originalName}
          onMouseEnter={() => setPreviewImage(previewImage)}
          onMouseLeave={handleImageMouseLeave}
          sx={{
            position: 'fixed',
            left: previewPosition.x,
            top: previewPosition.y,
            right: 20,
            bottom: 20,
            zIndex: 1400,
            objectFit: 'contain',
            borderRadius: 1,
            pointerEvents: 'none',
            animation: 'fadeIn 0.15s ease-out',
            '@keyframes fadeIn': {
              from: {
                opacity: 0,
              },
              to: {
                opacity: 1,
              }
            }
          }}
        />
      )}
    </Dialog>
  );
};

export default TicketDetailDialog;

