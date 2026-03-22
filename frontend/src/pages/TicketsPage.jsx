import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Zoom,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  InputAdornment,
  LinearProgress,
  Breadcrumbs,
  Link,
  Skeleton,
  useMediaQuery
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
  TrendingUp as TrendingUpIcon,
  AssignmentInd as AssignmentIndIcon,
  Support as SupportIcon,
  NavigateNext as NavigateNextIcon,
  HourglassEmpty as HourglassEmptyIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Speed as SpeedIcon,
  ErrorOutline as ErrorOutlineIcon,
  FiberManualRecord as DotIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { selectUser } from '../store/slices/authSlice';
import ticketsService from '../services/tickets';
import TicketDetailDialog from '../components/TicketDetailDialog';

// -- Design tokens --
const COLORS = {
  primary: '#1e3a5f',
  accent: '#f57c00',
  headerGradient: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
  cardShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
  cardShadowHover: '0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05)',
  statusOpen: '#1976d2',
  statusInProgress: '#f57c00',
  statusResolved: '#2e7d32',
  statusClosed: '#757575',
  statusWaiting: '#7b1fa2',
  statusDeleted: '#d32f2f',
  priorityLow: '#1976d2',
  priorityMedium: '#f57c00',
  priorityHigh: '#d32f2f',
  priorityUrgent: '#7b0000',
};

const getStatusStyle = (status) => {
  const styles = {
    open: { bg: '#e3f2fd', color: '#1565c0', label: 'Open' },
    in_progress: { bg: '#fff3e0', color: '#e65100', label: 'In Progress' },
    waiting_response: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Waiting' },
    resolved: { bg: '#e8f5e9', color: '#2e7d32', label: 'Resolved' },
    closed: { bg: '#f5f5f5', color: '#616161', label: 'Closed' },
    deleted: { bg: '#ffebee', color: '#c62828', label: 'Deleted' },
  };
  return styles[status] || styles.open;
};

const getPriorityStyle = (priority) => {
  const styles = {
    low: { bg: '#e3f2fd', color: '#1565c0', label: 'Low' },
    medium: { bg: '#fff3e0', color: '#e65100', label: 'Medium' },
    high: { bg: '#ffebee', color: '#c62828', label: 'High' },
    urgent: { bg: '#fce4ec', color: '#7b0000', label: 'Critical' },
  };
  return styles[priority] || styles.medium;
};

