import React from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  alpha,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { Controller } from "react-hook-form";
import { getSortedCountries } from "../../constants/countries";

export default function CreateOrderDialog({
  open,
  onClose,
  control,
  handleSubmit,
  watch,
  errors,
  isSubmitting,
  onSubmitOrder,
  user,
  manualSelectionMode,
  setManualSelectionMode,
  manualLeadEmails,
  setManualLeadEmails,
  manualLeads,
  setManualLeads,
  searchingLeads,
  searchLeadsByEmails,
  updateManualLeadAgent,
  removeManualLead,
  allAgents,
  clientNetworks,
  loadingClientNetworks,
  ourNetworks,
  loadingOurNetworks,
  campaigns,
  loadingCampaigns,
  clientBrokers,
  loadingClientBrokers,
  agents,
  loadingAgents,
  filteredAgents,
  filteredAgentsLoading,
  unassignedLeadsStats,
  fetchFilteredAgents,
  fulfillmentSummary,
  checkingFulfillment,
  setNotification,
  handleCreateNewBroker,
  handleManageBrokers,
  clientNetworkInput,
  setClientNetworkInput,
  clientNetworkOpen,
  setClientNetworkOpen,
  ourNetworkInput,
  setOurNetworkInput,
  ourNetworkOpen,
  setOurNetworkOpen,
  campaignInput,
  setCampaignInput,
  campaignOpen,
  setCampaignOpen,
  setCopyPreferencesOpen,
  setFilteredAgents,
  setUnassignedLeadsStats,
}) {
  if (!open) return null;

  return (
      <Dialog
        open
        onClose={onClose}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle
          sx={{
            py: 1.5,
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(
                theme.palette.primary.main,
                0.08
              )} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            {/* Left: Title and Manual Toggle */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Create New Order
              </Typography>
              <Button
                variant={manualSelectionMode ? "contained" : "outlined"}
                size="small"
                onClick={() => {
                  setManualSelectionMode(!manualSelectionMode);
                  if (manualSelectionMode) {
                    setManualLeadEmails("");
                    setManualLeads([]);
                  }
                }}
                sx={{
                  borderRadius: "16px",
                  textTransform: "none",
                  fontSize: "0.75rem",
                  px: 2,
                  py: 0.5,
                  minWidth: "auto",
                }}
              >
                {manualSelectionMode ? "Auto" : "Manual"}
              </Button>
            </Box>

            {/* Right: Quick Filters - Gender & Priority as Chips */}
            {!manualSelectionMode && (
              <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
                {/* Gender Filter */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    Gender:
                  </Typography>
                  <Controller
                    name="genderFilter"
                    control={control}
                    render={({ field }) => (
                      <ToggleButtonGroup
                        value={field.value || ""}
                        exclusive
                        onChange={(e, newValue) =>
                          field.onChange(newValue ?? "")
                        }
                        size="small"
                        sx={{
                          "& .MuiToggleButton-root": {
                            px: 1.5,
                            py: 0.25,
                            fontSize: "0.7rem",
                            textTransform: "none",
                            borderRadius: "16px !important",
                            border: "1px solid",
                            borderColor: "divider",
                            mx: 0.25,
                            "&.Mui-selected": {
                              bgcolor: "primary.main",
                              color: "primary.contrastText",
                              borderColor: "primary.main",
                              "&:hover": {
                                bgcolor: "primary.dark",
                              },
                            },
                          },
                        }}
                      >
                        <ToggleButton value="">All</ToggleButton>
                        <ToggleButton value="male">Male</ToggleButton>
                        <ToggleButton value="female">Female</ToggleButton>
                        <ToggleButton value="not_defined">N/A</ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  />
                </Box>

                {/* Priority Filter */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    Priority:
                  </Typography>
                  <Controller
                    name="priority"
                    control={control}
                    render={({ field }) => (
                      <ToggleButtonGroup
                        value={field.value || "medium"}
                        exclusive
                        onChange={(e, newValue) => {
                          if (newValue !== null) field.onChange(newValue);
                        }}
                        size="small"
                        sx={{
                          "& .MuiToggleButton-root": {
                            px: 1.5,
                            py: 0.25,
                            fontSize: "0.7rem",
                            textTransform: "none",
                            borderRadius: "16px !important",
                            border: "1px solid",
                            borderColor: "divider",
                            mx: 0.25,
                            "&.Mui-selected": {
                              '&[value="low"]': {
                                bgcolor: "success.main",
                                color: "success.contrastText",
                                borderColor: "success.main",
                              },
                              '&[value="medium"]': {
                                bgcolor: "warning.main",
                                color: "warning.contrastText",
                                borderColor: "warning.main",
                              },
                              '&[value="high"]': {
                                bgcolor: "error.main",
                                color: "error.contrastText",
                                borderColor: "error.main",
                              },
                            },
                          },
                        }}
                      >
                        <ToggleButton value="low">Low</ToggleButton>
                        <ToggleButton value="medium">Medium</ToggleButton>
                        <ToggleButton value="high">High</ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmitOrder)}>
          <DialogContent sx={{ pt: 2 }}>
            {/* Top Row: Planned Date + Fulfillment Estimate */}
            {!manualSelectionMode && (
              <Box
                sx={{
                  mb: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                {/* Planned Date - Outside the fulfillment box */}
                <Controller
                  name="plannedDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Planned Date *"
                      type="date"
                      error={!!errors.plannedDate}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        "& .MuiInputBase-input": {
                          py: 0.75,
                          fontSize: "0.875rem",
                        },
                        width: 160,
                        flexShrink: 0,
                      }}
                      value={
                        field.value
                          ? new Date(field.value).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        const dateValue = e.target.value
                          ? new Date(e.target.value)
                          : null;
                        field.onChange(dateValue);
                      }}
                    />
                  )}
                />

                {/* Fulfillment Box */}
                <Box
                  sx={{
                    flex: 1,
                    p: 1.5,
                    bgcolor: (theme) => alpha(theme.palette.info.main, 0.04),
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: (theme) => alpha(theme.palette.info.main, 0.2),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    minHeight: 44,
                  }}
                >
                  {/* Left: Title and Status */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        fontWeight: 600,
                        color: "info.dark",
                        whiteSpace: "nowrap",
                      }}
                    >
                      📊 Fulfillment
                      {checkingFulfillment && <CircularProgress size={14} />}
                    </Typography>

                    {/* Status Chip */}
                    {!checkingFulfillment && fulfillmentSummary ? (
                      <Chip
                        label={
                          fulfillmentSummary.status === "fulfilled"
                            ? "✓ Can be Fulfilled"
                            : fulfillmentSummary.status === "partial"
                            ? "⚠ Partial"
                            : "✗ Not Fulfilled"
                        }
                        color={
                          fulfillmentSummary.status === "fulfilled"
                            ? "success"
                            : fulfillmentSummary.status === "partial"
                            ? "warning"
                            : "error"
                        }
                        size="small"
                        sx={{ fontWeight: 500 }}
                      />
                    ) : (
                      <Chip
                        label={checkingFulfillment ? "Checking..." : "Pending"}
                        size="small"
                        variant="outlined"
                        sx={{ opacity: 0.6 }}
                      />
                    )}
                  </Box>

                  {/* Right: Breakdown Stats */}
                  <Box sx={{ display: "flex", gap: 3 }}>
                    {fulfillmentSummary?.breakdown ? (
                      Object.entries(fulfillmentSummary.breakdown).map(
                        ([type, stats]) =>
                          stats.requested > 0 ? (
                            <Box
                              key={type}
                              sx={{ textAlign: "center", minWidth: 45 }}
                            >
                              <Typography
                                variant="caption"
                                fontWeight="bold"
                                display="block"
                                sx={{
                                  textTransform: "uppercase",
                                  color: "text.secondary",
                                  fontSize: "0.65rem",
                                }}
                              >
                                {type}
                              </Typography>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                color={
                                  stats.available < stats.requested
                                    ? "error.main"
                                    : "success.main"
                                }
                              >
                                {stats.available}/{stats.requested}
                              </Typography>
                            </Box>
                          ) : null
                      )
                    ) : (
                      <>
                        <Box
                          sx={{
                            textAlign: "center",
                            minWidth: 45,
                            opacity: 0.4,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight="bold"
                            display="block"
                            sx={{
                              textTransform: "uppercase",
                              color: "text.secondary",
                              fontSize: "0.65rem",
                            }}
                          >
                            FTD
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color="text.disabled"
                          >
                            -/-
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            textAlign: "center",
                            minWidth: 45,
                            opacity: 0.4,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight="bold"
                            display="block"
                            sx={{
                              textTransform: "uppercase",
                              color: "text.secondary",
                              fontSize: "0.65rem",
                            }}
                          >
                            Filler
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color="text.disabled"
                          >
                            -/-
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              </Box>
            )}

            <Grid container spacing={2}>
              {/* Manual Selection Mode UI */}
              {manualSelectionMode && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Lead Emails (one per line or space/comma separated)"
                      placeholder="email1@example.com&#10;email2@example.com&#10;email3@example.com"
                      value={manualLeadEmails}
                      onChange={(e) => setManualLeadEmails(e.target.value)}
                      size="small"
                      helperText="Enter the email addresses of leads you want to include in this order"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      onClick={searchLeadsByEmails}
                      disabled={searchingLeads || !manualLeadEmails.trim()}
                      startIcon={
                        searchingLeads ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <PersonIcon />
                        )
                      }
                    >
                      {searchingLeads ? "Searching..." : "Search Leads"}
                    </Button>
                  </Grid>

                  {/* Display found leads with agent assignment */}
                  {manualLeads.length > 0 && (
                    <Grid item xs={12}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Found Leads ({manualLeads.length})
                        </Typography>
                        {manualLeads.filter((e) => e.isOnCooldown).length > 0 && (
                          <Chip
                            label={`${
                              manualLeads.filter((e) => !e.isOnCooldown).length
                            } active, ${
                              manualLeads.filter((e) => e.isOnCooldown).length
                            } on cooldown`}
                            size="small"
                            color={
                              manualLeads.filter((e) => !e.isOnCooldown).length ===
                              0
                                ? "error"
                                : "warning"
                            }
                            variant="outlined"
                          />
                        )}
                      </Box>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Email</TableCell>
                              <TableCell>Name</TableCell>
                              <TableCell>Country</TableCell>
                              <TableCell>Type</TableCell>
                              <TableCell>Assign to Agent *</TableCell>
                              <TableCell width={50}></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {manualLeads.map((entry, index) => (
                              <TableRow
                                key={entry.lead._id}
                                sx={{
                                  opacity: entry.isOnCooldown ? 0.5 : 1,
                                  bgcolor: entry.isOnCooldown
                                    ? "action.disabledBackground"
                                    : "inherit",
                                }}
                              >
                                <TableCell>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontSize: "0.75rem",
                                      textDecoration: entry.isOnCooldown
                                        ? "line-through"
                                        : "none",
                                    }}
                                  >
                                    {entry.lead.newEmail}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {entry.lead.firstName} {entry.lead.lastName}
                                </TableCell>
                                <TableCell>{entry.lead.country}</TableCell>
                                <TableCell>
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 0.5,
                                    }}
                                  >
                                    <Chip
                                      label={entry.lead.leadType?.toUpperCase()}
                                      size="small"
                                      color={
                                        entry.isOnCooldown
                                          ? "default"
                                          : entry.lead.leadType === "ftd"
                                          ? "success"
                                          : entry.lead.leadType === "filler"
                                          ? "warning"
                                          : "default"
                                      }
                                    />
                                    {entry.isOnCooldown && (
                                      <Chip
                                        label={`Cooldown ${entry.cooldownDaysRemaining}d`}
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                        sx={{ fontSize: "0.65rem" }}
                                      />
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  {entry.lead.leadType === "cold" ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                      N/A
                                    </Typography>
                                  ) : (
                                    <FormControl fullWidth size="small">
                                      <Select
                                        value={entry.agent}
                                        onChange={(e) =>
                                          updateManualLeadAgent(
                                            index,
                                            e.target.value
                                          )
                                        }
                                        displayEmpty
                                        error={!entry.agent && (!entry.isOnCooldown || user?.role === "admin")}
                                        disabled={entry.isOnCooldown && user?.role !== "admin"}
                                      >
                                        <MenuItem value="">
                                          <em>
                                            {entry.isOnCooldown && user?.role !== "admin"
                                              ? "On Cooldown"
                                              : "Select Agent"}
                                          </em>
                                        </MenuItem>
                                        {allAgents.map((agent) => (
                                          <MenuItem
                                            key={agent._id}
                                            value={agent._id}
                                          >
                                            {agent.fullName || agent.email}
                                          </MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={() => removeManualLead(index)}
                                    color="error"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 1, display: "block" }}
                      >
                        * All active FTD/Filler leads must have an agent assigned. Cold leads do not require agent assignment. Leads on
                        cooldown will be automatically excluded from the order.
                      </Typography>
                    </Grid>
                  )}
                </>
              )}

              {/* Normal Selection Mode UI */}
              {!manualSelectionMode && (
                <>
                  {/* Lead Quantities Section */}
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: (theme) =>
                          alpha(theme.palette.grey[500], 0.04),
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          mb: 1.5,
                          fontWeight: 600,
                          color: "text.secondary",
                        }}
                      >
                        Lead Quantities
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Controller
                            name="ftd"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                label="FTD"
                                type="number"
                                error={!!errors.ftd}
                                helperText={errors.ftd?.message}
                                inputProps={{ min: 0 }}
                                size="small"
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Controller
                            name="filler"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                label="Filler"
                                type="number"
                                error={!!errors.filler}
                                helperText={errors.filler?.message}
                                inputProps={{ min: 0 }}
                                size="small"
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Controller
                            name="cold"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                label="Cold"
                                type="number"
                                error={!!errors.cold}
                                helperText={errors.cold?.message}
                                inputProps={{ min: 0 }}
                                size="small"
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Controller
                            name="countryFilter"
                            control={control}
                            render={({ field }) => {
                              const [inputValue, setInputValue] =
                                React.useState("");
                              const [isOpen, setIsOpen] = React.useState(false);

                              return (
                                <Autocomplete
                                  {...field}
                                  options={getSortedCountries().map(
                                    (country) => country.name
                                  )}
                                  value={field.value || null}
                                  inputValue={inputValue}
                                  open={isOpen}
                                  onOpen={() => {
                                    if (inputValue.length > 0) setIsOpen(true);
                                  }}
                                  onClose={() => setIsOpen(false)}
                                  onInputChange={(
                                    event,
                                    newInputValue,
                                    reason
                                  ) => {
                                    setInputValue(newInputValue);
                                    if (
                                      reason === "input" &&
                                      newInputValue.length > 0
                                    ) {
                                      setIsOpen(true);
                                    } else if (
                                      reason === "clear" ||
                                      newInputValue.length === 0
                                    ) {
                                      setIsOpen(false);
                                    }
                                  }}
                                  onChange={(event, newValue) => {
                                    field.onChange(newValue || "");
                                    setIsOpen(false);
                                  }}
                                  filterOptions={(options, state) => {
                                    if (!state.inputValue) {
                                      return [];
                                    }
                                    return options.filter((option) =>
                                      option
                                        .toLowerCase()
                                        .includes(
                                          state.inputValue.toLowerCase()
                                        )
                                    );
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="Country *"
                                      size="small"
                                      error={!!errors.countryFilter}
                                      helperText={errors.countryFilter?.message}
                                      sx={{
                                        "& .MuiOutlinedInput-root": {
                                          bgcolor: "background.paper",
                                        },
                                      }}
                                    />
                                  )}
                                  fullWidth
                                  disableClearable={false}
                                  forcePopupIcon={false}
                                  noOptionsText=""
                                />
                              );
                            }}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                </>
              )}

              {/* Common fields for both modes */}

              {/* Networks Section - Grouped */}
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1.5, fontWeight: 600, color: "text.secondary" }}
                  >
                    Network Configuration
                  </Typography>
                  <Grid container spacing={2}>
                    {/* Client Network Selection */}
                    {(user?.role === "admin" ||
                      user?.role === "affiliate_manager") && (
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="selectedClientNetwork"
                          control={control}
                          render={({ field: { onChange, value } }) => (
                            <Autocomplete
                              open={clientNetworkOpen}
                              onOpen={() => {
                                if (clientNetworkInput.length > 0)
                                  setClientNetworkOpen(true);
                              }}
                              onClose={() => setClientNetworkOpen(false)}
                              inputValue={clientNetworkInput}
                              onInputChange={(event, newInputValue, reason) => {
                                setClientNetworkInput(newInputValue);
                                if (
                                  reason === "input" &&
                                  newInputValue.length > 0
                                ) {
                                  setClientNetworkOpen(true);
                                } else if (
                                  reason === "clear" ||
                                  newInputValue.length === 0
                                ) {
                                  setClientNetworkOpen(false);
                                }
                              }}
                              options={clientNetworks}
                              getOptionLabel={(option) => option.name || ""}
                              value={
                                clientNetworks.find((n) => n._id === value) ||
                                null
                              }
                              onChange={(event, newValue) => {
                                onChange(newValue ? newValue._id : "");
                                setFilteredAgents([]);
                                setUnassignedLeadsStats({
                                  ftd: null,
                                  filler: null,
                                });
                              }}
                              disabled={loadingClientNetworks}
                              size="small"
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="Client Network *"
                                  error={!!errors.selectedClientNetwork}
                                  placeholder="Search..."
                                  helperText={
                                    errors.selectedClientNetwork?.message ||
                                    (loadingClientNetworks
                                      ? "Loading..."
                                      : `${clientNetworks.length} available`)
                                  }
                                  sx={{
                                    "& .MuiOutlinedInput-root": {
                                      bgcolor: "background.paper",
                                    },
                                  }}
                                />
                              )}
                              renderOption={(props, option) => (
                                <li {...props} key={option._id}>
                                  <Box>
                                    <Typography variant="body2">
                                      {option.name}
                                    </Typography>
                                    {option.description && (
                                      <Typography
                                        variant="caption"
                                        sx={{ color: "text.secondary" }}
                                      >
                                        {option.description}
                                      </Typography>
                                    )}
                                  </Box>
                                </li>
                              )}
                              isOptionEqualToValue={(option, value) =>
                                option._id === value._id
                              }
                            />
                          )}
                        />
                      </Grid>
                    )}
                    {/* Our Network Selection */}
                    <Grid
                      item
                      xs={12}
                      md={
                        user?.role === "admin" ||
                        user?.role === "affiliate_manager"
                          ? 6
                          : 12
                      }
                    >
                      <Controller
                        name="selectedOurNetwork"
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <Autocomplete
                            open={ourNetworkOpen}
                            onOpen={() => {
                              if (ourNetworkInput.length > 0)
                                setOurNetworkOpen(true);
                            }}
                            onClose={() => setOurNetworkOpen(false)}
                            inputValue={ourNetworkInput}
                            onInputChange={(event, newInputValue, reason) => {
                              setOurNetworkInput(newInputValue);
                              if (
                                reason === "input" &&
                                newInputValue.length > 0
                              ) {
                                setOurNetworkOpen(true);
                              } else if (
                                reason === "clear" ||
                                newInputValue.length === 0
                              ) {
                                setOurNetworkOpen(false);
                              }
                            }}
                            options={ourNetworks}
                            getOptionLabel={(option) => option.name || ""}
                            value={
                              ourNetworks.find((n) => n._id === value) || null
                            }
                            onChange={(event, newValue) => {
                              onChange(newValue ? newValue._id : "");
                            }}
                            disabled={loadingOurNetworks}
                            size="small"
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Our Network *"
                                error={!!errors.selectedOurNetwork}
                                placeholder="Search..."
                                helperText={
                                  errors.selectedOurNetwork?.message ||
                                  (loadingOurNetworks
                                    ? "Loading..."
                                    : `${ourNetworks.length} available`)
                                }
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              />
                            )}
                            renderOption={(props, option) => (
                              <li {...props} key={option._id}>
                                <Box>
                                  <Typography variant="body2">
                                    {option.name}
                                  </Typography>
                                  {option.description && (
                                    <Typography
                                      variant="caption"
                                      sx={{ color: "text.secondary" }}
                                    >
                                      {option.description}
                                    </Typography>
                                  )}
                                </Box>
                              </li>
                            )}
                            isOptionEqualToValue={(option, value) =>
                              option._id === value._id
                            }
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
              {/* Campaign & Brokers Section */}
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1.5, fontWeight: 600, color: "text.secondary" }}
                  >
                    Campaign & Broker Settings
                  </Typography>
                  <Grid container spacing={2}>
                    {/* Campaign Selection */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="selectedCampaign"
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <Autocomplete
                            open={campaignOpen}
                            onOpen={() => {
                              if (campaignInput.length > 0)
                                setCampaignOpen(true);
                            }}
                            onClose={() => setCampaignOpen(false)}
                            inputValue={campaignInput}
                            onInputChange={(event, newInputValue, reason) => {
                              setCampaignInput(newInputValue);
                              if (
                                reason === "input" &&
                                newInputValue.length > 0
                              ) {
                                setCampaignOpen(true);
                              } else if (
                                reason === "clear" ||
                                newInputValue.length === 0
                              ) {
                                setCampaignOpen(false);
                              }
                            }}
                            options={campaigns}
                            getOptionLabel={(option) => option.name || ""}
                            value={
                              campaigns.find((c) => c._id === value) || null
                            }
                            onChange={(event, newValue) => {
                              onChange(newValue ? newValue._id : "");
                            }}
                            disabled={loadingCampaigns}
                            size="small"
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Campaign *"
                                error={!!errors.selectedCampaign}
                                helperText={
                                  errors.selectedCampaign?.message ||
                                  (loadingCampaigns
                                    ? "Loading..."
                                    : `${campaigns.length} available`)
                                }
                                placeholder="Search..."
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              />
                            )}
                            renderOption={(props, option) => (
                              <li {...props} key={option._id}>
                                <Box>
                                  <Typography variant="body2">
                                    {option.name}
                                  </Typography>
                                  {option.description && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: "block",
                                        color: "text.secondary",
                                      }}
                                    >
                                      {option.description}
                                    </Typography>
                                  )}
                                </Box>
                              </li>
                            )}
                            isOptionEqualToValue={(option, value) =>
                              option._id === value._id
                            }
                          />
                        )}
                      />
                    </Grid>
                    {/* Client Brokers Selection */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="selectedClientBrokers"
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <Autocomplete
                            multiple
                            options={clientBrokers}
                            getOptionLabel={(option) => option.name || ""}
                            value={clientBrokers.filter((broker) =>
                              (value || []).includes(broker._id)
                            )}
                            isOptionEqualToValue={(option, value) =>
                              option._id === value._id
                            }
                            onChange={(event, newValue) => {
                              onChange(newValue.map((broker) => broker._id));
                              setFilteredAgents([]);
                              setUnassignedLeadsStats({
                                ftd: null,
                                filler: null,
                              });
                            }}
                            loading={loadingClientBrokers}
                            disabled={loadingClientBrokers}
                            size="small"
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                fullWidth
                                label="Exclude Brokers (optional)"
                                placeholder="Select..."
                                error={!!errors.selectedClientBrokers}
                                helperText={
                                  errors.selectedClientBrokers?.message ||
                                  "Exclude leads from these brokers"
                                }
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <React.Fragment>
                                      {loadingClientBrokers ? (
                                        <CircularProgress
                                          color="inherit"
                                          size={18}
                                        />
                                      ) : null}
                                      {params.InputProps.endAdornment}
                                    </React.Fragment>
                                  ),
                                }}
                              />
                            )}
                            renderTags={(tagValue, getTagProps) =>
                              tagValue.map((option, index) => {
                                const { key, ...chipProps } = getTagProps({
                                  index,
                                });
                                return (
                                  <Chip
                                    key={key}
                                    label={option.name}
                                    {...chipProps}
                                    size="small"
                                  />
                                );
                              })
                            }
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Load Agents Button - Shows when criteria are set and FTD or Filler > 0 (Normal mode only) */}
              {!manualSelectionMode &&
                (watch("ftd") > 0 || watch("filler") > 0) &&
                watch("countryFilter") &&
                watch("selectedClientNetwork") && (
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 2,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={async () => {
                          const country = watch("countryFilter");
                          const clientNetwork = watch("selectedClientNetwork");
                          const clientBrokersSelected =
                            watch("selectedClientBrokers") || [];

                          // Fetch filtered agents for FTD/Filler leads
                          // Both FTD and Filler are stored with leadType: 'ftd' in the database
                          // So we always search for 'ftd' type leads
                          if (watch("ftd") > 0 || watch("filler") > 0) {
                            await fetchFilteredAgents(
                              "ftd",
                              country,
                              clientNetwork,
                              clientBrokersSelected
                            );
                          }
                        }}
                        disabled={filteredAgentsLoading}
                        startIcon={
                          filteredAgentsLoading ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PersonIcon />
                          )
                        }
                      >
                        {filteredAgentsLoading
                          ? "Loading Agents..."
                          : "Load Matching Agents"}
                      </Button>

                      {filteredAgents.length > 0 && (
                        <Typography variant="body2" color="success.main">
                          Found {filteredAgents.length} agent(s) with leads
                          matching your criteria (country + network + broker
                          filters)
                        </Typography>
                      )}

                      {!filteredAgentsLoading &&
                        filteredAgents.length === 0 &&
                        unassignedLeadsStats.ftd !== null && (
                          <Typography variant="body2" color="warning.main">
                            No agents found with leads matching your criteria.
                            Use unassigned leads option.
                          </Typography>
                        )}
                    </Box>

                    {/* Unassigned leads info - shows filtered stats */}
                    {(unassignedLeadsStats.ftd ||
                      unassignedLeadsStats.filler) && (
                      <Box
                        sx={{
                          mt: 1,
                          p: 1.5,
                          bgcolor: "action.hover",
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="subtitle2" gutterBottom>
                          Unassigned Leads Matching Criteria:
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mb: 1 }}
                        >
                          These are leads not assigned to any agent, filtered by
                          your selected country, client network, and client
                          brokers
                        </Typography>
                        {unassignedLeadsStats.ftd && watch("ftd") > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            FTD:{" "}
                            <strong>
                              {unassignedLeadsStats.ftd.available}
                            </strong>{" "}
                            matching available,{" "}
                            {unassignedLeadsStats.ftd.onCooldown} matching on
                            cooldown
                          </Typography>
                        )}
                        {unassignedLeadsStats.filler && watch("filler") > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            Filler:{" "}
                            <strong>
                              {unassignedLeadsStats.filler.available}
                            </strong>{" "}
                            matching available,{" "}
                            {unassignedLeadsStats.filler.onCooldown} matching on
                            cooldown
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Grid>
                )}

              {/* Individual FTD Agent Assignments - Shows after filtered agents are loaded (Normal mode only) */}
              {!manualSelectionMode &&
                watch("ftd") > 0 &&
                (filteredAgents.length > 0 ||
                  unassignedLeadsStats.ftd !== null) && (
                  <Grid item xs={12}>
                    <Typography
                      variant="subtitle2"
                      color="primary"
                      sx={{ mb: 1, fontWeight: 600 }}
                    >
                      Assign FTD Leads to Agents
                    </Typography>
                    <Grid container spacing={2}>
                      {Array.from({ length: watch("ftd") }, (_, index) => (
                        <Grid
                          item
                          xs={12}
                          sm={6}
                          md={4}
                          key={`ftd-agent-${index}`}
                        >
                          <Controller
                            name={`ftdAgents.${index}`}
                            control={control}
                            render={({ field }) => (
                              <FormControl fullWidth size="small">
                                <InputLabel>FTD #{index + 1} Agent</InputLabel>
                                <Select
                                  {...field}
                                  label={`FTD #${index + 1} Agent`}
                                  value={field.value || ""}
                                  disabled={filteredAgentsLoading}
                                >
                                  <MenuItem value="">
                                    <em>
                                      Unassigned lead{" "}
                                      {unassignedLeadsStats.ftd
                                        ? `(${unassignedLeadsStats.ftd.available} matching available)`
                                        : ""}
                                    </em>
                                  </MenuItem>
                                  {filteredAgents.map((agent) => (
                                    <MenuItem
                                      key={agent._id}
                                      value={agent._id}
                                      disabled={
                                        agent.filteredLeadStats?.available === 0
                                      }
                                    >
                                      {agent.fullName || agent.email} —{" "}
                                      {agent.filteredLeadStats?.available || 0}{" "}
                                      matching available,{" "}
                                      {agent.filteredLeadStats?.onCooldown || 0}{" "}
                                      matching on cooldown
                                    </MenuItem>
                                  ))}
                                </Select>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ mt: 0.5, display: "block" }}
                                >
                                  Stats show only leads matching your selected
                                  criteria
                                </Typography>
                              </FormControl>
                            )}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                )}

              {/* Individual Filler Agent Assignments - Shows after filtered agents are loaded (Normal mode only) */}
              {!manualSelectionMode &&
                watch("filler") > 0 &&
                (filteredAgents.length > 0 ||
                  unassignedLeadsStats.filler !== null) && (
                  <Grid item xs={12}>
                    <Typography
                      variant="subtitle2"
                      color="secondary"
                      sx={{ mb: 1, fontWeight: 600 }}
                    >
                      Assign Filler Leads to Agents
                    </Typography>
                    <Grid container spacing={2}>
                      {Array.from({ length: watch("filler") }, (_, index) => (
                        <Grid
                          item
                          xs={12}
                          sm={6}
                          md={4}
                          key={`filler-agent-${index}`}
                        >
                          <Controller
                            name={`fillerAgents.${index}`}
                            control={control}
                            render={({ field }) => (
                              <FormControl fullWidth size="small">
                                <InputLabel>
                                  Filler #{index + 1} Agent
                                </InputLabel>
                                <Select
                                  {...field}
                                  label={`Filler #${index + 1} Agent`}
                                  value={field.value || ""}
                                  disabled={filteredAgentsLoading}
                                >
                                  <MenuItem value="">
                                    <em>
                                      Unassigned lead{" "}
                                      {unassignedLeadsStats.filler
                                        ? `(${unassignedLeadsStats.filler.available} matching available)`
                                        : ""}
                                    </em>
                                  </MenuItem>
                                  {filteredAgents.map((agent) => (
                                    <MenuItem
                                      key={agent._id}
                                      value={agent._id}
                                      disabled={
                                        agent.filteredLeadStats?.available === 0
                                      }
                                    >
                                      {agent.fullName || agent.email} —{" "}
                                      {agent.filteredLeadStats?.available || 0}{" "}
                                      matching available,{" "}
                                      {agent.filteredLeadStats?.onCooldown || 0}{" "}
                                      matching on cooldown
                                    </MenuItem>
                                  ))}
                                </Select>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ mt: 0.5, display: "block" }}
                                >
                                  Stats show only leads matching your selected
                                  criteria
                                </Typography>
                              </FormControl>
                            )}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                )}

              {/* Show message if FTD/Filler requested but criteria not complete (Normal mode only) */}
              {!manualSelectionMode &&
                (watch("ftd") > 0 || watch("filler") > 0) &&
                (!watch("countryFilter") ||
                  !watch("selectedClientNetwork")) && (
                  <Grid item xs={12}>
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Please select country and client network to load agents
                      with matching leads for assignment.
                    </Alert>
                  </Grid>
                )}

              {/* Notes Section */}
              <Grid item xs={12}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Notes (optional)"
                      multiline
                      rows={2}
                      error={!!errors.notes}
                      helperText={errors.notes?.message}
                      size="small"
                      placeholder="Add any additional notes for this order..."
                    />
                  )}
                />
              </Grid>
            </Grid>
            {errors[""] && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errors[""]?.message}
              </Alert>
            )}
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2,
              borderTop: "1px solid",
              borderColor: "divider",
              bgcolor: (theme) => alpha(theme.palette.grey[500], 0.02),
            }}
          >
            <Button
              onClick={onClose}
              sx={{ px: 3 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              sx={{
                px: 4,
                fontWeight: 600,
              }}
            >
              {isSubmitting ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                "Create Order"
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
  );
}
