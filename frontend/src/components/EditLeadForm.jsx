import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
  CircularProgress,
  Chip,
  Box,
  Autocomplete,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import api from "../services/api";
const LEAD_STATUSES = {
  ACTIVE: "active",
  CONTACTED: "contacted",
  CONVERTED: "converted",
  INACTIVE: "inactive",
};
const LEAD_TYPES = {
  FTD: "ftd",
  FILLER: "filler",
  COLD: "cold",
};
const schema = yup.object().shape({
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  newEmail: yup.string().email("Invalid email").required("Email is required"),
  oldEmail: yup.string().nullable().email("Invalid email format"),
  newPhone: yup.string().required("Phone number is required"),
  oldPhone: yup.string().nullable(),
  country: yup.string().required("Country is required"),
  status: yup.string().oneOf(Object.values(LEAD_STATUSES), "Invalid status"),
  leadType: yup.string().oneOf(Object.values(LEAD_TYPES), "Invalid lead type"),
  sin: yup.string().nullable(),
  gender: yup.string().oneOf(["male", "female", "other"], "Invalid gender"),
  clientBroker: yup.array().of(yup.string()).nullable(),
  clientNetwork: yup.array().of(yup.string()).nullable(),
  campaign: yup.array().of(yup.string()).nullable(),
  ourNetwork: yup.array().of(yup.string()).nullable(),
  dob: yup.string().nullable().transform((value, originalValue) => {
    // Transform empty strings to null, otherwise keep the string date format (YYYY-MM-DD)
    return originalValue === "" ? null : originalValue;
  }),
  address: yup.string().nullable().typeError('Address must be a string type'),
  socialMedia: yup.object().shape({
    facebook: yup.string().nullable().url('Invalid Facebook URL'),
    twitter: yup.string().nullable().url('Invalid Twitter URL'),
    linkedin: yup.string().nullable().url('Invalid LinkedIn URL'),
    instagram: yup.string().nullable().url('Invalid Instagram URL'),
    telegram: yup.string().nullable(),
    whatsapp: yup.string().nullable()
  }),
  documents: yup.array().of(
    yup.object().shape({
      url: yup.string().nullable().test('url-validation', 'Invalid document URL', function(value) {
        if (!value || value.trim() === '') return true;
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      }),
      description: yup.string().nullable()
    })
  ).nullable().default([]),
});
const getDefaultValues = (lead) => {
  let addressValue = "";
  if (lead?.address) {
    if (typeof lead.address === 'string') {
      addressValue = lead.address;
    } else if (typeof lead.address === 'object') {
      const street = lead.address.street || '';
      const city = lead.address.city || '';
      const postalCode = lead.address.postalCode || '';
      addressValue = `${street}, ${city} ${postalCode}`.trim();
    }
  }
  
  let dobValue = "";
  if (lead?.dob) {
    if (typeof lead.dob === 'string') {
      dobValue = lead.dob.split('T')[0];
    } else if (lead.dob instanceof Date) {
      dobValue = lead.dob.toISOString().split('T')[0];
    } else {
      dobValue = new Date(lead.dob).toISOString().split('T')[0];
    }
  }
  
  const defaultValues = {
    firstName: lead?.firstName ?? "",
    lastName: lead?.lastName ?? "",
    newEmail: lead?.newEmail ?? "",
    oldEmail: lead?.oldEmail ?? "",
    newPhone: lead?.newPhone ?? "",
    oldPhone: lead?.oldPhone ?? "",
    country: lead?.country ?? "",
    status: lead?.status ?? LEAD_STATUSES.ACTIVE,
    leadType: lead?.leadType ?? LEAD_TYPES.COLD,
    sin: lead?.sin ?? "",
    gender: lead?.gender ?? "other",
    clientBroker: (lead?.assignedClientBrokers?.map(broker => broker._id || broker) || []).filter(Boolean),
    clientNetwork: extractCurrentAssignments(lead?.clientNetworkHistory, 'clientNetwork', lead?.clientNetwork),
    campaign: extractCurrentAssignments(lead?.campaignHistory, 'campaign', lead?.campaign),
    ourNetwork: extractCurrentAssignments(lead?.ourNetworkHistory, 'ourNetwork', lead?.ourNetwork),
    dob: dobValue,
    address: addressValue,
    socialMedia: {
      facebook: lead?.socialMedia?.facebook ?? "",
      twitter: lead?.socialMedia?.twitter ?? "",
      linkedin: lead?.socialMedia?.linkedin ?? "",
      instagram: lead?.socialMedia?.instagram ?? "",
      telegram: lead?.socialMedia?.telegram ?? "",
      whatsapp: lead?.socialMedia?.whatsapp ?? "",
    },
    documents: lead?.documents && lead.documents.length > 0
      ? lead.documents.map(doc => ({ url: doc.url || "", description: doc.description || "" }))
      : [{ url: "", description: "" }],
  };
  
  return defaultValues;
};

