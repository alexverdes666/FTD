import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Box,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Person as PersonIcon,
  AssignmentInd as AssignIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../services/api';

const assignmentSchema = yup.object({
  agentId: yup.string().required('Please select an agent or choose to unassign'),
});

const AssignLeadToAgentDialog = ({ 
  open, 
  onClose, 
  lead,  // Can be a single lead object OR array of leads
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState(null);
  
  // Support both single lead and array of leads
  const leads = Array.isArray(lead) ? lead : (lead ? [lead] : []);
  const isBulkMode = Array.isArray(lead);
  
  // Filter valid leads (only FTD and Filler)
  const validLeads = leads.filter(
    l => l && (l.leadType === 'ftd' || l.leadType === 'filler')
  );
  const invalidLeads = leads.filter(
    l => l && (l.leadType !== 'ftd' && l.leadType !== 'filler')
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(assignmentSchema),
    defaultValues: {
      agentId: '',
    },
  });

  // Fetch available agents
  useEffect(() => {
    if (open) {
      fetchAgents();
      setError(null);
      setSuccess(null);
      setResult(null);
      setSearchQuery('');
      reset();
    }
  }, [open, reset]);

  // Filter agents based on search query
  const filteredAgents = agents.filter((agent) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const fullName = (agent.fullName || '').toLowerCase();
    const email = (agent.email || '').toLowerCase();
    const code = (agent.fourDigitCode || '').toLowerCase();
    
    return fullName.includes(query) || email.includes(query) || code.includes(query);
  });

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users?role=agent&isActive=true&limit=1000');
      setAgents(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      setError('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitAssignment = async (data) => {
    try {
      setError(null);
      setSuccess(null);
      setResult(null);
      
      // Use valid leads only
      const leadIds = validLeads.map(l => l._id);
      
      // Check if unassigning
      const isUnassigning = data.agentId === 'UNASSIGN';
      
      // Use the correct API endpoint for agent assignment
      const response = await api.post('/leads/assign-to-agent', { 
        leadIds, 
        agentId: isUnassigning ? null : data.agentId 
      });
      
      // Use the full agents list (not filtered) to get agent name
      const selectedAgent = isUnassigning ? null : agents.find(agent => agent._id === data.agentId);
      
      if (isBulkMode) {
        // Bulk mode - show detailed results
        setResult(response.data.data);
        const totalSuccess = (response.data.data.success?.length || 0) + (response.data.data.reassigned?.length || 0);
        const reassignedCount = response.data.data.reassigned?.length || 0;
        
        let successMsg = isUnassigning 
          ? `Successfully unassigned ${totalSuccess} lead(s)!`
          : `Successfully assigned ${totalSuccess} lead(s) to ${selectedAgent?.fullName || 'agent'}!`;
        if (reassignedCount > 0 && !isUnassigning) {
          successMsg += ` (${reassignedCount} reassigned from other agents)`;
        }
        setSuccess(successMsg);
      } else {
        // Single mode - simple success message
        if (isUnassigning) {
          setSuccess('Lead unassigned successfully!');
        } else {
          const wasReassigned = response.data.data.reassigned && response.data.data.reassigned.length > 0;
          if (wasReassigned) {
            const previousAgent = response.data.data.reassigned[0].previousAgent;
            setSuccess(`Lead reassigned from ${previousAgent?.name || 'previous agent'} to ${selectedAgent?.fullName || 'agent'} successfully!`);
          } else {
            setSuccess(`Lead assigned to ${selectedAgent?.fullName || 'agent'} successfully!`);
          }
        }
      }
      
      if (onSuccess) {
        if (isBulkMode) {
          onSuccess(response.data.data);
        } else {
          onSuccess({
            leadId: validLeads[0]._id,
            agentId: isUnassigning ? null : data.agentId,
            agentName: isUnassigning ? null : (selectedAgent?.fullName || 'Unknown Agent')
          });
        }
      }
      
      // Close dialog after showing success message
      setTimeout(() => {
        onClose();
        setSuccess(null);
        setResult(null);
      }, isBulkMode ? 3000 : 1500);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign lead(s)');
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      setSuccess(null);
      setResult(null);
      onClose();
    }
  };

  if (leads.length === 0) return null;

  // Check if lead is a cold lead (cannot be assigned) - for single mode only
  const isColdLead = !isBulkMode && validLeads.length === 0;
  
  // Check if lead is already assigned to an agent - for single mode only (now used for warning, not blocking)
  const isAlreadyAssigned = !isBulkMode && validLeads.length > 0 && validLeads[0].assignedAgent && validLeads[0].assignedAgent !== null;
  
  // Find the currently assigned agent's name if any - for single mode only
  const currentlyAssignedAgent = isAlreadyAssigned 
    ? agents.find(agent => agent._id === (validLeads[0].assignedAgent._id || validLeads[0].assignedAgent))
    : null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignIcon color="primary" />
          {isBulkMode ? `Assign Leads to Agent (${validLeads.length})` : 'Assign Lead to Agent'}
        </Box>
      </DialogTitle>
      
      <form onSubmit={handleSubmit(onSubmitAssignment)}>
        <DialogContent>
          {/* Bulk mode: Invalid leads warning */}
          {isBulkMode && invalidLeads.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {invalidLeads.length} lead(s) cannot be assigned (only FTD and Filler leads can be permanently assigned to agents).
            </Alert>
          )}

          {/* Bulk mode: No valid leads */}
          {isBulkMode && validLeads.length === 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              No valid leads selected. Only FTD and Filler leads can be assigned to agents.
            </Alert>
          )}
          
          {/* Single mode: Cold lead warning */}
          {isColdLead && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Cold leads cannot be assigned to agents. Only FTD and Filler leads can be assigned.
            </Alert>
          )}
          
          {/* Single mode: Already assigned - now a warning, not blocking */}
          {isAlreadyAssigned && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This lead is currently assigned to{' '}
              <strong>{currentlyAssignedAgent?.fullName || 'an agent'}</strong>
              {currentlyAssignedAgent?.email && ` (${currentlyAssignedAgent.email})`}.
              {' '}Selecting a new agent will reassign this lead to them.
            </Alert>
          )}
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {/* Bulk mode: Show failed assignments */}
          {result && result.failed.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {result.failed.length} lead(s) failed to assign: 
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {result.failed.slice(0, 3).map((fail, idx) => (
                  <li key={idx}>{fail.reason}</li>
                ))}
                {result.failed.length > 3 && <li>... and {result.failed.length - 3} more</li>}
              </ul>
            </Alert>
          )}

          {/* Lead Information */}
          {!isBulkMode && validLeads.length > 0 && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                Lead Information
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
                <Chip
                  icon={<PersonIcon />}
                  label={`${validLeads[0].firstName} ${validLeads[0].lastName}`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  icon={<EmailIcon />}
                  label={validLeads[0].newEmail}
                  color="secondary"
                  variant="outlined"
                />
                <Chip
                  icon={<PhoneIcon />}
                  label={validLeads[0].newPhone}
                  color="secondary"
                  variant="outlined"
                />
                <Chip
                  label={`Lead Type: ${(validLeads[0].orderedAs || validLeads[0].leadType)?.toUpperCase()}`}
                  color="info"
                  variant="outlined"
                />
              </Stack>
            </Box>
          )}

          {/* Bulk mode: Show leads list */}
          {isBulkMode && validLeads.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Leads to Assign ({validLeads.length})
              </Typography>
              <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Type</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {validLeads.slice(0, 10).map((l) => (
                      <TableRow key={l._id}>
                        <TableCell>{l.firstName} {l.lastName}</TableCell>
                        <TableCell>{l.newEmail}</TableCell>
                        <TableCell>
                          <Chip
                            label={l.leadType.toUpperCase()}
                            color={l.leadType === 'ftd' ? 'primary' : 'secondary'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {validLeads.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          ... and {validLeads.length - 10} more
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          )}

          {/* Agent Selection */}
          {validLeads.length > 0 && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Select an agent to {isBulkMode ? 'permanently assign these leads to, or choose to unassign them' : 'assign this lead to, or choose to unassign'}:
            </Typography>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Search Field */}
              <TextField
                fullWidth
                placeholder="Search agents by name, email, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                disabled={isSubmitting || isColdLead}
              />
              
              <Controller
                name="agentId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.agentId}>
                    <InputLabel>Select Agent</InputLabel>
                    <Select {...field} label="Select Agent" disabled={isSubmitting || isColdLead}>
                      <MenuItem value="UNASSIGN">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon fontSize="small" color="error" />
                          <Box>
                            <Typography variant="body2" color="error.main" fontWeight="medium">
                              Unassign Lead
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Remove agent assignment
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                      {filteredAgents.length === 0 ? (
                        <MenuItem disabled>
                          <Typography variant="body2" color="text.secondary">
                            No agents found matching "{searchQuery}"
                          </Typography>
                        </MenuItem>
                      ) : (
                        filteredAgents.map((agent) => (
                          <MenuItem key={agent._id} value={agent._id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PersonIcon fontSize="small" />
                              <Box>
                                <Typography variant="body2">
                                  {agent.fullName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {agent.email}
                                </Typography>
                                {agent.fourDigitCode && (
                                  <Typography variant="caption" color="primary">
                                    {' '}• Code: {agent.fourDigitCode}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </MenuItem>
                        ))
                      )}
                    </Select>
                    {errors.agentId && (
                      <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                        {errors.agentId.message}
                      </Typography>
                    )}
                    {!errors.agentId && filteredAgents.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, ml: 1.5 }}>
                        Showing {filteredAgents.length} of {agents.length} agent(s)
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </>
          )}

          {!isColdLead && validLeads.length > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {isBulkMode ? (
                <>
                  <strong>Note:</strong> Leads will be assigned to the selected agent. If any leads are already assigned to other agents, they will be reassigned. You can also select "Unassign Lead" to remove agent assignments. When creating orders with an agent filter, you'll get leads assigned to that agent.
                </>
              ) : isAlreadyAssigned ? (
                'This lead will be reassigned to the newly selected agent. The previous agent will no longer have access to this lead. You can also select "Unassign Lead" to remove the agent assignment.'
              ) : (
                'The lead will be assigned to the selected agent and they will be able to work with it. You can also select "Unassign Lead" to leave it unassigned.'
              )}
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || loading || isColdLead || validLeads.length === 0}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <AssignIcon />}
          >
            {isSubmitting 
              ? 'Processing...' 
              : isBulkMode 
                ? `Assign ${validLeads.length} Lead(s)`
                : isAlreadyAssigned
                  ? 'Reassign Lead'
                  : 'Assign Lead'
            }
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AssignLeadToAgentDialog;
