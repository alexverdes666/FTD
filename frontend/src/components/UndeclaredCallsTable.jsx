import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AccessTime as AccessTimeIcon,
  Add as AddIcon,
  Check as CheckIcon,
  HourglassEmpty as HourglassIcon,
} from '@mui/icons-material';

const UndeclaredCallsTable = ({
  calls = [],
  loading = false,
  error = null,
  onDeclare,
  emptyMessage = "No undeclared calls found"
}) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const formatPhoneNumber = (number) => {
    if (!number) return 'N/A';
    // Basic formatting - just show the number
    return number;
  };

  const getDurationColor = (seconds) => {
    if (seconds >= 3600) return 'error'; // 1+ hour - red
    if (seconds >= 1800) return 'warning'; // 30+ min - orange
    return 'default'; // 15-30 min - default
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading calls from CDR...
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

  if (!calls || calls.length === 0) {
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
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Alias</TableCell>
            <TableCell>Date & Time</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Phone Number</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {calls.map((call, index) => (
            <TableRow
              key={call.cdrCallId || index}
              hover
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell>
                <Typography variant="body2">
                  {call.email || 'N/A'}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {formatDate(call.callDate)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                  label={call.formattedDuration}
                  size="small"
                  color={getDurationColor(call.callDuration)}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontFamily="monospace">
                  {formatPhoneNumber(call.lineNumber)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                {call.declarationStatus === 'approved' ? (
                  <Chip
                    icon={<CheckIcon />}
                    label="Declared"
                    size="small"
                    color="success"
                  />
                ) : call.declarationStatus === 'pending' ? (
                  <Chip
                    icon={<HourglassIcon />}
                    label="Pending"
                    size="small"
                    color="warning"
                  />
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => onDeclare(call)}
                  >
                    Declare
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default UndeclaredCallsTable;
