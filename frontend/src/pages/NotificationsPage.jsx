import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Button,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Paper,
  Pagination,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Notifications as NotificationIcon,
  Check as CheckIcon,
  CheckCircle as CheckAllIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  SupportAgent as TicketIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Announcement as AnnouncementIcon,
  MoreVert as MoreVertIcon,
  Visibility as ViewIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  selectNotifications,
  selectUnreadCount,
  selectNotificationsLoading,
  selectNotificationsError,
  selectNotificationsPagination,
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearError
} from '../store/slices/notificationSlice';
import { toast } from 'react-toastify';
import { formatDistanceToNow, format } from 'date-fns';

const NotificationsPage = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loading = useSelector(selectNotificationsLoading);
  const error = useSelector(selectNotificationsError);
  const pagination = useSelector(selectNotificationsPagination);

  const [filters, setFilters] = useState({
    type: '',
    priority: '',
    isRead: '',
    search: ''
  });

  const [selectedNotification, setSelectedNotification] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [notificationMenuAnchor, setNotificationMenuAnchor] = useState(null);
  const [selectedNotificationForMenu, setSelectedNotificationForMenu] = useState(null);

  // Load notifications on component mount and filter changes
  const loadNotifications = useCallback(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      ...filters
    };

    // Remove empty filters
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });

    dispatch(fetchNotifications(params));
  }, [dispatch, pagination.page, pagination.limit, filters]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Clear error on component mount
  useEffect(() => {
    if (error) {
      dispatch(clearError());
    }
  }, [dispatch, error]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      priority: '',
      isRead: '',
      search: ''
    });
  };

  const handlePageChange = (event, newPage) => {
    dispatch(fetchNotifications({
      ...filters,
      page: newPage,
      limit: pagination.limit
    }));
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read if not already read
    if (!notification.isRead) {
      try {
        await dispatch(markNotificationAsRead(notification._id)).unwrap();
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate to related page
    if (notification.type.startsWith('ticket_')) {
      // For all ticket-related notifications, navigate to tickets page
      navigate('/tickets');
    } else if (notification.actionUrl) {
      navigate(notification.actionUrl);
    } else {
      // Open detail dialog
      setSelectedNotification(notification);
      setDetailDialogOpen(true);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await dispatch(markAllNotificationsAsRead()).unwrap();
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all notifications as read');
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await dispatch(deleteNotification(notificationId)).unwrap();
      toast.success('Notification deleted');
      handleCloseNotificationMenu();
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const handleOpenNotificationMenu = (event, notification) => {
    event.stopPropagation();
    setNotificationMenuAnchor(event.currentTarget);
    setSelectedNotificationForMenu(notification);
  };

  const handleCloseNotificationMenu = () => {
    setNotificationMenuAnchor(null);
    setSelectedNotificationForMenu(null);
  };

  const getNotificationIcon = (type, priority) => {
    const iconProps = { 
      fontSize: 'medium',
      color: priority === 'urgent' ? 'error' : priority === 'high' ? 'warning' : 'primary'
    };
    
    switch (type) {
      case 'ticket_created':
      case 'ticket_updated':
      case 'ticket_commented':
      case 'ticket_assigned':
      case 'ticket_resolved':
      case 'ticket_closed':
        return <TicketIcon {...iconProps} />;
      case 'system':
        if (priority === 'urgent' || priority === 'high') {
          return <WarningIcon {...iconProps} />;
        }
        return <InfoIcon {...iconProps} />;
      default:
        return <AnnouncementIcon {...iconProps} />;
    }
  };

  const getNotificationColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return theme.palette.error.main;
      case 'high':
        return theme.palette.warning.main;
      case 'medium':
        return theme.palette.info.main;
      case 'low':
        return theme.palette.grey[500];
      default:
        return theme.palette.info.main;
    }
  };

  const getPriorityChip = (priority) => {
    const colors = {
      urgent: 'error',
      high: 'warning',
      medium: 'info',
      low: 'default'
    };

    return (
      <Chip
        label={priority.toUpperCase()}
        size="small"
        color={colors[priority] || 'default'}
        sx={{ ml: 1 }}
      />
    );
  };

  if (loading && notifications.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Notifications
        </Typography>
        {unreadCount > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </Typography>
            <Button
              startIcon={<CheckAllIcon />}
              onClick={handleMarkAllAsRead}
              size="small"
            >
              Mark All Read
            </Button>
          </Box>
        )}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search notifications..."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.type}
                  label="Type"
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="ticket_created">New Ticket</MenuItem>
                  <MenuItem value="ticket_commented">Comment</MenuItem>
                  <MenuItem value="ticket_resolved">Resolved</MenuItem>
                  <MenuItem value="ticket_updated">Updated</MenuItem>
                  <MenuItem value="system">System</MenuItem>
                  <MenuItem value="general">General</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={filters.priority}
                  label="Priority"
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                >
                  <MenuItem value="">All Priorities</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.isRead}
                  label="Status"
                  onChange={(e) => handleFilterChange('isRead', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="false">Unread</MenuItem>
                  <MenuItem value="true">Read</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                onClick={clearFilters}
                startIcon={<FilterIcon />}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Notifications List */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <NotificationIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No notifications found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {Object.values(filters).some(filter => filter !== '') 
                  ? 'Try adjusting your filters'
                  : 'You\'ll see notifications here when they arrive'
                }
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification._id}>
                  <ListItem
                    button
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      backgroundColor: notification.isRead 
                        ? 'transparent' 
                        : alpha(theme.palette.primary.main, 0.05),
                      borderLeft: notification.isRead 
                        ? 'none' 
                        : `4px solid ${getNotificationColor(notification.priority)}`,
                      '&:hover': {
                        backgroundColor: notification.isRead 
                          ? theme.palette.action.hover 
                          : alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          backgroundColor: getNotificationColor(notification.priority),
                          width: 40,
                          height: 40
                        }}
                      >
                        {getNotificationIcon(notification.type, notification.priority)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: notification.isRead ? 400 : 600,
                              fontSize: '1rem'
                            }}
                          >
                            {notification.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getPriorityChip(notification.priority)}
                            {!notification.isRead && (
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: theme.palette.primary.main
                                }}
                              />
                            )}
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenNotificationMenu(e, notification)}
                            >
                              <MoreVertIcon />
                            </IconButton>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 1 }}
                          >
                            {notification.message}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </Typography>
                            {notification.sender && (
                              <Typography variant="caption" color="text.secondary">
                                by {notification.sender.fullName}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pagination.pages}
            page={pagination.page}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}

      {/* Notification Menu */}
      <Menu
        anchorEl={notificationMenuAnchor}
        open={Boolean(notificationMenuAnchor)}
        onClose={handleCloseNotificationMenu}
      >
        {selectedNotificationForMenu && !selectedNotificationForMenu.isRead && (
          <MenuItem
            onClick={() => {
              dispatch(markNotificationAsRead(selectedNotificationForMenu._id));
              handleCloseNotificationMenu();
            }}
          >
            <CheckIcon sx={{ mr: 1 }} />
            Mark as Read
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setSelectedNotification(selectedNotificationForMenu);
            setDetailDialogOpen(true);
            handleCloseNotificationMenu();
          }}
        >
          <ViewIcon sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem
          onClick={() => handleDeleteNotification(selectedNotificationForMenu._id)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Notification Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedNotification && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  {selectedNotification.title}
                </Typography>
                <IconButton onClick={() => setDetailDialogOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body1" gutterBottom>
                  {selectedNotification.message}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  {getPriorityChip(selectedNotification.priority)}
                  <Chip
                    label={selectedNotification.type.replace('_', ' ').toUpperCase()}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={selectedNotification.isRead ? 'Read' : 'Unread'}
                    size="small"
                    color={selectedNotification.isRead ? 'default' : 'primary'}
                  />
                </Box>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Created: {format(new Date(selectedNotification.createdAt), 'PPpp')}
                  </Typography>
                  {selectedNotification.sender && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                      From: {selectedNotification.sender.fullName}
                    </Typography>
                  )}
                </Box>

                {selectedNotification.readAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Read: {format(new Date(selectedNotification.readAt), 'PPpp')}
                  </Typography>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              {(selectedNotification.type.startsWith('ticket_') || selectedNotification.actionUrl) && (
                <Button
                  onClick={() => {
                    if (selectedNotification.type.startsWith('ticket_')) {
                      navigate('/tickets');
                    } else {
                      navigate(selectedNotification.actionUrl);
                    }
                    setDetailDialogOpen(false);
                  }}
                  variant="contained"
                >
                  View Related Item
                </Button>
              )}
              <Button onClick={() => setDetailDialogOpen(false)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default NotificationsPage;
