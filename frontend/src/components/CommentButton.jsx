import React, { useState, useEffect } from "react";
import {
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Collapse,
  IconButton as MuiIconButton,
} from "@mui/material";
import {
  Comment as CommentIcon,
  Add as AddIcon,
  CheckCircle as ResolveIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import { selectUser } from "../store/slices/authSlice";
import {
  getCommentsByTarget,
  createComment,
  createReply,
  resolveComment,
  deleteComment,
  formatStatus,
  getStatusColor,
} from "../services/agentComments";

// Reply Form Component
const ReplyForm = ({ parentComment, onSubmit, onCancel }) => {
  const [replyText, setReplyText] = useState("");

  const handleSubmit = () => {
    if (!replyText.trim()) {
      toast.error("Please enter a reply");
      return;
    }
    onSubmit(parentComment._id, replyText);
    setReplyText("");
  };

  return (
    <Box sx={{ mt: 1, p: 2, backgroundColor: "background.paper", borderRadius: 1, border: 1, borderColor: "divider" }}>
      <Typography variant="subtitle2" gutterBottom>
        Reply to {parentComment.agent?.fullName}
      </Typography>
      <TextField
        label="Your reply"
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        multiline
        rows={2}
        fullWidth
        size="small"
        sx={{ mb: 1 }}
      />
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" onClick={handleSubmit}>
          Reply
        </Button>
        <Button size="small" variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
      </Stack>
    </Box>
  );
};

// Comment Thread Component
const CommentThread = ({ comment, user, onReply, onResolve, onDelete, canManageComments }) => {
  const [showReplies, setShowReplies] = useState(true);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const handleReply = async (replyText) => {
    try {
      await onReply(comment._id, replyText);
      setShowReplyForm(false);
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <Box sx={{ mb: 2 }}>
      {/* Main Comment */}
      <Box
        sx={{
          p: 2,
          border: 1,
          borderColor: comment.isResolved ? "success.main" : "warning.main",
          borderRadius: 1,
          backgroundColor: comment.isResolved ? "success.light" : "warning.light",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Avatar sx={{ width: 24, height: 24, mr: 1 }}>
              {comment.agent?.fullName?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Typography variant="body2" fontWeight="bold">
              {comment.agent?.fullName}
            </Typography>
          </Box>
          <Chip
            label={formatStatus(comment.status)}
            color={getStatusColor(comment.status)}
            size="small"
          />
        </Box>
        
        <Typography variant="body2" sx={{ mb: 1 }}>
          {comment.comment}
        </Typography>
        
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="caption" color="textSecondary">
            {new Date(comment.createdAt).toLocaleString()}
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ReplyIcon />}
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              Reply
            </Button>
            {!comment.isResolved && comment.agent?._id === user?.id && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  // Handle edit - you might want to implement this
                }}
              >
                Edit
              </Button>
            )}
            {!comment.isResolved && canManageComments && (
              <Button
                size="small"
                variant="outlined"
                color="success"
                onClick={() => onResolve(comment)}
              >
                Resolve
              </Button>
            )}
            {(comment.agent?._id === user?.id || user?.role === "admin") && (
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => onDelete(comment._id)}
              >
                Delete
              </Button>
            )}
          </Stack>
        </Box>

        {comment.isResolved && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: "background.paper", borderRadius: 1 }}>
            <Typography variant="caption" color="success.main" fontWeight="bold">
              Resolved by {comment.resolvedBy?.fullName} on {new Date(comment.resolvedAt).toLocaleString()}
            </Typography>
            {comment.resolutionNote && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {comment.resolutionNote}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Reply Form */}
      {showReplyForm && (
        <ReplyForm
          parentComment={comment}
          onSubmit={(replyText) => handleReply(replyText)}
          onCancel={() => setShowReplyForm(false)}
        />
      )}

      {/* Replies Section */}
      {hasReplies && (
        <Box sx={{ ml: 3, mt: 1 }}>
          <Button
            size="small"
            onClick={() => setShowReplies(!showReplies)}
            startIcon={showReplies ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            {showReplies ? "Hide" : "Show"} {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
          </Button>
          
          <Collapse in={showReplies}>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {comment.replies.map((reply) => (
                <Box
                  key={reply._id}
                  sx={{
                    p: 1.5,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    backgroundColor: "background.paper",
                    ml: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                    <Avatar sx={{ width: 20, height: 20, mr: 1 }}>
                      {reply.agent?.fullName?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" fontWeight="bold">
                      {reply.agent?.fullName}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                      {new Date(reply.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2">
                    {reply.comment}
                  </Typography>
                  
                  {(reply.agent?._id === user?.id || user?.role === "admin") && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => onDelete(reply._id)}
                      sx={{ mt: 0.5 }}
                    >
                      Delete
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}
    </Box>
  );
};

const CommentButton = ({ targetType, targetId, targetName }) => {
  const user = useSelector(selectUser);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolvingComment, setResolvingComment] = useState(null);
  const [formData, setFormData] = useState({
    comment: "",
    status: "",
  });
  const [resolveData, setResolveData] = useState({
    resolutionNote: "",
  });

  // Load comments
  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await getCommentsByTarget(targetType, targetId);
      setComments(response.data);
      
      // Count unresolved comments (only top-level comments)
      const unresolved = response.data.filter(comment => !comment.isResolved);
      setUnresolvedCount(unresolved.length);
    } catch (error) {
      console.error("Error loading comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  // Load comments when dialog opens
  useEffect(() => {
    if (open) {
      loadComments();
    }
  }, [open, targetId]);

  // Handle create comment
  const handleCreateComment = async () => {
    // Validate form data
    if (!formData.status) {
      toast.error("Please select a status");
      return;
    }
    if (!formData.comment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    try {
      await createComment({
        targetType,
        targetId,
        comment: formData.comment,
        status: formData.status,
      });
      toast.success("Comment created successfully");
      setShowCreateForm(false);
      setFormData({ comment: "", status: "" });
      loadComments();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create comment");
    }
  };

  // Handle create reply
  const handleCreateReply = async (parentCommentId, replyText) => {
    try {
      await createReply(parentCommentId, replyText);
      toast.success("Reply created successfully");
      loadComments();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create reply");
    }
  };

  // Handle resolve comment
  const handleResolveComment = async () => {
    try {
      await resolveComment(resolvingComment._id, resolveData.resolutionNote);
      toast.success("Comment resolved successfully");
      setShowResolveForm(false);
      setResolvingComment(null);
      setResolveData({ resolutionNote: "" });
      loadComments();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resolve comment");
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      await deleteComment(commentId);
      toast.success("Comment deleted successfully");
      loadComments();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete comment");
    }
  };

  // Open resolve dialog
  const openResolveDialog = (comment) => {
    setResolvingComment(comment);
    setShowResolveForm(true);
  };

  // Check if form is valid
  const isFormValid = () => {
    return formData.status && formData.comment.trim();
  };

  const canManageComments = user?.role === "admin" || user?.role === "affiliate_manager";

  return (
    <>
      <IconButton
        onClick={() => setOpen(true)}
        color="primary"
        size="small"
      >
        <Badge badgeContent={unresolvedCount} color="error">
          <CommentIcon />
        </Badge>
      </IconButton>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Comments for {targetName}
          <Typography variant="body2" color="textSecondary">
            {formatTargetType(targetType)} • {unresolvedCount} unresolved
          </Typography>
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              {/* Create Comment Button */}
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowCreateForm(true)}
                  fullWidth
                >
                  Add Comment
                </Button>
              </Box>

              {/* Create Comment Form */}
              {showCreateForm && (
                <Box sx={{ mb: 3, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    Add New Comment
                  </Typography>
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        label="Status"
                      >
                        <MenuItem value="">Select status...</MenuItem>
                        <MenuItem value="working_ok">Working OK</MenuItem>
                        <MenuItem value="shaving">Shaving</MenuItem>
                        <MenuItem value="playing_games">Playing Games</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="Comment"
                      value={formData.comment}
                      onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                      multiline
                      rows={3}
                      fullWidth
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        onClick={handleCreateComment}
                        disabled={!isFormValid()}
                      >
                        Submit
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setShowCreateForm(false);
                          setFormData({ comment: "", status: "" });
                        }}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              )}

              {/* Comments List */}
              {comments.length === 0 ? (
                <Alert severity="info">No comments yet</Alert>
              ) : (
                <Stack spacing={2}>
                  {comments.map((comment) => (
                    <CommentThread
                      key={comment._id}
                      comment={comment}
                      user={user}
                      onReply={handleCreateReply}
                      onResolve={openResolveDialog}
                      onDelete={handleDeleteComment}
                      canManageComments={canManageComments}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Resolve Comment Dialog */}
      <Dialog open={showResolveForm} onClose={() => setShowResolveForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve Comment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Resolution Note"
              value={resolveData.resolutionNote}
              onChange={(e) => setResolveData(prev => ({ ...prev, resolutionNote: e.target.value }))}
              multiline
              rows={4}
              fullWidth
              placeholder="Optional note about how this was resolved..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResolveForm(false)}>Cancel</Button>
          <Button onClick={handleResolveComment} variant="contained" color="success">
            Resolve
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Helper function to format target type for display
const formatTargetType = (targetType) => {
  const typeMap = {
    client_network: "Client Network",
    client_broker: "Client Broker",
  };
  return typeMap[targetType] || targetType;
};

export default CommentButton;
