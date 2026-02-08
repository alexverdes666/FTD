import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Button,
  Chip,
  Tooltip,
  CircularProgress,
  Paper,
  useTheme
} from '@mui/material';
import {
  Notifications as NotificationIcon,
  NotificationsNone as NotificationNoneIcon,
  Check as CheckIcon,
  CheckCircle as CheckAllIcon,
  Delete as DeleteIcon,
  SupportAgent as TicketIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Announcement as AnnouncementIcon,
  SimCard as SimCardIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { 
  selectNotifications,
  selectUnreadCount,
  selectNotificationsLoading,
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  addNewNotification,
  updateUnreadCount,
  markNotificationReadLocally
} from '../store/slices/notificationSlice';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const NotificationBell = ({ onSocketConnect }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [page, setPage] = useState(1);
  
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loading = useSelector(selectNotificationsLoading);

  const open = Boolean(anchorEl);

  // Fetch initial data
  useEffect(() => {
    dispatch(fetchUnreadCount());
  }, [dispatch]);

  // Set up socket listeners for real-time notifications
  useEffect(() => {
    if (onSocketConnect && typeof onSocketConnect === 'function') {
      onSocketConnect((socket) => {
        // Listen for new notifications
        socket.on('new_notification', (data) => {
          dispatch(addNewNotification(data));
          
          // Show toast notification
          toast(`New notification: ${data.notification.title}`, {
            duration: 5000,
            icon: 'ℹ️',
          });
        });

        // Listen for notification read updates
        socket.on('notification_read', (data) => {
          dispatch(updateUnreadCount(data.unreadCount));
        });

        // Listen for all notifications read
        socket.on('notifications_all_read', (data) => {
          dispatch(updateUnreadCount(data.unreadCount));
        });

        // Listen for notification deletion
        socket.on('notification_deleted', (data) => {
          dispatch(updateUnreadCount(data.unreadCount));
        });
      });
    }
  }, [onSocketConnect, dispatch]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    if (notifications.length === 0) {
      dispatch(fetchNotifications({ page: 1, limit: 10 }));
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setPage(1);
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
      handleClose();
    } else if (notification.actionUrl) {
      navigate(notification.actionUrl);
      handleClose();
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

  const handleDeleteNotification = async (notificationId, event) => {
    event.stopPropagation();
    try {
      await dispatch(deleteNotification(notificationId)).unwrap();
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const getNotificationIcon = (type, priority) => {
    const iconProps = { fontSize: 'small' };
    
    switch (type) {
      case 'ticket_created':
      case 'ticket_updated':
      case 'ticket_commented':
      case 'ticket_assigned':
      case 'ticket_resolved':
      case 'ticket_closed':
        return <TicketIcon {...iconProps} />;
      case 'sim_card_cooldown':
        if (priority === 'urgent') {
          return <ErrorIcon {...iconProps} />;
        } else if (priority === 'high') {
          return <WarningIcon {...iconProps} />;
        }
        return <SimCardIcon {...iconProps} />;
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

  const loadMoreNotifications = () => {
    const nextPage = page + 1;
    dispatch(fetchNotifications({ page: nextPage, limit: 10 }));
    setPage(nextPage);
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          size="small"
          color="inherit"
          onClick={handleClick}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            max={99}
            sx={{
              "& .MuiBadge-badge": {
                fontSize: "0.65rem",
                height: 16,
                minWidth: 16,
                padding: "0 4px",
              },
            }}
          >
            {unreadCount > 0 ? <NotificationIcon sx={{ fontSize: 20 }} /> : <NotificationNoneIcon sx={{ fontSize: 20 }} />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 380,
            maxHeight: 500,
            mt: 1.5
          }
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Button
                size="small"
                startIcon={<CheckAllIcon />}
                onClick={handleMarkAllAsRead}
              >
                Mark All Read
              </Button>
            )}
          </Box>
          {unreadCount > 0 && (
            <Typography variant="body2" color="text.secondary">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>

        {/* Notifications List */}
        <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
          {loading && notifications.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <NotificationNoneIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No notifications yet
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
                      backgroundColor: notification.isRead ? 'transparent' : theme.palette.action.hover,
                      '&:hover': {
                        backgroundColor: notification.isRead 
                          ? theme.palette.action.hover 
                          : theme.palette.action.selected
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          backgroundColor: getNotificationColor(notification.priority),
                          width: 32,
                          height: 32
                        }}
                      >
                        {getNotificationIcon(notification.type, notification.priority)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primaryTypographyProps={{ component: 'div' }}
                      secondaryTypographyProps={{ component: 'div' }}
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: notification.isRead ? 400 : 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '200px'
                            }}
                          >
                            {notification.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {getPriorityChip(notification.priority)}
                            <IconButton
                              size="small"
                              onClick={(e) => handleDeleteNotification(notification._id, e)}
                              sx={{ ml: 1 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              mb: 0.5
                            }}
                          >
                            {notification.message}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </Typography>
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
        </Box>

        {/* Footer */}
        {notifications.length > 0 && (
          <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}`, textAlign: 'center' }}>
            <Button
              size="small"
              onClick={() => {
                navigate('/notifications');
                handleClose();
              }}
            >
              View All Notifications
            </Button>
          </Box>
        )}
      </Menu>
    </>
  );
};

export default React.memo(NotificationBell);
