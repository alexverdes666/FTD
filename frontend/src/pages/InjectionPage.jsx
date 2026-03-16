import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Replay as ReRequestIcon,
  Vaccines as InjectIcon,
  Image as ImageIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import DocumentPreview from "../components/DocumentPreview";
import { selectUser } from "../store/slices/authSlice";
import {
  getInjections,
  updateInjectionStatus,
} from "../services/injections";
import toast from "react-hot-toast";

const getStatusColor = (status) => {
  switch (status) {
    case "pending":
      return "warning";
    case "injected":
      return "info";
    case "approved":
      return "success";
    case "rejected":
      return "error";
    default:
      return "default";
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case "pending":
      return "Pending";
    case "injected":
      return "Injected";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
};

const InjectionPage = () => {
  const user = useSelector(selectUser);
  const isAgent = user?.role === "agent";
  const isManager = ["admin", "affiliate_manager"].includes(user?.role);

  const [injections, setInjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [tabValue, setTabValue] = useState(0);
  const [processing, setProcessing] = useState(null);
  const [rejectDialog, setRejectDialog] = useState({
    open: false,
    injectionId: null,
    note: "",
  });
  const [confirmInjectDialog, setConfirmInjectDialog] = useState({
    open: false,
    injectionId: null,
  });

  // Tab-based status filtering
  const getStatusFilter = useCallback(() => {
    if (isAgent) {
      const filters = [undefined, "pending", "injected", "approved", "rejected"];
      return filters[tabValue];
    }
    // Manager tabs: All, Pending Approval (injected), Approved, Rejected
    const filters = [undefined, "injected", "pending", "approved", "rejected"];
    return filters[tabValue];
  }, [tabValue, isAgent]);

  const fetchInjections = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter = getStatusFilter();
      const params = {
        page: page + 1,
        limit: rowsPerPage,
      };
      if (statusFilter) params.status = statusFilter;

      const res = await getInjections(params);
      if (res.data.success) {
        setInjections(res.data.data);
        setTotal(res.data.total);
      }
    } catch (error) {
      toast.error("Failed to load injections");
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, getStatusFilter]);

  useEffect(() => {
    fetchInjections();
  }, [fetchInjections]);

  const handleStatusChange = async (injectionId, status, note) => {
    setProcessing(injectionId);
    try {
      const res = await updateInjectionStatus(injectionId, { status, note });
      if (res.data.success) {
        toast.success(
          status === "injected"
            ? "Marked as injected"
            : status === "approved"
            ? "Injection approved"
            : status === "rejected"
            ? "Injection rejected"
            : "Status updated"
        );
        fetchInjections();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = () => {
    if (rejectDialog.injectionId) {
      handleStatusChange(
        rejectDialog.injectionId,
        "rejected",
        rejectDialog.note
      );
    }
    setRejectDialog({ open: false, injectionId: null, note: "" });
  };

  const handleConfirmInject = () => {
    if (confirmInjectDialog.injectionId) {
      handleStatusChange(confirmInjectDialog.injectionId, "injected");
    }
    setConfirmInjectDialog({ open: false, injectionId: null });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        {isAgent ? "My Injections" : "Injection Management"}
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => {
            setTabValue(v);
            setPage(0);
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="All" />
          {isAgent ? (
            [
              <Tab key="pending" label="Pending" />,
              <Tab key="injected" label="Injected" />,
              <Tab key="approved" label="Approved" />,
              <Tab key="rejected" label="Rejected" />,
            ]
          ) : (
            [
              <Tab key="approval" label="Pending Approval" />,
              <Tab key="pending" label="Pending" />,
              <Tab key="approved" label="Approved" />,
              <Tab key="rejected" label="Rejected" />,
            ]
          )}
        </Tabs>
      </Paper>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Lead</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Type</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Country</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Order</TableCell>
                {isManager && (
                  <TableCell sx={{ fontWeight: "bold" }}>Agent</TableCell>
                )}
                {isAgent && (
                  <TableCell sx={{ fontWeight: "bold" }}>Assigned By</TableCell>
                )}
                <TableCell sx={{ fontWeight: "bold" }}>Working Hours</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Docs</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Created</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "center" }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : injections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No injections found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                injections.map((inj) => (
                  <TableRow key={inj._id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {inj.leadId?.firstName} {inj.leadId?.lastName}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {inj.leadId?.newEmail}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={inj.leadId?.leadType?.toUpperCase() || "N/A"}
                        size="small"
                        color={
                          inj.leadId?.leadType === "ftd"
                            ? "success"
                            : inj.leadId?.leadType === "filler"
                            ? "warning"
                            : inj.leadId?.leadType === "cold"
                            ? "info"
                            : "default"
                        }
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {inj.leadId?.country}
                      </Typography>
                    </TableCell>
                    {/* Order ID & Planned Date */}
                    <TableCell>
                      {inj.orderId ? (
                        <>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
                            {inj.orderId._id?.toString().slice(-6).toUpperCase()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {inj.orderId.plannedDate
                              ? dayjs(inj.orderId.plannedDate).format("DD/MM/YY")
                              : "—"}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        <Typography variant="body2">
                          {inj.injectionType === "self"
                            ? "Self"
                            : inj.assignedTo?.fullName || "N/A"}
                        </Typography>
                      </TableCell>
                    )}
                    {isAgent && (
                      <TableCell>
                        <Typography variant="body2">
                          {inj.assignedBy?.fullName || "N/A"}
                        </Typography>
                      </TableCell>
                    )}
                    {/* Working Hours */}
                    <TableCell>
                      <Typography variant="body2">
                        {inj.workingHours || "—"}
                      </Typography>
                    </TableCell>
                    {/* Documents */}
                    <TableCell>
                      {(() => {
                        const docs = Array.isArray(inj.leadId?.documents)
                          ? inj.leadId.documents.filter((d) => d.url)
                          : [];
                        if (docs.length === 0) {
                          return <Typography variant="body2" color="text.disabled">—</Typography>;
                        }
                        return (
                          <Box sx={{ display: "flex", gap: 0.25, flexWrap: "wrap" }}>
                            {docs.map((doc, idx) => (
                              <DocumentPreview
                                key={idx}
                                url={doc.url}
                                type={doc.description || `Doc ${idx + 1}`}
                                forceImage
                              >
                                <Tooltip title={doc.description || `Doc ${idx + 1}`}>
                                  <ImageIcon
                                    sx={{
                                      fontSize: 20,
                                      color: "primary.main",
                                      cursor: "pointer",
                                    }}
                                  />
                                </Tooltip>
                              </DocumentPreview>
                            ))}
                          </Box>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(inj.status)}
                        size="small"
                        color={getStatusColor(inj.status)}
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {dayjs(inj.createdAt).format("DD/MM/YY HH:mm")}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      {processing === inj._id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <>
                          {/* Agent: Mark as injected (from pending or rejected) */}
                          {isAgent &&
                            ["pending", "rejected"].includes(inj.status) && (
                              <Tooltip title="Mark as Injected">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() =>
                                    setConfirmInjectDialog({
                                      open: true,
                                      injectionId: inj._id,
                                    })
                                  }
                                >
                                  <InjectIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          {/* Manager: Approve/Reject (from injected) */}
                          {isManager && inj.status === "injected" && (
                            <>
                              <Tooltip title="Approve">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() =>
                                    handleStatusChange(inj._id, "approved")
                                  }
                                >
                                  <ApproveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() =>
                                    setRejectDialog({
                                      open: true,
                                      injectionId: inj._id,
                                      note: "",
                                    })
                                  }
                                >
                                  <RejectIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {/* Manager self-injection: Mark as injected */}
                          {isManager &&
                            inj.injectionType === "self" &&
                            inj.status === "pending" && (
                              <Tooltip title="Mark as Injected">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() =>
                                    handleStatusChange(inj._id, "injected")
                                  }
                                >
                                  <InjectIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          {/* Manager self-injection: Auto-approve after injected */}
                          {isManager &&
                            inj.injectionType === "self" &&
                            inj.status === "injected" && (
                              <Tooltip title="Approve">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() =>
                                    handleStatusChange(inj._id, "approved")
                                  }
                                >
                                  <ApproveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      {/* Reject Reason Dialog */}
      <Dialog
        open={rejectDialog.open}
        onClose={() =>
          setRejectDialog({ open: false, injectionId: null, note: "" })
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Injection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason (optional)"
            fullWidth
            multiline
            rows={2}
            value={rejectDialog.note}
            onChange={(e) =>
              setRejectDialog((prev) => ({ ...prev, note: e.target.value }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setRejectDialog({ open: false, injectionId: null, note: "" })
            }
          >
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Injection Dialog */}
      <Dialog
        open={confirmInjectDialog.open}
        onClose={() =>
          setConfirmInjectDialog({ open: false, injectionId: null })
        }
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Injection</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Do you want to confirm this lead as injected?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setConfirmInjectDialog({ open: false, injectionId: null })
            }
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmInject}
            variant="contained"
            color="primary"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InjectionPage;
