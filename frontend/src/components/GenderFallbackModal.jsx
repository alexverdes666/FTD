import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Box,
  Chip,
  Stack,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Wc as GenderIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

const GenderFallbackModal = ({ 
  open, 
  onClose, 
  onSelectGender, 
  agentName, // For backward compatibility (not used with new format)
  insufficientTypes = {}, // Can be array (new) or object (old)
  agents = [], // List of agents for displaying names
}) => {
  const [selectedGender, setSelectedGender] = React.useState('');
  const [perAssignmentGenders, setPerAssignmentGenders] = React.useState({});

  const handleGenderChange = (event) => {
    setSelectedGender(event.target.value);
  };

  const handlePerAssignmentGenderChange = (index, gender) => {
    setPerAssignmentGenders(prev => ({
      ...prev,
      [index]: gender
    }));
  };

  const handleSubmit = () => {
    // New format with per-assignment genders
    if (isNewFormat && Object.keys(perAssignmentGenders).length > 0) {
      const genderSelections = assignmentDetails.map((detail, idx) => ({
        leadType: detail.leadType.toLowerCase(),
        index: insufficientTypes[idx].index,
        agentId: insufficientTypes[idx].agentId,
        gender: perAssignmentGenders[idx] || null
      }));
      onSelectGender(genderSelections);
      setPerAssignmentGenders({});
      return;
    }
    
    // Old format with single gender
    if (selectedGender) {
      onSelectGender(selectedGender);
      setSelectedGender('');
    }
  };

  const handleClose = () => {
    setSelectedGender('');
    setPerAssignmentGenders({});
    onClose();
  };

  // Handle both old format (object) and new format (array)
  const isNewFormat = Array.isArray(insufficientTypes);
  
  let insufficientLeadTypes = [];
  let assignmentDetails = [];
  
  if (isNewFormat) {
    // New format: array of {leadType, index, agentId}
    assignmentDetails = insufficientTypes.map(item => {
      const agent = agents.find(a => a._id === item.agentId);
      return {
        leadType: item.leadType.toUpperCase(),
        index: item.index + 1, // Convert to 1-based index
        agentName: agent ? (agent.fullName || agent.email) : 'Unknown Agent',
      };
    });
    
    // Extract unique lead types
    const uniqueTypes = [...new Set(insufficientTypes.map(t => t.leadType.toUpperCase()))];
    insufficientLeadTypes = uniqueTypes;
  } else {
    // Old format: {ftd: boolean, filler: boolean}
    if (insufficientTypes.ftd) insufficientLeadTypes.push('FTD');
    if (insufficientTypes.filler) insufficientLeadTypes.push('Filler');
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          <Typography variant="h6">
            Insufficient Agent-Assigned Leads
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }} icon={<PersonIcon />}>
          <Typography variant="body2" gutterBottom>
            <strong>
              {isNewFormat 
                ? `Unable to fulfill ${assignmentDetails.length} agent assignment(s)!`
                : `Not enough ${insufficientLeadTypes.join(' and ')} leads assigned to ${agentName || 'this agent'}!`
              }
            </strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: isNewFormat ? 1 : 0 }}>
            {isNewFormat
              ? 'The following assignments could not be fulfilled:'
              : 'The agent doesn\'t have enough leads assigned, or they have already been sent to the selected networks/brokers.'
            }
          </Typography>
          
          {isNewFormat && assignmentDetails.length > 0 && (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {assignmentDetails.map((detail, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip 
                    label={detail.leadType}
                    size="small" 
                    color={detail.leadType === 'FTD' ? 'primary' : 'secondary'} 
                  />
                  <Typography variant="body2">
                    <strong>#{detail.index}</strong> for <strong>{detail.agentName}</strong>
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Alert>

        <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
          {isNewFormat 
            ? 'Select a gender preference for each insufficient assignment:'
            : 'To help find alternative leads, please select a gender preference:'
          }
        </Typography>

        {isNewFormat ? (
          // New format: Individual gender selection per assignment
          <Stack spacing={2} sx={{ mb: 2 }}>
            {assignmentDetails.map((detail, idx) => (
              <Box 
                key={idx} 
                sx={{ 
                  p: 2, 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  backgroundColor: 'background.paper'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Chip 
                    label={detail.leadType}
                    size="small" 
                    color={detail.leadType === 'FTD' ? 'primary' : 'secondary'} 
                  />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    #{detail.index} for {detail.agentName}
                  </Typography>
                </Box>
                
                <FormControl fullWidth size="small">
                  <InputLabel>Select Gender</InputLabel>
                  <Select
                    value={perAssignmentGenders[idx] || ''}
                    onChange={(e) => handlePerAssignmentGenderChange(idx, e.target.value)}
                    label="Select Gender"
                  >
                    <MenuItem value="">
                      <em>Skip this assignment</em>
                    </MenuItem>
                    <MenuItem value="male">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="Male" size="small" color="primary" variant="outlined" />
                        <Typography variant="body2">Male leads</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="female">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="Female" size="small" color="secondary" variant="outlined" />
                        <Typography variant="body2">Female leads</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="not_defined">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="Not Defined" size="small" variant="outlined" />
                        <Typography variant="body2">Gender not specified</Typography>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>
            ))}
          </Stack>
        ) : (
          // Old format: Single gender selection
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Select Gender</InputLabel>
            <Select
              value={selectedGender}
              onChange={handleGenderChange}
              label="Select Gender"
              startAdornment={<GenderIcon sx={{ mr: 1, color: 'action.active' }} />}
            >
              <MenuItem value="male">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label="Male" size="small" color="primary" />
                  <Typography variant="body2">Male leads</Typography>
                </Box>
              </MenuItem>
              <MenuItem value="female">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label="Female" size="small" color="secondary" />
                  <Typography variant="body2">Female leads</Typography>
                </Box>
              </MenuItem>
              <MenuItem value="not_defined">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label="Not Defined" size="small" />
                  <Typography variant="body2">Gender not specified</Typography>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        )}

        <Alert severity="info" icon={<GenderIcon />}>
          <Typography variant="body2">
            <strong>What happens next:</strong>
          </Typography>
          <Typography variant="body2" component="div">
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              {isNewFormat ? (
                <>
                  <li>For each assignment with a gender selected, the system will look for leads assigned to that agent with the specified gender</li>
                  <li>If still not enough, it will use unassigned leads with that gender</li>
                  <li>Assignments without a gender selected will be skipped</li>
                  <li>All network/broker filters will still apply</li>
                </>
              ) : (
                <>
                  <li>The system will look for leads assigned to this agent with the selected gender</li>
                  <li>If still not enough, it will use unassigned leads with that gender</li>
                  <li>All network/broker filters will still apply</li>
                </>
              )}
            </ul>
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Cancel Order
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isNewFormat ? Object.keys(perAssignmentGenders).length === 0 : !selectedGender}
          startIcon={<GenderIcon />}
        >
          {isNewFormat 
            ? `Retry with Selected Genders (${Object.keys(perAssignmentGenders).length})`
            : `Retry with ${selectedGender ? selectedGender.charAt(0).toUpperCase() + selectedGender.slice(1) : 'Selected'} Gender`
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GenderFallbackModal;