// Helper function to extract current assignments from history arrays or legacy fields
const extractCurrentAssignments = (historyArray, fieldName, legacyValue) => {
  // First try history arrays if they exist and have data
  if (historyArray && Array.isArray(historyArray) && historyArray.length > 0) {
    const assignmentIds = new Set();
    
    historyArray.forEach((entry, index) => {
      let assignmentId = null;
      
      if (entry[fieldName]) {
        if (typeof entry[fieldName] === 'string') {
          assignmentId = entry[fieldName];
        } else if (entry[fieldName]._id) {
          assignmentId = entry[fieldName]._id;
        } else if (entry[fieldName].toString) {
          assignmentId = entry[fieldName].toString();
        }
      }
      
      if (assignmentId) {
        assignmentIds.add(assignmentId.toString());
      }
    });
    
    const result = Array.from(assignmentIds);
    return result;
  }
  
  // Fall back to legacy single value if available
  if (legacyValue) {
    return [legacyValue.toString()];
  }
  
  return [];
};

const EditLeadForm = ({ open, onClose, lead, onLeadUpdated, sx }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Dropdown data states
  const [clientBrokers, setClientBrokers] = useState([]);
  const [clientNetworks, setClientNetworks] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [ourNetworks, setOurNetworks] = useState([]);
  
  // Loading states for dropdowns
  const [loadingClientBrokers, setLoadingClientBrokers] = useState(false);
  const [loadingClientNetworks, setLoadingClientNetworks] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingOurNetworks, setLoadingOurNetworks] = useState(false);
  
  // Input value states for controlling dropdown visibility
  const [clientBrokerInputValue, setClientBrokerInputValue] = useState('');
  const [clientNetworkInputValue, setClientNetworkInputValue] = useState('');
  const [campaignInputValue, setCampaignInputValue] = useState('');
  const [ourNetworkInputValue, setOurNetworkInputValue] = useState('');
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    watch,
    trigger,
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: getDefaultValues(lead),
    mode: 'onChange',
  });
  useEffect(() => {
    if (lead) {
      reset(getDefaultValues(lead));
    }
    setError(null);
  }, [lead, reset]);

  // Fetch dropdown data
  useEffect(() => {
    if (open) {
      fetchClientBrokers();
      fetchClientNetworks();
      fetchCampaigns();
      fetchOurNetworks();
    }
  }, [open]);


  const fetchClientBrokers = async () => {
    setLoadingClientBrokers(true);
    try {
      const response = await api.get("/client-brokers?isActive=true&limit=1000");
      setClientBrokers(response.data.data || []);
    } catch (err) {
      // Error silently handled - already shown in UI if needed
    } finally {
      setLoadingClientBrokers(false);
    }
  };

  const fetchClientNetworks = async () => {
    setLoadingClientNetworks(true);
    try {
      const response = await api.get("/client-networks?isActive=true&limit=1000");
      setClientNetworks(response.data.data || []);
    } catch (err) {
      // Error silently handled - already shown in UI if needed
    } finally {
      setLoadingClientNetworks(false);
    }
  };

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const response = await api.get("/campaigns?isActive=true&status=active&limit=1000");
      setCampaigns(response.data.data || []);
    } catch (err) {
      // Error silently handled - already shown in UI if needed
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchOurNetworks = async () => {
    setLoadingOurNetworks(true);
    try {
      const response = await api.get("/our-networks?isActive=true&limit=1000");
      setOurNetworks(response.data.data || []);
    } catch (err) {
      // Error silently handled - already shown in UI if needed
    } finally {
      setLoadingOurNetworks(false);
    }
  };
  const leadType = watch("leadType");

  const handleButtonClick = async () => {
    try {
      // Trigger validation manually
      const isFormValid = await trigger();
      
      if (!isFormValid) {
        setError("Please fix the form validation errors");
        return;
      }
      
      // If validation passes, submit the form
      handleSubmit(onSubmit)();
    } catch (error) {
      setError("An error occurred: " + error.message);
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const updateData = {
        firstName: data.firstName,
        lastName: data.lastName,
        newEmail: data.newEmail,
        oldEmail: data.oldEmail,
        newPhone: data.newPhone,
        oldPhone: data.oldPhone,
        country: data.country,
        status: data.status,
        leadType: data.leadType,
        sin: data.sin,
        gender: data.gender,
        dob: data.dob || null,
        socialMedia: data.socialMedia,
        clientBroker: Array.isArray(data.clientBroker) && data.clientBroker.length > 0 ? data.clientBroker : [],
        clientNetwork: Array.isArray(data.clientNetwork) && data.clientNetwork.length > 0 ? data.clientNetwork : [],
        campaign: Array.isArray(data.campaign) && data.campaign.length > 0 ? data.campaign : [],
        ourNetwork: Array.isArray(data.ourNetwork) && data.ourNetwork.length > 0 ? data.ourNetwork : [],
      };
      // Include documents - filter out empty ones
      if (Array.isArray(data.documents)) {
        updateData.documents = data.documents.filter(doc => doc.url && doc.url.trim() !== '');
      }
      if (data.leadType === 'ftd' || data.leadType === 'filler') {
        if (data.address) {
          updateData.address = typeof data.address === 'string'
            ? data.address
            : JSON.stringify(data.address);
        }
      }
      const response = await api.put(`/leads/${lead?._id}`, updateData);
      if (response.data.success) {
        onLeadUpdated(response.data.data);
        onClose();
        reset();
      }
    } catch (error) {
      setError(error.response?.data?.message || "Failed to update lead");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={sx}
    >
      <DialogTitle>Edit Lead</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {Object.keys(errors).length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Please fix the following validation errors:
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>
                  <strong>{field}:</strong> {error?.message || 'Invalid value'}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        <Grid container spacing={2}>
          {}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>Basic Information</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="firstName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  fullWidth
                  label="First Name"
                  error={!!errors.firstName}
                  helperText={errors.firstName?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="lastName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  fullWidth
                  label="Last Name"
                  error={!!errors.lastName}
                  helperText={errors.lastName?.message}
                />
              )}
            />
          </Grid>
          {}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>Contact Information</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="newEmail"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  fullWidth
                  label="Email"
                  error={!!errors.newEmail}
                  helperText={errors.newEmail?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="oldEmail"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Old Email"
                  error={!!errors.oldEmail}
                  helperText={errors.oldEmail?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="newPhone"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Phone"
                  error={!!errors.newPhone}
                  helperText={errors.newPhone?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="oldPhone"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Old Phone"
                  error={!!errors.oldPhone}
                  helperText={errors.oldPhone?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="country"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  fullWidth
                  label="Country"
                  error={!!errors.country}
                  helperText={errors.country?.message}
                />
              )}
            />
          </Grid>
          {}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>Lead Information</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.leadType}>
              <InputLabel>Lead Type</InputLabel>
              <Controller
                name="leadType"
                control={control}
                render={({ field }) => (
                  <Select {...field} label="Lead Type">
                    {Object.values(LEAD_TYPES).map((type) => (
                      <MenuItem key={type} value={type}>
                        {type.toUpperCase()}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.leadType && (
                <Alert severity="error">{errors.leadType.message}</Alert>
              )}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.status}>
              <InputLabel>Status</InputLabel>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select {...field} label="Status">
                    {Object.values(LEAD_STATUSES).map((status) => (
                      <MenuItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.status && (
                <Alert severity="error">{errors.status.message}</Alert>
              )}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.gender}>
              <InputLabel>Gender</InputLabel>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Select {...field} label="Gender">
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                )}
              />
              {errors.gender && (
                <Alert severity="error">{errors.gender.message}</Alert>
              )}
            </FormControl>
          </Grid>
          {leadType === LEAD_TYPES.FTD && (
            <Grid item xs={12} sm={6}>
              <Controller
                name="sin"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="SIN"
                    error={!!errors.sin}
                    helperText={errors.sin?.message}
                  />
                )}
              />
            </Grid>
          )}
          {}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Assignment Information
              <Typography variant="caption" display="block" color="text.secondary">
                Assign lead to multiple client brokers, client networks, campaigns, or our networks
              </Typography>
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="clientBroker"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Autocomplete
                  multiple
                  open={clientBrokerInputValue.length > 0}
                  options={clientBrokers.map(b => b._id)}
                  getOptionLabel={(option) => {
                    const broker = clientBrokers.find(b => b._id === option);
                    return broker?.name || option;
                  }}
                  value={value || []}
                  onChange={(event, newValue) => {
                    onChange(newValue);
                  }}
                  onInputChange={(event, newInputValue) => {
                    setClientBrokerInputValue(newInputValue);
                  }}
                  disabled={loadingClientBrokers}
                  noOptionsText=""
                  ListboxProps={{
                    style: { maxHeight: '250px' }
                  }}
                  componentsProps={{
                    popper: {
                      placement: 'bottom-start'
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Client Brokers"
                      placeholder="Type to search..."
                      error={!!errors.clientBroker}
                      helperText={errors.clientBroker?.message}
                    />
                  )}
                  renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => {
                      const broker = clientBrokers.find(b => b._id === option);
                      return (
                        <Chip
                          label={broker?.name || option}
                          {...getTagProps({ index })}
                          size="small"
                          key={option}
                        />
                      );
                    })
                  }
                  isOptionEqualToValue={(option, value) => option === value}
                  filterOptions={(options, { inputValue }) => {
                    if (!inputValue) return [];
                    return options.filter(option => {
                      const broker = clientBrokers.find(b => b._id === option);
                      return broker?.name?.toLowerCase().includes(inputValue.toLowerCase());
                    });
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="clientNetwork"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Autocomplete
                  multiple
                  open={clientNetworkInputValue.length > 0}
                  options={clientNetworks.map(n => n._id)}
                  getOptionLabel={(option) => {
                    const network = clientNetworks.find(n => n._id === option);
                    return network?.name || option;
                  }}
                  value={value || []}
                  onChange={(event, newValue) => {
                    onChange(newValue);
                  }}
                  onInputChange={(event, newInputValue) => {
                    setClientNetworkInputValue(newInputValue);
                  }}
                  disabled={loadingClientNetworks}
                  noOptionsText=""
                  ListboxProps={{
                    style: { maxHeight: '250px' }
                  }}
                  componentsProps={{
                    popper: {
                      placement: 'bottom-start'
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Client Networks"
                      placeholder="Type to search..."
                      error={!!errors.clientNetwork}
                      helperText={errors.clientNetwork?.message}
                    />
                  )}
                  renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => {
                      const network = clientNetworks.find(n => n._id === option);
                      return (
                        <Chip
                          label={network?.name || option}
                          {...getTagProps({ index })}
                          size="small"
                          key={option}
                        />
                      );
                    })
                  }
                  isOptionEqualToValue={(option, value) => option === value}
                  filterOptions={(options, { inputValue }) => {
                    if (!inputValue) return [];
                    return options.filter(option => {
                      const network = clientNetworks.find(n => n._id === option);
                      return network?.name?.toLowerCase().includes(inputValue.toLowerCase());
                    });
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="campaign"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Autocomplete
                  multiple
                  open={campaignInputValue.length > 0}
                  options={campaigns.map(c => c._id)}
                  getOptionLabel={(option) => {
                    const campaign = campaigns.find(c => c._id === option);
                    return campaign?.name || option;
                  }}
                  value={value || []}
                  onChange={(event, newValue) => {
                    onChange(newValue);
                  }}
                  onInputChange={(event, newInputValue) => {
                    setCampaignInputValue(newInputValue);
                  }}
                  disabled={loadingCampaigns}
                  noOptionsText=""
                  ListboxProps={{
                    style: { maxHeight: '250px' }
                  }}
                  componentsProps={{
                    popper: {
                      placement: 'bottom-start'
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Campaigns"
                      placeholder="Type to search..."
                      error={!!errors.campaign}
                      helperText={errors.campaign?.message}
                    />
                  )}
                  renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => {
                      const campaign = campaigns.find(c => c._id === option);
                      return (
                        <Chip
                          label={campaign?.name || option}
                          {...getTagProps({ index })}
                          size="small"
                          key={option}
                        />
                      );
                    })
                  }
                  isOptionEqualToValue={(option, value) => option === value}
                  filterOptions={(options, { inputValue }) => {
                    if (!inputValue) return [];
                    return options.filter(option => {
                      const campaign = campaigns.find(c => c._id === option);
                      return campaign?.name?.toLowerCase().includes(inputValue.toLowerCase());
                    });
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="ourNetwork"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Autocomplete
                  multiple
                  open={ourNetworkInputValue.length > 0}
                  options={ourNetworks.map(n => n._id)}
                  getOptionLabel={(option) => {
                    const network = ourNetworks.find(n => n._id === option);
                    return network?.name || option;
                  }}
                  value={value || []}
                  onChange={(event, newValue) => {
                    onChange(newValue);
                  }}
                  onInputChange={(event, newInputValue) => {
                    setOurNetworkInputValue(newInputValue);
                  }}
                  disabled={loadingOurNetworks}
                  noOptionsText=""
                  ListboxProps={{
                    style: { maxHeight: '250px' }
                  }}
                  componentsProps={{
                    popper: {
                      placement: 'bottom-start'
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Our Networks"
                      placeholder="Type to search..."
                      error={!!errors.ourNetwork}
                      helperText={errors.ourNetwork?.message}
                    />
                  )}
                  renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => {
                      const network = ourNetworks.find(n => n._id === option);
                      return (
                        <Chip
                          label={network?.name || option}
                          {...getTagProps({ index })}
                          size="small"
                          key={option}
                        />
                      );
                    })
                  }
                  isOptionEqualToValue={(option, value) => option === value}
                  filterOptions={(options, { inputValue }) => {
                    if (!inputValue) return [];
                    return options.filter(option => {
                      const network = ourNetworks.find(n => n._id === option);
                      return network?.name?.toLowerCase().includes(inputValue.toLowerCase());
                    });
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="dob"
              control={control}
              render={({ field: { onChange, value, ...rest } }) => {
                // Format the date value for display in the input
                let displayValue = "";
                if (value) {
                  if (typeof value === 'string') {
                    displayValue = value.split('T')[0];
                  } else if (value instanceof Date) {
                    displayValue = value.toISOString().split('T')[0];
                  } else {
                    displayValue = value;
                  }
                }
                
                return (
                  <TextField
                    {...rest}
                    value={displayValue}
                    onChange={(e) => {
                      // Ensure the date is properly passed to the form
                      onChange(e.target.value || null);
                    }}
                    fullWidth
                    label="Date of Birth"
                    type="date"
                    InputLabelProps={{
                      shrink: true,
                    }}
                    error={!!errors.dob}
                    helperText={errors.dob?.message}
                  />
                );
              }}
            />
          </Grid>
          {}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Address Information
              <Typography variant="caption" display="block" color="text.secondary">
                (Note: These fields are displayed for reference but not currently supported for updates)
              </Typography>
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="address"
              control={control}
              render={({ field }) => {
                const addressValue = typeof field.value === 'string' ? field.value :
                  (field.value ? JSON.stringify(field.value) : '');
                const isAddressEditable = leadType === LEAD_TYPES.FTD || leadType === LEAD_TYPES.FILLER;
                return (
                  <TextField
                    {...field}
                    value={addressValue}
                    fullWidth
                    label="Address"
                    multiline
                    rows={3}
                    disabled={!isAddressEditable}
                    error={!!errors.address}
                    helperText={errors.address?.message ||
                      (isAddressEditable ? "Enter full address" : "Address display only, not editable")}
                  />
                );
              }}
            />
          </Grid>
          {}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>Social Media Information</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="socialMedia.facebook"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Facebook"
                  error={!!errors.socialMedia?.facebook}
                  helperText={errors.socialMedia?.facebook?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="socialMedia.twitter"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Twitter"
                  error={!!errors.socialMedia?.twitter}
                  helperText={errors.socialMedia?.twitter?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="socialMedia.linkedin"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="LinkedIn"
                  error={!!errors.socialMedia?.linkedin}
                  helperText={errors.socialMedia?.linkedin?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="socialMedia.instagram"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Instagram"
                  error={!!errors.socialMedia?.instagram}
                  helperText={errors.socialMedia?.instagram?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="socialMedia.telegram"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Telegram"
                  error={!!errors.socialMedia?.telegram}
                  helperText={errors.socialMedia?.telegram?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="socialMedia.whatsapp"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="WhatsApp"
                  error={!!errors.socialMedia?.whatsapp}
                  helperText={errors.socialMedia?.whatsapp?.message}
                />
              )}
            />
          </Grid>
          {/* Documents Section */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>Documents</Typography>
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="documents"
              control={control}
              render={({ field }) => (
                <Box>
                  {(field.value || []).map((doc, index) => (
                    <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={5}>
                        <TextField
                          fullWidth
                          label="Document URL"
                          value={doc.url || ""}
                          onChange={(e) => {
                            const newDocs = [...field.value];
                            newDocs[index] = { ...doc, url: e.target.value };
                            field.onChange(newDocs);
                          }}
                          error={!!errors.documents?.[index]?.url}
                          helperText={errors.documents?.[index]?.url?.message}
                        />
                      </Grid>
                      <Grid item xs={12} sm={5}>
                        <TextField
                          fullWidth
                          label="Description"
                          value={doc.description || ""}
                          onChange={(e) => {
                            const newDocs = [...field.value];
                            newDocs[index] = { ...doc, description: e.target.value };
                            field.onChange(newDocs);
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {index === field.value.length - 1 && (
                            <IconButton
                              color="primary"
                              onClick={() => {
                                field.onChange([...field.value, { url: '', description: '' }]);
                              }}
                            >
                              <AddIcon />
                            </IconButton>
                          )}
                          {field.value.length > 1 && (
                            <IconButton
                              color="error"
                              onClick={() => {
                                const newDocs = field.value.filter((_, i) => i !== index);
                                field.onChange(newDocs);
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                  ))}
                </Box>
              )}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          type="button"
          variant="contained"
          color="primary"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
          onClick={handleButtonClick}
        >
          {loading ? "Updating..." : "Update Lead"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
export default EditLeadForm;