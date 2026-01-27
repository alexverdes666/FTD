/**
 * Activity Page - Admin Real-Time User Activity Dashboard
 *
 * Shows live user activity, engagement metrics, and performance analytics.
 * Only accessible to admins.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  LinearProgress,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Badge,
  Divider,
  CircularProgress,
  Alert,
  Collapse,
  Button,
  useTheme
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Mouse as MouseIcon,
  Keyboard as KeyboardIcon,
  TouchApp as ClickIcon,
  Timer as TimerIcon,
  TrendingUp as EngagementIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Circle as CircleIcon,
  Speed as SpeedIcon,
  Pages as PagesIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';
import chatService from '../services/chatService';

// Format duration in milliseconds to human readable
const formatDuration = (ms) => {
  if (!ms || ms < 0) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

// Format time ago
const formatTimeAgo = (date) => {
  if (!date) return 'Never';
  
  const now = new Date();
  const then = new Date(date);
  const diff = now - then;
  
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  return then.toLocaleDateString();
};

// Role color mapping
const getRoleColor = (role) => {
  const colors = {
    admin: '#e91e63',
    affiliate_manager: '#9c27b0',
    agent: '#2196f3',
    lead_manager: '#ff9800',
    refunds_manager: '#4caf50',
    inventory_manager: '#00bcd4'
  };
  return colors[role] || '#757575';
};

// Engagement score color
const getEngagementColor = (score) => {
  if (score >= 70) return '#4caf50';
  if (score >= 40) return '#ff9800';
  return '#f44336';
};

// Live User Card Component
const LiveUserCard = ({ user, expanded, onToggle }) => {
  const theme = useTheme();
  
  return (
    <Card 
      sx={{ 
        mb: 2,
        border: `1px solid ${user.isFocused ? theme.palette.success.main : theme.palette.grey[300]}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: 4
        }
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <CircleIcon 
                  sx={{ 
                    fontSize: 12, 
                    color: user.isActive ? '#4caf50' : '#ff9800',
                    animation: user.isActive ? 'pulse 2s infinite' : 'none'
                  }} 
                />
              }
            >
              <Avatar sx={{ bgcolor: getRoleColor(user.userRole), width: 48, height: 48 }}>
                {user.userName?.charAt(0) || '?'}
              </Avatar>
            </Badge>
            
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {user.userName}
                </Typography>
                {user.fourDigitCode && (
                  <Chip 
                    label={user.fourDigitCode} 
                    size="small" 
                    sx={{ fontSize: '0.7rem', height: 20 }} 
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {user.userRole?.replace('_', ' ').toUpperCase()}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">
                Current Page
              </Typography>
              <Typography variant="body2" fontWeight="medium" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.currentPage || '/'}
              </Typography>
            </Box>
            
            <Tooltip title={user.isFocused ? 'Window focused' : 'Window not focused'}>
              <ViewIcon color={user.isFocused ? 'success' : 'disabled'} />
            </Tooltip>
            
            <IconButton size="small" onClick={onToggle}>
              {expanded ? <CollapseIcon /> : <ExpandIcon />}
            </IconButton>
          </Box>
        </Box>
        
        {/* Quick Stats Row */}
        <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
          <Tooltip title="Mouse Movements">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MouseIcon fontSize="small" color="action" />
              <Typography variant="body2">{user.totalMouseMovements?.toLocaleString() || 0}</Typography>
            </Box>
          </Tooltip>
          
          <Tooltip title="Keystrokes">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <KeyboardIcon fontSize="small" color="action" />
              <Typography variant="body2">{user.totalKeystrokes?.toLocaleString() || 0}</Typography>
            </Box>
          </Tooltip>
          
          <Tooltip title="Clicks">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ClickIcon fontSize="small" color="action" />
              <Typography variant="body2">{user.totalClicks?.toLocaleString() || 0}</Typography>
            </Box>
          </Tooltip>
          
          <Tooltip title="Session Duration">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TimerIcon fontSize="small" color="action" />
              <Typography variant="body2">{formatDuration(user.sessionDuration)}</Typography>
            </Box>
          </Tooltip>
          
          <Tooltip title="Engagement Score">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <EngagementIcon fontSize="small" sx={{ color: getEngagementColor(user.engagementScore) }} />
              <Typography variant="body2" sx={{ color: getEngagementColor(user.engagementScore) }}>
                {user.engagementScore || 0}%
              </Typography>
            </Box>
          </Tooltip>
          
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            Last active: {formatTimeAgo(user.lastActivityAt)}
          </Typography>
        </Box>
      </CardContent>
      
      {/* Expanded Details */}
      <Collapse in={expanded}>
        <Divider />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Active Time</Typography>
              <Typography variant="body2">{formatDuration(user.totalActiveTime)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Inactive Time</Typography>
              <Typography variant="body2">{formatDuration(user.totalInactiveTime)}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Session Started</Typography>
              <Typography variant="body2">{new Date(user.sessionStart).toLocaleTimeString()}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Scroll Events</Typography>
              <Typography variant="body2">{user.totalScrollEvents?.toLocaleString() || 0}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Collapse>
    </Card>
  );
};

