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
      {/* Warning Banner */}
      <Collapse in={shouldShowBanner}>
        <Alert 
          severity="warning" 
          icon={<SecurityIcon />}
          action={
            <Box display="flex" gap={1} alignItems="center">
              <Button 
                color="inherit" 
                size="small" 
                variant="outlined"
                onClick={() => setShow2FASetup(true)}
              >
                Enable Now
              </Button>
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={() => setBannerDismissed(true)}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            </Box>
          }
          sx={{ mb: 2, borderRadius: 1 }}
        >
          <strong>Security Notice:</strong> Enable Two-Factor Authentication to protect your admin account
        </Alert>
      </Collapse>

      {children}

      {/* 2FA Setup Dialog */}
      <TwoFactorSetup
        open={show2FASetup}
        onClose={() => setShow2FASetup(false)}
        onSuccess={handle2FASuccess}
      />
    </>
  );
};

export default Force2FASetup;

