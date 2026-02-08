import React, { useState, useEffect } from "react";
import { TableSkeleton } from "../components/common/TableSkeleton.jsx";
import { useSelector } from "react-redux";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Divider,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  Avatar,
  useTheme,
  Pagination,
  FormControlLabel,
  Switch,
  Collapse,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ResolveIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Comment as CommentIcon,
  Business as BusinessIcon,
  AccountBalance as BrokerIcon,
  Reply as ReplyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { selectUser } from "../store/slices/authSlice";
import {
  getComments,
  createComment,
  createReply,
  updateComment,
  resolveComment,
  deleteComment,
  getCommentStats,
  formatStatus,
  getStatusColor,
  formatTargetType,
} from "../services/agentComments";
import api from "../services/api";

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

// Comment Thread Component for AgentCommentsPage
const CommentThread = ({ comment, user, onReply, onResolve, onDelete, canManageComments, getTargetDisplay }) => {
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
        
        {/* Target Display */}
        <Box sx={{ mb: 1 }}>
          {getTargetDisplay(comment)}
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
          onSubmit={handleReply}
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

const AgentCommentsPage = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);

  // State
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [resolvingComment, setResolvingComment] = useState(null);
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  // Target data for dropdowns
  const [clientNetworks, setClientNetworks] = useState([]);
  const [clientBrokers, setClientBrokers] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    targetType: "",
    targetId: "",
    status: "",
    isResolved: "",
    agent: "",
  });

  // Form data
  const [formData, setFormData] = useState({
    targetType: "",
    targetId: "",
    comment: "",
    status: "",
  });

  const [resolveData, setResolveData] = useState({
    resolutionNote: "",
  });

  // Load target data for dropdowns
  const loadTargetData = async () => {
    try {
      setLoadingTargets(true);
      
      // Load target data for all users (same as admin experience)
      // Load client networks (only active ones)
      try {
        const networksResponse = await api.get("/client-networks?isActive=true&limit=1000");
        setClientNetworks(networksResponse.data.data || []);
      } catch (error) {
        console.warn("Could not load client networks:", error);
        // Continue without networks data
      }
      
      // Load client brokers (only active ones)
      try {
        const brokersResponse = await api.get("/client-brokers?isActive=true&limit=1000");
        setClientBrokers(brokersResponse.data.data || []);
      } catch (error) {
        console.warn("Could not load client brokers:", error);
        // Continue without brokers data
      }
    } catch (error) {
      console.error("Error loading target data:", error);
      // Don't show error toast for permission issues
      if (error.response?.status !== 403) {
        toast.error("Failed to load target data");
      }
    } finally {
      setLoadingTargets(false);
    }
  };

  // Load comments
  const loadComments = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === "" || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const response = await getComments(params);
      setComments(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Error loading comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const response = await getCommentStats(filters);
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Load data on mount and filter change
  useEffect(() => {
    loadComments();
    loadStats();
  }, [filters, pagination.page]);

  // Load target data on mount
  useEffect(() => {
    loadTargetData();
  }, []);

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Handle target type change in form
  const handleTargetTypeChange = (targetType) => {
    setFormData(prev => ({ 
      ...prev, 
      targetType,
      targetId: "" // Reset target ID when target type changes
    }));
  };

  // Get available targets based on selected target type
  const getAvailableTargets = () => {
    if (formData.targetType === "client_network") {
      return clientNetworks;
    } else if (formData.targetType === "client_broker") {
      return clientBrokers;
    }
    return [];
  };

  // Get target name by ID and type
  const getTargetName = (targetId, targetType, commentTarget = null) => {
    // First try to use the target data that comes with the comment
    if (commentTarget && commentTarget.name) {
      return commentTarget.name;
    }
    
    // Fallback to local target data if available
    if (targetType === "client_network") {
      const target = clientNetworks.find(network => network._id === targetId);
      return target ? target.name : `Network ${targetId}`;
    } else if (targetType === "client_broker") {
      const target = clientBrokers.find(broker => broker._id === targetId);
      return target ? target.name : `Broker ${targetId}`;
    }
    return `Unknown Target (${targetId})`;
  };

  // Get target display info for table
  const getTargetDisplay = (comment) => {
    const targetName = getTargetName(comment.targetId, comment.targetType, comment.target);
    const targetTypeLabel = formatTargetType(comment.targetType);
    
    return (
      <Box>
        <Typography variant="body2" fontWeight="medium">
          {targetName}
        </Typography>
        <Chip 
          label={targetTypeLabel} 
          size="small" 
          color="primary" 
          variant="outlined"
          icon={comment.targetType === "client_network" ? <BusinessIcon /> : <BrokerIcon />}
        />
      </Box>
    );
  };

  // Check if form is valid
  const isFormValid = () => {
    return formData.targetType && 
           formData.targetId && 
           formData.status && 
           formData.comment.trim();
  };

  // Handle create comment
  const handleCreateComment = async () => {
    // Validate form data
    if (!formData.targetType) {
      toast.error("Please select a target type");
      return;
    }
    if (!formData.targetId) {
      toast.error("Please select a target");
      return;
    }
    if (!formData.status) {
      toast.error("Please select a status");
      return;
    }
    if (!formData.comment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    try {
      await createComment(formData);
      toast.success("Comment created successfully");
      setShowCreateDialog(false);
      setFormData({
        targetType: "",
        targetId: "",
        comment: "",
        status: "",
      });
      loadComments();
      loadStats();
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
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create reply");
    }
  };

  // Handle update comment
  const handleUpdateComment = async () => {
    try {
      await updateComment(editingComment._id, {
        comment: formData.comment,
        status: formData.status,
      });
      toast.success("Comment updated successfully");
      setShowEditDialog(false);
      setEditingComment(null);
      loadComments();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update comment");
    }
  };

  // Handle resolve comment
  const handleResolveComment = async () => {
    try {
      await resolveComment(resolvingComment._id, resolveData.resolutionNote);
      toast.success("Comment resolved successfully");
      setShowResolveDialog(false);
      setResolvingComment(null);
      setResolveData({ resolutionNote: "" });
      loadComments();
      loadStats();
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
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete comment");
    }
  };

  // Open edit dialog
  const openEditDialog = (comment) => {
    setEditingComment(comment);
    setFormData({
      targetType: comment.targetType,
      targetId: comment.targetId,
      comment: comment.comment,
      status: comment.status,
    });
    setShowEditDialog(true);
  };

  // Open resolve dialog
  const openResolveDialog = (comment) => {
    setResolvingComment(comment);
    setShowResolveDialog(true);
  };

  // Open reply dialog
  const openReplyDialog = (comment) => {
    setReplyingToComment(comment);
    setShowReplyDialog(true);
  };

  // Handle reply submit
  const handleReplySubmit = async () => {
    if (!resolveData.resolutionNote.trim()) {
      toast.error("Please enter a reply");
      return;
    }

    try {
      await createReply(replyingToComment._id, resolveData.resolutionNote);
      toast.success("Reply created successfully");
      setShowReplyDialog(false);
      setReplyingToComment(null);
      setResolveData({ resolutionNote: "" });
      loadComments();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create reply");
    }
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      targetType: "",
      targetId: "",
      status: "",
      isResolved: "",
      agent: "",
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const canManageComments = user?.role === "admin" || user?.role === "affiliate_manager";
  const canCreateComments = true; // All authenticated users can create comments

  return (
    <Box sx={{ width: "100%", typography: "body1", bgcolor: "grey.50", minHeight: "100vh" }}>
      {/* Statistics Cards */}
      {!statsLoading && stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Comments
                </Typography>
                <Typography variant="h4">{stats.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Unresolved
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.unresolved}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Resolved
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.resolved}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Resolution Rate
                </Typography>
                <Typography variant="h4" color="info.main">
                  {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FilterIcon sx={{ mr: 1, verticalAlign: "middle" }} />
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Target Type</InputLabel>
                <Select
                  value={filters.targetType}
                  onChange={(e) => handleFilterChange("targetType", e.target.value)}
                  label="Target Type"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="client_network">Client Network</MenuItem>
                  <MenuItem value="client_broker">Client Broker</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="working_ok">Working OK</MenuItem>
                  <MenuItem value="shaving">Shaving</MenuItem>
                  <MenuItem value="playing_games">Playing Games</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Resolution</InputLabel>
                <Select
                  value={filters.isResolved}
                  onChange={(e) => handleFilterChange("isResolved", e.target.value)}
                  label="Resolution"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="false">Unresolved</MenuItem>
                  <MenuItem value="true">Resolved</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                onClick={clearFilters}
                startIcon={<ClearIcon />}
                fullWidth
              >
                Clear
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="contained"
                onClick={loadComments}
                startIcon={<RefreshIcon />}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Actions */}
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">
          Comments ({pagination.total})
        </Typography>
        {canCreateComments && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateDialog(true)}
          >
            Add Comment
          </Button>
        )}
      </Box>

      {/* Info for all users */}
      <Alert severity="info" sx={{ mb: 3 }}>
        You can add comments directly from the target pages (Client Networks or Client Brokers) 
        using the comment button on each target, or use the "Add Comment" button above. You can view and reply to existing comments here.
      </Alert>

      {/* Comments Table */}
      <Card>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : comments.length === 0 ? (
            <Alert severity="info">No comments found</Alert>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Agent</TableCell>
                      <TableCell>Target</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Comment</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {comments.map((comment) => (
                      <React.Fragment key={comment._id}>
                        {/* Main Comment Row */}
                        <TableRow>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Avatar sx={{ width: 32, height: 32, fontSize: "0.875rem" }}>
                                {comment.agent?.fullName?.charAt(0) || "A"}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {comment.agent?.fullName || "Unknown Agent"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {comment.agent?.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {getTargetName(comment.targetId, comment.targetType, comment.target)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {comment.targetType === "client_network" ? "Network" : "Broker"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={comment.status}
                              size="small"
                              color={
                                comment.status === "working_ok"
                                  ? "success"
                                  : comment.status === "shaving"
                                  ? "warning"
                                  : comment.status === "playing_games"
                                  ? "error"
                                  : "default"
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              {comment.comment}
                            </Typography>
                            {comment.replies && comment.replies.length > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                {comment.replies.length} reply{comment.replies.length !== 1 ? "ies" : ""}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(comment.createdAt).toLocaleTimeString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Tooltip title="Reply">
                                <IconButton
                                  size="small"
                                  onClick={() => openReplyDialog(comment)}
                                  color="primary"
                                >
                                  <ReplyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {comment.agent?._id === user?.id && (
                                <Tooltip title="Edit">
                                  <IconButton
                                    size="small"
                                    onClick={() => openEditDialog(comment)}
                                    color="primary"
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {canManageComments && !comment.isResolved && (
                                <Tooltip title="Resolve">
                                  <IconButton
                                    size="small"
                                    onClick={() => openResolveDialog(comment)}
                                    color="success"
                                  >
                                    <ResolveIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {(comment.agent?._id === user?.id || user?.role === "admin") && (
                                <Tooltip title="Delete">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteComment(comment._id)}
                                    color="error"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                        
                        {/* Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                          comment.replies.map((reply) => (
                            <TableRow key={reply._id} sx={{ backgroundColor: "grey.50" }}>
                              <TableCell>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 3 }}>
                                  <Avatar sx={{ width: 28, height: 28, fontSize: "0.75rem" }}>
                                    {reply.agent?.fullName?.charAt(0) || "A"}
                                  </Avatar>
                                  <Box>
                                    <Typography variant="body2" fontWeight="medium">
                                      {reply.agent?.fullName || "Unknown Agent"}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {reply.agent?.email}
                                    </Typography>
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary" sx={{ pl: 3 }}>
                                  Reply to above
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  Reply
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ pl: 3 }}>
                                  {reply.comment}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {new Date(reply.createdAt).toLocaleDateString()}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(reply.createdAt).toLocaleTimeString()}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1}>
                                  {(reply.agent?._id === user?.id || user?.role === "admin") && (
                                    <Tooltip title="Delete Reply">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleDeleteComment(reply._id)}
                                        color="error"
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                  <Pagination
                    count={pagination.pages}
                    page={pagination.page}
                    onChange={handlePageChange}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Comment Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Comment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Target Type</InputLabel>
              <Select
                value={formData.targetType}
                onChange={(e) => handleTargetTypeChange(e.target.value)}
                label="Target Type"
              >
                <MenuItem value="">Select target type...</MenuItem>
                <MenuItem value="client_network">Client Network</MenuItem>
                <MenuItem value="client_broker">Client Broker</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Target ID</InputLabel>
              <Select
                value={formData.targetId}
                onChange={(e) => setFormData(prev => ({ ...prev, targetId: e.target.value }))}
                label="Target ID"
                disabled={loadingTargets || !formData.targetType}
              >
                {!formData.targetType ? (
                  <MenuItem value="">Please select target type first</MenuItem>
                ) : loadingTargets ? (
                  <MenuItem value="">Loading...</MenuItem>
                ) : getAvailableTargets().length === 0 ? (
                  <MenuItem value="">No targets found</MenuItem>
                ) : (
                  getAvailableTargets().map((target) => (
                    <MenuItem key={target._id} value={target._id}>
                      {target.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            {formData.targetType && getAvailableTargets().length === 0 && !loadingTargets && (
              <TextField
                label="Target ID (Manual Entry)"
                value={formData.targetId}
                onChange={(e) => setFormData(prev => ({ ...prev, targetId: e.target.value }))}
                placeholder="Enter target ID manually"
                helperText="Enter the target ID if you don't have access to the target list"
                fullWidth
              />
            )}
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
              rows={4}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateComment} variant="contained" disabled={!isFormValid()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Comment Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Comment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                label="Status"
              >
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
              rows={4}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
          <Button onClick={handleUpdateComment} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Resolve Comment Dialog */}
      <Dialog open={showResolveDialog} onClose={() => setShowResolveDialog(false)} maxWidth="sm" fullWidth>
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
          <Button onClick={() => setShowResolveDialog(false)}>Cancel</Button>
          <Button onClick={handleResolveComment} variant="contained" color="success">
            Resolve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onClose={() => setShowReplyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Reply to {replyingToComment?.agent?.fullName}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              Original comment: "{replyingToComment?.comment}"
            </Typography>
            <TextField
              label="Your reply"
              value={resolveData.resolutionNote}
              onChange={(e) => setResolveData(prev => ({ ...prev, resolutionNote: e.target.value }))}
              multiline
              rows={4}
              fullWidth
              placeholder="Enter your reply..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowReplyDialog(false)}>Cancel</Button>
          <Button onClick={handleReplySubmit} variant="contained" color="primary">
            Reply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AgentCommentsPage;
