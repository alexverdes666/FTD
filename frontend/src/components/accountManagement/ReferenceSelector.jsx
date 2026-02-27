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
} from "@mui/material";
import api from "../../services/api";
import toast from "react-hot-toast";

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
  const [notes, setNotes] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState("");
  const [newNetworkDescription, setNewNetworkDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchNetworks();
      setSelectedNetwork(null);
      setNotes("");
      setCreateMode(false);
      setNewNetworkName("");
      setNewNetworkDescription("");
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
      onSelect({
        clientNetworkId: selectedNetwork._id,
        notes,
      });
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
                onChange={(_, newValue) => setSelectedNetwork(newValue)}
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
                }}
              >
                or Create New Network
              </Typography>
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
                }}
              >
                or Select Existing Network
              </Typography>
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
