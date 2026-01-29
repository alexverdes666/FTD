import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Grid,
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
  Chip,
  Tooltip,
  Avatar,
  useTheme,
  Pagination,
  FormControlLabel,
  Switch,
  Collapse,
  Divider,
  alpha,
  Fade,
  Zoom
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as ResolveIcon,
  Comment as CommentIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  Schedule as ScheduleIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  AccessTime as AccessTimeIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  DoneAll as DoneAllIcon,
  ConfirmationNumber as TicketIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { selectUser } from '../store/slices/authSlice';
import ticketsService from '../services/tickets';
import TicketDetailDialog from '../components/TicketDetailDialog';

const TicketsPage = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);

  // State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: 'open',
    category: '',
    priority: '',
    search: '',
    isEscalated: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });


  // Form data
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    tags: ''
  });

  // Image upload states
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadedImageIds, setUploadedImageIds] = useState([]);

  const [commentData, setCommentData] = useState({
    message: '',
    isInternal: false
  });

  const [resolveData, setResolveData] = useState({
    resolutionNote: ''
  });

  // Load data
  const loadTickets = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...ticketsService.buildTicketFilters(filters)
      };

      const response = await ticketsService.getTickets(params);
      setTickets(response.data);
      setPagination(response.pagination);
    } catch (error) {
      if (!silent) {
        toast.error(error.response?.data?.message || 'Failed to load tickets');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  const loadStats = useCallback(async () => {
    // Only admins can see stats
    if (user?.role !== 'admin') return;
    
    try {
      const response = await ticketsService.getTicketStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [user?.role]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Auto-refresh tickets every 30 seconds (silent refresh)
  const autoRefreshRef = useRef(null);

  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      loadTickets(true); // Silent refresh - no loading spinner
      if (user?.role === 'admin') {
        loadStats();
      }
    }, 30000);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [loadTickets, loadStats, user?.role]);

  // Event handlers
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      category: '',
      priority: '',
      search: '',
      isEscalated: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleImageSelect = async (event) => {
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
        const response = await ticketsService.uploadTicketImage(file);
        if (response.success) {
          newImageIds.push(response.data._id);
          setSelectedImages(prev => [...prev, {
            id: response.data._id,
            name: file.name,
            url: ticketsService.getTicketImageThumbnailUrl(response.data._id)
          }]);
        }
      }
      setUploadedImageIds(prev => [...prev, ...newImageIds]);
      toast.success(`${files.length} image(s) uploaded successfully`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = async (imageId) => {
    try {
      await ticketsService.deleteTicketImage(imageId);
      setSelectedImages(prev => prev.filter(img => img.id !== imageId));
      setUploadedImageIds(prev => prev.filter(id => id !== imageId));
      toast.success('Image removed');
    } catch (error) {
      toast.error('Failed to remove image');
    }
  };

  const handleCreateTicket = async () => {
    try {
      const validation = ticketsService.validateTicketData(newTicket);
      if (!validation.isValid) {
        Object.values(validation.errors).forEach(error => toast.error(error));
        return;
      }

      await ticketsService.createTicket({
        ...newTicket,
        imageIds: uploadedImageIds
      });
      toast.success('Ticket created successfully');
      setCreateDialogOpen(false);
      setNewTicket({
        title: '',
        description: '',
        category: '',
        priority: 'medium',
        tags: ''
      });
      setSelectedImages([]);
      setUploadedImageIds([]);
      loadTickets();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create ticket');
    }
  };

  const handleAddComment = async () => {
    try {
      if (!commentData.message.trim()) {
        toast.error('Please enter a comment');
        return;
      }

      const response = await ticketsService.addComment(selectedTicket._id, commentData);
      toast.success('Comment added successfully');
      setCommentDialogOpen(false);
      setCommentData({ message: '', isInternal: false });

      // Update only the specific ticket in local state
      setTickets(prev => prev.map(ticket =>
        ticket._id === selectedTicket._id ? response.data : ticket
      ));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    }
  };

  // Helper function to check if a ticket matches current filters
  const ticketMatchesFilters = (ticket) => {
    if (filters.status && ticket.status !== filters.status) return false;
    if (filters.category && ticket.category !== filters.category) return false;
    if (filters.priority && ticket.priority !== filters.priority) return false;
    return true;
  };

  // Assignment functionality removed - only admins handle all tickets

  const handleResolveTicket = async () => {
    try {
      const response = await ticketsService.resolveTicket(selectedTicket._id, resolveData.resolutionNote);
      toast.success('Ticket resolved successfully');
      setResolveDialogOpen(false);
      setResolveData({ resolutionNote: '' });

      // Check if resolved ticket still matches current filters
      if (ticketMatchesFilters(response.data)) {
        // Update the ticket in the list
        setTickets(prev => prev.map(ticket =>
          ticket._id === selectedTicket._id ? response.data : ticket
        ));
      } else {
        // Remove from list if it no longer matches filters
        setTickets(prev => prev.filter(ticket => ticket._id !== selectedTicket._id));
      }

      // Refresh stats in the background
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resolve ticket');
    }
  };


  const handleDeleteTicket = async (ticket) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;

    try {
      await ticketsService.deleteTicket(ticket._id);
      toast.success('Ticket deleted successfully');

      // Remove the ticket from local state
      setTickets(prev => prev.filter(t => t._id !== ticket._id));

      // Refresh stats in the background
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete ticket');
    }
  };

  const openDialog = (dialogType, ticket = null) => {
    setSelectedTicket(ticket);
    
    switch (dialogType) {
      case 'view':
        setViewDialogOpen(true);
        break;
      case 'comment':
        setCommentDialogOpen(true);
        break;
      case 'resolve':
        setResolveDialogOpen(true);
        break;
      default:
        break;
    }
  };

  const handleTicketUpdate = (updatedTicket) => {
    // Check if updated ticket still matches current filters
    if (ticketMatchesFilters(updatedTicket)) {
      // Update the ticket in the list
      setTickets(prev => prev.map(ticket =>
        ticket._id === updatedTicket._id ? updatedTicket : ticket
      ));
    } else {
      // Remove from list if it no longer matches filters
      setTickets(prev => prev.filter(ticket => ticket._id !== updatedTicket._id));
    }
    loadStats(); // Refresh stats
  };

  // Check permissions
  const isAdmin = user?.role === 'admin';

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight={700}>
            Support Tickets
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage and track support requests
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? 'contained' : 'outlined'}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 2
            }}
          >
            Filters
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            variant="contained"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 2.5,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.35)}`,
              '&:hover': {
                boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
              }
            }}
          >
            Create Ticket
          </Button>
        </Stack>
      </Box>

      {/* Stats Cards - Only for Admins */}
      {isAdmin && stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={6} md={3}>
            <Card 
              sx={{ 
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
              }}
            >
              <CardContent sx={{ py: 2, px: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="caption" fontWeight={500}>
                      Total Tickets
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="primary.main">
                      {stats.summary?.total || 0}
                    </Typography>
                  </Box>
                  <TicketIcon sx={{ fontSize: 40, color: alpha(theme.palette.primary.main, 0.3) }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <Card 
              sx={{ 
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`
              }}
            >
              <CardContent sx={{ py: 2, px: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="caption" fontWeight={500}>
                      Open
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="info.main">
                      {stats.summary?.open || 0}
                    </Typography>
                  </Box>
                  <ChatBubbleOutlineIcon sx={{ fontSize: 40, color: alpha(theme.palette.info.main, 0.3) }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <Card 
              sx={{ 
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}`
              }}
            >
              <CardContent sx={{ py: 2, px: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="caption" fontWeight={500}>
                      Overdue
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="warning.main">
                      {stats.summary?.overdue || 0}
                    </Typography>
                  </Box>
                  <ScheduleIcon sx={{ fontSize: 40, color: alpha(theme.palette.warning.main, 0.3) }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <Card 
              sx={{ 
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
                border: `1px solid ${alpha(theme.palette.success.main, 0.15)}`
              }}
            >
              <CardContent sx={{ py: 2, px: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="caption" fontWeight={500}>
                      Avg Resolution
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="success.main">
                      {stats.summary?.avgResolutionTimeHours || 0}
                      <Typography component="span" variant="caption" color="text.secondary"> hrs</Typography>
                    </Typography>
                  </Box>
                  <TrendingUpIcon sx={{ fontSize: 40, color: alpha(theme.palette.success.main, 0.3) }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Collapse in={showFilters}>
        <Card 
          sx={{ 
            mb: 3, 
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.7)
          }}
        >
          <CardContent sx={{ py: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  placeholder="Search tickets..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: 'background.paper'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    label="Status"
                    sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
                  >
                    <MenuItem value="">All Statuses</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="waiting_response">Waiting Response</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                    {user?.role === 'admin' && (
                      <MenuItem value="deleted">Deleted</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    label="Category"
                    sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    <MenuItem value="leads_request">Leads Request</MenuItem>
                    <MenuItem value="salary_issue">Salary Issue</MenuItem>
                    <MenuItem value="technical_support">Technical Support</MenuItem>
                    <MenuItem value="account_access">Account Access</MenuItem>
                    <MenuItem value="payment_issue">Payment Issue</MenuItem>
                    <MenuItem value="feature_request">Feature Request</MenuItem>
                    <MenuItem value="bug_report">Bug Report</MenuItem>
                    <MenuItem value="fine_dispute">Fine Dispute</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    label="Priority"
                    sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
                  >
                    <MenuItem value="">All Priorities</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={6} md={3}>
                <Button
                  startIcon={<ClearIcon />}
                  onClick={clearFilters}
                  variant="outlined"
                  size="small"
                  sx={{ 
                    borderRadius: 2,
                    textTransform: 'none',
                    px: 2
                  }}
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Collapse>

      {/* Tickets Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={48} />
        </Box>
      ) : tickets.length === 0 ? (
        <Paper 
          sx={{ 
            py: 8, 
            px: 4, 
            textAlign: 'center',
            bgcolor: alpha(theme.palette.background.paper, 0.6),
            borderRadius: 3
          }}
        >
          <TicketIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No tickets found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Create a new ticket or adjust your filters
          </Typography>
        </Paper>
      ) : (
        <>
          <Grid container spacing={2.5}>
            {tickets.map((ticket, index) => {
              const isOverdue = ticketsService.isTicketOverdue(ticket);
              const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
              const priorityColor = ticketsService.getPriorityColor(ticket.priority);
              const statusColor = ticketsService.getStatusColor(ticket.status);
              
              return (
                <Grid item xs={12} sm={6} lg={4} xl={3} key={ticket._id}>
                  <Fade in timeout={300 + index * 50}>
                    <Card
                      onClick={() => openDialog('view', ticket)}
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 3,
                        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.9),
                        position: 'relative',
                        overflow: 'visible',
                        cursor: 'pointer',
                        ...(isOverdue && {
                          borderColor: alpha(theme.palette.warning.main, 0.5),
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 4,
                            bgcolor: 'warning.main',
                            borderRadius: '12px 12px 0 0'
                          }
                        }),
                        ...(ticket.priority === 'urgent' && !isResolved && {
                          animation: 'urgentPulse 2s ease-in-out infinite',
                          '@keyframes urgentPulse': {
                            '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.error.main, 0.4)}` },
                            '50%': { boxShadow: `0 0 0 8px ${alpha(theme.palette.error.main, 0)}` }
                          }
                        })
                      }}
                    >
                      {/* Priority Indicator Strip */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 12,
                          left: 0,
                          width: 4,
                          height: 40,
                          borderRadius: '0 4px 4px 0',
                          bgcolor: `${priorityColor}.main`,
                          opacity: 0.9
                        }}
                      />

                      <CardContent sx={{ flex: 1, pb: 1, pt: 2 }}>
                        {/* Header with status and priority chips */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            <Chip
                              label={ticketsService.formatTicketStatus(ticket.status)}
                              color={statusColor}
                              size="small"
                              sx={{ 
                                height: 24, 
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                '& .MuiChip-label': { px: 1 }
                              }}
                            />
                            <Chip
                              label={ticketsService.formatTicketPriority(ticket.priority)}
                              color={priorityColor}
                              variant="outlined"
                              size="small"
                              sx={{ 
                                height: 24, 
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                '& .MuiChip-label': { px: 1 }
                              }}
                            />
                          </Stack>
                          {isOverdue && (
                            <Tooltip title="Overdue!" arrow>
                              <ScheduleIcon 
                                sx={{ 
                                  fontSize: 20, 
                                  color: 'warning.main',
                                  animation: 'bounce 1s ease infinite',
                                  '@keyframes bounce': {
                                    '0%, 100%': { transform: 'translateY(0)' },
                                    '50%': { transform: 'translateY(-3px)' }
                                  }
                                }} 
                              />
                            </Tooltip>
                          )}
                        </Box>

                        {/* Title */}
                        <Typography 
                          variant="subtitle1" 
                          fontWeight={600}
                          sx={{ 
                            mb: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.3,
                            minHeight: '2.6em'
                          }}
                        >
                          {ticket.title}
                        </Typography>

                        {/* Category Badge */}
                        <Chip
                          label={ticketsService.formatTicketCategory(ticket.category)}
                          variant="outlined"
                          size="small"
                          sx={{ 
                            height: 22, 
                            fontSize: '0.65rem',
                            mb: 1.5,
                            bgcolor: alpha(theme.palette.background.default, 0.5),
                            borderColor: alpha(theme.palette.divider, 0.3)
                          }}
                        />

                        {/* Description Preview */}
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            fontSize: '0.8rem',
                            lineHeight: 1.5,
                            mb: 2,
                            minHeight: '2.4em'
                          }}
                        >
                          {ticket.description}
                        </Typography>

                        {/* Meta info */}
                        <Stack spacing={0.75}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar 
                              sx={{ 
                                width: 22, 
                                height: 22, 
                                fontSize: '0.7rem',
                                bgcolor: alpha(theme.palette.primary.main, 0.15),
                                color: 'primary.main'
                              }}
                            >
                              {ticket.createdBy?.fullName?.charAt(0)}
                            </Avatar>
                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                              {ticket.createdBy?.fullName}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <AccessTimeIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                              <Typography variant="caption" color="text.disabled">
                                {ticketsService.formatSmartDateTime(ticket.createdAt)}
                              </Typography>
                            </Box>
                            {ticket.comments && ticket.comments.length > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ChatBubbleOutlineIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                                <Typography variant="caption" color="text.disabled">
                                  {ticket.comments.length}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Stack>
                      </CardContent>

                      {/* Action Buttons */}
                      <CardActions 
                        sx={{ 
                          px: 2, 
                          pb: 2, 
                          pt: 0,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Tooltip title="Add Comment" arrow>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => openDialog('comment', ticket)}
                              sx={{ 
                                minWidth: 'auto',
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 2,
                                fontSize: '0.75rem',
                                textTransform: 'none',
                                borderColor: alpha(theme.palette.divider, 0.3),
                                '&:hover': {
                                  borderColor: 'info.main',
                                  bgcolor: alpha(theme.palette.info.main, 0.05)
                                }
                              }}
                              startIcon={<CommentIcon sx={{ fontSize: 16 }} />}
                            >
                              Comment
                            </Button>
                          </Tooltip>

                          {isAdmin && !isResolved && (
                            <Tooltip title="Resolve Ticket" arrow>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => openDialog('resolve', ticket)}
                                sx={{ 
                                  minWidth: 'auto',
                                  px: 1.5,
                                  py: 0.5,
                                  borderRadius: 2,
                                  fontSize: '0.75rem',
                                  textTransform: 'none',
                                  boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.3)}`,
                                  '&:hover': {
                                    boxShadow: `0 6px 16px ${alpha(theme.palette.success.main, 0.4)}`,
                                  }
                                }}
                                startIcon={<DoneAllIcon sx={{ fontSize: 16 }} />}
                              >
                                Resolve
                              </Button>
                            </Tooltip>
                          )}

                          {isResolved && (
                            <Chip
                              icon={<ResolveIcon sx={{ fontSize: 16 }} />}
                              label="Resolved"
                              color="success"
                              variant="outlined"
                              size="small"
                              sx={{ 
                                height: 28,
                                fontSize: '0.75rem'
                              }}
                            />
                          )}
                        </Box>

                        {isAdmin && (
                          <Tooltip title="Delete Ticket" arrow>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteTicket(ticket)}
                              sx={{ 
                                color: 'text.disabled',
                                '&:hover': {
                                  color: 'error.main',
                                  bgcolor: alpha(theme.palette.error.main, 0.1)
                                }
                              }}
                            >
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </CardActions>
                    </Card>
                  </Fade>
                </Grid>
              );
            })}
          </Grid>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={pagination.pages}
                page={pagination.page}
                onChange={handlePageChange}
                color="primary"
                size="large"
                sx={{
                  '& .MuiPaginationItem-root': {
                    borderRadius: 2
                  }
                }}
              />
            </Box>
          )}
        </>
      )}

      {/* Create Ticket Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden'
          }
        }}
      >
        <Box 
          sx={{ 
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <AddIcon sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Create New Ticket
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Submit a new support request
            </Typography>
          </Box>
        </Box>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Title"
              value={newTicket.title}
              onChange={(e) => setNewTicket(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
              required
              placeholder="Brief summary of your issue"
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2 }
              }}
            />
            <TextField
              label="Description"
              value={newTicket.description}
              onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={4}
              fullWidth
              required
              placeholder="Provide detailed information about your issue..."
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2 }
              }}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket(prev => ({ ...prev, category: e.target.value }))}
                    label="Category"
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="leads_request">Leads Request</MenuItem>
                    <MenuItem value="salary_issue">Salary Issue</MenuItem>
                    <MenuItem value="technical_support">Technical Support</MenuItem>
                    <MenuItem value="account_access">Account Access</MenuItem>
                    <MenuItem value="payment_issue">Payment Issue</MenuItem>
                    <MenuItem value="feature_request">Feature Request</MenuItem>
                    <MenuItem value="bug_report">Bug Report</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value }))}
                    label="Priority"
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="low">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                        Low
                      </Box>
                    </MenuItem>
                    <MenuItem value="medium">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'info.main' }} />
                        Medium
                      </Box>
                    </MenuItem>
                    <MenuItem value="high">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                        High
                      </Box>
                    </MenuItem>
                    <MenuItem value="urgent">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />
                        Urgent
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <TextField
              label="Tags"
              value={newTicket.tags}
              onChange={(e) => setNewTicket(prev => ({ ...prev, tags: e.target.value }))}
              fullWidth
              placeholder="urgent, leads, payment (comma separated)"
              helperText="Optional: Add tags to help categorize this ticket"
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2 }
              }}
            />
            
            {/* Image Upload Section */}
            <Box 
              sx={{ 
                p: 2, 
                borderRadius: 2, 
                border: `2px dashed ${alpha(theme.palette.divider, 0.3)}`,
                bgcolor: alpha(theme.palette.background.default, 0.5),
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                  bgcolor: alpha(theme.palette.primary.main, 0.02)
                }
              }}
            >
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="ticket-image-upload"
                multiple
                type="file"
                onChange={handleImageSelect}
                disabled={uploadingImages}
              />
              <label htmlFor="ticket-image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={uploadingImages ? <CircularProgress size={20} /> : <ImageIcon />}
                  disabled={uploadingImages}
                  fullWidth
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    py: 1.5,
                    borderStyle: 'dashed'
                  }}
                >
                  {uploadingImages ? 'Uploading...' : 'Click to attach images'}
                </Button>
              </label>
              
              {/* Display selected images */}
              {selectedImages.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    Attached Images ({selectedImages.length}):
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {selectedImages.map((img) => (
                      <Box 
                        key={img.id} 
                        sx={{ 
                          position: 'relative', 
                          width: 80, 
                          height: 80,
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: `1px solid ${alpha(theme.palette.divider, 0.3)}`
                        }}
                      >
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
                          onClick={() => handleRemoveImage(img.id)}
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            bgcolor: 'error.main',
                            color: 'white',
                            p: 0.25,
                            '&:hover': { bgcolor: 'error.dark' }
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button 
            onClick={() => {
              setCreateDialogOpen(false);
              setSelectedImages([]);
              setUploadedImageIds([]);
            }}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateTicket} 
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.35)}`,
            }}
          >
            Create Ticket
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Comment Dialog */}
      <Dialog 
        open={commentDialogOpen} 
        onClose={() => setCommentDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden'
          }
        }}
      >
        <Box 
          sx={{ 
            bgcolor: alpha(theme.palette.info.main, 0.1),
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'info.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CommentIcon sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Add Comment
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add a response or note to this ticket
            </Typography>
          </Box>
        </Box>
        <DialogContent sx={{ pt: 3 }}>
          {selectedTicket && (
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {selectedTicket.title}
              </Typography>
            </Alert>
          )}
          <Stack spacing={2.5}>
            <TextField
              label="Your Comment"
              value={commentData.message}
              onChange={(e) => setCommentData(prev => ({ ...prev, message: e.target.value }))}
              multiline
              rows={4}
              fullWidth
              required
              placeholder="Write your comment here..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
            {isAdmin && (
              <FormControlLabel
                control={
                  <Switch
                    checked={commentData.isInternal}
                    onChange={(e) => setCommentData(prev => ({ ...prev, isInternal: e.target.checked }))}
                    color="warning"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Internal comment
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Only visible to admins
                    </Typography>
                  </Box>
                }
                sx={{
                  mx: 0,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: commentData.isInternal ? alpha(theme.palette.warning.main, 0.1) : 'transparent',
                  border: `1px solid ${commentData.isInternal ? alpha(theme.palette.warning.main, 0.3) : 'transparent'}`,
                  transition: 'all 0.2s'
                }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button 
            onClick={() => setCommentDialogOpen(false)}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddComment} 
            variant="contained"
            startIcon={<CommentIcon />}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.35)}`,
            }}
          >
            Add Comment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assignment dialog removed - only admins handle all tickets */}

      {/* Resolve Dialog */}
      <Dialog 
        open={resolveDialogOpen} 
        onClose={() => setResolveDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden'
          }
        }}
      >
        <Box 
          sx={{ 
            bgcolor: alpha(theme.palette.success.main, 0.1),
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <DoneAllIcon sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Resolve Ticket
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Mark this ticket as resolved
            </Typography>
          </Box>
        </Box>
        <DialogContent sx={{ pt: 3 }}>
          {selectedTicket && (
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {selectedTicket.title}
              </Typography>
            </Alert>
          )}
          <TextField
            label="Resolution Note"
            value={resolveData.resolutionNote}
            onChange={(e) => setResolveData(prev => ({ ...prev, resolutionNote: e.target.value }))}
            multiline
            rows={4}
            fullWidth
            placeholder="Describe how the ticket was resolved (optional)..."
            helperText="Add a note explaining how this issue was resolved"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button 
            onClick={() => setResolveDialogOpen(false)}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleResolveTicket} 
            variant="contained" 
            color="success"
            startIcon={<ResolveIcon />}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              boxShadow: `0 4px 14px ${alpha(theme.palette.success.main, 0.35)}`,
              '&:hover': {
                boxShadow: `0 6px 20px ${alpha(theme.palette.success.main, 0.4)}`,
              }
            }}
          >
            Resolve Ticket
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <TicketDetailDialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        ticketId={selectedTicket?._id}
        onTicketUpdate={handleTicketUpdate}
      />
    </Box>
  );
};

export default TicketsPage;
