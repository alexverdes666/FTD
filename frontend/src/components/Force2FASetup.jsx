import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import TwoFactorSetup from './TwoFactorSetup';
import {
  Alert,
  Button,
  Box,
  Collapse
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

/**
 * Force2FASetup - Shows a dismissible banner for admin users without 2FA
 */
const Force2FASetup = ({ children }) => {
  const user = useSelector(selectUser);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const handle2FASuccess = () => {
    setShow2FASetup(false);
    // User state will be updated by TwoFactorSetup component
  };

  const shouldShowBanner = user && user.role === 'admin' && !user.twoFactorEnabled && !bannerDismissed;

  return (
    <>
      {children}
    </>
  );
};

export default Force2FASetup;

