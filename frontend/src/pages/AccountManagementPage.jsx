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
  IconButton,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  CircularProgress,
  Autocomplete,
  Stack,
  Tooltip,
  useTheme,
  useMediaQuery,
  Popover
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

const LinkedUsersCell = ({ users }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => {
    event.stopPropagation(); // Prevent row selection if enabled
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (event) => {
    event?.stopPropagation();
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  if (!users || users.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No linked accounts
      </Typography>
    );
  }

  const remaining = users.length - 1;

  return (
    <>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Chip
          label={`${users[0].fullName}`}
          size="small"
          color={getRoleColor(users[0].role)}
          variant="outlined"
          onClick={handleClick}
          sx={{ cursor: 'pointer' }}
        />
        {remaining > 0 && (
          <Chip
            label={`+${remaining}`}
            size="small"
            variant="outlined"
            onClick={handleClick}
            sx={{ cursor: 'pointer' }}
          />
        )}
      </Stack>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box sx={{ p: 2, maxWidth: 350 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold' }}>
            Linked Users ({users.length})
          </Typography>
          <Stack spacing={1}>
            {users.map((user) => (
              <Chip
                key={user._id}
                label={`${user.fullName} (${getRoleDisplayName(user.role)})`}
                size="small"
                color={getRoleColor(user.role)}
                variant="outlined"
                sx={{ width: '100%', justifyContent: 'flex-start', height: 'auto', py: 0.5 }}
              />
            ))}
          </Stack>
        </Box>
      </Popover>
    </>
  );
};

const AccountManagementPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const user = useSelector(selectUser);
  const [users, setUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 100 });
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

  const columns = [
    {
      field: 'fullName',
      headerName: 'Full Name',
      minWidth: 150,
      flex: 1.5,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="bold">{params.value}</Typography>
      )
    },
    {
      field: 'email',
      headerName: 'Email',
      minWidth: 180,
      flex: 2,
      sortable: false,
      filterable: false,
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'role',
      headerName: 'Role',
      minWidth: 130,
      flex: 1,
      sortable: false,
      filterable: false,
      align: 'center',
      headerAlign: 'center',
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
      field: 'linkedAccounts',
      headerName: 'Linked Users',
      minWidth: 200,
      flex: 2,
      sortable: false,
      filterable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => <LinkedUsersCell users={params.value} />
    },
    {
      field: 'actions',
      headerName: 'Actions',
      minWidth: 120,
      flex: 1,
      sortable: false,
      filterable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
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
    <Box sx={{ width: "100%", typography: "body1" }}>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
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
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ width: "100%", overflow: "hidden" }}>
        <DataGrid
          rows={users}
          columns={columns}
          loading={loading}
          pagination
          paginationMode="server"
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          rowCount={totalRows}
          pageSizeOptions={[100]}
          disableRowSelectionOnClick
          disableColumnMenu
          autoHeight
          sx={{
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#eeeeee',
            },
            border: 'none',
          }}
        />
      </Paper>

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