// Main Performance Page Component
const ActivityPage = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [liveUsers, setLiveUsers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [pageAnalytics, setPageAnalytics] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [expandedUsers, setExpandedUsers] = useState({});
  
  // Fetch interval ref
  const fetchIntervalRef = useRef(null);
  
  // Fetch live users
  const fetchLiveUsers = useCallback(async () => {
    try {
      const response = await api.get('/user-activity/live');
      setLiveUsers(response.data.data || []);
    } catch (err) {
      console.error('Error fetching live users:', err);
    }
  }, []);
  
  // Fetch dashboard stats
  const fetchDashboardStats = useCallback(async () => {
    try {
      const response = await api.get('/user-activity/dashboard');
      setDashboardStats(response.data.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  }, []);
  
  // Fetch page analytics
  const fetchPageAnalytics = useCallback(async () => {
    try {
      const response = await api.get('/user-activity/analytics/pages');
      setPageAnalytics(response.data.data || []);
    } catch (err) {
      console.error('Error fetching page analytics:', err);
    }
  }, []);
  
  // Fetch user history
  const fetchUserHistory = useCallback(async (userId) => {
    try {
      const response = await api.get(`/user-activity/user/${userId}/history`);
      setUserHistory(response.data.data || []);
    } catch (err) {
      console.error('Error fetching user history:', err);
    }
  }, []);
  
  // Initial fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchLiveUsers(),
          fetchDashboardStats(),
          fetchPageAnalytics()
        ]);
        setError(null);
      } catch (err) {
        setError('Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAll();
    
    // Set up polling every 5 seconds
    fetchIntervalRef.current = setInterval(() => {
      fetchLiveUsers();
    }, 5000);
    
    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
    };
  }, [fetchLiveUsers, fetchDashboardStats, fetchPageAnalytics]);
  
  // Socket.IO real-time updates
  useEffect(() => {
    // Join admin performance room
    if (chatService.getConnectionStatus().isConnected) {
      chatService.socket?.emit('join_room', 'admin:performance');
    }
    
    // Listen for activity updates
    const handleActivityUpdate = (data) => {
      setLiveUsers(prev => {
        const index = prev.findIndex(u => u.userId.toString() === data.userId.toString());
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...data };
          return updated;
        }
        return prev;
      });
    };
    
    const handleSessionStarted = (data) => {
      fetchLiveUsers();
    };
    
    const handleSessionEnded = (data) => {
      setLiveUsers(prev => prev.filter(u => u.userId.toString() !== data.userId.toString()));
    };
    
    chatService.on('activity_update', handleActivityUpdate);
    chatService.on('user_session_started', handleSessionStarted);
    chatService.on('user_session_ended', handleSessionEnded);
    
    return () => {
      chatService.off('activity_update', handleActivityUpdate);
      chatService.off('user_session_started', handleSessionStarted);
      chatService.off('user_session_ended', handleSessionEnded);
      
      if (chatService.socket) {
        chatService.socket.emit('leave_room', 'admin:performance');
      }
    };
  }, [fetchLiveUsers]);
  
  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchLiveUsers(),
      fetchDashboardStats(),
      fetchPageAnalytics()
    ]);
    setRefreshing(false);
  };
  
  // Toggle user expansion
  const toggleUserExpanded = (userId) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Performance Monitor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time user activity tracking and analytics
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip 
            icon={<CircleIcon sx={{ color: '#4caf50 !important', fontSize: '12px !important' }} />}
            label={`${liveUsers.length} Live Users`}
            color="success"
            variant="outlined"
          />
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </IconButton>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h3" fontWeight="bold">
                    {liveUsers.length}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Users Online Now
                  </Typography>
                </Box>
                <PersonIcon sx={{ fontSize: 48, opacity: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h3" fontWeight="bold">
                    {dashboardStats?.today?.totalSessions || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Sessions Today
                  </Typography>
                </Box>
                <SpeedIcon sx={{ fontSize: 48, opacity: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h3" fontWeight="bold">
                    {dashboardStats?.today?.avgEngagement || 0}%
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Avg Engagement
                  </Typography>
                </Box>
                <EngagementIcon sx={{ fontSize: 48, opacity: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h3" fontWeight="bold">
                    {formatDuration(dashboardStats?.today?.totalActiveTime || 0)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Active Time
                  </Typography>
                </Box>
                <TimerIcon sx={{ fontSize: 48, opacity: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`Live Users (${liveUsers.length})`} icon={<PersonIcon />} iconPosition="start" />
          <Tab label="User Stats" icon={<EngagementIcon />} iconPosition="start" />
          <Tab label="Page Analytics" icon={<PagesIcon />} iconPosition="start" />
        </Tabs>
      </Paper>
      
      {/* Tab Content */}
      {tab === 0 && (
        <Box>
          {liveUsers.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                No users currently online
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Users will appear here when they're active on the platform
              </Typography>
            </Paper>
          ) : (
            liveUsers.map(liveUser => (
              <LiveUserCard
                key={liveUser.userId}
                user={liveUser}
                expanded={expandedUsers[liveUser.userId]}
                onToggle={() => toggleUserExpanded(liveUser.userId)}
              />
            ))
          )}
        </Box>
      )}
      
      {tab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: theme.palette.grey[100] }}>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="center">Sessions</TableCell>
                <TableCell align="center">Active Time</TableCell>
                <TableCell align="center">Inactive Time</TableCell>
                <TableCell align="center">Engagement</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Last Active</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dashboardStats?.userStats?.map((stat) => (
                <TableRow key={stat.userId} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: getRoleColor(stat.userRole) }}>
                        {stat.userName?.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">{stat.userName}</Typography>
                        {stat.fourDigitCode && (
                          <Typography variant="caption" color="text.secondary">#{stat.fourDigitCode}</Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={stat.userRole?.replace('_', ' ')} 
                      size="small"
                      sx={{ backgroundColor: getRoleColor(stat.userRole), color: 'white' }}
                    />
                  </TableCell>
                  <TableCell align="center">{stat.sessions}</TableCell>
                  <TableCell align="center">{formatDuration(stat.totalActiveTime)}</TableCell>
                  <TableCell align="center">{formatDuration(stat.totalInactiveTime)}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <CircularProgress 
                        variant="determinate" 
                        value={stat.avgEngagement || 0} 
                        size={24}
                        sx={{ color: getEngagementColor(stat.avgEngagement) }}
                      />
                      <Typography variant="body2">{stat.avgEngagement || 0}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={stat.isCurrentlyLive ? 'Online' : 'Offline'}
                      color={stat.isCurrentlyLive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="caption">{formatTimeAgo(stat.lastActivity)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
              {(!dashboardStats?.userStats || dashboardStats.userStats.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No user activity data for today</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {tab === 2 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: theme.palette.grey[100] }}>
                <TableCell>Page Path</TableCell>
                <TableCell align="center">Visits</TableCell>
                <TableCell align="center">Unique Users</TableCell>
                <TableCell align="center">Avg Duration</TableCell>
                <TableCell align="center">Avg Scroll Depth</TableCell>
                <TableCell align="center">Total Interactions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageAnalytics.map((page, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">{page.path}</Typography>
                  </TableCell>
                  <TableCell align="center">{page.visits}</TableCell>
                  <TableCell align="center">{page.uniqueUsers}</TableCell>
                  <TableCell align="center">{formatDuration(page.avgDuration)}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={page.avgScrollDepth || 0} 
                        sx={{ width: 60, height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption">{Math.round(page.avgScrollDepth || 0)}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">{page.totalInteractions}</TableCell>
                </TableRow>
              ))}
              {pageAnalytics.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No page analytics data available</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* CSS Animations */}
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );
};

export default ActivityPage;

