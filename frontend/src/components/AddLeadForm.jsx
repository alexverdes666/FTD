import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
    Box,
    Button,
    TextField,
    Grid,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Typography,
    Paper,
    Alert,
    CircularProgress,
    IconButton,
    Chip
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../services/api';
import { getSortedCountries } from '../constants/countries';
import { selectUser } from '../store/slices/authSlice';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
const addLeadSchema = yup.object({
    firstName: yup.string().required('First name is required').min(2, 'First name must be at least 2 characters'),
    lastName: yup.string().required('Last name is required').min(2, 'Last name must be at least 2 characters'),
    gender: yup.string().oneOf(['male', 'female', 'not_defined'], 'Invalid gender').default('not_defined'),
    newEmail: yup.string().required('New email is required').email('Invalid email format'),
    oldEmail: yup.string().nullable().email('Invalid email format'),
    newPhone: yup.string().required('New phone is required'),
    oldPhone: yup.string().nullable(),
    country: yup.string().required('Country is required').min(2, 'Country must be at least 2 characters'),
    leadType: yup.string().required('Lead type is required').oneOf(['ftd', 'filler', 'cold'], 'Invalid lead type'),
    sin: yup.string().when('leadType', {
        is: 'ftd',
        then: () => yup.string().required('SIN is required for FTD leads'),
        otherwise: () => yup.string().nullable()
    }),
    dob: yup.date().nullable().when('leadType', {
        is: (val) => val === 'ftd' || val === 'filler',
        then: () => yup.date().nullable(),
        otherwise: () => yup.date().nullable()
    }),
    address: yup.string().nullable().typeError('Address must be a string type'),
    'socialMedia.facebook': yup.string().nullable().url('Invalid Facebook URL'),
    'socialMedia.twitter': yup.string().nullable().url('Invalid Twitter URL'),
    'socialMedia.linkedin': yup.string().nullable().url('Invalid LinkedIn URL'),
    'socialMedia.instagram': yup.string().nullable().url('Invalid Instagram URL'),
    'socialMedia.telegram': yup.string().nullable(),
    'socialMedia.whatsapp': yup.string().nullable(),
    documents: yup.array().of(
        yup.object().shape({
            url: yup.string().required('Document URL is required').url('Invalid document URL'),
            description: yup.string().nullable()
        })
    ).nullable().default([]),
    // Optional dropdown fields
    campaign: yup.array().of(yup.string()).nullable(),
    clientBroker: yup.array().of(yup.string()).nullable(),
    clientNetwork: yup.array().of(yup.string()).nullable(),
    ourNetwork: yup.array().of(yup.string()).nullable()
});
const AddLeadForm = ({ onLeadAdded }) => {
    const user = useSelector(selectUser);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [documents, setDocuments] = useState([{ url: '', description: '' }]);
    
    // Dropdown data states
    const [campaigns, setCampaigns] = useState([]);
    const [clientBrokers, setClientBrokers] = useState([]);
    const [clientNetworks, setClientNetworks] = useState([]);
    const [ourNetworks, setOurNetworks] = useState([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);
    const [loadingClientBrokers, setLoadingClientBrokers] = useState(false);
    const [loadingClientNetworks, setLoadingClientNetworks] = useState(false);
    const [loadingOurNetworks, setLoadingOurNetworks] = useState(false);
    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors }
    } = useForm({
        resolver: yupResolver(addLeadSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            gender: 'not_defined',
            newEmail: '',
            oldEmail: '',
            newPhone: '',
            oldPhone: '',
            country: '',
            leadType: '',
            sin: '',
            campaign: [],
            clientBroker: [],
            clientNetwork: [],
            ourNetwork: [],
            dob: null,
            address: '',
            socialMedia: {
                facebook: '',
                twitter: '',
                linkedin: '',
                instagram: '',
                telegram: '',
                whatsapp: ''
            },
            documents: [{ url: '', description: '' }]
        }
    });
    const leadType = watch('leadType');

    // Fetch dropdown data
    const fetchCampaigns = useCallback(async () => {
        setLoadingCampaigns(true);
        try {
            // Always fetch all active campaigns for lead creation dropdown
            const response = await api.get('/campaigns?isActive=true&status=active&limit=1000');
            setCampaigns(response.data.data || []);
        } catch (err) {
            // Error silently handled - already shown in UI if needed
        } finally {
            setLoadingCampaigns(false);
        }
    }, []);

    const fetchClientBrokers = useCallback(async () => {
        setLoadingClientBrokers(true);
        try {
            const response = await api.get('/client-brokers?isActive=true&limit=1000');
            setClientBrokers(response.data.data || []);
        } catch (err) {
            // Error silently handled - already shown in UI if needed
        } finally {
            setLoadingClientBrokers(false);
        }
    }, []);

    const fetchClientNetworks = useCallback(async () => {
        setLoadingClientNetworks(true);
        try {
            const response = await api.get('/client-networks?isActive=true&limit=1000');
            setClientNetworks(response.data.data || []);
        } catch (err) {
            // Error silently handled - already shown in UI if needed
        } finally {
            setLoadingClientNetworks(false);
        }
    }, []);

    const fetchOurNetworks = useCallback(async () => {
        setLoadingOurNetworks(true);
        try {
            // Always fetch all active our networks for lead creation dropdown
            const response = await api.get('/our-networks?isActive=true&limit=1000');
            setOurNetworks(response.data.data || []);
        } catch (err) {
            // Error silently handled - already shown in UI if needed
        } finally {
            setLoadingOurNetworks(false);
        }
    }, []);

    // Load data on component mount
    useEffect(() => {
        fetchCampaigns();
        fetchClientBrokers();
        fetchClientNetworks();
        fetchOurNetworks();
    }, [fetchCampaigns, fetchClientBrokers, fetchClientNetworks, fetchOurNetworks]);

    const onSubmit = async (data) => {
        setLoading(true);
        setError(null);
        setSuccess(null);
            try {
                const submitData = { ...data };
                
                // Clean up empty array values for optional fields
                if (Array.isArray(submitData.campaign) && submitData.campaign.length === 0) {
                    delete submitData.campaign;
                } else if (Array.isArray(submitData.campaign) && submitData.campaign.length > 0) {
                    // Keep the array as is
                }
                
                if (Array.isArray(submitData.clientBroker) && submitData.clientBroker.length === 0) {
                    delete submitData.clientBroker;
                } else if (Array.isArray(submitData.clientBroker) && submitData.clientBroker.length > 0) {
                    // Keep the array as is  
                }
                
                if (Array.isArray(submitData.clientNetwork) && submitData.clientNetwork.length === 0) {
                    delete submitData.clientNetwork;
                } else if (Array.isArray(submitData.clientNetwork) && submitData.clientNetwork.length > 0) {
                    // Keep the array as is
                }
                
                if (Array.isArray(submitData.ourNetwork) && submitData.ourNetwork.length === 0) {
                    delete submitData.ourNetwork;
                } else if (Array.isArray(submitData.ourNetwork) && submitData.ourNetwork.length > 0) {
                    // Keep the array as is
                }
            if (data.leadType === 'ftd') {
                submitData.documents = data.documents.filter(doc => doc.url.trim() !== '');
                if (submitData.documents.length === 0) {
                    submitData.documents = [];
                }
            }
            if (submitData.address) {
                if (typeof submitData.address === 'object') {
                    const { street, city, postalCode } = submitData.address;
                    submitData.address = `${street || ''}, ${city || ''} ${postalCode || ''}`.trim();
                } else if (typeof submitData.address !== 'string') {
                    submitData.address = String(submitData.address);
                }
            }
            const response = await api.post('/leads', submitData);
            if (response.data.success) {
                setSuccess('Lead added successfully');
                reset();
                if (onLeadAdded) {
                    onLeadAdded(response.data.data);
                }
            } else {
                throw new Error(response.data.message || 'Failed to add lead');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to add lead');
        } finally {
            setLoading(false);
        }
    };
    return (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
                Add New Lead
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <Grid container spacing={2}>
                    {}
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="firstName"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="First Name"
                                    fullWidth
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
                                    label="Last Name"
                                    fullWidth
                                    error={!!errors.lastName}
                                    helperText={errors.lastName?.message}
                                />
                            )}
                        />
                    </Grid>
                    {}
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth error={!!errors.leadType}>
                            <InputLabel>Lead Type</InputLabel>
                            <Controller
                                name="leadType"
                                control={control}
                                render={({ field }) => (
                                    <Select {...field} label="Lead Type">
                                        <MenuItem value="ftd">FTD</MenuItem>
                                        <MenuItem value="filler">Filler</MenuItem>
                                        <MenuItem value="cold">Cold</MenuItem>
                                    </Select>
                                )}
                            />
                            {errors.leadType && (
                                <Typography color="error" variant="caption">
                                    {errors.leadType.message}
                                </Typography>
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
                                        <MenuItem value="not_defined">Not Defined</MenuItem>
                                    </Select>
                                )}
                            />
                            {errors.gender && (
                                <Typography variant="caption" color="error">
                                    {errors.gender.message}
                                </Typography>
                            )}
                        </FormControl>
                    </Grid>
                    {}
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="newEmail"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="New Email"
                                    fullWidth
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
                                    label="Old Email (Optional)"
                                    fullWidth
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
                                    label="New Phone"
                                    fullWidth
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
                                    label="Old Phone (Optional)"
                                    fullWidth
                                    error={!!errors.oldPhone}
                                    helperText={errors.oldPhone?.message}
                                />
                            )}
                        />
                    </Grid>
                    {}
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="country"
                            control={control}
                            render={({ field }) => (
                                <FormControl fullWidth error={!!errors.country}>
                                    <InputLabel>Country</InputLabel>
                                    <Select
                                        {...field}
                                        label="Country"
                                        value={field.value || ''}
                                    >
                                        {getSortedCountries().map((country) => (
                                            <MenuItem key={country.code} value={country.name}>
                                                {country.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {errors.country?.message && (
                                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                                            {errors.country.message}
                                        </Typography>
                                    )}
                                </FormControl>
                            )}
                        />
                    </Grid>
                    {}
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                            <InputLabel>Campaign</InputLabel>
                            <Controller
                                name="campaign"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        {...field}
                                        multiple
                                        label="Campaign"
                                        value={field.value || []}
                                        disabled={loadingCampaigns}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((campaignId) => {
                                                    const campaign = campaigns.find(c => c._id === campaignId);
                                                    return (
                                                        <Chip 
                                                            key={campaignId} 
                                                            label={campaign?.name || campaignId} 
                                                            size="small"
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        )}
                                    >
                                        {campaigns.map((campaign) => (
                                            <MenuItem key={campaign._id} value={campaign._id}>
                                                {campaign.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                )}
                            />
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                            <InputLabel>Client Broker</InputLabel>
                            <Controller
                                name="clientBroker"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        {...field}
                                        multiple
                                        label="Client Broker"
                                        value={field.value || []}
                                        disabled={loadingClientBrokers}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((brokerId) => {
                                                    const broker = clientBrokers.find(b => b._id === brokerId);
                                                    return (
                                                        <Chip 
                                                            key={brokerId} 
                                                            label={broker?.name || brokerId} 
                                                            size="small"
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        )}
                                    >
                                        {clientBrokers.map((broker) => (
                                            <MenuItem key={broker._id} value={broker._id}>
                                                {broker.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                )}
                            />
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                            <InputLabel>Client Network</InputLabel>
                            <Controller
                                name="clientNetwork"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        {...field}
                                        multiple
                                        label="Client Network"
                                        value={field.value || []}
                                        disabled={loadingClientNetworks}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((networkId) => {
                                                    const network = clientNetworks.find(n => n._id === networkId);
                                                    return (
                                                        <Chip 
                                                            key={networkId} 
                                                            label={network?.name || networkId} 
                                                            size="small"
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        )}
                                    >
                                        {clientNetworks.map((network) => (
                                            <MenuItem key={network._id} value={network._id}>
                                                {network.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                )}
                            />
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                            <InputLabel>Our Network</InputLabel>
                            <Controller
                                name="ourNetwork"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        {...field}
                                        multiple
                                        label="Our Network"
                                        value={field.value || []}
                                        disabled={loadingOurNetworks}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((networkId) => {
                                                    const network = ourNetworks.find(n => n._id === networkId);
                                                    return (
                                                        <Chip 
                                                            key={networkId} 
                                                            label={network?.name || networkId} 
                                                            size="small"
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        )}
                                    >
                                        {ourNetworks.map((network) => (
                                            <MenuItem key={network._id} value={network._id}>
                                                {network.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                )}
                            />
                        </FormControl>
                    </Grid>
                    {}
                    {leadType === 'ftd' && (
                        <Grid item xs={12} sm={6}>
                            <Controller
                                name="sin"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="SIN"
                                        fullWidth
                                        error={!!errors.sin}
                                        helperText={errors.sin?.message}
                                    />
                                )}
                            />
                        </Grid>
                    )}
                    {}
                    {(leadType === 'ftd' || leadType === 'filler') && (
                        <>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="dob"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label="Date of Birth"
                                            type="date"
                                            fullWidth
                                            InputLabelProps={{
                                                shrink: true,
                                            }}
                                            value={field.value || ''}
                                            error={!!errors.dob}
                                            helperText={errors.dob?.message}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="address"
                                    control={control}
                                    render={({ field }) => {
                                        const addressValue = typeof field.value === 'string'
                                            ? field.value
                                            : (field.value ? JSON.stringify(field.value) : '');
                                        return (
                                            <TextField
                                                {...field}
                                                label="Address"
                                                fullWidth
                                                multiline
                                                rows={3}
                                                value={addressValue}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                error={!!errors.address}
                                                helperText={errors.address?.message || "Enter full address"}
                                            />
                                        );
                                    }}
                                />
                            </Grid>
                        </>
                    )}
                    {}
                    <Grid item xs={12}>
                        <Typography variant="subtitle1" gutterBottom>
                            Social Media (Optional)
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="socialMedia.facebook"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Facebook"
                                    fullWidth
                                    value={field.value || ''}
                                    error={!!errors['socialMedia.facebook']}
                                    helperText={errors['socialMedia.facebook']?.message}
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
                                    label="Twitter"
                                    fullWidth
                                    value={field.value || ''}
                                    error={!!errors['socialMedia.twitter']}
                                    helperText={errors['socialMedia.twitter']?.message}
                                />
                            )}
                        />
                    </Grid>
                    {}
                    <Grid item xs={12}>
                        <Typography variant="subtitle1" gutterBottom>
                            Documents
                        </Typography>
                    </Grid>
                    <Grid item xs={12}>
                        <Controller
                            name="documents"
                            control={control}
                            render={({ field }) => (
                                <Box>
                                    {field.value.map((doc, index) => (
                                        <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                                            <Grid item xs={12} sm={5}>
                                                <TextField
                                                    fullWidth
                                                    label="Document URL"
                                                    value={doc.url}
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
                                                    value={doc.description}
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
                    {}
                    <Grid item xs={12}>
                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            disabled={loading}
                            sx={{ mr: 2 }}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Add Lead'}
                        </Button>
                        <Button
                            type="button"
                            variant="outlined"
                            onClick={() => reset()}
                            disabled={loading}
                        >
                            Reset
                        </Button>
                    </Grid>
                </Grid>
            </Box>
        </Paper>
    );
};
export default AddLeadForm;