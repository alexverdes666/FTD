import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Close,
  Person,
  Email,
  Phone,
  Public,
  CalendarToday,
  ShoppingCart,
  Fingerprint,
  Assignment,
  Restore,
  ExpandMore
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { formatPhoneWithCountryCode } from '../utils/phoneUtils';

const DeletedLeadDetailsModal = ({ open, onClose, deletedLead, onRestore }) => {
  if (!deletedLead) return null;

  const { leadData, traces, orderReferences, deletedBy, deletedAt, deletionReason, migrationRecovered } = deletedLead;

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return dayjs(date).format('MMM D, YYYY HH:mm:ss');
  };

  const InfoRow = ({ label, value, icon: Icon }) => (
    <Box display="flex" alignItems="center" mb={1.5}>
      {Icon && <Icon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="body2">{value || 'N/A'}</Typography>
      </Box>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <Person />
            <Typography variant="h6">Deleted Lead Details</Typography>
            {migrationRecovered && (
              <Chip label="Migration Recovered" size="small" color="warning" />
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Basic Lead Information */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Lead Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <InfoRow
                  icon={Person}
                  label="Full Name"
                  value={`${leadData?.firstName || ''} ${leadData?.lastName || ''}`}
                />
                <InfoRow icon={Email} label="Email" value={leadData?.email || leadData?.newEmail} />
                <InfoRow icon={Phone} label="Phone" value={formatPhoneWithCountryCode(leadData?.phone || leadData?.newPhone, leadData?.country)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <InfoRow icon={Public} label="Country" value={leadData?.country} />
                <Box display="flex" alignItems="center" mb={1.5}>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                    Lead Type:
                  </Typography>
                  <Chip
                    label={leadData?.leadType?.toUpperCase() || 'N/A'}
                    size="small"
                    color={
                      leadData?.leadType === 'ftd'
                        ? 'success'
                        : leadData?.leadType === 'filler'
                        ? 'warning'
                        : 'info'
                    }
                  />
                </Box>
                <InfoRow label="Gender" value={leadData?.gender} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Deletion Information */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="error">
              Deletion Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <InfoRow icon={CalendarToday} label="Deleted At" value={formatDateTime(deletedAt)} />
                <InfoRow icon={Person} label="Deleted By" value={deletedBy?.fullName || 'Unknown'} />
              </Grid>
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                    Deletion Reason
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default' }}>
                    <Typography variant="body2">{deletionReason || 'No reason provided'}</Typography>
                  </Paper>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Order References */}
        {orderReferences && orderReferences.length > 0 && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box display="flex" alignItems="center" gap={1}>
                <ShoppingCart />
                <Typography variant="h6">
                  Orders ({orderReferences.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Order ID</TableCell>
                      <TableCell>Ordered As</TableCell>
                      <TableCell>Order Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orderReferences.map((orderRef, index) => (
                      <TableRow key={index}>
                        <TableCell>{orderRef.orderId}</TableCell>
                        <TableCell>
                          <Chip
                            label={orderRef.orderedAs || 'N/A'}
                            size="small"
                            color={
                              orderRef.orderedAs === 'ftd'
                                ? 'success'
                                : orderRef.orderedAs === 'filler'
                                ? 'warning'
                                : 'info'
                            }
                          />
                        </TableCell>
                        <TableCell>{formatDateTime(orderRef.orderCreatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Traces */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center" gap={1}>
              <Assignment />
              <Typography variant="h6">Traces & References</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      Deposit Calls
                    </Typography>
                    <Typography variant="h4">{traces?.depositCalls?.length || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      Call Changes
                    </Typography>
                    <Typography variant="h4">{traces?.callChangeRequests?.length || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      Refunds
                    </Typography>
                    <Typography variant="h4">{traces?.refundAssignments?.length || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      Fingerprints
                    </Typography>
                    <Typography variant="h4">{traces?.fingerprints?.length || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {traces?.clientBrokerAssignments && traces.clientBrokerAssignments.length > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Client Broker History
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {traces.clientBrokerAssignments.map((broker, index) => (
                    <Chip key={index} label={broker} size="small" />
                  ))}
                </Box>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Deposit Call Details */}
        {traces?.depositCalls && traces.depositCalls.length > 0 && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Deposit Call Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>FTD Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Order ID</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {traces.depositCalls.map((call, index) => (
                      <TableRow key={index}>
                        <TableCell>{call.ftdName || 'N/A'}</TableCell>
                        <TableCell>{call.ftdEmail || 'N/A'}</TableCell>
                        <TableCell>{call.ftdPhone || 'N/A'}</TableCell>
                        <TableCell>{call.orderId || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}
      </DialogContent>

      <DialogActions>
        {onRestore && (
          <Button
            variant="contained"
            color="success"
            startIcon={<Restore />}
            onClick={() => onRestore(deletedLead._id, `${leadData?.firstName} ${leadData?.lastName}`)}
          >
            Restore Lead
          </Button>
        )}
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeletedLeadDetailsModal;
