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
  Chip,
} from "@mui/material";
import api from "../../services/api";
import toast from "react-hot-toast";

const PSPSelector = ({
  open,
  onClose,
  onSelect,
  excludeIds = [],
  loading = false,
}) => {
  const [psps, setPsps] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [selectedPSP, setSelectedPSP] = useState(null);

  useEffect(() => {
    if (open) {
      fetchPSPs();
      setSelectedPSP(null);
    }
  }, [open]);

  const fetchPSPs = async () => {
    try {
      setFetchLoading(true);
      const response = await api.get("/psps", {
        params: { limit: 100, isActive: true },
      });
      // Filter out excluded PSPs
      const filtered = response.data.data.filter(
        (p) => !excludeIds.includes(p._id)
      );
      setPsps(filtered);
    } catch (error) {
      toast.error("Failed to fetch PSPs");
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!selectedPSP) {
      toast.error("Please select a PSP");
      return;
    }
    onSelect(selectedPSP._id);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add PSP</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Autocomplete
            options={psps}
            getOptionLabel={(option) => option.name}
            value={selectedPSP}
            onChange={(_, newValue) => setSelectedPSP(newValue)}
            loading={fetchLoading}
            renderOption={(props, option) => (
              <li {...props}>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <span>{option.name}</span>
                  {option.website && (
                    <span style={{ fontSize: "0.75rem", color: "#666" }}>
                      {option.website}
                    </span>
                  )}
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select PSP"
                placeholder="Search PSPs..."
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
          {selectedPSP && (
            <Box sx={{ p: 2, backgroundColor: "grey.50", borderRadius: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <strong>{selectedPSP.name}</strong>
                <Chip
                  label={selectedPSP.isActive ? "Active" : "Inactive"}
                  color={selectedPSP.isActive ? "success" : "default"}
                  size="small"
                />
              </Box>
              {selectedPSP.description && (
                <Box sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                  {selectedPSP.description}
                </Box>
              )}
              {selectedPSP.website && (
                <Box sx={{ fontSize: "0.875rem", color: "primary.main", mt: 0.5 }}>
                  {selectedPSP.website}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !selectedPSP}
        >
          {loading ? <CircularProgress size={20} /> : "Add PSP"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PSPSelector;
