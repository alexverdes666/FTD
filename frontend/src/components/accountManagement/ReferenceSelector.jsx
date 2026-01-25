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

  useEffect(() => {
    if (open) {
      fetchNetworks();
      setSelectedNetwork(null);
      setNotes("");
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

  const handleSubmit = () => {
    if (!selectedNetwork) {
      toast.error("Please select a network");
      return;
    }
    onSelect({
      clientNetworkId: selectedNetwork._id,
      notes,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Reference Network</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
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
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !selectedNetwork}
        >
          {loading ? <CircularProgress size={20} /> : "Add Reference"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReferenceSelector;
