import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Avatar,
  Typography,
  Divider,
  CircularProgress,
  Tooltip,
  Chip,
  ListItemIcon
} from '@mui/material';
import {
  ArrowDropDown,
  AccountCircle,
  SwapHoriz,
  Check,
  FlashOn as QuickIcon,
  Keyboard
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser, switchUserAccount, fetchRelatedAccounts } from '../store/slices/authSlice';
import { addRecentAccount } from '../utils/accountHistory';
import toast from 'react-hot-toast';

const UserSwitcher = ({ onOpenQuickSwitcher }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const [anchorEl, setAnchorEl] = useState(null);
  const [relatedAccounts, setRelatedAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  const open = Boolean(anchorEl);

  useEffect(() => {
    if (open && user) {
      loadRelatedAccounts();
    }
  }, [open, user]);

  const loadRelatedAccounts = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const result = await dispatch(fetchRelatedAccounts()).unwrap();
      setRelatedAccounts(result);
    } catch (error) {
      console.error('Failed to load related accounts:', error);
      // Don't show error toast if no related accounts (expected behavior)
      if (!error?.message?.includes('No related accounts')) {
        toast.error('Failed to load account options');
      }
      setRelatedAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAccountSwitch = async (accountId) => {
    if (switching) return;

    setSwitching(true);
    handleClose();

    try {
      const result = await dispatch(switchUserAccount(accountId)).unwrap();

      if (result.requires2FA) {
        // MainLayout will show the 2FA dialog
        return;
      }

      // Add to recent accounts
      if (result.user) {
        addRecentAccount(result.user);
      }

      toast.success('Account switched successfully', {
        duration: 2000,
        icon: '🔄'
      });
      // Clear related accounts to force refresh on next open
      setRelatedAccounts([]);
      // Redirect to dashboard after switching accounts
      navigate('/');
    } catch (error) {
      console.error('Failed to switch account:', error);
      toast.error(error?.message || 'Failed to switch account');
    } finally {
      setSwitching(false);
    }
  };

  const getRoleDisplayName = (role) => {
    const roleMap = {
      admin: 'Admin',
      affiliate_manager: 'Affiliate Manager',
      agent: 'Agent',
      lead_manager: 'Lead Manager',
      refunds_manager: 'Refunds Manager',
      inventory_manager: 'Inventory Manager',
      pending_approval: 'Pending Approval'
    };
    return roleMap[role] || role;
  };

  const getRoleColor = (role) => {
    const colorMap = {
      admin: 'error',
      affiliate_manager: 'primary',
      agent: 'success',
      lead_manager: 'info',
      refunds_manager: 'warning',
      inventory_manager: 'secondary',
      pending_approval: 'default'
    };
    return colorMap[role] || 'default';
  };

  if (!user) return null;

  // Only show if user has related accounts or we're loading
  const showSwitcher = relatedAccounts.length > 1 || loading;

  if (!showSwitcher && !open) {
    return null;
  }

  return (
    <Box>
      <Tooltip title="Switch Account" arrow>
        <Button
          onClick={handleClick}
          variant="outlined"
          size="small"
          startIcon={switching ? <CircularProgress size={16} /> : <SwapHoriz />}
          endIcon={<ArrowDropDown />}
          disabled={switching}
          sx={{
            minWidth: 'auto',
            textTransform: 'none',
            borderColor: 'divider',
            color: 'text.primary',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: 'action.hover'
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountCircle fontSize="small" />
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              {getRoleDisplayName(user.role)}
            </Box>
          </Box>
        </Button>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            minWidth: 280,
            maxWidth: 400,
            mt: 1
          }
        }}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="overline" color="text.secondary">
            Switch Account
          </Typography>
        </Box>
        <Divider />

        {/* Quick Switcher Option */}
        {relatedAccounts.length > 1 && (
          <>
            <MenuItem
              onClick={() => {
                handleClose();
                onOpenQuickSwitcher?.();
              }}
              sx={{
                py: 1,
                px: 2,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  bgcolor: 'primary.dark'
                }
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                <QuickIcon fontSize="small" />
              </ListItemIcon>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Quick Switcher
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  <Keyboard fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                  Ctrl+Shift+S
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
          </>
        )}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : relatedAccounts.length === 0 ? (
          <MenuItem disabled>
            <Typography color="text.secondary">
              No other accounts available
            </Typography>
          </MenuItem>
        ) : (
          relatedAccounts.map((account) => (
            <MenuItem
              key={account.id}
              onClick={() => handleAccountSwitch(account.id)}
              disabled={account.isCurrentAccount || switching}
              sx={{
                py: 1.5,
                px: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0.5,
                '&:hover': {
                  backgroundColor: account.isCurrentAccount ? 'action.selected' : 'action.hover'
                },
                ...(account.isCurrentAccount && {
                  backgroundColor: 'action.selected'
                })
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                  {account.fullName?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        fontWeight: account.isCurrentAccount ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}
                    >
                      {account.fullName}
                    </Typography>
                    {account.isCurrentAccount && (
                      <Check fontSize="small" color="primary" />
                    )}
                  </Box>
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ 
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {account.email}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ ml: 5 }}>
                <Chip
                  label={getRoleDisplayName(account.role)}
                  size="small"
                  color={getRoleColor(account.role)}
                  variant={account.isCurrentAccount ? 'filled' : 'outlined'}
                />
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </Box>
  );
};

export default UserSwitcher;
