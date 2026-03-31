import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  CircularProgress,
  Chip,
  Paper,
  Alert,
  IconButton,
  Radio,
} from '@mui/material';
import {
  Call as CallIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { fetchCDRCalls, fetchRecordingBlob, createDeclaration } from '../services/callDeclarations';
import toast from 'react-hot-toast';

// Map call slot number to call type for declarations
const CALL_NUMBER_TO_TYPE = {
  1: 'first_call',
  2: 'second_call',
  3: 'third_call',
  4: 'fourth_call',
  5: 'fifth_call',
  6: 'sixth_call',
  7: 'seventh_call',
  8: 'eighth_call',
  9: 'ninth_call',
  10: 'tenth_call',
};

const CALL_NUMBER_TO_LABEL = {
  1: '1st Call',
  2: '2nd Call',
  3: '3rd Call',
  4: '4th Call',
  5: '5th Call',
  6: '6th Call',
  7: '7th Call',
  8: '8th Call',
  9: '9th Call',
  10: '10th Call',
};

/**
 * Dialog for agents to declare a CDR call for a specific call slot on the Deposit Calls page.
 * Auto-detects the lead from the deposit call record, fetches agent's CDR calls filtered by lead,
 * and submits a call declaration for AM approval.
 */
const AgentCallScheduleDialog = ({ open, onClose, depositCall, callNumber, onSuccess }) => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [playingRecording, setPlayingRecording] = useState(null);

  // Derive lead info and AM from deposit call
  const leadId = depositCall?.leadId?._id || depositCall?.leadId;
  const leadPhone = depositCall?.ftdPhone || depositCall?.leadId?.newPhone || '';
  const leadEmail = depositCall?.ftdEmail || depositCall?.leadId?.newEmail || '';
  const leadName = depositCall?.ftdName || '';
  const affiliateManagerId = depositCall?.accountManager?._id || depositCall?.accountManager;
  const affiliateManagerName = depositCall?.accountManager?.fullName || '';
  const depositCallId = depositCall?._id;
  const callType = CALL_NUMBER_TO_TYPE[callNumber];
  const callLabel = CALL_NUMBER_TO_LABEL[callNumber] || `Call ${callNumber}`;

  const leadDetected = !!leadId;

  // Fetch CDR calls when dialog opens
  const fetchCalls = useCallback(async () => {
    if (!open || !leadDetected) return;
    setLoading(true);
    setCalls([]);
    setSelectedCall(null);
    try {
      const data = await fetchCDRCalls(3, leadPhone, leadEmail, true);
      setCalls(data?.calls || []);
    } catch (err) {
      toast.error('Failed to fetch your calls');
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [open, leadDetected, leadPhone, leadEmail]);

  useEffect(() => {
    if (open) {
      fetchCalls();
      setSearchQuery('');
      setPlayingRecording(null);
    }
    return () => {
      if (playingRecording?.blobUrl) {
        URL.revokeObjectURL(playingRecording.blobUrl);
      }
    };
  }, [open, fetchCalls]);

  const handleClose = () => {
    if (playingRecording?.blobUrl) {
      URL.revokeObjectURL(playingRecording.blobUrl);
    }
    setPlayingRecording(null);
    setSelectedCall(null);
    setSearchQuery('');
    setCalls([]);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedCall || !leadId || !affiliateManagerId || !callType || !depositCallId) return;

    setSubmitting(true);
    try {
      await createDeclaration({
        cdrCallId: selectedCall.cdrCallId,
        callDate: selectedCall.callDate,
        callDuration: selectedCall.callDuration,
        sourceNumber: selectedCall.sourceNumber || selectedCall.lineNumber || '',
        destinationNumber: selectedCall.destinationNumber || selectedCall.email || '',
        lineNumber: selectedCall.lineNumber || '',
        callType,
        callCategory: 'ftd',
        description: '',
        affiliateManagerId,
        leadId,
        depositCallId,
        recordFile: selectedCall.recordFile || '',
      });
      toast.success(`${callLabel} declared successfully - pending AM approval`);
      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to declare call');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePlayRecording = async (e, call) => {
    e.stopPropagation();
    if (playingRecording?.blobUrl) {
      URL.revokeObjectURL(playingRecording.blobUrl);
    }
    if (playingRecording?.cdrCallId === call.cdrCallId) {
      setPlayingRecording(null);
      return;
    }
    try {
      const blobUrl = await fetchRecordingBlob(call.recordFile);
      setPlayingRecording({ cdrCallId: call.cdrCallId, blobUrl });
    } catch (err) {
      console.error('Failed to load recording:', err);
      toast.error('Failed to load recording');
    }
  };

  // Filter: only matching calls, apply search query
  const filtered = calls
    .filter((call) => call.matchesLead)
    .filter((call) => {
      const q = (searchQuery || '').toLowerCase().trim();
      if (!q) return true;
      return (
        (call.lineNumber || '').toLowerCase().includes(q) ||
        (call.sourceNumber || '').toLowerCase().includes(q) ||
        (call.email || '').toLowerCase().includes(q) ||
        (call.destinationNumber || '').toLowerCase().includes(q)
      );
    });

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CallIcon color="primary" />
          <Typography variant="h6">Declare {callLabel}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* Lead info */}
        <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            FTD: <strong>{leadName}</strong>
            {leadPhone && <> | Phone: <strong>{leadPhone}</strong></>}
            {leadEmail && <> | Email: <strong>{leadEmail}</strong></>}
          </Typography>
          {affiliateManagerName && (
            <Typography variant="body2" color="text.secondary">
              AM: <strong>{affiliateManagerName}</strong>
            </Typography>
          )}
        </Box>

        {!leadDetected ? (
          <Alert severity="error">
            Lead not detected for this deposit call. You cannot declare calls for this record.
          </Alert>
        ) : !affiliateManagerId ? (
          <Alert severity="error">
            No affiliate manager assigned to this deposit call. Cannot submit for approval.
          </Alert>
        ) : (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Select your call for this lead
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose the call you made for this lead. It will be sent to the affiliate manager for approval.
            </Typography>

            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">Loading your calls...</Typography>
              </Box>
            ) : calls.length === 0 ? (
              <Alert severity="warning">
                No calls found in the last 3 months. You may not have a CDR code configured.
              </Alert>
            ) : (
              <>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search by phone number or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ mb: 1.5 }}
                />
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {filtered.map((call) => {
                    const isDeclared = !!call.declarationStatus;
                    const isSelected = selectedCall?.cdrCallId === call.cdrCallId;

                    return (
                      <Paper
                        key={call.cdrCallId}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          mb: 1,
                          cursor: isDeclared ? 'default' : 'pointer',
                          border: isSelected ? '2px solid' : '1px solid',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected ? 'primary.50' : isDeclared ? 'action.disabledBackground' : 'transparent',
                          opacity: isDeclared ? 0.6 : 1,
                          '&:hover': isDeclared ? {} : { bgcolor: isSelected ? 'primary.50' : 'action.hover' },
                        }}
                        onClick={() => { if (!isDeclared) setSelectedCall(call); }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                              <Typography variant="body2">
                                {new Date(call.callDate).toLocaleString()}
                              </Typography>
                              <Chip
                                label={call.formattedDuration}
                                size="small"
                                color={call.callDuration >= 3600 ? 'error' : call.callDuration >= 1800 ? 'warning' : 'default'}
                                variant="outlined"
                              />
                              {call.isAdminCombined && (
                                <Chip
                                  label={`Admin Combined${call.adminCombinedCallCount ? ` (${call.adminCombinedCallCount} calls)` : ''}`}
                                  size="small"
                                  color="info"
                                  variant="filled"
                                />
                              )}
                              {!call.isAdminCombined && call.declarationStatus === 'pending' && (
                                <Chip
                                  label={`Pending: ${(call.declaredCallType || '').replace(/_/g, ' ')}`}
                                  size="small"
                                  color="warning"
                                  variant="filled"
                                />
                              )}
                              {!call.isAdminCombined && call.declarationStatus === 'approved' && (
                                <Chip
                                  label={`Declared: ${(call.declaredCallType || '').replace(/_/g, ' ')}`}
                                  size="small"
                                  color="error"
                                  variant="filled"
                                />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              {call.lineNumber || call.sourceNumber} {'\u2192'} {call.email || call.destinationNumber}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={0.5} sx={{ ml: 1 }}>
                            {/* Only show play button on undeclared calls */}
                            {call.recordFile && !isDeclared && (
                              <IconButton
                                size="small"
                                onClick={(e) => handlePlayRecording(e, call)}
                                color={playingRecording?.cdrCallId === call.cdrCallId ? 'primary' : 'default'}
                              >
                                <PlayArrowIcon fontSize="small" />
                              </IconButton>
                            )}
                            {/* Only show radio on undeclared calls */}
                            {!isDeclared && (
                              <Radio
                                checked={isSelected}
                                size="small"
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => setSelectedCall(call)}
                              />
                            )}
                          </Box>
                        </Box>
                        {playingRecording?.cdrCallId === call.cdrCallId && (
                          <Box sx={{ mt: 1 }}>
                            <audio
                              controls
                              src={playingRecording.blobUrl}
                              style={{ width: '100%' }}
                            />
                          </Box>
                        )}
                      </Paper>
                    );
                  })}
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={!selectedCall || submitting || !leadDetected || !affiliateManagerId}
          startIcon={submitting ? <CircularProgress size={16} /> : <CallIcon />}
        >
          {submitting ? 'Declaring...' : `Declare ${callLabel}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AgentCallScheduleDialog;
