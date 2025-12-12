import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Chip,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
} from '@mui/material';
import {
  Schedule as TimeIcon,
  Language as DomainIcon,
  Computer as DeviceIcon,
  Cookie as CookieIcon,
  Storage as StorageIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
const SessionMetadataDialog = ({ open, onClose, lead, sessionData }) => {
  if (!sessionData) return null;
  const formatDate = (date) => {
    return date ? new Date(date).toLocaleString() : 'N/A';
  };
  const isExpired = () => {
    if (!sessionData.createdAt) return true;
    const createdAt = new Date(sessionData.createdAt);
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    return createdAt < thirtyDaysAgo;
  };
  const getStatusColor = () => {
    if (isExpired()) return 'error';
    return sessionData.isActive ? 'success' : 'warning';
  };
  const getStatusText = () => {
    if (isExpired()) return 'Expired';
    return sessionData.isActive ? 'Active' : 'Inactive';
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <InfoIcon color="primary" />
          <Typography variant="h6">
            Session Details - {lead?.firstName} {lead?.lastName}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {}
          <Grid item xs={12}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Typography variant="h6">Session Status</Typography>
              <Chip
                label={getStatusText()}
                color={getStatusColor()}
                icon={sessionData.isActive ? <SuccessIcon /> : <ErrorIcon />}
              />
            </Box>
            {isExpired() && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This session has expired and cannot be accessed. Sessions expire after 30 days.
              </Alert>
            )}
          </Grid>
          {}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom color="primary">
              <TimeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Session Timeline
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><TimeIcon color="action" /></ListItemIcon>
                <ListItemText
                  primary="Created"
                  secondary={formatDate(sessionData.createdAt)}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><TimeIcon color="action" /></ListItemIcon>
                <ListItemText
                  primary="Last Accessed"
                  secondary={formatDate(sessionData.lastAccessedAt)}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><InfoIcon color="action" /></ListItemIcon>
                <ListItemText
                  primary="Session ID"
                  secondary={sessionData.sessionId}
                />
              </ListItem>
            </List>
          </Grid>
          {}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom color="primary">
              <DomainIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Session Metadata
            </Typography>
            <List dense>
              {sessionData.metadata?.domain && (
                <ListItem>
                  <ListItemIcon><DomainIcon color="action" /></ListItemIcon>
                  <ListItemText
                    primary="Domain"
                    secondary={sessionData.metadata.domain}
                  />
                </ListItem>
              )}
              <ListItem>
                <ListItemIcon><SuccessIcon color="action" /></ListItemIcon>
                <ListItemText
                  primary="Injection Success"
                  secondary={sessionData.metadata?.success ? 'Yes' : 'No'}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><InfoIcon color="action" /></ListItemIcon>
                <ListItemText
                  primary="Injection Type"
                  secondary={sessionData.metadata?.injectionType || 'N/A'}
                />
              </ListItem>
              {sessionData.metadata?.notes && (
                <ListItem>
                  <ListItemIcon><InfoIcon color="action" /></ListItemIcon>
                  <ListItemText
                    primary="Notes"
                    secondary={sessionData.metadata.notes}
                  />
                </ListItem>
              )}
            </List>
          </Grid>
          {}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom color="primary">
              <DeviceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Technical Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">User Agent</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {sessionData.userAgent || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Viewport</Typography>
                <Typography variant="body2">
                  {sessionData.viewport ?
                    `${sessionData.viewport.width} x ${sessionData.viewport.height}` :
                    'N/A'
                  }
                </Typography>
              </Grid>
            </Grid>
          </Grid>
          {}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom color="primary">
              <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Stored Data Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box display="flex" alignItems="center" gap={1}>
                  <CookieIcon color="action" />
                  <Typography variant="body2">
                    Cookies: {sessionData.cookies ? sessionData.cookies.length : 0}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box display="flex" alignItems="center" gap={1}>
                  <StorageIcon color="action" />
                  <Typography variant="body2">
                    localStorage: {sessionData.localStorage ?
                      Object.keys(sessionData.localStorage).length : 0} items
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box display="flex" alignItems="center" gap={1}>
                  <StorageIcon color="action" />
                  <Typography variant="body2">
                    sessionStorage: {sessionData.sessionStorage ?
                      Object.keys(sessionData.sessionStorage).length : 0} items
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Grid>
          {}
          {sessionData.isActive && !isExpired() && (
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Access Instructions:</strong>
                  <br />
                  • Click "Access Session" to open a browser with the restored session
                  • The browser will automatically navigate to the stored domain
                  • You can continue from where the FTD injection left off
                  • Make sure to close the browser when finished
                </Typography>
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
export default SessionMetadataDialog;