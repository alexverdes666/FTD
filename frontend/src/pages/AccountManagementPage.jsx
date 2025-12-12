import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Avatar,
  IconButton,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  CircularProgress,
  Autocomplete,
  Stack,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';
import toast from 'react-hot-toast';

const AccountManagementPage = () => {
  const user = useSelector(selectUser);
  const [users, setUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 10 });
  const [totalRows, setTotalRows] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedPrimaryUser, setSelectedPrimaryUser] = useState(null);
  const [selectedLinkedUsers, setSelectedLinkedUsers] = useState([]);
  const [linkingInProgress, setLinkingInProgress] = useState(false);

  // Check admin access
  if (!user || user.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You need administrator privileges to access account management.
        </Alert>
      </Box>
    );
  }

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, pagination.pageSize, searchTerm, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/account-management/users', {
        params: {
          page: pagination.page + 1, // DataGrid uses 0-based, API uses 1-based
          limit: pagination.pageSize,
          search: searchTerm,
          role: roleFilter
        }
      });

      if (response.data.success) {
        const userData = response.data.data.users.map((userGroup, index) => ({
          id: userGroup.primaryUser._id,
          index: pagination.page * pagination.pageSize + index + 1,
          ...userGroup.primaryUser,
          linkedAccounts: userGroup.linkedAccounts,
          totalAccounts: userGroup.totalAccounts
        }));
        
        setUsers(userData);
        setTotalRows(response.data.data.pagination.totalUsers);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async (excludeIds = []) => {
    try {
      const response = await api.get('/account-management/available-users', {
        params: { excludeIds }
      });
      
      if (response.data.success) {
        setAvailableUsers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch available users:', error);
      toast.error('Failed to load available users');
    }
  };

  const handleOpenLinkDialog = async (primaryUser = null) => {
    setSelectedPrimaryUser(primaryUser);
    
    if (primaryUser) {
      // Editing existing links
      setSelectedLinkedUsers(primaryUser.linkedAccounts || []);
      await fetchAvailableUsers([primaryUser._id, ...(primaryUser.linkedAccounts?.map(u => u._id) || [])]);
    } else {
      // Creating new links
      setSelectedLinkedUsers([]);
      await fetchAvailableUsers();
    }
    
    setLinkDialogOpen(true);
  };

  const handleCloseLinkDialog = () => {
    setLinkDialogOpen(false);
    setSelectedPrimaryUser(null);
    setSelectedLinkedUsers([]);
  };

  const handleLinkAccounts = async () => {
    if (!selectedPrimaryUser || selectedLinkedUsers.length === 0) {
      toast.error('Please select a primary user and at least one linked account');
      return;
    }

    setLinkingInProgress(true);
    try {
      const response = await api.post('/account-management/link-accounts', {
        primaryAccountId: selectedPrimaryUser._id,
        linkedAccountIds: selectedLinkedUsers.map(user => user._id)
      });

      if (response.data.success) {
        toast.success('Accounts linked successfully');
        fetchUsers();
        handleCloseLinkDialog();
      }
    } catch (error) {
      console.error('Failed to link accounts:', error);
      toast.error(error.response?.data?.message || 'Failed to link accounts');
    } finally {
      setLinkingInProgress(false);
    }
  };

  const handleUnlinkAccount = async (accountId) => {
    if (!window.confirm('Are you sure you want to remove this account from its group?')) {
      return;
    }

    try {
      const response = await api.delete(`/account-management/remove-from-group/${accountId}`);
      
      if (response.data.success) {
        toast.success('Account removed from group successfully');
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to unlink account:', error);
      toast.error(error.response?.data?.message || 'Failed to unlink account');
    }
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

  const columns = [
    {
      field: 'index',
      headerName: '#',
      width: 60,
      sortable: false
    },
    {
      field: 'fullName',
      headerName: 'Full Name',
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
            {params.value?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      )
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 250
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={getRoleDisplayName(params.value)}
          size="small"
          color={getRoleColor(params.value)}
          variant="outlined"
        />
      )
    },
    {
      field: 'totalAccounts',
      headerName: 'Linked Accounts',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Chip
          icon={<GroupIcon fontSize="small" />}
          label={params.value > 1 ? `${params.value} accounts` : 'No links'}
          size="small"
          color={params.value > 1 ? 'primary' : 'default'}
          variant={params.value > 1 ? 'filled' : 'outlined'}
        />
      )
    },
    {
      field: 'linkedAccounts',
      headerName: 'Linked Users',
      width: 300,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ py: 1 }}>
          {params.value && params.value.length > 0 ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {params.value.slice(0, 3).map((linkedUser) => (
                <Chip
                  key={linkedUser._id}
                  label={`${linkedUser.fullName} (${getRoleDisplayName(linkedUser.role)})`}
                  size="small"
                  color={getRoleColor(linkedUser.role)}
                  variant="outlined"
                />
              ))}
              {params.value.length > 3 && (
                <Chip
                  label={`+${params.value.length - 3} more`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              No linked accounts
            </Typography>
          )}
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Manage Links">
            <IconButton
              size="small"
              onClick={() => handleOpenLinkDialog(params.row)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {params.row.totalAccounts > 1 && (
            <Tooltip title="Remove from Group">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleUnlinkAccount(params.row.id)}
              >
                <UnlinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Account Management
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage user account relationships for account switching functionality.
        Users can only switch between accounts that you link together here.
      </Typography>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search users"
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  endAdornment: <SearchIcon />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                select
                label="Filter by role"
                variant="outlined"
                size="small"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <MenuItem value="all">All Roles</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="affiliate_manager">Affiliate Manager</MenuItem>
                <MenuItem value="agent">Agent</MenuItem>
                <MenuItem value="lead_manager">Lead Manager</MenuItem>
                <MenuItem value="refunds_manager">Refunds Manager</MenuItem>
                <MenuItem value="inventory_manager">Inventory Manager</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<LinkIcon />}
                  onClick={() => handleOpenLinkDialog()}
                >
                  Link Accounts
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <DataGrid
          rows={users}
          columns={columns}
          loading={loading}
          pagination
          paginationMode="server"
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          rowCount={totalRows}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          autoHeight
          sx={{
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
          }}
        />
      </Card>

      {/* Link Accounts Dialog */}
      <Dialog
        open={linkDialogOpen}
        onClose={handleCloseLinkDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedPrimaryUser ? 'Edit Account Links' : 'Link Accounts'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Primary Account
            </Typography>
            <Autocomplete
              options={availableUsers}
              getOptionLabel={(option) => `${option.fullName} (${option.email}) - ${getRoleDisplayName(option.role)}`}
              value={selectedPrimaryUser}
              onChange={(event, newValue) => setSelectedPrimaryUser(newValue)}
              disabled={!!selectedPrimaryUser} // Disable if editing existing
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select primary account"
                  variant="outlined"
                  fullWidth
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                    {option.fullName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body2">{option.fullName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email} - {getRoleDisplayName(option.role)}
                    </Typography>
                  </Box>
                </li>
              )}
              sx={{ mb: 3 }}
            />

            <Typography variant="subtitle2" gutterBottom>
              Linked Accounts
            </Typography>
            <Autocomplete
              multiple
              options={availableUsers.filter(u => u._id !== selectedPrimaryUser?._id)}
              getOptionLabel={(option) => `${option.fullName} (${option.email}) - ${getRoleDisplayName(option.role)}`}
              value={selectedLinkedUsers}
              onChange={(event, newValue) => setSelectedLinkedUsers(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select accounts to link"
                  variant="outlined"
                  fullWidth
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...chipProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={key}
                      variant="outlined"
                      label={`${option.fullName} (${getRoleDisplayName(option.role)})`}
                      {...chipProps}
                      color={getRoleColor(option.role)}
                    />
                  );
                })
              }
              renderOption={(props, option) => (
                <li {...props}>
                  <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                    {option.fullName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body2">{option.fullName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email} - {getRoleDisplayName(option.role)}
                    </Typography>
                  </Box>
                </li>
              )}
            />

            {selectedPrimaryUser && selectedLinkedUsers.length > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                These accounts will be able to switch between each other. 
                The primary account and all linked accounts will have bidirectional switching access.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLinkDialog}>Cancel</Button>
          <Button
            onClick={handleLinkAccounts}
            variant="contained"
            disabled={!selectedPrimaryUser || selectedLinkedUsers.length === 0 || linkingInProgress}
            startIcon={linkingInProgress ? <CircularProgress size={16} /> : <LinkIcon />}
          >
            {linkingInProgress ? 'Linking...' : 'Link Accounts'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AccountManagementPage;
