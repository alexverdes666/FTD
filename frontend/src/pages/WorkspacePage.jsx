import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Pagination,
} from "@mui/material";
import { useSelector } from "react-redux";
import api from "../services/api";
import { selectUser } from "../store/slices/authSlice";

const getCountryAbbreviation = (country) => {
  if (!country) return "—";
  const words = country.trim().split(/\s+/);
  if (words.length >= 2 && words[0].length >= 1 && words[1].length >= 1) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return country;
};

const WorkspacePage = () => {
  const user = useSelector(selectUser);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingLeadId, setSavingLeadId] = useState(null);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const inputRef = useRef(null);
  const shouldPositionCursor = useRef(false);

  const showNotification = (message, severity) => {
    setNotification({ open: true, message, severity });
  };

  // Position cursor after first 2 digits when entering edit mode via navigation
  useEffect(() => {
    if (shouldPositionCursor.current && inputRef.current) {
      const position = Math.min(2, editValue.length);
      inputRef.current.setSelectionRange(position, position);
      shouldPositionCursor.current = false;
    }
  }, [editingLeadId, editValue]);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/leads", {
        params: { page, limit: 50 },
      });
      if (response.data.success) {
        setLeads(response.data.data);
        setTotalPages(response.data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      showNotification("Failed to fetch leads", "error");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handlePhoneSave = async (leadId, newPhone, keepEditing = false) => {
    if (savingLeadId === leadId) return;

    const originalPhone = leads.find((l) => l._id === leadId)?.newPhone;
    if (newPhone === originalPhone) {
      if (!keepEditing) {
        setEditingLeadId(null);
        setEditValue("");
      }
      return;
    }

    setSavingLeadId(leadId);

    setLeads((prev) =>
      prev.map((l) => (l._id === leadId ? { ...l, newPhone } : l))
    );

    try {
      await api.put(`/leads/${leadId}`, { newPhone });
      showNotification("Phone updated", "success");
    } catch (error) {
      console.error("Error updating phone:", error);
      setLeads((prev) =>
        prev.map((l) => (l._id === leadId ? { ...l, newPhone: originalPhone } : l))
      );
      showNotification("Failed to update phone", "error");
    } finally {
      setSavingLeadId(null);
      if (!keepEditing) {
        setEditingLeadId(null);
        setEditValue("");
      }
    }
  };

  const navigateToRecord = (direction) => {
    const currentIndex = leads.findIndex((l) => l._id === editingLeadId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= leads.length) return;

    // Save current record before moving
    handlePhoneSave(editingLeadId, editValue, true);

    // Move to next/previous record
    const nextLead = leads[newIndex];
    shouldPositionCursor.current = true;
    setEditingLeadId(nextLead._id);
    setEditValue(nextLead.newPhone || "");
  };

  const renderPhoneCell = (lead) => {
    const isEditing = editingLeadId === lead._id;
    const isSaving = savingLeadId === lead._id;

    if (isEditing) {
      return (
        <TextField
          size="small"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handlePhoneSave(lead._id, editValue)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              navigateToRecord("up");
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              navigateToRecord("down");
            } else if (e.key === "Enter") {
              e.preventDefault();
              handlePhoneSave(lead._id, editValue);
            } else if (e.key === "Escape") {
              setEditingLeadId(null);
              setEditValue("");
            }
          }}
          inputRef={inputRef}
          autoFocus
          disabled={isSaving}
          sx={{
            width: "150px",
            "& .MuiInputBase-input": {
              padding: "4px 8px",
              fontSize: "0.875rem",
            },
          }}
        />
      );
    }

    return (
      <Typography
        variant="body2"
        onClick={() => {
          setEditingLeadId(lead._id);
          setEditValue(lead.newPhone || "");
        }}
        sx={{
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: "4px",
          minWidth: "150px",
          display: "inline-block",
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.04)",
          },
        }}
      >
        {lead.newPhone || "N/A"}
      </Typography>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Workspace
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: "180px" }}>Phone</TableCell>
                  <TableCell sx={{ width: "80px" }}>Country</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead._id} hover>
                    <TableCell>{renderPhoneCell(lead)}</TableCell>
                    <TableCell>
                      <Chip
                        label={getCountryAbbreviation(lead.country)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={2}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, p) => setPage(p)}
              />
            </Box>
          )}
        </>
      )}

      <Snackbar
        open={notification.open}
        autoHideDuration={3000}
        onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
          severity={notification.severity}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default WorkspacePage;
