import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import {
  SwapHorizontalCircle as SwapIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { getSortedCountries } from '../constants/countries';

const ChangeFTDDialog = ({ 
  open, 
  onClose, 
  order, 
  lead, 
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [networks, setNetworks] = useState({
    clientNetworks: [],
    ourNetworks: [],
    campaigns: [],
    clientBrokers: []
  });
  const [agents, setAgents] = useState([]);
  const [filteredAgents, setFilteredAgents] = useState([]);
  const [filteredAgentsLoading, setFilteredAgentsLoading] = useState(false);
  const [unassignedLeadsStats, setUnassignedLeadsStats] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({
    selectedClientNetwork: '',
    selectedOurNetwork: '',
    selectedCampaign: '',
    selectedClientBrokers: [],
    countryFilter: '',
    preferredAgent: '',
    fallbackGender: ''
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [needsGenderFallback, setNeedsGenderFallback] = useState(false);

  // Fetch available networks and campaigns
  useEffect(() => {
    if (open && order && lead) {
      fetchNetworkOptions();
    }
  }, [open, order, lead]);

  const fetchNetworkOptions = async () => {
    try {
      setLoading(true);
      const [clientNetworksRes, ourNetworksRes, campaignsRes, clientBrokersRes, agentsRes] = await Promise.all([
        api.get('/client-networks?isActive=true&limit=1000'),
        api.get('/our-networks?isActive=true&limit=1000'),
        api.get('/campaigns?isActive=true&limit=1000'),
        api.get('/client-brokers?isActive=true&limit=1000'),
        api.get('/users/agents-with-lead-stats')
      ]);

      setNetworks({
        clientNetworks: clientNetworksRes.data.data || [],
        ourNetworks: ourNetworksRes.data.data || [],
        campaigns: campaignsRes.data.data || [],
        clientBrokers: clientBrokersRes.data.data || []
      });

      setAgents(agentsRes.data.users || agentsRes.data.data || []);

      // Set default values from order and lead
      setSelectedOptions({
        selectedClientNetwork: order.selectedClientNetwork?._id || '',
        selectedOurNetwork: order.selectedOurNetwork?._id || '',
        selectedCampaign: order.selectedCampaign?._id || '',
        selectedClientBrokers: Array.isArray(order.selectedClientBrokers) 
          ? order.selectedClientBrokers.map(b => typeof b === 'object' && b._id ? b._id : b)
          : [],
        countryFilter: order.countryFilter || '',
        preferredAgent: lead.assignedAgent?._id || lead.assignedAgent || '',
        fallbackGender: ''
      });
      setNeedsGenderFallback(false);
      
      // Reset filtered agents when dialog opens
      setFilteredAgents([]);
      setUnassignedLeadsStats(null);
    } catch (err) {
      console.error('Failed to fetch network options:', err);
      setError('Failed to load network options');
    } finally {
      setLoading(false);
    }
  };

  // Fetch agents with lead stats filtered by specific criteria
  const fetchFilteredAgents = useCallback(async () => {
    // Both FTD and Filler leads are stored with leadType: 'ftd' in the database
    // Fillers are just "ordered as" filler but their actual leadType is 'ftd'
    // So we always search for 'ftd' type leads
    const leadType = 'ftd';
    
    // Use selected client network or order's client network
    const clientNetwork = selectedOptions.selectedClientNetwork || order?.selectedClientNetwork?._id;
    // Use selected country filter or order's country filter
    const country = selectedOptions.countryFilter || order?.countryFilter;
    // Use selected client brokers
    const clientBrokers = selectedOptions.selectedClientBrokers || [];

    if (!clientNetwork || !country) {
      setError('Cannot load agents: Country and client network are required');
      return;
    }

    setFilteredAgentsLoading(true);
    try {
      const response = await api.post("/users/agents-with-filtered-lead-stats", {
        leadType,
        country,
        clientNetwork,
        clientBrokers,
      });
      
      setFilteredAgents(response.data.data || []);
      setUnassignedLeadsStats(response.data.unassignedLeads || null);
      setError(null);
      
      return response.data;
    } catch (err) {
      console.error("Failed to fetch filtered agents:", err);
      setError(err.response?.data?.message || "Failed to load agents with matching leads");
      return null;
    } finally {
      setFilteredAgentsLoading(false);
    }
  }, [order, lead, selectedOptions.selectedClientNetwork, selectedOptions.selectedClientBrokers, selectedOptions.countryFilter]);

  const handleChange = (field) => (event) => {
    setSelectedOptions(prev => ({
      ...prev,
      [field]: event.target.value,
      // Reset fallbackGender when changing preferred agent to start fresh
      ...(field === 'preferredAgent' ? { fallbackGender: '' } : {})
    }));
    setError(null);
    
    // When changing preferred agent, reset the gender fallback state
    // so the system tries finding agent-assigned leads first
    if (field === 'preferredAgent') {
      setNeedsGenderFallback(false);
    }
    
    // Reset filtered agents when client network, brokers, or country change
    if (field === 'selectedClientNetwork' || field === 'selectedClientBrokers' || field === 'countryFilter') {
      setFilteredAgents([]);
      setUnassignedLeadsStats(null);
    }
  };

  const handleChangeFTD = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Determine if this is a filler based on order metadata, not lead type
      const leadMetadata = order.leadsMetadata?.find(m => m.leadId?.toString() === lead._id?.toString());
      const isFillerOrder = leadMetadata?.orderedAs === 'filler';
      const leadTypeLabel = isFillerOrder ? 'Filler' : 'FTD';

      const requestBody = {
        ...selectedOptions,
        isFillerOrder, // Send info about whether this was ordered as filler
      };

      const response = await api.post(
        `/orders/${order._id}/leads/${lead._id}/change-ftd`,
        requestBody
      );

      setSuccess(`${leadTypeLabel} lead successfully changed!`);
      if (onSuccess) {
        onSuccess(response.data.data);
      }
      
      // Close dialog after a short delay to show success message
      setTimeout(() => {
        onClose();
        setSuccess(null);
        setNeedsGenderFallback(false);
      }, 2000);

    } catch (err) {
      console.error(`Failed to change lead:`, err);
      
      // Check if we need gender fallback
      if (err.response?.data?.needsGenderFallback) {
        setNeedsGenderFallback(true);
        setError(
          err.response?.data?.message || 
          'No leads found assigned to the selected agent. Please select a gender to find an unassigned lead.'
        );
      } else {
        setError(
          err.response?.data?.message || 
          `Failed to change lead. Please try again.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setSuccess(null);
      setFilteredAgents([]);
      setUnassignedLeadsStats(null);
      onClose();
    }
  };

  if (!order || !lead) return null;

  // Determine if this is a filler based on order metadata, not lead type
  const leadMetadata = order.leadsMetadata?.find(m => m.leadId?.toString() === lead._id?.toString());
  const isFillerOrder = leadMetadata?.orderedAs === 'filler';
  const leadTypeLabel = isFillerOrder ? 'Filler' : 'FTD';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SwapIcon color="primary" />
          Change {leadTypeLabel} Lead
        </Box>
      </DialogTitle>
      
      <DialogContent>
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

        {/* Current Lead Information */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            Current {leadTypeLabel} Lead
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
            <Chip
              icon={<PersonIcon />}
              label={`${lead.firstName} ${lead.lastName}`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<EmailIcon />}
              label={lead.newEmail}
              color="secondary"
              variant="outlined"
            />
            <Chip
              icon={<PhoneIcon />}
              label={lead.newPhone}
              color="secondary"
              variant="outlined"
            />
            {lead.assignedAgent && (
              <Chip
                icon={<PersonIcon />}
                label={`Agent: ${lead.assignedAgent.fullName || lead.assignedAgent.email || 'Unknown'}`}
                color="info"
                variant="outlined"
              />
            )}
            {!lead.assignedAgent && (
              <Chip
                label="Unassigned"
                color="warning"
                variant="outlined"
              />
            )}
            {(() => {
              // Show cooldown status if applicable
              if (lead.lastUsedInOrder) {
                const lastUsedDate = new Date(lead.lastUsedInOrder);
                const now = new Date();
                const cooldownEnd = new Date(lastUsedDate.getTime() + 10 * 24 * 60 * 60 * 1000);

                if (now < cooldownEnd) {
                  const daysRemaining = Math.ceil((cooldownEnd - now) / (1000 * 60 * 60 * 24));
                  return (
                    <Chip
                      label={`Cooldown: ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
                      color="error"
                      variant="filled"
                      title={`This lead was last used on ${lastUsedDate.toLocaleDateString()}. It will be available again on ${cooldownEnd.toLocaleDateString()}`}
                    />
                  );
                }
              }
              return null;
            })()}
          </Stack>
        </Box>

        {/* Cooldown Information Alert */}
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>FTD Cooldown Policy:</strong> FTD and Filler leads cannot be reused within 10 days of being added to an order. 
          The replacement lead will also enter a 10-day cooldown period after this change.
        </Alert>

        {/* Network Selection */}
        <Typography variant="h6" gutterBottom>
          Select Networks & Campaign for Replacement
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          These filters will be used to find a suitable replacement FTD lead. 
          Leave fields blank to use the order's original settings.
        </Typography>

        {loading && networks.clientNetworks.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={2}>
            {/* Country/GEO Filter */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Country (GEO) *</InputLabel>
                <Select
                  value={selectedOptions.countryFilter}
                  label="Country (GEO) *"
                  onChange={handleChange('countryFilter')}
                >
                  {getSortedCountries().map((country) => (
                    <MenuItem key={country.code} value={country.name}>
                      {country.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Client Network *</InputLabel>
                <Select
                  value={selectedOptions.selectedClientNetwork}
                  label="Client Network *"
                  onChange={handleChange('selectedClientNetwork')}
                >
                  <MenuItem value="">Use Order Default</MenuItem>
                  {networks.clientNetworks.map((network) => (
                    <MenuItem key={network._id} value={network._id}>
                      {network.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Our Network</InputLabel>
                <Select
                  value={selectedOptions.selectedOurNetwork}
                  label="Our Network"
                  onChange={handleChange('selectedOurNetwork')}
                >
                  <MenuItem value="">Use Order Default</MenuItem>
                  {networks.ourNetworks.map((network) => (
                    <MenuItem key={network._id} value={network._id}>
                      {network.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Campaign</InputLabel>
                <Select
                  value={selectedOptions.selectedCampaign}
                  label="Campaign"
                  onChange={handleChange('selectedCampaign')}
                >
                  <MenuItem value="">Use Order Default</MenuItem>
                  {networks.campaigns.map((campaign) => (
                    <MenuItem key={campaign._id} value={campaign._id}>
                      {campaign.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Client Brokers (for filtering)</InputLabel>
                <Select
                  multiple
                  value={selectedOptions.selectedClientBrokers}
                  label="Client Brokers (for filtering)"
                  onChange={handleChange('selectedClientBrokers')}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((brokerId) => {
                        const broker = networks.clientBrokers.find(b => b._id === brokerId);
                        const brokerLabel = broker?.name || (typeof brokerId === 'string' ? brokerId : 'Unknown');
                        return (
                          <Chip key={typeof brokerId === 'string' ? brokerId : broker?._id || Math.random()} label={brokerLabel} size="small" />
                        );
                      })}
                    </Box>
                  )}
                >
                  {networks.clientBrokers.map((broker) => (
                    <MenuItem key={broker._id} value={broker._id}>
                      {broker.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        )}

        {/* Agent Preference Section */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
          <Typography variant="h6" gutterBottom color="primary">
            Find Replacement Lead
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {lead.assignedAgent 
              ? `Current lead is assigned to: ${lead.assignedAgent.fullName || lead.assignedAgent.email || 'Agent'}. Load matching agents to see who has available leads.`
              : 'Load matching agents to see who has leads available for your criteria, or leave blank to use any unassigned lead.'}
          </Typography>

          {/* Load Matching Agents Button */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={fetchFilteredAgents}
              disabled={filteredAgentsLoading || loading}
              startIcon={filteredAgentsLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
            >
              {filteredAgentsLoading ? "Loading Agents..." : "Load Matching Agents"}
            </Button>
            
            {filteredAgents.length > 0 && (
              <Typography variant="body2" color="success.main">
                Found {filteredAgents.length} agent(s) with leads matching criteria
              </Typography>
            )}
            
            {!filteredAgentsLoading && filteredAgents.length === 0 && unassignedLeadsStats !== null && (
              <Typography variant="body2" color="warning.main">
                No agents found with matching leads. Use unassigned leads option.
              </Typography>
            )}
          </Box>

          {/* Unassigned leads info */}
          {unassignedLeadsStats && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>
                Unassigned Leads Matching Criteria:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>{unassignedLeadsStats.available}</strong> matching available, {unassignedLeadsStats.onCooldown} matching on cooldown
              </Typography>
            </Box>
          )}

          {loading && agents.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              <FormControl fullWidth>
                <InputLabel>Prefer Agent (Optional)</InputLabel>
                <Select
                  value={selectedOptions.preferredAgent}
                  label="Prefer Agent (Optional)"
                  onChange={handleChange('preferredAgent')}
                  disabled={filteredAgentsLoading}
                >
                  <MenuItem value="">
                    <em>No preference - use unassigned lead {unassignedLeadsStats ? `(${unassignedLeadsStats.available} matching available)` : ''}</em>
                  </MenuItem>
                  {/* 
                    Show filtered agents if loaded and found.
                    If filtered agents were loaded but none found, show nothing (only unassigned option above).
                    If filtered agents haven't been loaded yet, show all agents with total stats.
                  */}
                  {filteredAgents.length > 0 ? (
                    // Show filtered agents with matching stats
                    filteredAgents.map((agent) => (
                      <MenuItem 
                        key={agent._id} 
                        value={agent._id}
                        disabled={agent.filteredLeadStats?.available === 0}
                      >
                        {agent.fullName || agent.email}
                        {agent.fourDigitCode ? ` (${agent.fourDigitCode})` : ''} — {agent.filteredLeadStats?.available || 0} matching available, {agent.filteredLeadStats?.onCooldown || 0} matching on cooldown
                      </MenuItem>
                    ))
                  ) : unassignedLeadsStats === null ? (
                    // Filtered agents haven't been loaded yet - show all agents with warning
                    agents.map((agent) => (
                      <MenuItem key={agent._id} value={agent._id}>
                        {agent.fullName || agent.email}
                        {agent.fourDigitCode ? ` (${agent.fourDigitCode})` : ''} 
                        <Chip 
                          label={`${agent.leadStats?.available || 0} total available`}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ ml: 1, height: 20 }}
                        />
                        <Chip 
                          label={`${agent.leadStats?.onCooldown || 0} total cooldown`}
                          size="small"
                          color={agent.leadStats?.onCooldown > 0 ? "warning" : "default"}
                          variant="outlined"
                          sx={{ ml: 0.5, height: 20 }}
                        />
                      </MenuItem>
                    ))
                  ) : null /* Filtered agents loaded but none found - only show unassigned option */}
                </Select>
                {filteredAgents.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Stats show only leads matching your selected criteria (country, client network, client brokers)
                  </Typography>
                )}
                {filteredAgents.length === 0 && unassignedLeadsStats === null && agents.length > 0 && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
                    Click "Load Matching Agents" to see agents with leads matching your criteria
                  </Typography>
                )}
                {filteredAgents.length === 0 && unassignedLeadsStats !== null && (
                  <Typography variant="caption" color="info.main" sx={{ mt: 0.5 }}>
                    No agents have leads matching your criteria. Only unassigned leads are available.
                  </Typography>
                )}
              </FormControl>
              
              {needsGenderFallback && (
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Gender Fallback *</InputLabel>
                  <Select
                    value={selectedOptions.fallbackGender}
                    label="Gender Fallback *"
                    onChange={handleChange('fallbackGender')}
                    required
                  >
                    <MenuItem value="">
                      <em>Select gender for unassigned lead</em>
                    </MenuItem>
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="not_defined">Not Defined</MenuItem>
                  </Select>
                </FormControl>
              )}
            </>
          )}
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          {selectedOptions.preferredAgent 
            ? 'The system will first try to find a lead already assigned to the selected agent. If none found, you will be asked to select a gender for an unassigned lead.'
            : 'The system will find any suitable unassigned lead that matches the order criteria and network requirements.'}
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleChangeFTD}
          disabled={loading || (needsGenderFallback && !selectedOptions.fallbackGender)}
          startIcon={loading ? <CircularProgress size={20} /> : <SwapIcon />}
        >
          {loading ? `Changing ${leadTypeLabel}...` : `Change ${leadTypeLabel}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChangeFTDDialog;
