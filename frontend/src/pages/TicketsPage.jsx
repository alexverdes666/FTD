import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
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
  Chip,
  Tooltip,
  Avatar,
  useTheme,
  Pagination,
  FormControlLabel,
  Switch,
  Collapse,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Assignment as AssignIcon,
  CheckCircle as ResolveIcon,
  Comment as CommentIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  AttachFile as AttachFileIcon,
  Image as ImageIcon,
  Close as CloseIcon
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

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [menuTicket, setMenuTicket] = useState(null);

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
  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...ticketsService.buildTicketFilters(filters)
      };
      
      const response = await ticketsService.getTickets(params);
      setTickets(response.data);
      setPagination(response.pagination);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
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

      await ticketsService.addComment(selectedTicket._id, commentData);
      toast.success('Comment added successfully');
      setCommentDialogOpen(false);
      setCommentData({ message: '', isInternal: false });
      loadTickets();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    }
  };

  // Assignment functionality removed - only admins handle all tickets

  const handleResolveTicket = async () => {
    try {
      await ticketsService.resolveTicket(selectedTicket._id, resolveData.resolutionNote);
      toast.success('Ticket resolved successfully');
      setResolveDialogOpen(false);
      setResolveData({ resolutionNote: '' });
      loadTickets();
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
      loadTickets();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete ticket');
    }
  };

  const handleMenuOpen = (event, ticket) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTicket(ticket);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTicket(null);
  };

  const openDialog = (dialogType, ticket = null) => {
    setSelectedTicket(ticket);
    handleMenuClose();
    
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
    // Update the ticket in the list
    setTickets(prev => prev.map(ticket => 
      ticket._id === updatedTicket._id ? updatedTicket : ticket
    ));
    loadStats(); // Refresh stats
  };

  // Check permissions
  const isAdmin = user?.role === 'admin';

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Support Tickets
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? 'contained' : 'outlined'}
          >
            Filters
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadTickets}
            variant="outlined"
          >
            Refresh
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            variant="contained"
          >
            Create Ticket
          </Button>
        </Stack>
      </Box>

      {/* Stats Cards - Only for Admins */}
      {isAdmin && stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Tickets
                </Typography>
                <Typography variant="h4">
                  {stats.summary?.total || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Open
                </Typography>
                <Typography variant="h4" color="info.main">
                  {stats.summary?.open || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                  Overdue
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.summary?.overdue || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Avg Resolution (hrs)
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.summary?.avgResolutionTimeHours || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Collapse in={showFilters}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  label="Search"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="waiting_response">Waiting Response</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="">All</MenuItem>
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
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    label="Priority"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {/* Assignee filter removed - only admins handle all tickets */}
              <Grid item xs={12} sm={6} md={2}>
                <Stack direction="row" spacing={1}>
                  <Button
                    startIcon={<ClearIcon />}
                    onClick={clearFilters}
                    variant="outlined"
                    size="small"
                  >
                    Clear
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Collapse>

      {/* Tickets Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Created By</TableCell>
                {isAdmin && <TableCell>Assigned To</TableCell>}
                <TableCell>Created</TableCell>
                <TableCell>Last Activity</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">
                      No tickets found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow key={ticket._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography 
                          variant="subtitle2" 
                          noWrap 
                          sx={{ 
                            maxWidth: 200,
                            cursor: 'pointer',
                            color: 'primary.main',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                          onClick={() => openDialog('view', ticket)}
                        >
                          {ticket.title}
                        </Typography>
                        {ticketsService.isTicketOverdue(ticket) && (
                          <Tooltip title="Overdue">
                            <ScheduleIcon color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ticketsService.formatTicketCategory(ticket.category)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ticketsService.formatTicketStatus(ticket.status)}
                        color={ticketsService.getStatusColor(ticket.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ticketsService.formatTicketPriority(ticket.priority)}
                        color={ticketsService.getPriorityColor(ticket.priority)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24 }}>
                          {ticket.createdBy?.fullName?.charAt(0)}
                        </Avatar>
                        <Typography variant="body2">
                          {ticket.createdBy?.fullName}
                        </Typography>
                      </Box>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          Admin Handled
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {ticketsService.formatTimeAgo(ticket.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {ticketsService.formatTimeAgo(ticket.lastActivityAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, ticket)}
                        size="small"
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <Pagination
              count={pagination.pages}
              page={pagination.page}
              onChange={handlePageChange}
              color="primary"
            />
          </Box>
        )}
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => openDialog('view', menuTicket)}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openDialog('comment', menuTicket)}>
          <ListItemIcon>
            <CommentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add Comment</ListItemText>
        </MenuItem>
        {isAdmin && (
          <MenuItem onClick={() => openDialog('resolve', menuTicket)}>
            <ListItemIcon>
              <ResolveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Resolve</ListItemText>
          </MenuItem>
        )}
        {isAdmin && (
          <>
            <Divider />
            <MenuItem onClick={() => handleDeleteTicket(menuTicket)} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Create Ticket Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Ticket</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={newTicket.title}
              onChange={(e) => setNewTicket(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={newTicket.description}
              onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={4}
              fullWidth
              required
            />
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select
                value={newTicket.category}
                onChange={(e) => setNewTicket(prev => ({ ...prev, category: e.target.value }))}
                label="Category"
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
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={newTicket.priority}
                onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value }))}
                label="Priority"
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Tags (comma separated)"
              value={newTicket.tags}
              onChange={(e) => setNewTicket(prev => ({ ...prev, tags: e.target.value }))}
              fullWidth
              placeholder="urgent, leads, payment"
            />
            
            {/* Image Upload Section */}
            <Box>
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
                >
                  {uploadingImages ? 'Uploading...' : 'Attach Images'}
                </Button>
              </label>
              
              {/* Display selected images */}
              {selectedImages.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Attached Images ({selectedImages.length}):
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                    {selectedImages.map((img) => (
                      <Card key={img.id} variant="outlined" sx={{ position: 'relative', width: 100, height: 100 }}>
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
                            onClick={() => handleRemoveImage(img.id)}
                            sx={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              bgcolor: 'background.paper',
                              '&:hover': { bgcolor: 'error.light' }
                            }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setSelectedImages([]);
            setUploadedImageIds([]);
          }}>Cancel</Button>
          <Button onClick={handleCreateTicket} variant="contained">Create Ticket</Button>
        </DialogActions>
      </Dialog>

      {/* Add Comment Dialog */}
      <Dialog open={commentDialogOpen} onClose={() => setCommentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Comment"
              value={commentData.message}
              onChange={(e) => setCommentData(prev => ({ ...prev, message: e.target.value }))}
              multiline
              rows={4}
              fullWidth
              required
            />
            {isAdmin && (
              <FormControlLabel
                control={
                  <Switch
                    checked={commentData.isInternal}
                    onChange={(e) => setCommentData(prev => ({ ...prev, isInternal: e.target.checked }))}
                  />
                }
                label="Internal comment (visible to admins only)"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddComment} variant="contained">Add Comment</Button>
        </DialogActions>
      </Dialog>

      {/* Assignment dialog removed - only admins handle all tickets */}

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onClose={() => setResolveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve Ticket</DialogTitle>
        <DialogContent>
          <TextField
            label="Resolution Note (optional)"
            value={resolveData.resolutionNote}
            onChange={(e) => setResolveData(prev => ({ ...prev, resolutionNote: e.target.value }))}
            multiline
            rows={4}
            fullWidth
            sx={{ mt: 2 }}
            placeholder="Describe how the ticket was resolved..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleResolveTicket} variant="contained" color="success">
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
