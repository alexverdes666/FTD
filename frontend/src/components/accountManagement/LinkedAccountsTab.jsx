import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  Alert,
  Collapse,
  Card,
  CardContent,
  CardActions,
  Grid,
} from "@mui/material";
import {
  Add as AddIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PersonRemove as RemoveIcon,
  Group as GroupIcon,
  SwapHoriz as SwitchIcon,
  Lock as LockIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import api from "../../services/api";
import toast from "react-hot-toast";

const ROLES = [
  { value: "all", label: "All Roles" },
  { value: "admin", label: "Admin" },
  { value: "affiliate_manager", label: "Affiliate Manager" },
  { value: "agent", label: "Agent" },
  { value: "lead_manager", label: "Lead Manager" },
  { value: "refunds_manager", label: "Refunds Manager" },
  { value: "inventory_manager", label: "Inventory Manager" },
];

const getRoleColor = (role) => {
  const colorMap = {
    admin: "error",
    affiliate_manager: "primary",
    agent: "success",
    lead_manager: "info",
    refunds_manager: "warning",
    inventory_manager: "secondary",
  };
  return colorMap[role] || "default";
};

const getRoleLabel = (role) => {
  const labelMap = {
    admin: "Admin",
    affiliate_manager: "Affiliate Manager",
    agent: "Agent",
    lead_manager: "Lead Manager",
    refunds_manager: "Refunds Manager",
    inventory_manager: "Inventory Manager",
  };
  return labelMap[role] || role;
};

// User Group Card Component
const UserGroupCard = ({ group, onUnlink, onRemoveUser, onExpand, expanded }) => {
  const primaryUser = group.primaryUser;
  const linkedAccounts = group.linkedAccounts || [];
  const hasLinkedAccounts = linkedAccounts.length > 0;

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
            {primaryUser.fullName?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {primaryUser.fullName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {primaryUser.email}
            </Typography>
            <Chip
              label={getRoleLabel(primaryUser.role)}
              color={getRoleColor(primaryUser.role)}
              size="small"
              sx={{ mt: 0.5 }}
            />
          </Box>
          {hasLinkedAccounts && (
            <Chip
              icon={<GroupIcon />}
              label={`${linkedAccounts.length} linked`}
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>

      {hasLinkedAccounts && (
        <>
          <CardActions sx={{ pt: 0 }}>
            <Button
              size="small"
              onClick={() => onExpand(primaryUser._id)}
              endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              {expanded ? "Hide" : "Show"} Linked Accounts
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Unlink all accounts in this group">
              <Button
                size="small"
                color="error"
                startIcon={<UnlinkIcon />}
                onClick={() => onUnlink([primaryUser._id, ...linkedAccounts.map(a => a._id)])}
              >
                Unlink All
              </Button>
            </Tooltip>
          </CardActions>

          <Collapse in={expanded}>
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Linked Accounts:
              </Typography>
              <List dense disablePadding>
                {linkedAccounts.map((account) => (
                  <ListItem
                    key={account._id}
                    sx={{
                      bgcolor: "action.hover",
                      borderRadius: 1,
                      mb: 0.5,
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {account.fullName?.charAt(0)?.toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={account.fullName}
                      secondary={
                        <Box component="span">
                          {account.email}
                          <Chip
                            label={getRoleLabel(account.role)}
                            color={getRoleColor(account.role)}
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        </Box>
                      }
                      secondaryTypographyProps={{ component: "div" }}
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Remove from group">
                        <IconButton
                          edge="end"
                          color="error"
                          size="small"
                          onClick={() => onRemoveUser(account._id)}
                        >
                          <RemoveIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Collapse>
        </>
      )}
    </Card>
  );
};

const LinkedAccountsTab = () => {
  const user = useSelector(selectUser);
  const isAdmin = user?.role === "admin";

  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    totalUsers: 0,
  });

  // Link Dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedPrimary, setSelectedPrimary] = useState(null);
  const [selectedLinked, setSelectedLinked] = useState([]);
  const [linkLoading, setLinkLoading] = useState(false);

  // Only admins can manage linked accounts
  if (!isAdmin) {
    return (
      <Box sx={{ p: 5, textAlign: "center" }}>
        <LockIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Admin Access Required
        </Typography>
        <Typography color="text.secondary">
          Only administrators can manage linked accounts.
        </Typography>
        <Alert severity="info" sx={{ mt: 3, maxWidth: 500, mx: "auto" }}>
          <Typography variant="body2">
            <strong>Tip:</strong> If you have linked accounts set up, you can still switch between them
            using <Chip label="Ctrl+Shift+S" size="small" sx={{ mx: 0.5 }} /> keyboard shortcut.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const fetchUserGroups = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(roleFilter !== "all" && { role: roleFilter }),
      });

      const response = await api.get(`/account-management/users?${params}`);
      setUserGroups(response.data.data.users);
      setPagination((prev) => ({
        ...prev,
        totalPages: response.data.data.pagination.totalPages,
        totalUsers: response.data.data.pagination.totalUsers,
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, searchTerm, roleFilter]);

  useEffect(() => {
    fetchUserGroups();
  }, [fetchUserGroups]);

  const fetchAvailableUsers = async () => {
    try {
      const response = await api.get("/account-management/available-users");
      setAvailableUsers(response.data.data);
    } catch (error) {
      toast.error("Failed to load available users");
    }
  };

  const handleOpenLinkDialog = () => {
    fetchAvailableUsers();
    setSelectedPrimary(null);
    setSelectedLinked([]);
    setLinkDialogOpen(true);
  };

  const handleLinkAccounts = async () => {
    if (!selectedPrimary || selectedLinked.length === 0) {
      toast.error("Please select a primary account and at least one account to link");
      return;
    }

    try {
      setLinkLoading(true);
      await api.post("/account-management/link-accounts", {
        primaryAccountId: selectedPrimary._id,
        linkedAccountIds: selectedLinked.map((u) => u._id),
      });
      toast.success("Accounts linked successfully");
      setLinkDialogOpen(false);
      fetchUserGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to link accounts");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUnlinkGroup = async (accountIds) => {
    if (!window.confirm("Are you sure you want to unlink all accounts in this group?")) {
      return;
    }

    try {
      await api.post("/account-management/unlink-accounts", { accountIds });
      toast.success("Accounts unlinked successfully");
      fetchUserGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to unlink accounts");
    }
  };

  const handleRemoveFromGroup = async (accountId) => {
    if (!window.confirm("Remove this account from the group?")) {
      return;
    }

    try {
      await api.delete(`/account-management/remove-from-group/${accountId}`);
      toast.success("Account removed from group");
      fetchUserGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove account");
    }
  };

  const toggleExpand = (userId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Filter available users when primary is selected
  const getFilteredLinkedOptions = () => {
    if (!selectedPrimary) return [];
    return availableUsers.filter((u) => u._id !== selectedPrimary._id);
  };

  return (
    <Box>
      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Linked Accounts</strong> allow users to quickly switch between accounts using{" "}
          <Chip label="Ctrl+Shift+S" size="small" sx={{ mx: 0.5 }} /> keyboard shortcut.
          Link accounts that belong to the same person or team for seamless switching.
        </Typography>
      </Alert>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search users..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            sx={{ minWidth: 200 }}
            InputProps={{ endAdornment: <SearchIcon color="action" /> }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              label="Role"
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              {ROLES.map((role) => (
                <MenuItem key={role.value} value={role.value}>
                  {role.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ ml: "auto" }}>
            <Button
              variant="contained"
              startIcon={<LinkIcon />}
              onClick={handleOpenLinkDialog}
            >
              Link Accounts
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* User Groups */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
          <CircularProgress />
        </Box>
      ) : userGroups.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: "center" }}>
          <GroupIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
          <Typography color="text.secondary">
            No users found matching your criteria
          </Typography>
        </Paper>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Showing {userGroups.length} of {pagination.totalUsers} users
          </Typography>
          {userGroups.map((group) => (
            <UserGroupCard
              key={group.primaryUser._id}
              group={group}
              expanded={expandedGroups[group.primaryUser._id]}
              onExpand={toggleExpand}
              onUnlink={handleUnlinkGroup}
              onRemoveUser={handleRemoveFromGroup}
            />
          ))}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 2 }}>
              <Button
                disabled={pagination.page === 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <Typography sx={{ alignSelf: "center" }}>
                Page {pagination.page} of {pagination.totalPages}
              </Typography>
              <Button
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Link Accounts Dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LinkIcon />
            Link Accounts Together
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}>
            <Alert severity="info" variant="outlined">
              All selected accounts will be able to switch between each other using the quick switcher
              (Ctrl+Shift+S).
            </Alert>

            <Autocomplete
              options={availableUsers}
              getOptionLabel={(option) => `${option.fullName} (${option.email})`}
              value={selectedPrimary}
              onChange={(e, newValue) => {
                setSelectedPrimary(newValue);
                // Remove from linked if it was selected there
                if (newValue) {
                  setSelectedLinked((prev) => prev.filter((u) => u._id !== newValue._id));
                }
              }}
              renderInput={(params) => (
                <TextField {...params} label="Primary Account" placeholder="Select primary account" />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option._id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {option.fullName?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{option.fullName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.email} • {getRoleLabel(option.role)}
                      </Typography>
                    </Box>
                  </Box>
                </li>
              )}
            />

            <Autocomplete
              multiple
              options={getFilteredLinkedOptions()}
              getOptionLabel={(option) => `${option.fullName} (${option.email})`}
              value={selectedLinked}
              onChange={(e, newValue) => setSelectedLinked(newValue)}
              disabled={!selectedPrimary}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Accounts to Link"
                  placeholder={selectedPrimary ? "Select accounts to link" : "Select primary first"}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option._id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {option.fullName?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{option.fullName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.email} • {getRoleLabel(option.role)}
                      </Typography>
                    </Box>
                  </Box>
                </li>
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option._id}
                    avatar={<Avatar>{option.fullName?.charAt(0)?.toUpperCase()}</Avatar>}
                    label={option.fullName}
                    size="small"
                  />
                ))
              }
            />

            {selectedPrimary && selectedLinked.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview: Account Group
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                  <Chip
                    avatar={<Avatar>{selectedPrimary.fullName?.charAt(0)?.toUpperCase()}</Avatar>}
                    label={selectedPrimary.fullName}
                    color="primary"
                  />
                  {selectedLinked.map((account) => (
                    <React.Fragment key={account._id}>
                      <SwitchIcon color="action" />
                      <Chip
                        avatar={<Avatar>{account.fullName?.charAt(0)?.toUpperCase()}</Avatar>}
                        label={account.fullName}
                      />
                    </React.Fragment>
                  ))}
                </Box>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLinkAccounts}
            disabled={linkLoading || !selectedPrimary || selectedLinked.length === 0}
            startIcon={linkLoading ? <CircularProgress size={16} /> : <LinkIcon />}
          >
            Link Accounts
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LinkedAccountsTab;
