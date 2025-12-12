import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  Box,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Chip,
  Fade,
  Paper,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  SwapHoriz as SwitchIcon,
  KeyboardArrowDown,
  KeyboardArrowUp
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser, switchUserAccount, fetchRelatedAccounts } from '../store/slices/authSlice';
import { addRecentAccount, getRecentAccounts } from '../utils/accountHistory';
import toast from 'react-hot-toast';

const QuickSwitcher = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [accounts, setAccounts] = useState([]);
  const [filteredAccounts, setFilteredAccounts] = useState([]);
  const [recentAccounts, setRecentAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      loadAccounts();
      loadRecentAccounts();
      setSearchQuery('');
      setSelectedIndex(0);
      // Focus the input after a small delay to ensure the dialog is open
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const loadRecentAccounts = () => {
    const recent = getRecentAccounts();
    setRecentAccounts(recent);
  };

  useEffect(() => {
    // Filter and sort accounts based on search query and recent usage
    if (!searchQuery) {
      // Sort by recent usage, then by name
      const sortedAccounts = [...accounts].sort((a, b) => {
        const aIsRecent = recentAccounts.some(r => r.id === a.id);
        const bIsRecent = recentAccounts.some(r => r.id === b.id);
        
        if (aIsRecent && !bIsRecent) return -1;
        if (!aIsRecent && bIsRecent) return 1;
        if (aIsRecent && bIsRecent) {
          // Sort by recent order
          const aRecentIndex = recentAccounts.findIndex(r => r.id === a.id);
          const bRecentIndex = recentAccounts.findIndex(r => r.id === b.id);
          return aRecentIndex - bRecentIndex;
        }
        return a.fullName.localeCompare(b.fullName);
      });
      setFilteredAccounts(sortedAccounts);
    } else {
      const filtered = accounts.filter(account =>
        account.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getRoleDisplayName(account.role).toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAccounts(filtered);
    }
    setSelectedIndex(0);
  }, [searchQuery, accounts, recentAccounts]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const result = await dispatch(fetchRelatedAccounts()).unwrap();
      setAccounts(result);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredAccounts.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => prev === 0 ? filteredAccounts.length - 1 : prev - 1);
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredAccounts[selectedIndex] && !filteredAccounts[selectedIndex].isCurrentAccount) {
          handleAccountSwitch(filteredAccounts[selectedIndex].id);
        }
        break;
      case 'Escape':
        onClose();
        break;
      default:
        break;
    }
  };

  const handleAccountSwitch = async (accountId) => {
    if (switching) return;

    setSwitching(true);
    try {
      const result = await dispatch(switchUserAccount(accountId)).unwrap();
      
      // Add to recent accounts
      if (result.user) {
        addRecentAccount(result.user);
      }
      
      toast.success('Switched successfully!', {
        duration: 1500,
        icon: '⚡'
      });
      onClose();
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '70vh',
          bgcolor: 'background.paper',
          backdropFilter: 'blur(10px)'
        }
      }}
      TransitionComponent={Fade}
      transitionDuration={200}
    >
      <Box sx={{ p: 0 }}>
        {/* Header */}
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            ref={inputRef}
            fullWidth
            placeholder="Search accounts to switch..."
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 2,
                '& fieldset': { border: 'none' },
                bgcolor: 'action.hover'
              }
            }}
            disabled={switching}
          />
        </Box>

        {/* Quick tip */}
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Use ↑↓ arrows to navigate, Enter to switch, Esc to close
          </Typography>
        </Box>

        <Divider />

        {/* Account list */}
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Loading accounts...</Typography>
            </Box>
          ) : filteredAccounts.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {searchQuery ? 'No accounts match your search' : 'No linked accounts available'}
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {filteredAccounts.map((account, index) => {
                const isRecent = recentAccounts.some(r => r.id === account.id);
                return (
                <ListItem
                  key={account.id}
                  button
                  selected={index === selectedIndex}
                  onClick={() => {
                    if (!account.isCurrentAccount && !switching) {
                      handleAccountSwitch(account.id);
                    }
                  }}
                  disabled={account.isCurrentAccount || switching}
                  sx={{
                    py: 1.5,
                    px: 2,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        bgcolor: 'primary.dark'
                      },
                      '& .MuiTypography-root': {
                        color: 'inherit'
                      },
                      '& .MuiChip-root': {
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'inherit'
                      }
                    },
                    '&:hover': {
                      bgcolor: account.isCurrentAccount ? 'action.hover' : 'action.selected'
                    },
                    opacity: account.isCurrentAccount ? 0.6 : 1,
                    cursor: account.isCurrentAccount ? 'default' : 'pointer'
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: account.isCurrentAccount ? 'success.main' : 'grey.400'
                      }}
                    >
                      {account.fullName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {account.fullName}
                        </Typography>
                        {account.isCurrentAccount && (
                          <Chip
                            label="Current"
                            size="small"
                            color="success"
                            variant="filled"
                          />
                        )}
                        {!account.isCurrentAccount && isRecent && (
                          <Chip
                            label="Recent"
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" component="div">
                          {account.email}
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            label={getRoleDisplayName(account.role)}
                            size="small"
                            color={getRoleColor(account.role)}
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    }
                  />
                  {!account.isCurrentAccount && index === selectedIndex && (
                    <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                      <SwitchIcon fontSize="small" />
                    </Box>
                  )}
                </ListItem>
              );
              })}
            </List>
          )}
        </Box>

        {/* Footer */}
        {filteredAccounts.length > 0 && (
          <>
            <Divider />
            <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary" align="center" display="block">
                {filteredAccounts.filter(a => !a.isCurrentAccount).length} account(s) available for switching
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Dialog>
  );
};

export default QuickSwitcher;
