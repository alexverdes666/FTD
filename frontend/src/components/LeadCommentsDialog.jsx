import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Typography,
  Box,
  Avatar,
  Stack,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Comment as CommentIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';

const LeadCommentsDialog = ({
  open,
  onClose,
  lead,
  onCommentAdded,
}) => {
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [error, setError] = useState(null);
  const commentsEndRef = useRef(null);

  // Fetch comments when dialog opens
  useEffect(() => {
    if (open && lead?._id) {
      fetchComments();
    }
  }, [open, lead?._id]);

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  const fetchComments = async () => {
    if (!lead?._id) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/leads/${lead._id}`);

      if (response.data.success && response.data.data) {
        // Get comments from the lead data
        const leadComments = response.data.data.comments || [];

        // Sort by date (oldest first for chat view)
        const sortedComments = [...leadComments].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );

        setComments(sortedComments);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    try {
      setAddingComment(true);
      setError(null);

      await api.put(`/leads/${lead._id}/comment`, {
        text: newComment.trim(),
      });

      toast.success('Comment added successfully');
      setNewComment('');

      // Refresh comments
      await fetchComments();

      // Notify parent
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      const errorMessage = err.response?.data?.message || 'Failed to add comment';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setAddingComment(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const handleClose = () => {
    setNewComment('');
    setComments([]);
    setError(null);
    onClose();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOwnComment = (comment) => {
    const authorId = comment.author?._id || comment.author?.id || comment.author;
    return authorId === user?.id || authorId === user?._id;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { height: '70vh', maxHeight: 550 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <CommentIcon color="primary" />
            <Typography variant="h6">Comments</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        {lead && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {lead.firstName} {lead.lastName} - {lead.newEmail}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden' }}>
        {error && (
          <Alert severity="error" sx={{ mx: 3, mt: 1 }}>
            {error}
          </Alert>
        )}

        {/* Comments list */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            px: 2,
            py: 2,
            bgcolor: 'grey.50',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
              <CircularProgress />
            </Box>
          ) : comments.length === 0 ? (
            <Box
              display="flex"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              flex={1}
              color="text.secondary"
            >
              <CommentIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography variant="body2">No comments yet</Typography>
              <Typography variant="caption" color="text.secondary">
                Be the first to add a comment
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {comments.map((comment, index) => {
                const isOwn = isOwnComment(comment);
                return (
                  <Box
                    key={comment._id || index}
                    sx={{
                      display: 'flex',
                      flexDirection: isOwn ? 'row-reverse' : 'row',
                      gap: 1,
                      alignItems: 'flex-end',
                    }}
                  >
                    {!isOwn && (
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: '0.875rem',
                          bgcolor: 'primary.main'
                        }}
                      >
                        {comment.author?.fullName?.charAt(0) || 'U'}
                      </Avatar>
                    )}
                    <Paper
                      elevation={0}
                      sx={{
                        maxWidth: '75%',
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: isOwn ? 'primary.main' : 'white',
                        color: isOwn ? 'white' : 'text.primary',
                        borderBottomRightRadius: isOwn ? 4 : 16,
                        borderBottomLeftRadius: isOwn ? 16 : 4,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    >
                      {!isOwn && (
                        <Typography
                          variant="caption"
                          fontWeight="medium"
                          display="block"
                          sx={{ mb: 0.5, color: 'primary.main' }}
                        >
                          {comment.author?.fullName || 'Unknown'}
                          {comment.author?.fourDigitCode && ` (${comment.author.fourDigitCode})`}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                        {comment.text}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 0.5,
                          opacity: 0.7,
                          textAlign: isOwn ? 'right' : 'left',
                          color: isOwn ? 'inherit' : 'text.secondary'
                        }}
                      >
                        {formatDate(comment.createdAt)}
                      </Typography>
                    </Paper>
                    {isOwn && (
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: '0.875rem',
                          bgcolor: 'secondary.main'
                        }}
                      >
                        {user?.fullName?.charAt(0) || 'Y'}
                      </Avatar>
                    )}
                  </Box>
                );
              })}
              <div ref={commentsEndRef} />
            </Stack>
          )}
        </Box>

        {/* Comment input */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Type your comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={addingComment}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                }
              }}
            />
            <IconButton
              color="primary"
              onClick={handleAddComment}
              disabled={!newComment.trim() || addingComment}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
                '&.Mui-disabled': {
                  bgcolor: 'grey.300',
                  color: 'grey.500',
                }
              }}
            >
              {addingComment ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <SendIcon />
              )}
            </IconButton>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default LeadCommentsDialog;