const TicketsPage = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [tickets, setTickets] = useState([]);
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
  const [statusTab, setStatusTab] = useState('open');
  const [filters, setFilters] = useState({
    status: 'open',
    category: '',
    priority: '',
    search: '',
    assignedTo: '',
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

  const queryClient = useQueryClient();

  // React Query for tickets (replaces loadTickets + setInterval)
  const ticketQueryKey = ['tickets', pagination.page, pagination.limit, filters];
  const { data: ticketsData, isLoading: loading } = useQuery({
    queryKey: ticketQueryKey,
    queryFn: async () => {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...ticketsService.buildTicketFilters(filters)
      };
      return ticketsService.getTickets(params);
    },
    refetchInterval: 30000,
    keepPreviousData: true,
  });

  // Sync query data into existing state (minimal refactor)
  useEffect(() => {
    if (ticketsData) {
      setTickets(ticketsData.data);
      setPagination(ticketsData.pagination);
    }
  }, [ticketsData]);

  // React Query for stats
  useQuery({
    queryKey: ['tickets', 'stats'],
    queryFn: async () => {
      const response = await ticketsService.getTicketStats();
      return response.data;
    },
    enabled: user?.role === 'admin',
    refetchInterval: 30000,
    onSuccess: (data) => setStats(data),
  });

  // Wrappers for backward compat with the rest of the component
  const loadTickets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
  }, [queryClient]);

  const loadStats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tickets', 'stats'] });
  }, [queryClient]);

  // Event handlers
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleStatusTabChange = (event, newValue) => {
    setStatusTab(newValue);
    handleFilterChange('status', newValue === 'all' ? '' : newValue);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      category: '',
      priority: '',
      search: '',
      assignedTo: '',
      isEscalated: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    setStatusTab('all');
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

  // Derive ticket ID display string
  const getTicketDisplayId = (ticket) => {
    if (ticket.ticketNumber) return `#${ticket.ticketNumber}`;
    // Fallback: last 6 chars of _id
    return `#${ticket._id?.slice(-6).toUpperCase()}`;
  };

  // ---- Stat Card Component ----
  const StatCard = ({ icon: Icon, label, value, color, suffix }) => (
    <Card
      sx={{
        borderRadius: 2.5,
        boxShadow: COLORS.cardShadow,
        border: `1px solid ${alpha(color, 0.12)}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: COLORS.cardShadowHover,
          transform: 'translateY(-2px)',
        },
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: color,
        },
      }}
    >
      <CardContent sx={{ py: 2, px: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}
            >
              {label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color, lineHeight: 1.2 }}>
                {value}
              </Typography>
              {suffix && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {suffix}
                </Typography>
              )}
            </Box>
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(color, 0.1),
            }}
          >
            <Icon sx={{ fontSize: 24, color }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // ---- Status Badge Component ----
  const StatusBadge = ({ status }) => {
    const style = getStatusStyle(status);
    return (
      <Chip
        label={ticketsService.formatTicketStatus(status)}
        size="small"
        sx={{
          height: 24,
          fontSize: '0.7rem',
          fontWeight: 600,
          bgcolor: style.bg,
          color: style.color,
          border: `1px solid ${alpha(style.color, 0.2)}`,
          '& .MuiChip-label': { px: 1 },
        }}
      />
    );
  };

  // ---- Priority Badge Component ----
  const PriorityBadge = ({ priority }) => {
    const style = getPriorityStyle(priority);
    return (
      <Chip
        size="small"
        label={ticketsService.formatTicketPriority(priority)}
        sx={{
          height: 22,
          fontSize: '0.65rem',
          fontWeight: 600,
          bgcolor: style.bg,
          color: style.color,
          border: `1px solid ${alpha(style.color, 0.2)}`,
          '& .MuiChip-label': { px: 0.8 },
        }}
      />
    );
  };

  // ---- Desktop Table Row ----
  const TicketTableRow = ({ ticket, index }) => {
    const isOverdue = ticketsService.isTicketOverdue(ticket);
    const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

    return (
      <TableRow
        hover
        onClick={() => openDialog('view', ticket)}
        sx={{
          cursor: 'pointer',
          transition: 'background 0.15s ease',
          '&:hover': {
            bgcolor: alpha(COLORS.primary, 0.03),
          },
          ...(isOverdue && {
            borderLeft: `3px solid ${COLORS.accent}`,
          }),
          ...(ticket.priority === 'urgent' && !isResolved && {
            borderLeft: `3px solid ${COLORS.priorityUrgent}`,
          }),
        }}
      >
        {/* Ticket ID */}
        <TableCell sx={{ py: 1.5, width: 100 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: COLORS.primary,
              fontFamily: 'monospace',
              fontSize: '0.8rem',
            }}
          >
            {getTicketDisplayId(ticket)}
          </Typography>
        </TableCell>

        {/* Subject */}
        <TableCell sx={{ py: 1.5, maxWidth: 300 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 280,
              display: 'block',
              color: 'text.primary',
            }}
          >
            {ticket.title}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              maxWidth: 280,
            }}
          >
            {ticketsService.formatTicketCategory(ticket.category)}
          </Typography>
        </TableCell>

        {/* Status */}
        <TableCell sx={{ py: 1.5 }}>
          <StatusBadge status={ticket.status} />
        </TableCell>

        {/* Priority */}
        <TableCell sx={{ py: 1.5 }}>
          <PriorityBadge priority={ticket.priority} />
        </TableCell>

        {/* Created */}
        <TableCell sx={{ py: 1.5 }}>
          <Tooltip title={ticketsService.formatExactDateTime(ticket.createdAt)} arrow>
            <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {ticketsService.formatTimeAgo(ticket.createdAt)}
            </Typography>
          </Tooltip>
        </TableCell>

        {/* Assigned To */}
        <TableCell sx={{ py: 1.5 }}>
          {ticket.assignedTo ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: '0.7rem',
                  bgcolor: alpha(COLORS.primary, 0.15),
                  color: COLORS.primary,
                }}
              >
                {ticket.assignedTo.fullName?.charAt(0)}
              </Avatar>
              <Typography variant="caption" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                {ticket.assignedTo.fullName}
              </Typography>
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
              Unassigned
            </Typography>
          )}
        </TableCell>

        {/* Last Updated */}
        <TableCell sx={{ py: 1.5 }}>
          <Tooltip title={ticketsService.formatExactDateTime(ticket.updatedAt || ticket.createdAt)} arrow>
            <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {ticketsService.formatSmartDateTime(ticket.updatedAt || ticket.createdAt)}
            </Typography>
          </Tooltip>
        </TableCell>

        {/* Actions */}
        <TableCell sx={{ py: 1.5 }} onClick={(e) => e.stopPropagation()}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {ticket.comments && ticket.comments.length > 0 && (
              <Tooltip title={`${ticket.comments.length} comment(s)`} arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mr: 0.5 }}>
                  <ChatBubbleOutlineIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                    {ticket.comments.length}
                  </Typography>
                </Box>
              </Tooltip>
            )}
            <Tooltip title="Comment" arrow>
              <IconButton
                size="small"
                onClick={() => openDialog('comment', ticket)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: '#1976d2', bgcolor: alpha('#1976d2', 0.08) },
                }}
              >
                <CommentIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            {(isAdmin || (ticket.assignedTo && ticket.assignedTo._id === user?._id)) && !isResolved && (
              <Tooltip title="Resolve" arrow>
                <IconButton
                  size="small"
                  onClick={() => openDialog('resolve', ticket)}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: '#2e7d32', bgcolor: alpha('#2e7d32', 0.08) },
                  }}
                >
                  <DoneAllIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            {isAdmin && (
              <Tooltip title="Delete" arrow>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteTicket(ticket)}
                  sx={{
                    color: 'text.disabled',
                    '&:hover': { color: '#d32f2f', bgcolor: alpha('#d32f2f', 0.08) },
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </TableCell>
      </TableRow>
    );
  };

  // ---- Mobile Card Row ----
  const TicketMobileCard = ({ ticket, index }) => {
    const isOverdue = ticketsService.isTicketOverdue(ticket);
    const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
    const priorityColor = ticketsService.getPriorityColor(ticket.priority);
    const statusColor = ticketsService.getStatusColor(ticket.status);

    return (
      <Fade in timeout={300 + index * 50}>
        <Card
          onClick={() => openDialog('view', ticket)}
          sx={{
            mb: 1.5,
            borderRadius: 2.5,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            boxShadow: COLORS.cardShadow,
            cursor: 'pointer',
            position: 'relative',
            overflow: 'visible',
            transition: 'all 0.2s ease',
            '&:hover': {
              boxShadow: COLORS.cardShadowHover,
              transform: 'translateY(-1px)',
            },
            ...(isOverdue && {
              borderColor: alpha(COLORS.accent, 0.5),
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                bgcolor: COLORS.accent,
                borderRadius: '10px 10px 0 0'
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

            {/* Ticket ID + Title */}
            <Box sx={{ mb: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  color: COLORS.primary,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                }}
              >
                {getTicketDisplayId(ticket)}
              </Typography>
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{
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
            </Box>

            {/* Category Badge */}
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              <Chip
                label={ticketsService.formatTicketCategory(ticket.category)}
                variant="outlined"
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.65rem',
                  bgcolor: alpha(theme.palette.background.default, 0.5),
                  borderColor: alpha(theme.palette.divider, 0.3)
                }}
              />
              {ticket.assignedTo && (
                <Chip
                  icon={<AssignmentIndIcon sx={{ fontSize: 14 }} />}
                  label={ticket.assignedTo.fullName}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{
                    height: 22,
                    fontSize: '0.65rem',
                    '& .MuiChip-icon': { ml: 0.5 }
                  }}
                />
              )}
            </Stack>

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

              {(isAdmin || (ticket.assignedTo && ticket.assignedTo._id === user?._id)) && !isResolved && (
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
    );
  };

  // Status tabs config
  const statusTabs = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'waiting_response', label: 'Waiting' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
    ...(isAdmin ? [{ value: 'deleted', label: 'Deleted' }] : []),
  ];

  return (
    <Box sx={{ width: '100%', typography: 'body1' }}>
      {/* ===== Page Header ===== */}
      <Box
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3 },
          borderRadius: 3,
          background: COLORS.headerGradient,
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: -40,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          },
        }}
      >
        {/* Breadcrumb */}
        <Breadcrumbs
          separator={<NavigateNextIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} />}
          sx={{ mb: 1.5 }}
        >
          <Link
            underline="hover"
            sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            Dashboard
          </Link>
          <Typography sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.8rem', fontWeight: 600 }}>
            Tickets
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SupportIcon sx={{ fontSize: 28, color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.2 }}>
                Support Tickets
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.3 }}>
                Track and manage support requests
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{
              bgcolor: COLORS.accent,
              color: '#fff',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
              py: 1,
              boxShadow: '0 4px 14px rgba(245,124,0,0.4)',
              '&:hover': {
                bgcolor: '#e56c00',
                boxShadow: '0 6px 20px rgba(245,124,0,0.5)',
              },
            }}
          >
            New Ticket
          </Button>
        </Box>
      </Box>

      {/* ===== Stats Row ===== */}
      {isAdmin && stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={ChatBubbleOutlineIcon}
              label="Open Tickets"
              value={stats.summary?.open || 0}
              color={COLORS.statusOpen}
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={HourglassEmptyIcon}
              label="In Progress"
              value={stats.summary?.inProgress || stats.summary?.total - (stats.summary?.open || 0) - (stats.summary?.resolved || 0) || 0}
              color={COLORS.statusInProgress}
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={CheckCircleOutlineIcon}
              label="Resolved"
              value={stats.summary?.resolved || 0}
              color={COLORS.statusResolved}
            />
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              icon={SpeedIcon}
              label="Avg Response"
              value={stats.summary?.avgResolutionTimeHours || 0}
              color={COLORS.primary}
              suffix="hrs"
            />
          </Grid>
        </Grid>
      )}

      {/* ===== Filters Section ===== */}
      <Card
        sx={{
          mb: 3,
          borderRadius: 2.5,
          boxShadow: COLORS.cardShadow,
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          overflow: 'hidden',
        }}
      >
        {/* Status Tabs */}
        <Box sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
          <Tabs
            value={statusTab}
            onChange={handleStatusTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 44,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                minHeight: 44,
                py: 0,
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: COLORS.primary,
                },
              },
              '& .MuiTabs-indicator': {
                bgcolor: COLORS.primary,
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            {statusTabs.map((tab) => (
              <Tab key={tab.value} value={tab.value} label={tab.label} />
            ))}
          </Tabs>
        </Box>

        {/* Search + Filters Row */}
        <Box sx={{ p: 2 }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                placeholder="Search by subject or ID..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.default, 0.5),
                    '&:hover': { bgcolor: alpha(theme.palette.background.default, 0.8) },
                  },
                }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={filters.priority}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  label="Priority"
                  sx={{ borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}
                >
                  <MenuItem value="">All Priorities</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  label="Category"
                  sx={{ borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}
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
                  <MenuItem value="refund_approval">Refund Approval</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {isAdmin && (
              <Grid item xs={6} sm={3} md={2}>
                <TextField
                  fullWidth
                  placeholder="Assignee..."
                  value={filters.assignedTo}
                  onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AssignmentIndIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                    },
                  }}
                />
              </Grid>
            )}
            <Grid item xs={6} sm={3} md={isAdmin ? 1 : 3}>
              <Tooltip title="Clear all filters" arrow>
                <Button
                  startIcon={<ClearIcon />}
                  onClick={clearFilters}
                  variant="outlined"
                  size="small"
                  fullWidth
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    borderColor: alpha(theme.palette.divider, 0.2),
                    color: 'text.secondary',
                    height: 40,
                    '&:hover': {
                      borderColor: COLORS.accent,
                      color: COLORS.accent,
                    },
                  }}
                >
                  Clear
                </Button>
              </Tooltip>
            </Grid>
          </Grid>
        </Box>

        {/* Loading indicator */}
        {loading && (
          <LinearProgress
            sx={{
              height: 2,
              '& .MuiLinearProgress-bar': { bgcolor: COLORS.accent },
              bgcolor: alpha(COLORS.accent, 0.1),
            }}
          />
        )}
      </Card>

      {/* ===== Tickets Content ===== */}
      {loading && tickets.length === 0 ? (
        <Card sx={{ borderRadius: 2.5, boxShadow: COLORS.cardShadow, overflow: 'hidden' }}>
          <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={44} sx={{ color: COLORS.primary }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Loading tickets...
            </Typography>
          </Box>
        </Card>
      ) : tickets.length === 0 ? (
        /* ===== Empty State ===== */
        <Card
          sx={{
            borderRadius: 2.5,
            boxShadow: COLORS.cardShadow,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}
        >
          <Box
            sx={{
              py: 8,
              px: 4,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: alpha(COLORS.primary, 0.08),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <TicketIcon sx={{ fontSize: 40, color: alpha(COLORS.primary, 0.4) }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
              No tickets found
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 360 }}>
              There are no support tickets matching your current filters. Create a new ticket or adjust your search criteria.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{
                bgcolor: COLORS.primary,
                textTransform: 'none',
                borderRadius: 2,
                px: 3,
                fontWeight: 600,
                '&:hover': { bgcolor: '#15304f' },
              }}
            >
              Create a Ticket
            </Button>
          </Box>
        </Card>
      ) : (
        <>
          {/* ===== Desktop Table View ===== */}
          {!isTablet ? (
            <Card
              sx={{
                borderRadius: 2.5,
                boxShadow: COLORS.cardShadow,
                border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                overflow: 'hidden',
              }}
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow
                      sx={{
                        bgcolor: alpha(COLORS.primary, 0.04),
                        '& th': {
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          color: 'text.secondary',
                          borderBottom: `2px solid ${alpha(COLORS.primary, 0.08)}`,
                          py: 1.5,
                          whiteSpace: 'nowrap',
                        },
                      }}
                    >
                      <TableCell>ID</TableCell>
                      <TableCell>Subject</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Assigned To</TableCell>
                      <TableCell>Updated</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tickets.map((ticket, index) => (
                      <TicketTableRow key={ticket._id} ticket={ticket} index={index} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          ) : (
            /* ===== Mobile/Tablet Card View ===== */
            <Box>
              {tickets.map((ticket, index) => (
                <TicketMobileCard key={ticket._id} ticket={ticket} index={index} />
              ))}
            </Box>
          )}

          {/* ===== Pagination ===== */}
          {pagination.pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={pagination.pages}
                page={pagination.page}
                onChange={handlePageChange}
                color="primary"
                size={isMobile ? 'medium' : 'large'}
                sx={{
                  '& .MuiPaginationItem-root': {
                    borderRadius: 2,
                    fontWeight: 500,
                    '&.Mui-selected': {
                      bgcolor: COLORS.primary,
                      color: '#fff',
                      '&:hover': { bgcolor: '#15304f' },
                    },
                  },
                }}
              />
            </Box>
          )}

          {/* Results summary */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1, mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Showing {tickets.length} of {pagination.total} ticket{pagination.total !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </>
      )}

      {/* ===== Create Ticket Dialog ===== */}
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
            background: COLORS.headerGradient,
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            color: '#fff',
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.15)',
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
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
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
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS.priorityLow }} />
                        Low
                      </Box>
                    </MenuItem>
                    <MenuItem value="medium">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS.priorityMedium }} />
                        Medium
                      </Box>
                    </MenuItem>
                    <MenuItem value="high">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS.priorityHigh }} />
                        High
                      </Box>
                    </MenuItem>
                    <MenuItem value="urgent">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS.priorityUrgent }} />
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
                  borderColor: alpha(COLORS.accent, 0.5),
                  bgcolor: alpha(COLORS.accent, 0.02)
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
                    borderStyle: 'dashed',
                    borderColor: alpha(theme.palette.divider, 0.3),
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: COLORS.accent,
                      color: COLORS.accent,
                    },
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
        <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
          <Button
            onClick={() => {
              setCreateDialogOpen(false);
              setSelectedImages([]);
              setUploadedImageIds([]);
            }}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              color: 'text.secondary',
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
              bgcolor: COLORS.primary,
              fontWeight: 600,
              boxShadow: `0 4px 14px ${alpha(COLORS.primary, 0.35)}`,
              '&:hover': {
                bgcolor: '#15304f',
                boxShadow: `0 6px 20px ${alpha(COLORS.primary, 0.4)}`,
              },
            }}
          >
            Create Ticket
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Add Comment Dialog ===== */}
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
            bgcolor: alpha('#1976d2', 0.08),
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              bgcolor: '#1976d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CommentIcon sx={{ fontSize: 26, color: 'white' }} />
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
        <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
          <Button
            onClick={() => setCommentDialogOpen(false)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              color: 'text.secondary',
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
              bgcolor: COLORS.primary,
              fontWeight: 600,
              boxShadow: `0 4px 14px ${alpha(COLORS.primary, 0.35)}`,
              '&:hover': {
                bgcolor: '#15304f',
              },
            }}
          >
            Add Comment
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Resolve Dialog ===== */}
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
            bgcolor: alpha('#2e7d32', 0.08),
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              bgcolor: '#2e7d32',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <DoneAllIcon sx={{ fontSize: 26, color: 'white' }} />
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
        <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
          <Button
            onClick={() => setResolveDialogOpen(false)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              color: 'text.secondary',
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
              fontWeight: 600,
              boxShadow: `0 4px 14px ${alpha('#2e7d32', 0.35)}`,
              '&:hover': {
                boxShadow: `0 6px 20px ${alpha('#2e7d32', 0.4)}`,
              }
            }}
          >
            Resolve Ticket
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Ticket Detail Dialog ===== */}
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
