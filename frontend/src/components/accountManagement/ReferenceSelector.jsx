import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  CircularProgress,
  Typography,
  Divider,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import api from "../../services/api";
import toast from "react-hot-toast";

const positionOptions = [
  { value: "finance", label: "Finance" },
  { value: "boss", label: "Boss" },
  { value: "manager", label: "Manager" },
  { value: "affiliate_manager", label: "Affiliate Manager" },
  { value: "tech_support", label: "Tech Support" },
];

const ReferenceSelector = ({
  open,
  onClose,
  onSelect,
  excludeIds = [],
  loading = false,
}) => {
  const [networks, setNetworks] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [existingEmployees, setExistingEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [notes, setNotes] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState("");
  const [newNetworkDescription, setNewNetworkDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [empName, setEmpName] = useState("");
  const [empTelegram, setEmpTelegram] = useState("");
  const [empPosition, setEmpPosition] = useState("");

  useEffect(() => {
    if (open) {
      fetchNetworks();
      setSelectedNetwork(null);
      setExistingEmployees([]);
      setNotes("");
      setCreateMode(false);
      setNewNetworkName("");
      setNewNetworkDescription("");
      setEmployees([]);
      setEmpName("");
      setEmpTelegram("");
      setEmpPosition("");
    }
  }, [open]);

  const fetchNetworks = async () => {
    try {
      setFetchLoading(true);
      const response = await api.get("/client-networks", {
        params: { limit: 100, isActive: true },
      });
      // Filter out excluded networks
      const filtered = response.data.data.filter(
        (n) => !excludeIds.includes(n._id)
      );
      setNetworks(filtered);
    } catch (error) {
      toast.error("Failed to fetch networks");
    } finally {
      setFetchLoading(false);
    }
  };

  const fetchNetworkEmployees = async (networkId) => {
    try {
      setLoadingEmployees(true);
      const response = await api.get(`/client-networks/${networkId}`);
      const activeEmployees = (response.data.data.employees || []).filter(
        (emp) => emp.isActive !== false
      );
      setExistingEmployees(activeEmployees);
    } catch (error) {
      toast.error("Failed to fetch network employees");
      setExistingEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleNetworkSelect = (_, newValue) => {
    setSelectedNetwork(newValue);
    setEmployees([]);
    setEmpName("");
    setEmpTelegram("");
    setEmpPosition("");
    if (newValue) {
      fetchNetworkEmployees(newValue._id);
    } else {
      setExistingEmployees([]);
    }
  };

  const handleAddEmployee = () => {
    if (!empName.trim() || !empPosition) return;
    setEmployees((prev) => [
      ...prev,
      {
        name: empName.trim(),
        telegramUsername: empTelegram.replace(/^@+/, "").trim(),
        position: empPosition,
      },
    ]);
    setEmpName("");
    setEmpTelegram("");
    setEmpPosition("");
  };

  const handleRemoveEmployee = (index) => {
    setEmployees((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (createMode) {
      if (!newNetworkName.trim()) {
        toast.error("Please enter a network name");
        return;
      }
      try {
        setCreating(true);
        const response = await api.post("/client-networks", {
          name: newNetworkName.trim(),
          description: newNetworkDescription.trim() || undefined,
        });
        const newNetwork = response.data.data;

        // Add employees to the newly created network
        if (employees.length > 0) {
          const results = await Promise.allSettled(
            employees.map((emp) =>
              api.post(`/client-networks/${newNetwork._id}/employees`, emp)
            )
          );
          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed > 0) {
            toast.error(`Failed to add ${failed} employee(s)`);
          }
        }

        toast.success(`Network "${newNetwork.name}" created`);
        onSelect({
          clientNetworkId: newNetwork._id,
          notes,
        });
      } catch (error) {
        const msg =
          error.response?.data?.message || "Failed to create network";
        toast.error(msg);
      } finally {
        setCreating(false);
      }
    } else {
      if (!selectedNetwork) {
        toast.error("Please select a network");
        return;
      }
      try {
        setCreating(true);
        // Add new employees to the existing network
        if (employees.length > 0) {
          const results = await Promise.allSettled(
            employees.map((emp) =>
              api.post(`/client-networks/${selectedNetwork._id}/employees`, emp)
            )
          );
          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed > 0) {
            toast.error(`Failed to add ${failed} employee(s)`);
          } else {
            toast.success(`Added ${employees.length} employee(s) to "${selectedNetwork.name}"`);
          }
        }
        onSelect({
          clientNetworkId: selectedNetwork._id,
          notes,
        });
      } catch (error) {
        toast.error("Failed to add employees");
      } finally {
        setCreating(false);
      }
    }
  };

  const isSubmitDisabled = createMode
    ? loading || creating || !newNetworkName.trim()
    : loading || !selectedNetwork;

  const isLoading = loading || creating;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Reference Network</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {!createMode ? (
            <>
              <Autocomplete
                options={networks}
                getOptionLabel={(option) => option.name}
                value={selectedNetwork}
                onChange={handleNetworkSelect}
                loading={fetchLoading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Network"
                    placeholder="Search networks..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {fetchLoading && <CircularProgress size={20} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <Typography
                variant="body2"
                color="primary"
                sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                onClick={() => {
                  setCreateMode(true);
                  setSelectedNetwork(null);
                  setExistingEmployees([]);
                }}
              >
                or Create New Network
              </Typography>

              {/* Employees Section for selected network */}
              {selectedNetwork && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Employees
                  </Typography>

                  {loadingEmployees ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                      <CircularProgress size={20} />
                    </Box>
                  ) : (
                    <>
                      {existingEmployees.length > 0 && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {existingEmployees.map((emp) => (
                            <Chip
                              key={emp._id}
                              label={`${emp.name} - ${positionOptions.find((p) => p.value === emp.position)?.label || emp.position}${emp.telegramUsername ? ` (@${emp.telegramUsername})` : ""}`}
                              size="small"
                              variant="outlined"
                              color="default"
                            />
                          ))}
                        </Box>
                      )}

                      {existingEmployees.length === 0 && (
                        <Typography variant="body2" color="text.disabled">
                          No employees yet
                        </Typography>
                      )}

                      {/* New employees to add */}
                      {employees.length > 0 && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {employees.map((emp, idx) => (
                            <Chip
                              key={idx}
                              label={`${emp.name} - ${positionOptions.find((p) => p.value === emp.position)?.label || emp.position}${emp.telegramUsername ? ` (@${emp.telegramUsername})` : ""}`}
                              onDelete={() => handleRemoveEmployee(idx)}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                        </Box>
                      )}

                      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                        <TextField
                          label="Name"
                          value={empName}
                          onChange={(e) => setEmpName(e.target.value)}
                          size="small"
                          sx={{ flex: 1 }}
                          inputProps={{ maxLength: 100 }}
                        />
                        <TextField
                          label="Telegram"
                          value={empTelegram}
                          onChange={(e) => setEmpTelegram(e.target.value.replace(/^@+/, ""))}
                          size="small"
                          sx={{ flex: 1 }}
                          placeholder="username"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start" sx={{ mr: 0 }}>
                                <span style={{ fontWeight: 700, color: "#1976d2" }}>@</span>
                              </InputAdornment>
                            ),
                          }}
                          inputProps={{ maxLength: 100 }}
                        />
                      </Box>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        <FormControl size="small" sx={{ flex: 1 }}>
                          <InputLabel>Position</InputLabel>
                          <Select
                            value={empPosition}
                            onChange={(e) => setEmpPosition(e.target.value)}
                            label="Position"
                          >
                            {positionOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <IconButton
                          color="primary"
                          onClick={handleAddEmployee}
                          disabled={!empName.trim() || !empPosition}
                          sx={{
                            border: "1px solid",
                            borderColor: !empName.trim() || !empPosition ? "action.disabled" : "primary.main",
                            borderRadius: 1,
                          }}
                        >
                          <AddIcon />
                        </IconButton>
                      </Box>
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <TextField
                label="Network Name"
                value={newNetworkName}
                onChange={(e) => setNewNetworkName(e.target.value)}
                fullWidth
                required
                placeholder="Enter new network name..."
                inputProps={{ maxLength: 100 }}
              />
              <TextField
                label="Description (optional)"
                value={newNetworkDescription}
                onChange={(e) => setNewNetworkDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="Add a description..."
                inputProps={{ maxLength: 500 }}
              />
              <Typography
                variant="body2"
                color="primary"
                sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                onClick={() => {
                  setCreateMode(false);
                  setNewNetworkName("");
                  setNewNetworkDescription("");
                  setEmployees([]);
                  setEmpName("");
                  setEmpTelegram("");
                  setEmpPosition("");
                }}
              >
                or Select Existing Network
              </Typography>

              {/* Employees Section */}
              <Divider sx={{ my: 0.5 }} />
              <Typography variant="subtitle2" color="text.secondary">
                Employees (optional)
              </Typography>

              {employees.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {employees.map((emp, idx) => (
                    <Chip
                      key={idx}
                      label={`${emp.name} - ${positionOptions.find((p) => p.value === emp.position)?.label || emp.position}${emp.telegramUsername ? ` (@${emp.telegramUsername})` : ""}`}
                      onDelete={() => handleRemoveEmployee(idx)}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}

              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <TextField
                  label="Name"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ maxLength: 100 }}
                />
                <TextField
                  label="Telegram"
                  value={empTelegram}
                  onChange={(e) => setEmpTelegram(e.target.value.replace(/^@+/, ""))}
                  size="small"
                  sx={{ flex: 1 }}
                  placeholder="username"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0 }}>
                        <span style={{ fontWeight: 700, color: "#1976d2" }}>@</span>
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ maxLength: 100 }}
                />
              </Box>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Position</InputLabel>
                  <Select
                    value={empPosition}
                    onChange={(e) => setEmpPosition(e.target.value)}
                    label="Position"
                  >
                    {positionOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  color="primary"
                  onClick={handleAddEmployee}
                  disabled={!empName.trim() || !empPosition}
                  sx={{
                    border: "1px solid",
                    borderColor: !empName.trim() || !empPosition ? "action.disabled" : "primary.main",
                    borderRadius: 1,
                  }}
                >
                  <AddIcon />
                </IconButton>
              </Box>
            </>
          )}
          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={3}
            fullWidth
            placeholder="Add any notes about this reference..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitDisabled}
        >
          {isLoading ? <CircularProgress size={20} /> : "Add Reference"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReferenceSelector;
