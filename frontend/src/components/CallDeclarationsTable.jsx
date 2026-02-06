import React, { useState, useEffect, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AccessTime as AccessTimeIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  PlayCircleOutline as PlayIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { fetchRecordingBlob } from '../services/callDeclarations';

const CallDeclarationsTable = ({
  declarations = [],
  loading = false,
  error = null,
  onViewDetails,
  onDelete,
  showAgent = false,
  emptyMessage = "No declarations found"
}) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatCurrency = (value) => `$${Number(value).toFixed(2)}`;

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const getCallTypeLabel = (callType, callCategory) => {
    if (callCategory === 'filler') return 'Filler Call';
    const labels = {
      deposit: 'Deposit Call',
      first_call: 'First Call',
      second_call: 'Second Call',
      third_call: '3rd Call',
      fourth_call: '4th Call',
      fifth_call: '5th Call',
      sixth_call: '6th Call',
      seventh_call: '7th Call',
      eighth_call: '8th Call',
      ninth_call: '9th Call',
      tenth_call: '10th Call',
    };
    return labels[callType] || callType || 'N/A';
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading declarations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  const [recordingDeclaration, setRecordingDeclaration] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioUrlRef = useRef(null);

  useEffect(() => {
    if (recordingDeclaration?.recordFile) {
      setAudioLoading(true);
      setAudioUrl(null);
      fetchRecordingBlob(recordingDeclaration.recordFile)
        .then((url) => {
          audioUrlRef.current = url;
          setAudioUrl(url);
        })
        .catch((err) => {
          console.error("Failed to load recording:", err);
        })
        .finally(() => setAudioLoading(false));
    }

    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [recordingDeclaration]);

  if (!declarations || declarations.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <PhoneIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {showAgent && <TableCell>Agent</TableCell>}
              {showAgent && <TableCell>Affiliate Manager</TableCell>}
              <TableCell>Call Date</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Lead</TableCell>
              <TableCell>Phone Number</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Bonus</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {declarations.map((declaration) => (
              <TableRow
                key={declaration._id}
                hover
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                {showAgent && (
                  <TableCell>
                    <Typography variant="body2">
                      {declaration.agent?.fullName || 'N/A'}
                    </Typography>
                  </TableCell>
                )}
                {showAgent && (
                  <TableCell>
                    <Typography variant="body2">
                      {declaration.affiliateManager?.fullName || 'N/A'}
                    </Typography>
                  </TableCell>
                )}
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(declaration.callDate)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                    label={formatDuration(declaration.callDuration)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {declaration.lead
                      ? `${declaration.lead.firstName || ''} ${declaration.lead.lastName || ''}`.trim() || 'N/A'
                      : 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {declaration.lineNumber || declaration.lead?.newPhone || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {getCallTypeLabel(declaration.callType, declaration.callCategory)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box>
                    <Typography variant="body2" fontWeight="medium" color="success.main">
                      {formatCurrency(declaration.totalBonus)}
                    </Typography>
                    {declaration.hourlyBonus > 0 && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        (incl. +{formatCurrency(declaration.hourlyBonus)} hourly)
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={getStatusLabel(declaration.status)}
                    size="small"
                    color={getStatusColor(declaration.status)}
                  />
                </TableCell>
                <TableCell align="right">
                  <Box display="flex" justifyContent="flex-end" gap={0.5}>
                    {declaration.recordFile && (
                      <Tooltip title="Play Recording">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => setRecordingDeclaration(declaration)}
                        >
                          <PlayIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {onViewDetails && (
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => onViewDetails(declaration)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {onDelete && declaration.status === 'pending' && (
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onDelete(declaration)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Recording Playback Dialog */}
      <Dialog
        open={!!recordingDeclaration}
        onClose={() => setRecordingDeclaration(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <PlayIcon color="primary" />
              <Typography variant="h6">Call Recording</Typography>
            </Box>
            <IconButton size="small" onClick={() => setRecordingDeclaration(null)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {recordingDeclaration && (
            <Box sx={{ py: 1 }}>
              <Box display="flex" gap={3} mb={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Agent</Typography>
                  <Typography variant="body2">{recordingDeclaration.agent?.fullName || 'N/A'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body2">{formatDate(recordingDeclaration.callDate)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Duration</Typography>
                  <Typography variant="body2">{formatDuration(recordingDeclaration.callDuration)}</Typography>
                </Box>
              </Box>
              {audioLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" py={2}>
                  <CircularProgress size={24} sx={{ mr: 1 }} />
                  <Typography variant="body2" color="text.secondary">Loading recording...</Typography>
                </Box>
              ) : audioUrl ? (
                <audio
                  controls
                  src={audioUrl}
                  style={{ width: '100%' }}
                />
              ) : (
                <Typography variant="body2" color="error">Failed to load recording</Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default React.memo(CallDeclarationsTable);
