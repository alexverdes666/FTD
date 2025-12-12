import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { login, verify2FAAndLogin, clearError, clear2FAState, selectAuth } from '../store/slices/authSlice';
import TwoFactorVerification from '../components/TwoFactorVerification';
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
const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error, isAuthenticated, requires2FA, twoFactorUserId } = useSelector(selectAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');
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
    // Show 2FA dialog when 2FA is required
    if (requires2FA) {
      setShow2FADialog(true);
    }
  }, [requires2FA]);
  const onSubmit = async (data) => {
    try {
      const result = await dispatch(login(data)).unwrap();
      
      // If 2FA is required, dialog will be shown automatically via useEffect
      if (result.requires2FA) {
        return;
      }
      
      // Normal login without 2FA
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
      // Check if 2FA was reset due to encryption key mismatch
      if (error && error.includes('disabled')) {
        setTwoFactorError(error);
        // Close 2FA dialog and allow re-login
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
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  return (
    <>
      <div className="login-page">
        <div className="login-container">
          <div className="login-branding">
            <h1>Welcome to Lead Management</h1>
            <p>Your one-stop solution for managing leads effectively.</p>
          </div>
          <div className="login-form-container">
            <form onSubmit={handleSubmit(onSubmit)}>
              <h2>Sign In</h2>
              {error && (
                <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                  {error}
                </Alert>
              )}
              <div className="form-group">
                <span className="icon">
                  <Email />
                </span>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="Email Address"
                  autoComplete="email"
                  autoFocus
                />
                {errors.email && <p className="error-message">{errors.email.message}</p>}
              </div>
              <div className="form-group">
                <span className="icon">
                  <Lock />
                </span>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="current-password"
                />
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={handleTogglePasswordVisibility}
                  edge="end"
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
                {errors.password && <p className="error-message">{errors.password.message}</p>}
              </div>
              <button type="submit" className="login-btn" disabled={isLoading}>
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign In'
                )}
              </button>
              <p style={{ textAlign: 'center', marginTop: '20px', color: '#777' }}>
                Don't have an account?{' '}
                <RouterLink to="/register" style={{ color: 'inherit', textDecoration: 'underline' }}>
                  Sign Up
                </RouterLink>
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* 2FA Verification Dialog */}
      <TwoFactorVerification
        open={show2FADialog}
        onClose={handle2FAClose}
        onVerify={handle2FAVerification}
        loading={isLoading}
        error={twoFactorError}
      />
    </>
  );
};
export default LoginPage;