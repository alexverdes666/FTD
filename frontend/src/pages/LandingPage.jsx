import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Alert,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Fade,
  Chip,
} from "@mui/material";
import {
  Email,
  Person,
  Phone,
  Public,
  Send,
  CheckCircle,
  Cloud,
  Campaign,
  NetworkCheck,
  Info,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { motion } from "framer-motion";
import api from "../services/api";
import { normalizePhone } from "../utils/phoneUtils";

const countryCodes = [
  { code: "+1", country: "US/Canada" },
  { code: "+44", country: "UK" },
  { code: "+49", country: "Germany" },
  { code: "+33", country: "France" },
  { code: "+39", country: "Italy" },
  { code: "+34", country: "Spain" },
  { code: "+31", country: "Netherlands" },
  { code: "+46", country: "Sweden" },
  { code: "+47", country: "Norway" },
  { code: "+45", country: "Denmark" },
  { code: "+41", country: "Switzerland" },
  { code: "+43", country: "Austria" },
  { code: "+32", country: "Belgium" },
  { code: "+351", country: "Portugal" },
  { code: "+30", country: "Greece" },
  { code: "+48", country: "Poland" },
  { code: "+7", country: "Russia" },
  { code: "+81", country: "Japan" },
  { code: "+86", country: "China" },
  { code: "+91", country: "India" },
  { code: "+61", country: "Australia" },
  { code: "+64", country: "New Zealand" },
  { code: "+27", country: "South Africa" },
  { code: "+55", country: "Brazil" },
  { code: "+52", country: "Mexico" },
  { code: "+971", country: "UAE" },
  { code: "+966", country: "Saudi Arabia" },
  { code: "+965", country: "Kuwait" },
  { code: "+974", country: "Qatar" },
  { code: "+973", country: "Bahrain" },
];

const schema = yup.object().shape({
  firstName: yup
    .string()
    .required("First name is required")
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must not exceed 50 characters"),
  lastName: yup
    .string()
    .required("Last name is required")
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must not exceed 50 characters"),
  email: yup.string().email("Invalid email format").required("Email is required"),
  prefix: yup.string().required("Country code is required"),
  phone: yup
    .string()
    .required("Phone number is required")
    .matches(/^[\d\s\-\(\)\+]*$/, "Phone number contains invalid characters")
    .transform((value) => value.replace(/[\s\-\(\)\+]/g, '')) // Remove spaces, dashes, parentheses, and plus signs
    .matches(/^\d+$/, "Phone number must contain only digits after formatting")
    .min(6, "Phone number must be at least 6 digits")
    .max(15, "Phone number must not exceed 15 digits"),
  campaign: yup.string().optional(),
  ourNetwork: yup.string().optional(),
});

const LandingPage = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [injectionContext, setInjectionContext] = useState({
    campaign: null,
    ourNetwork: null,
    clientNetwork: null,
    leadInfo: null,
  });
  
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      prefix: "+1",
      phone: "",
      campaign: "",
      ourNetwork: "",
    },
  });

  // Load injection context from URL parameters or local storage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for injection context in URL parameters
    const contextData = {
      campaign: null,
      ourNetwork: null,
      clientNetwork: null,
      leadInfo: null,
    };

    // Try to get campaign data from URL parameters
    if (urlParams.get('campaign')) {
      try {
        contextData.campaign = JSON.parse(decodeURIComponent(urlParams.get('campaign')));
      } catch (e) {
        console.warn('Failed to parse campaign data from URL');
      }
    }

    // Try to get network data from URL parameters
    if (urlParams.get('ourNetwork')) {
      try {
        contextData.ourNetwork = JSON.parse(decodeURIComponent(urlParams.get('ourNetwork')));
      } catch (e) {
        console.warn('Failed to parse ourNetwork data from URL');
      }
    }

    if (urlParams.get('clientNetwork')) {
      try {
        contextData.clientNetwork = JSON.parse(decodeURIComponent(urlParams.get('clientNetwork')));
      } catch (e) {
        console.warn('Failed to parse clientNetwork data from URL');
      }
    }

    // Try to get lead info from URL parameters
    if (urlParams.get('leadInfo')) {
      try {
        contextData.leadInfo = JSON.parse(decodeURIComponent(urlParams.get('leadInfo')));
      } catch (e) {
        console.warn('Failed to parse leadInfo data from URL');
      }
    }

    // Check local storage if URL parameters don't have the data
    if (!contextData.campaign && window.localStorage.getItem('injectionCampaign')) {
      try {
        contextData.campaign = JSON.parse(window.localStorage.getItem('injectionCampaign'));
      } catch (e) {
        console.warn('Failed to parse campaign data from localStorage');
      }
    }

    if (!contextData.ourNetwork && window.localStorage.getItem('injectionOurNetwork')) {
      try {
        contextData.ourNetwork = JSON.parse(window.localStorage.getItem('injectionOurNetwork'));
      } catch (e) {
        console.warn('Failed to parse ourNetwork data from localStorage');
      }
    }

    if (!contextData.clientNetwork && window.localStorage.getItem('injectionClientNetwork')) {
      try {
        contextData.clientNetwork = JSON.parse(window.localStorage.getItem('injectionClientNetwork'));
      } catch (e) {
        console.warn('Failed to parse clientNetwork data from localStorage');
      }
    }

    if (!contextData.leadInfo && window.localStorage.getItem('injectionLeadInfo')) {
      try {
        contextData.leadInfo = JSON.parse(window.localStorage.getItem('injectionLeadInfo'));
      } catch (e) {
        console.warn('Failed to parse leadInfo data from localStorage');
      }
    }

    // Set the injection context if we found any data
    if (contextData.campaign || contextData.ourNetwork || contextData.clientNetwork || contextData.leadInfo) {
      setInjectionContext(contextData);
      console.log('Injection context loaded:', contextData);
      
      // Auto-fill form fields with campaign and network data
      if (contextData.campaign) {
        setValue('campaign', contextData.campaign.name);
      }
      
      if (contextData.ourNetwork) {
        setValue('ourNetwork', contextData.ourNetwork.name);
      }
    }
  }, [setValue]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    setSubmitError("");
    setRedirectUrl("");
    
    try {
      const isInjectionMode = window.localStorage.getItem('isInjectionMode') === 'true';
      
      // Enhanced proxy IP detection for injection scenarios
      let proxyIp = null;
      
      // Add URL parameters from current page to the request
      const urlParams = new URLSearchParams(window.location.search);
      const queryParams = {};
      for (const [key, value] of urlParams.entries()) {
        queryParams[key] = value;
      }
      
      // Check for proxy IP in various sources (for injection scenarios)
      // 1. Check URL parameters
      if (urlParams.get('clientIp') || urlParams.get('proxyIp') || urlParams.get('ip')) {
        proxyIp = urlParams.get('clientIp') || urlParams.get('proxyIp') || urlParams.get('ip');
        console.log('🎯 Found proxy IP from URL parameters:', proxyIp);
      }
      
      // 2. Check sessionStorage (set by injection scripts)
      if (!proxyIp && window.sessionStorage.getItem('proxyIp')) {
        proxyIp = window.sessionStorage.getItem('proxyIp');
        console.log('🎯 Found proxy IP from sessionStorage:', proxyIp);
      }
      
      // 3. Check localStorage (set by injection scripts)
      if (!proxyIp && window.localStorage.getItem('proxyIp')) {
        proxyIp = window.localStorage.getItem('proxyIp');
        console.log('🎯 Found proxy IP from localStorage:', proxyIp);
      }
      
      // 4. Check if there's a global proxy IP variable (set by injection scripts)
      if (!proxyIp && window.PROXY_IP) {
        proxyIp = window.PROXY_IP;
        console.log('🎯 Found proxy IP from window.PROXY_IP:', proxyIp);
      }
      
      // 5. Check request body for clientIp (for manual injection)
      if (!proxyIp && data.clientIp) {
        proxyIp = data.clientIp;
        console.log('🎯 Found proxy IP from form data:', proxyIp);
      }

      // If in injection mode, we still need to submit the data to get the proxy IP properly recorded
      if (isInjectionMode) {
        console.log('🤖 Injection mode detected, submitting with proxy IP:', proxyIp || 'none detected');
        
        // For injection mode, we still submit to the backend to record the proxy IP
        const submissionData = {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          prefix: data.prefix,
          phone: normalizePhone(data.phone, data.prefix),
          campaign: data.campaign,
          ourNetwork: data.ourNetwork,
          submissionMode: 'external'
        };

        // Add proxy IP to submission if found
        if (proxyIp) {
          submissionData.clientIp = proxyIp;
          console.log('🎯 Using proxy IP for injection submission:', proxyIp);
        }

        try {
          // Submit to backend API with external mode
          const response = await api.post('/landing', submissionData, {
            params: queryParams // Pass URL parameters to backend
          });

          if (response.data.success) {
            console.log('✅ Injection submission successful with proxy IP:', proxyIp);
            setIsSubmitted(true);
            reset();
            
            // Handle redirect URL from external API
            if (response.data.redirectUrl) {
              setRedirectUrl(response.data.redirectUrl);
              setTimeout(() => {
                window.location.href = response.data.redirectUrl;
              }, 2000);
            }
          } else {
            throw new Error(response.data.message || "Injection submission failed");
          }
        } catch (injectionError) {
          console.error('❌ Injection submission failed:', injectionError);
          // Even if backend submission fails, show success for injection mode
          // This maintains the injection flow while logging the error
          setIsSubmitted(true);
          reset();
        }
        
        return;
      }

      // Prepare submission data for regular submissions
      const submissionData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        prefix: data.prefix,
        phone: normalizePhone(data.phone, data.prefix),
        campaign: data.campaign,
        ourNetwork: data.ourNetwork,
        submissionMode: 'external'
      };

      // Add proxy IP to submission if found
      if (proxyIp) {
        submissionData.clientIp = proxyIp;
        console.log('🎯 Using proxy IP for submission:', proxyIp);
      }

      // Submit to backend API with external mode
      const response = await api.post('/landing', submissionData, {
        params: queryParams // Pass URL parameters to backend
      });

      if (response.data.success) {
        setIsSubmitted(true);
        reset();
        
        // Handle redirect URL from external API
        if (response.data.redirectUrl) {
          setRedirectUrl(response.data.redirectUrl);
          setTimeout(() => {
            window.location.href = response.data.redirectUrl;
          }, 2000);
        }
      } else {
        throw new Error(response.data.message || "Submission failed");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      
      let errorMessage = "Something went wrong. Please try again later.";
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Handle specific error types
      if (error.response?.status === 400) {
        // Client error - show the specific message from server
        errorMessage = error.response.data.message || "Please check your information and try again.";
      } else if (error.response?.status === 409) {
        // Conflict - duplicate email
        errorMessage = "A lead with this email already exists.";
      } else if (error.response?.status === 429) {
        // Too many requests
        errorMessage = "Too many attempts. Please wait a moment and try again.";
      } else if (error.response?.status >= 500) {
        // Server error
        errorMessage = "Service temporarily unavailable. Please try again in a few minutes.";
      }
      
      setSubmitError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Container maxWidth="sm">
          <Fade in={isSubmitted} timeout={1000}>
            <Paper
              elevation={24}
              sx={{
                p: 6,
                textAlign: "center",
                borderRadius: 4,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px)",
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
              >
                <CheckCircle
                  sx={{
                    fontSize: 80,
                    color: "success.main",
                    mb: 2
                  }}
                />
              </motion.div>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: "text.primary" }}>
                Thank You!
              </Typography>
              <Typography variant="h6" sx={{ mb: 3, color: "text.secondary" }}>
                Your information has been submitted successfully.
              </Typography>
              <Typography variant="body1" sx={{ mb: 4, color: "text.secondary" }}>
                {redirectUrl ? "You will be redirected to complete your registration." : "We'll be in touch with you soon. Our team will contact you within 24 hours."}
              </Typography>
              
              {redirectUrl && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  Redirecting to: {redirectUrl}
                </Alert>
              )}
              
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Chip
                  icon={<Cloud />}
                  label="External API"
                  color="primary"
                  variant="outlined"
                />
              </Box>
              
              <Box sx={{ mt: 4 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setIsSubmitted(false)}
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderRadius: 3,
                    background: "linear-gradient(45deg, #667eea 30%, #764ba2 90%)",
                    "&:hover": {
                      background: "linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)",
                    },
                  }}
                >
                  Submit Another Form
                </Button>
              </Box>
            </Paper>
          </Fade>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Container maxWidth="md">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Paper
            elevation={24}
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: 4,
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Typography
                variant="h3"
                component="h1"
                gutterBottom
                sx={{
                  fontWeight: 700,
                  background: "linear-gradient(45deg, #667eea 30%, #764ba2 90%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 2,
                }}
              >
                Get Started Today
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: "text.secondary",
                  maxWidth: 600,
                  mx: "auto",
                  mb: 1,
                }}
              >
                Join thousands of satisfied customers. Fill out the form below and our team will contact you within 24 hours.
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", fontStyle: "italic" }}
              >
                Your information is secure and will never be shared with third parties.
              </Typography>
            </Box>

            {/* Injection Mode Indicator */}
            {(injectionContext.campaign || injectionContext.ourNetwork || injectionContext.clientNetwork) && (
              <Alert 
                severity="info" 
                sx={{ 
                  mb: 3, 
                  borderRadius: 2,
                  background: "linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)",
                  border: "1px solid #e1bee7",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Info sx={{ mr: 1 }} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Manual Injection Mode - Campaign and network information has been pre-filled
                  </Typography>
                </Box>
              </Alert>
            )}
            
            {submitError && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {submitError}
              </Alert>
            )}
            
            <Box
              component="form"
              id="landingForm"
              data-testid="landingForm"
              onSubmit={handleSubmit(onSubmit)}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="firstName"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="First Name"
                        id="firstName"
                        data-testid="firstName"
                        name="firstName"
                        placeholder="Enter your first name"
                        error={!!errors.firstName}
                        helperText={errors.firstName?.message}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Person sx={{ color: "primary.main" }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                            "&:hover": {
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "primary.main",
                              },
                            },
                          },
                        }}
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
                        fullWidth
                        label="Last Name"
                        id="lastName"
                        data-testid="lastName"
                        name="lastName"
                        placeholder="Enter your last name"
                        error={!!errors.lastName}
                        helperText={errors.lastName?.message}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Person sx={{ color: "primary.main" }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                            "&:hover": {
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "primary.main",
                              },
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Email Address"
                        id="email"
                        data-testid="email"
                        name="email"
                        type="email"
                        placeholder="Enter your email address"
                        error={!!errors.email}
                        helperText={errors.email?.message || "We'll use this to contact you"}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Email sx={{ color: "primary.main" }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                            "&:hover": {
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "primary.main",
                              },
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
                
                {/* Campaign and Network Fields */}
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="campaign"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Campaign"
                        id="campaign"
                        data-testid="campaign"
                        name="campaign"
                        placeholder="Campaign information"
                        error={!!errors.campaign}
                        helperText={errors.campaign?.message || "Campaign associated with this lead"}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Campaign sx={{ color: "primary.main" }} />
                            </InputAdornment>
                          ),
                          readOnly: !!injectionContext.campaign, // Make read-only if auto-filled
                        }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                            backgroundColor: injectionContext.campaign ? "rgba(25, 118, 210, 0.04)" : "transparent",
                            "&:hover": {
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "primary.main",
                              },
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="ourNetwork"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Our Network"
                        id="ourNetwork"
                        data-testid="ourNetwork"
                        name="ourNetwork"
                        placeholder="Network information"
                        error={!!errors.ourNetwork}
                        helperText={errors.ourNetwork?.message || "Network associated with this lead"}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <NetworkCheck sx={{ color: "success.main" }} />
                            </InputAdornment>
                          ),
                          readOnly: !!injectionContext.ourNetwork, // Make read-only if auto-filled
                        }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                            backgroundColor: injectionContext.ourNetwork ? "rgba(46, 125, 50, 0.04)" : "transparent",
                            "&:hover": {
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "success.main",
                              },
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Controller
                    name="prefix"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.prefix}>
                        <InputLabel id="prefix-label">Country Code</InputLabel>
                        <Select
                          {...field}
                          labelId="prefix-label"
                          id="prefix"
                          data-testid="prefix"
                          label="Country Code"
                          startAdornment={
                            <InputAdornment position="start">
                              <Public sx={{ color: "primary.main" }} />
                            </InputAdornment>
                          }
                          sx={{
                            borderRadius: 2,
                            "& .MuiOutlinedInput-root": {
                              "&:hover": {
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "primary.main",
                                },
                              },
                            },
                          }}
                        >
                          {countryCodes.map((item) => (
                            <MenuItem key={item.code} value={item.code}>
                              {item.code} ({item.country})
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.prefix && (
                          <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                            {errors.prefix.message}
                          </Typography>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Phone Number"
                        id="phone"
                        data-testid="phone"
                        name="phone"
                        placeholder="Enter your phone number"
                        error={!!errors.phone}
                        helperText={errors.phone?.message || "Enter your phone number without the country code"}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Phone sx={{ color: "primary.main" }} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                            "&:hover": {
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "primary.main",
                              },
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
              </Grid>
              <Box sx={{ mt: 4, textAlign: "center" }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} /> : <Send />}
                  sx={{
                    px: 6,
                    py: 2,
                    borderRadius: 3,
                    background: "linear-gradient(45deg, #667eea 30%, #764ba2 90%)",
                    "&:hover": {
                      background: "linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)",
                    },
                    "&:disabled": {
                      background: "rgba(0, 0, 0, 0.26)",
                    },
                  }}
                >
                  {isLoading ? "Submitting..." : "Get Started Now"}
                </Button>
              </Box>
            </Box>
            
            <Box sx={{ mt: 4, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                ✨ Why choose us?
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 3 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  🔒 Secure & Private
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  ⚡ Fast Response
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  💬 24/7 Support
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  ✅ No Hidden Fees
                </Typography>
              </Box>
            </Box>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
};

export default LandingPage;