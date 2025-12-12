import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
    Alert,
    CircularProgress,
    InputAdornment,
} from '@mui/material';
import {
    Person as PersonIcon,
    Email as EmailIcon,
    Lock as LockIcon,
} from '@mui/icons-material';
import { register, clearError, selectAuth } from '../store/slices/authSlice';
import './LoginPage.css';
const schema = yup.object({
    fullName: yup.string().required('Full name is required').min(2, 'Name must be at least 2 characters'),
    email: yup.string().email('Invalid email format').required('Email is required'),
    password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
    confirmPassword: yup.string().oneOf([yup.ref('password'), null], 'Passwords must match').required('Please confirm your password')
});
const RegisterPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { isLoading, error } = useSelector(selectAuth);
    const [successMessage, setSuccessMessage] = useState('');
    useEffect(() => {
        dispatch(clearError());
    }, [dispatch]);
    const {
        register: formRegister,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            confirmPassword: ''
        }
    });
    const onSubmit = async (data) => {
        dispatch(clearError());
        setSuccessMessage('');
        try {
            const actionResult = await dispatch(register({
                fullName: data.fullName,
                email: data.email,
                password: data.password
            })).unwrap();
            setSuccessMessage(actionResult.message || 'Registration successful. Your account is pending approval.');
        } catch (err) {
            console.error('Registration failed:', err);
        }
    };
    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-branding">
                    <h1>Register for Lead Management</h1>
                    <p>Create your account to get started.</p>
                </div>
                <div className="login-form-container">
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <h2>Create an Account</h2>
                        {error && (
                            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                                {error}
                            </Alert>
                        )}
                        {successMessage && !error && (
                            <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
                                {successMessage}
                            </Alert>
                        )}
                        <div className="form-group">
                            <span className="icon"><PersonIcon /></span>
                            <input
                                {...formRegister('fullName')}
                                type="text"
                                placeholder="Full Name"
                                autoComplete="name"
                                autoFocus
                            />
                            {errors.fullName && <p className="error-message">{errors.fullName.message}</p>}
                        </div>
                        <div className="form-group">
                            <span className="icon"><EmailIcon /></span>
                            <input
                                {...formRegister('email')}
                                type="email"
                                placeholder="Email Address"
                                autoComplete="email"
                            />
                            {errors.email && <p className="error-message">{errors.email.message}</p>}
                        </div>
                        <div className="form-group">
                            <span className="icon"><LockIcon /></span>
                            <input
                                {...formRegister('password')}
                                type="password"
                                placeholder="Password"
                                autoComplete="new-password"
                            />
                            {errors.password && <p className="error-message">{errors.password.message}</p>}
                        </div>
                        <div className="form-group">
                            <span className="icon"><LockIcon /></span>
                            <input
                                {...formRegister('confirmPassword')}
                                type="password"
                                placeholder="Confirm Password"
                                autoComplete="new-password"
                            />
                            {errors.confirmPassword && <p className="error-message">{errors.confirmPassword.message}</p>}
                        </div>
                        <button type="submit" className="login-btn" disabled={isLoading || isSubmitting}>
                            {isLoading || isSubmitting ? (
                                <CircularProgress size={24} color="inherit" />
                            ) : (
                                'Register'
                            )}
                        </button>
                        <p style={{ textAlign: 'center', marginTop: '20px', color: '#777' }}>
                            Already have an account? {' '}
                            <RouterLink to="/login" style={{ color: 'inherit', textDecoration: 'underline' }}>
                                Sign In
                            </RouterLink>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};
export default RegisterPage;