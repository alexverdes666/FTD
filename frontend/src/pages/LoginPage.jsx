import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  EmailOutlined,
  LockOutlined,
  TrendingUp,
  Speed,
  Security,
  BarChart,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { login, verify2FAAndLogin, completeQRLogin, clearError, clear2FAState, selectAuth } from '../store/slices/authSlice';
import TwoFactorVerification from '../components/TwoFactorVerification';
import QRCodeLogin from '../components/QRCodeLogin';
import './LoginPage.css';

const schema = yup.object({
  email: yup
    .string()
    .email('Invalid email format')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

const features = [
  { icon: <TrendingUp sx={{ fontSize: 28 }} />, title: 'Lead Tracking', desc: 'Monitor and manage leads in real-time' },
  { icon: <Speed sx={{ fontSize: 28 }} />, title: 'Fast Performance', desc: 'Optimized workflows for maximum efficiency' },
  { icon: <Security sx={{ fontSize: 28 }} />, title: 'Secure Platform', desc: 'Enterprise-grade security and compliance' },
  { icon: <BarChart sx={{ fontSize: 28 }} />, title: 'Advanced Analytics', desc: 'Actionable insights and detailed reports' },
];

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error, isAuthenticated, requires2FA, twoFactorUserId, useQRAuth } = useSelector(selectAuth);

  const [showPassword, setShowPassword] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
  });

  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  useEffect(() => {
    if (requires2FA && twoFactorUserId) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      if (useQRAuth) {
        setShowQRDialog(true);
        setShow2FADialog(false);
      } else {
        setShow2FADialog(true);
        setShowQRDialog(false);
      }
    }
  }, [requires2FA, twoFactorUserId, useQRAuth]);

  const onSubmit = async (data) => {
    try {
      const result = await dispatch(login(data)).unwrap();

      if (result.requires2FA) {
        return;
      }

      if (result.token) {
        localStorage.setItem('token', result.token);
      }
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handle2FAVerification = async (code, useBackupCode) => {
    setTwoFactorError('');
    try {
      const result = await dispatch(verify2FAAndLogin({
        userId: twoFactorUserId,
        token: code,
        useBackupCode
      })).unwrap();

      if (result.token) {
        localStorage.setItem('token', result.token);
      }

      setShow2FADialog(false);
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      if (error && error.includes('disabled')) {
        setTwoFactorError(error);
        setTimeout(() => {
          setShow2FADialog(false);
          dispatch(clear2FAState());
        }, 3000);
      } else {
        setTwoFactorError(error || '2FA verification failed');
      }
      console.error('2FA verification error:', error);
    }
  };

  const handle2FAClose = () => {
    setShow2FADialog(false);
    setTwoFactorError('');
    dispatch(clear2FAState());
  };

  const handleQRClose = () => {
    setShowQRDialog(false);
    dispatch(clear2FAState());
  };

  const handleQRLoginSuccess = async (token, user) => {
    await dispatch(completeQRLogin({ token, user }));
    setShowQRDialog(false);
    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  const handleFallbackTo2FA = () => {
    setShowQRDialog(false);
    setShow2FADialog(true);
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Left Branding Panel */}
        <Box
          className="login-left-panel"
          sx={{
            width: '50%',
            background: 'linear-gradient(160deg, #1e3a5f 0%, #0d2137 100%)',
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            p: 6,
          }}
        >
          {/* Decorative geometric shapes */}
          <Box className="login-deco-circle login-deco-circle-1" />
          <Box className="login-deco-circle login-deco-circle-2" />
          <Box className="login-deco-circle login-deco-circle-3" />
          <Box className="login-deco-line login-deco-line-1" />
          <Box className="login-deco-line login-deco-line-2" />

          {/* Branding Content */}
          <Box
            className="login-brand-content"
            sx={{
              position: 'relative',
              zIndex: 2,
              textAlign: 'center',
              maxWidth: 420,
            }}
          >
            <Typography
              variant="h3"
              sx={{
                color: '#fff',
                fontWeight: 800,
                letterSpacing: '-0.5px',
                mb: 1,
                lineHeight: 1.2,
              }}
            >
              FTD Platform
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 400,
                mb: 6,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontSize: '0.85rem',
              }}
            >
              Enterprise Lead Management
            </Typography>

            <Box sx={{ textAlign: 'left', mt: 2 }}>
              {features.map((feature, index) => (
                <Box
                  key={index}
                  className="login-feature-item"
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    mb: 3.5,
                    gap: 2,
                    animationDelay: `${0.3 + index * 0.15}s`,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '12px',
                      background: 'rgba(245, 124, 0, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f57c00',
                      flexShrink: 0,
                    }}
                  >
                    {feature.icon}
                  </Box>
                  <Box>
                    <Typography
                      sx={{
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        mb: 0.3,
                      }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography
                      sx={{
                        color: 'rgba(255,255,255,0.55)',
                        fontSize: '0.82rem',
                        lineHeight: 1.4,
                      }}
                    >
                      {feature.desc}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Right Form Panel */}
        <Box
          className="login-right-panel"
          sx={{
            width: { xs: '100%', md: '50%' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#f8f9fc',
            p: { xs: 3, sm: 4 },
          }}
        >
          <Paper
            elevation={0}
            className="login-form-card"
            sx={{
              width: '100%',
              maxWidth: 440,
              p: { xs: 3, sm: 5 },
              borderRadius: '16px',
              bgcolor: '#fff',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            {/* Mobile-only brand mark */}
            <Typography
              variant="h5"
              sx={{
                display: { xs: 'block', md: 'none' },
                textAlign: 'center',
                fontWeight: 800,
                color: '#1e3a5f',
                mb: 3,
              }}
            >
              FTD Platform
            </Typography>

            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: '#1e3a5f',
                mb: 0.5,
              }}
            >
              Welcome Back
            </Typography>
            <Typography
              sx={{
                color: '#8492a6',
                mb: 4,
                fontSize: '0.95rem',
              }}
            >
              Sign in to continue to your dashboard
            </Typography>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 3,
                  borderRadius: '10px',
                  '& .MuiAlert-icon': { alignItems: 'center' },
                }}
              >
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <TextField
                {...register('email')}
                fullWidth
                label="Email Address"
                type="email"
                autoComplete="email"
                autoFocus
                error={!!errors.email}
                helperText={errors.email?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined sx={{ color: '#8492a6', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    transition: 'box-shadow 0.2s ease',
                    '&.Mui-focused': {
                      boxShadow: '0 0 0 3px rgba(30, 58, 95, 0.1)',
                    },
                  },
                }}
              />

              <TextField
                {...register('password')}
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: '#8492a6', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleTogglePasswordVisibility}
                        edge="end"
                        size="small"
                        sx={{ color: '#8492a6' }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    transition: 'box-shadow 0.2s ease',
                    '&.Mui-focused': {
                      boxShadow: '0 0 0 3px rgba(30, 58, 95, 0.1)',
                    },
                  },
                }}
              />

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 3,
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      size="small"
                      sx={{
                        color: '#8492a6',
                        '&.Mui-checked': { color: '#1e3a5f' },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: '0.85rem', color: '#6c7a89' }}>
                      Remember me
                    </Typography>
                  }
                />
                <Link
                  component={RouterLink}
                  to="/forgot-password"
                  underline="none"
                  sx={{
                    fontSize: '0.85rem',
                    color: '#f57c00',
                    fontWeight: 500,
                    '&:hover': { color: '#e65100' },
                  }}
                >
                  Forgot Password?
                </Link>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={isLoading}
                disableElevation
                sx={{
                  py: 1.5,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  letterSpacing: '0.3px',
                  transition: 'all 0.25s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #16304f 0%, #245080 100%)',
                    transform: 'scale(1.015)',
                    boxShadow: '0 6px 20px rgba(30, 58, 95, 0.35)',
                  },
                  '&:active': {
                    transform: 'scale(0.99)',
                  },
                  '&.Mui-disabled': {
                    background: '#c5cdd8',
                    color: '#fff',
                  },
                }}
              >
                {isLoading ? (
                  <CircularProgress size={24} sx={{ color: '#fff' }} />
                ) : (
                  'Sign In'
                )}
              </Button>

              <Typography
                sx={{
                  textAlign: 'center',
                  mt: 3.5,
                  color: '#8492a6',
                  fontSize: '0.9rem',
                }}
              >
                Don&apos;t have an account?{' '}
                <Link
                  component={RouterLink}
                  to="/register"
                  underline="none"
                  sx={{
                    color: '#1e3a5f',
                    fontWeight: 600,
                    '&:hover': { color: '#f57c00' },
                  }}
                >
                  Register
                </Link>
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* 2FA Verification Dialog */}
      <TwoFactorVerification
        open={show2FADialog}
        onClose={handle2FAClose}
        onVerify={handle2FAVerification}
        loading={isLoading}
        error={twoFactorError}
      />

      {/* QR Code Login Dialog */}
      <QRCodeLogin
        open={showQRDialog}
        onClose={handleQRClose}
        userId={twoFactorUserId}
        onLoginSuccess={handleQRLoginSuccess}
        onFallbackTo2FA={handleFallbackTo2FA}
      />
    </>
  );
};

export default LoginPage;
