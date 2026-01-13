import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineOppositeContent
} from '@mui/lab';
import {
  Close,
  History,
  Assignment,
  ShoppingCart,
  Phone,
  Comment,
  Laptop,
  ExpandMore,
  Edit,
  Delete,
  Add,
  Visibility
} from '@mui/icons-material';
import api from '../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const LeadAuditHistoryModal = ({ open, onClose, leadId, leadName }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [auditHistory, setAuditHistory] = useState([]);
  const [fullHistory, setFullHistory] = useState(null);

  // Fetch data when modal opens
  useEffect(() => {
    if (open && leadId) {
      fetchAuditHistory();
      fetchFullHistory();
    }
  }, [open, leadId]);

  const fetchAuditHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/leads/${leadId}/audit-history`);
      setAuditHistory(response.data.data || []);
    } catch (err) {
      console.error('Error fetching audit history:', err);
      setError(err.response?.data?.message || 'Failed to load audit history');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  const fetchFullHistory = useCallback(async () => {
    try {
      const response = await api.get(`/leads/${leadId}/full-history`);
      setFullHistory(response.data.data || null);
    } catch (err) {
      console.error('Error fetching full history:', err);
    }
  }, [leadId]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return dayjs(date).format('MMM D, YYYY HH:mm:ss');
  };

  const getActionColor = (actionType) => {
    const colors = {
      CREATE: 'success',
      UPDATE: 'primary',
      DELETE: 'error',
      ASSIGN: 'info',
      UNASSIGN: 'warning'
    };
    return colors[actionType] || 'default';
  };

  const getActionIcon = (method, actionType) => {
    if (method === 'POST') return <Add fontSize="small" />;
    if (method === 'PUT' || method === 'PATCH') return <Edit fontSize="small" />;
    if (method === 'DELETE') return <Delete fontSize="small" />;
    if (method === 'GET') return <Visibility fontSize="small" />;
    return <History fontSize="small" />;
  };

  const renderActivityLogTab = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
    }

    if (auditHistory.length === 0) {
      return (
        <Alert severity="info" sx={{ m: 2 }}>
          No activity logs found for this lead.
        </Alert>
      );
    }

    return (
      <Timeline position="right">
        {auditHistory.map((log, index) => (
          <TimelineItem key={log._id || index}>
            <TimelineOppositeContent color="text.secondary" sx={{ maxWidth: '150px' }}>
              <Typography variant="caption" display="block">
                {formatDateTime(log.timestamp)}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                {dayjs(log.timestamp).fromNow()}
              </Typography>
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineDot color={getActionColor(log.action)}>
                {getActionIcon(log.method, log.action)}
              </TimelineDot>
              {index < auditHistory.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6" component="span">
                      {log.action || 'Action'}
                    </Typography>
                    <Chip label={log.method} size="small" color="primary" variant="outlined" />
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    By: {log.user?.fullName || 'Unknown'} ({log.user?.email || 'N/A'})
                  </Typography>

                  {/* Field-level changes */}
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <Box mt={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Changes:
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell><strong>Field</strong></TableCell>
                              <TableCell><strong>Before</strong></TableCell>
                              <TableCell><strong>After</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(log.changes).map(([field, change]) => (
                              <TableRow key={field}>
                                <TableCell>{field}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={JSON.stringify(change.old) || 'null'}
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={JSON.stringify(change.new) || 'null'}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* Device info */}
                  <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                    {log.browser && <Chip label={log.browser} size="small" icon={<Laptop />} />}
                    {log.device && <Chip label={log.device} size="small" />}
                    {log.ip && <Chip label={log.ip} size="small" />}
                    {log.geo?.country && <Chip label={log.geo.country} size="small" />}
                  </Box>
                </CardContent>
              </Card>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    );
  };

  const renderAssignmentsTab = () => {
    if (!fullHistory) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <Box p={2}>
        {/* Client Broker History */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="h6">
              Client Broker History ({fullHistory.clientBrokerHistory?.length || 0})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {fullHistory.clientBrokerHistory?.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Broker</TableCell>
                      <TableCell>Assigned At</TableCell>
                      <TableCell>Assigned By</TableCell>
                      <TableCell>Domain</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fullHistory.clientBrokerHistory.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{entry.clientBroker?.name || 'N/A'}</TableCell>
                        <TableCell>{formatDateTime(entry.assignedAt)}</TableCell>
                        <TableCell>{entry.assignedBy?.fullName || 'N/A'}</TableCell>
                        <TableCell>{entry.domain || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No client broker history</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Client Network History */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="h6">
              Client Network History ({fullHistory.clientNetworkHistory?.length || 0})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {fullHistory.clientNetworkHistory?.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Network</TableCell>
                      <TableCell>Assigned At</TableCell>
                      <TableCell>Assigned By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fullHistory.clientNetworkHistory.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{entry.clientNetwork?.name || 'N/A'}</TableCell>
                        <TableCell>{formatDateTime(entry.assignedAt)}</TableCell>
                        <TableCell>{entry.assignedBy?.fullName || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No client network history</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Campaign History */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="h6">
              Campaign History ({fullHistory.campaignHistory?.length || 0})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {fullHistory.campaignHistory?.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Campaign</TableCell>
                      <TableCell>Assigned At</TableCell>
                      <TableCell>Assigned By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fullHistory.campaignHistory.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{entry.campaign?.name || 'N/A'}</TableCell>
                        <TableCell>{formatDateTime(entry.assignedAt)}</TableCell>
                        <TableCell>{entry.assignedBy?.fullName || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No campaign history</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Our Network History */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="h6">
              Our Network History ({fullHistory.ourNetworkHistory?.length || 0})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {fullHistory.ourNetworkHistory?.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Network</TableCell>
                      <TableCell>Assigned At</TableCell>
                      <TableCell>Assigned By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fullHistory.ourNetworkHistory.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{entry.ourNetwork?.name || 'N/A'}</TableCell>
                        <TableCell>{formatDateTime(entry.assignedAt)}</TableCell>
                        <TableCell>{entry.assignedBy?.fullName || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">No our network history</Typography>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  };

  const renderOrdersTab = () => {
    if (!fullHistory) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (!fullHistory.orders || fullHistory.orders.length === 0) {
      return (
        <Alert severity="info" sx={{ m: 2 }}>
          This lead has not been used in any orders.
        </Alert>
      );
    }

    return (
      <Box p={2}>
        <Typography variant="h6" gutterBottom>
          Orders Using This Lead ({fullHistory.orders.length})
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order ID</TableCell>
                <TableCell>Ordered As</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Requested</TableCell>
                <TableCell>Fulfilled</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fullHistory.orders.map((order) => (
                <TableRow key={order._id}>
                  <TableCell>{order._id}</TableCell>
                  <TableCell>
                    <Chip
                      label={order.orderedAs || 'N/A'}
                      size="small"
                      color={order.orderedAs === 'ftd' ? 'success' : 'primary'}
                    />
                  </TableCell>
                  <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                  <TableCell>
                    <Chip label={order.status} size="small" />
                  </TableCell>
                  <TableCell>
                    FTD: {order.requests?.ftd || 0}, Filler: {order.requests?.filler || 0}, Cold: {order.requests?.cold || 0}
                  </TableCell>
                  <TableCell>
                    FTD: {order.fulfilled?.ftd || 0}, Filler: {order.fulfilled?.filler || 0}, Cold: {order.fulfilled?.cold || 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderCallsTab = () => {
    if (!fullHistory) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <Box p={2}>
        <Typography variant="h6" gutterBottom>
          Call Tracking ({fullHistory.callTracking?.length || 0})
        </Typography>
        {fullHistory.callTracking?.length > 0 ? (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Call Number</TableCell>
                  <TableCell>Verified</TableCell>
                  <TableCell>Updated By</TableCell>
                  <TableCell>Updated At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fullHistory.callTracking.map((call, index) => (
                  <TableRow key={index}>
                    <TableCell>{call.orderId || 'N/A'}</TableCell>
                    <TableCell>{call.callNumber}</TableCell>
                    <TableCell>
                      <Chip
                        label={call.verified ? 'Yes' : 'No'}
                        size="small"
                        color={call.verified ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{call.updatedBy?.fullName || 'N/A'}</TableCell>
                    <TableCell>{formatDateTime(call.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography color="text.secondary">No call tracking data</Typography>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Comments ({fullHistory.comments?.length || 0})
        </Typography>
        {fullHistory.comments?.length > 0 ? (
          fullHistory.comments.map((comment, index) => (
            <Card key={index} variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="body2">{comment.text}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {comment.author?.fullName || 'Unknown'} - {formatDateTime(comment.createdAt)}
                </Typography>
              </CardContent>
            </Card>
          ))
        ) : (
          <Typography color="text.secondary">No comments</Typography>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <History />
            <Typography variant="h6">Lead Audit History</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {leadName || `Lead ID: ${leadId}`}
        </Typography>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth">
          <Tab icon={<History />} label="Activity Log" />
          <Tab icon={<Assignment />} label="Assignments" />
          <Tab icon={<ShoppingCart />} label="Orders" />
          <Tab icon={<Phone />} label="Calls & Comments" />
        </Tabs>
      </Box>

      <DialogContent dividers sx={{ minHeight: 400, maxHeight: '70vh' }}>
        {tabValue === 0 && renderActivityLogTab()}
        {tabValue === 1 && renderAssignmentsTab()}
        {tabValue === 2 && renderOrdersTab()}
        {tabValue === 3 && renderCallsTab()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LeadAuditHistoryModal;
