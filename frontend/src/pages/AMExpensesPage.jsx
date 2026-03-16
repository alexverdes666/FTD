import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  IconButton,
  Collapse,
  CircularProgress,
  Alert,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import dayjs from "dayjs";
import MonthYearSelector from "../components/common/MonthYearSelector";
import { formatCurrency } from "../services/affiliateManagerTable";
import {
  getCalculatedExpenses,
  getCalculatedExpensesForAM,
  getFixedExpenses,
  addFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
  getGlobalFixedExpenses,
  addGlobalFixedExpense,
  updateGlobalFixedExpense,
  deleteGlobalFixedExpense,
  getRateOverrides,
  saveRateOverrides,
} from "../services/amExpenses";
import { getAgentFines } from "../services/agentFines";

// Default rates (mirrors backend constants)
const DEFAULT_RATES = [
  { key: "ftdDeposit", label: "FTDs (Deposit)", defaultRate: 300, rateType: "fixed" },
  { key: "ftdTransactionCommission", label: "FTDs Transaction Commission", defaultRate: 0.05, rateType: "percentage" },
  { key: "sim-SE", label: "SIM Cards (SE)", defaultRate: 60, rateType: "fixed" },
  { key: "sim-UK", label: "SIM Cards (UK)", defaultRate: 35, rateType: "fixed" },
  { key: "sim-CA", label: "SIM Cards (CA)", defaultRate: 100, rateType: "fixed" },
  { key: "sim-PL", label: "SIM Cards (PL)", defaultRate: 35, rateType: "fixed" },
  { key: "sim-ES", label: "SIM Cards (ES)", defaultRate: 40, rateType: "fixed" },
  { key: "documents", label: "Documents", defaultRate: 20, rateType: "fixed" },
  { key: "dataTraffic", label: "Data Traffic", defaultRate: 1, rateType: "fixed" },
  { key: "esUkCards", label: "ES/UK Cards", defaultRate: 0.15, rateType: "percentage" },
  { key: "caCards", label: "CA Cards", defaultRate: 75, rateType: "fixed" },
  { key: "totalTalkingTime", label: "Total Talking Time", defaultRate: 10, rateType: "fixed", suffix: "/hr" },
  { key: "depositCalls", label: "Deposit Calls", defaultRate: 10, rateType: "fixed" },
  { key: "firstCalls", label: "1st Calls", defaultRate: 7.5, rateType: "fixed" },
  { key: "secondCalls", label: "2nd Calls", defaultRate: 7.5, rateType: "fixed" },
  { key: "thirdCalls", label: "3rd Calls", defaultRate: 5, rateType: "fixed" },
  { key: "fourthCalls", label: "4th Calls", defaultRate: 10, rateType: "fixed" },
  { key: "verifiedLeads", label: "Verified Leads", defaultRate: 5, rateType: "fixed" },
];

// --- Fixed Expense Dialog (reused for both per-AM and global) ---
const FixedExpenseDialog = ({ open, onClose, onSave, expense, title }) => {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (expense) {
      setLabel(expense.label || "");
      setAmount(expense.amount?.toString() || "");
      setNotes(expense.notes || "");
    } else {
      setLabel("");
      setAmount("");
      setNotes("");
    }
  }, [expense, open]);

  const handleSave = () => {
    onSave({
      label,
      amount: parseFloat(amount),
      notes,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title || (expense ? "Edit Fixed Expense" : "Add Fixed Expense")}</DialogTitle>
      <DialogContent>
        <TextField
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          fullWidth
          margin="normal"
          required
        />
        <TextField
          label="Amount ($)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          fullWidth
          margin="normal"
          type="number"
          required
        />
        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          margin="normal"
          multiline
          rows={2}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!label || !amount}
        >
          {expense ? "Update" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// --- Helper: compute total for a category given a rate override ---
const computeCategoryTotal = (cat, rateOverride) => {
  const rate = rateOverride !== undefined ? rateOverride : cat.rate;
  if (cat.displayType === "hours") {
    return Math.floor(cat.value || 0) * (rate || 0);
  }
  if (cat.rateType === "percentage") {
    return (cat.base || 0) * (rate || 0);
  }
  if (cat.count !== undefined && rate !== undefined) {
    return cat.count * rate;
  }
  return cat.total || 0;
};

// --- Editable Rate Input ---
const RateInput = ({ value, onChange, suffix }) => (
  <TextField
    value={value}
    onChange={(e) => onChange(e.target.value)}
    size="small"
    type="number"
    sx={{ width: 90 }}
    inputProps={{ style: { textAlign: "right", fontSize: "0.875rem", padding: "4px 8px" } }}
    InputProps={suffix ? { endAdornment: <Typography variant="caption" sx={{ ml: 0.5 }}>{suffix}</Typography> } : undefined}
  />
);

// --- Format rate display for read-only view ---
const formatRate = (value, rateType, suffix) => {
  if (value === undefined || value === null) return "—";
  if (rateType === "percentage") return `${(value * 100).toFixed(1)}%`;
  if (suffix) return `$${value}${suffix}`;
  return `$${value}`;
};

// --- AM Detail Row (Expandable) ---
const AMDetailRow = ({ row, month, year, onFixedExpenseChange, globalFixedTotal, rateOverrides }) => {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [fixedExpensesList, setFixedExpensesList] = useState([]);
  const [amFines, setAmFines] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!open) return;
    setLoadingDetail(true);
    try {
      const [expenseRes, fixedRes, finesRes] = await Promise.all([
        getCalculatedExpensesForAM(row.managerId, { month, year }),
        getFixedExpenses(row.managerId, { month, year }),
        getAgentFines(row.managerId, true, year, month).catch(() => []),
      ]);
      setDetail(expenseRes.data);
      setFixedExpensesList(fixedRes.data);
      setAmFines(finesRes || []);
    } catch (err) {
      console.error("Error loading AM detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  }, [open, row.managerId, month, year]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleToggle = () => setOpen(!open);

  const handleAddFixedExpense = () => {
    setEditingExpense(null);
    setDialogOpen(true);
  };

  const handleEditFixedExpense = (expense) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleDeleteFixedExpense = async (id) => {
    try {
      await deleteFixedExpense(id);
      await loadDetail();
      onFixedExpenseChange();
    } catch (err) {
      console.error("Error deleting fixed expense:", err);
    }
  };

  const handleSaveFixedExpense = async (data) => {
    try {
      if (editingExpense) {
        await updateFixedExpense(editingExpense._id, data);
      } else {
        await addFixedExpense(row.managerId, { ...data, month, year });
      }
      setDialogOpen(false);
      await loadDetail();
      onFixedExpenseChange();
    } catch (err) {
      console.error("Error saving fixed expense:", err);
    }
  };

  // Compute auto subtotal with overrides
  const autoSubtotal = useMemo(() => {
    if (!detail) return 0;
    let total = 0;
    for (const cat of detail.categories) {
      if (cat.key === "simCards" && cat.breakdown) {
        for (const sim of cat.breakdown) {
          const override = rateOverrides[`sim-${sim.geo}`];
          const rate = override !== undefined ? override : sim.rate;
          total += sim.count * rate;
        }
      } else {
        total += computeCategoryTotal(cat, rateOverrides[cat.key]);
      }
    }
    return total;
  }, [detail, rateOverrides]);

  const fixedSubtotal = fixedExpensesList.reduce((sum, fe) => sum + fe.amount, 0);

  // Only active fines count (approved or admin_approved)
  const activeFines = amFines.filter(f => ['approved', 'admin_approved'].includes(f.status));
  const finesTotal = activeFines.reduce((sum, f) => sum + f.amount, 0);

  const getRateValue = (key, defaultRate) => {
    return rateOverrides[key] !== undefined ? rateOverrides[key] : defaultRate;
  };

  return (
    <>
      <TableRow
        sx={{ "& > *": { borderBottom: "unset" }, cursor: "pointer" }}
        hover
        onClick={handleToggle}
      >
        <TableCell>
          <IconButton size="small">
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>{row.managerName}</TableCell>
        <TableCell>{row.managerEmail}</TableCell>
        <TableCell align="right">{formatCurrency(row.totalMoneyIn || 0)}</TableCell>
        <TableCell align="right">{formatCurrency(row.autoExpenses)}</TableCell>
        <TableCell align="right">{formatCurrency(row.fixedExpenses)}</TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold" }}>
          {formatCurrency(row.totalExpenses)}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold", color: (row.totalMoneyIn || 0) - row.totalExpenses >= 0 ? "success.main" : "error.main" }}>
          {formatCurrency((row.totalMoneyIn || 0) - row.totalExpenses)}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold" }}>
          {formatCurrency(((row.totalMoneyIn || 0) - row.totalExpenses) * 0.1)}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold", color: (row.globalNetAgent || 0) >= 0 ? "success.main" : "error.main" }}>
          {row.globalNetAgent !== null && row.globalNetAgent !== undefined ? formatCurrency(row.globalNetAgent) : "—"}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              {loadingDetail ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : detail ? (
                <>
                  {/* Auto-calculated expenses */}
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold" }}>
                    Auto-Calculated Expenses
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Expense</TableCell>
                          <TableCell align="right">Rate</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detail.categories.map((cat) => {
                          if (cat.key === "simCards" && cat.breakdown) {
                            return cat.breakdown.map((sim) => {
                              const simKey = `sim-${sim.geo}`;
                              const rate = getRateValue(simKey, sim.rate);
                              const total = sim.count * rate;
                              return (
                                <TableRow key={simKey}>
                                  <TableCell>SIM Cards ({sim.geo})</TableCell>
                                  <TableCell align="right">
                                    {formatRate(rate, "fixed")}
                                  </TableCell>
                                  <TableCell align="right">{sim.count}</TableCell>
                                  <TableCell align="right">
                                    {formatCurrency(total)}
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          }
                          // Total talking time
                          if (cat.displayType === "hours") {
                            const hours = Math.floor(cat.value || 0);
                            const minutes = Math.round(((cat.value || 0) - hours) * 60);
                            const rate = getRateValue(cat.key, cat.rate || 10);
                            const total = hours * rate;
                            return (
                              <TableRow key={cat.key} sx={{ bgcolor: "action.hover" }}>
                                <TableCell sx={{ fontWeight: "medium" }}>
                                  {cat.label} ({hours}h {minutes}m)
                                </TableCell>
                                <TableCell align="right">
                                  {formatRate(rate, "fixed", "/hr")}
                                </TableCell>
                                <TableCell align="right">{hours} hrs</TableCell>
                                <TableCell align="right" sx={{ fontWeight: "medium" }}>
                                  {formatCurrency(total)}
                                </TableCell>
                              </TableRow>
                            );
                          }
                          // Contract salary — no rate, just total
                          if (cat.key === "contractSalary") {
                            return (
                              <TableRow key={cat.key}>
                                <TableCell>{cat.label}</TableCell>
                                <TableCell align="right">—</TableCell>
                                <TableCell align="right">—</TableCell>
                                <TableCell align="right">
                                  {formatCurrency(cat.total)}
                                </TableCell>
                              </TableRow>
                            );
                          }
                          // Generic category — read-only rate display
                          const rate = getRateValue(cat.key, cat.rate);
                          const total = computeCategoryTotal(cat, rateOverrides[cat.key]);
                          const isPercentage = cat.rateType === "percentage";
                          return (
                            <TableRow key={cat.key}>
                              <TableCell>{cat.label}</TableCell>
                              <TableCell align="right">
                                {cat.rate !== undefined
                                  ? formatRate(rate, isPercentage ? "percentage" : "fixed")
                                  : "—"}
                              </TableCell>
                              <TableCell align="right">
                                {isPercentage && cat.base !== undefined
                                  ? formatCurrency(cat.base)
                                  : cat.count !== undefined
                                  ? cat.count
                                  : "—"}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(total)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow>
                          <TableCell colSpan={3} sx={{ fontWeight: "bold" }}>
                            Auto Subtotal
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: "bold" }}>
                            {formatCurrency(autoSubtotal)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Fixed expenses */}
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: "bold", flex: 1 }}>
                      Fixed Expenses
                    </Typography>
                    <Button
                      startIcon={<AddIcon />}
                      size="small"
                      variant="outlined"
                      onClick={handleAddFixedExpense}
                    >
                      Add
                    </Button>
                  </Box>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Label</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Notes</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {fixedExpensesList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>
                              No fixed expenses
                            </TableCell>
                          </TableRow>
                        ) : (
                          fixedExpensesList.map((fe) => (
                            <TableRow key={fe._id}>
                              <TableCell>{fe.label}</TableCell>
                              <TableCell align="right">{formatCurrency(fe.amount)}</TableCell>
                              <TableCell>{fe.notes || "—"}</TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditFixedExpense(fe)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteFixedExpense(fe._id)}
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                        {fixedExpensesList.length > 0 && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: "bold" }}>Fixed Subtotal</TableCell>
                            <TableCell align="right" sx={{ fontWeight: "bold" }}>
                              {formatCurrency(fixedSubtotal)}
                            </TableCell>
                            <TableCell colSpan={2} />
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Fines */}
                  {amFines.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: "bold", mt: 2 }}>
                        Fines
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Reason</TableCell>
                              <TableCell align="right">Amount</TableCell>
                              <TableCell>Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {amFines.map((fine) => (
                              <TableRow key={fine._id}>
                                <TableCell>{fine.reason}</TableCell>
                                <TableCell align="right" sx={{ color: ['approved', 'admin_approved'].includes(fine.status) ? 'error.main' : 'text.secondary' }}>
                                  {formatCurrency(fine.amount)}
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption" sx={{
                                    color: ['approved', 'admin_approved'].includes(fine.status) ? 'error.main' :
                                           fine.status === 'admin_rejected' ? 'success.main' : 'text.secondary'
                                  }}>
                                    {fine.status === 'pending_approval' ? 'Pending' :
                                     fine.status === 'approved' ? 'Active' :
                                     fine.status === 'disputed' ? 'Disputed' :
                                     fine.status === 'admin_approved' ? 'Active' :
                                     fine.status === 'admin_rejected' ? 'Dropped' : fine.status}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                            {activeFines.length > 0 && (
                              <TableRow>
                                <TableCell sx={{ fontWeight: "bold" }}>Fines Total</TableCell>
                                <TableCell align="right" sx={{ fontWeight: "bold", color: "error.main" }}>
                                  {formatCurrency(finesTotal)}
                                </TableCell>
                                <TableCell />
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}

                  {/* Grand Total */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-end",
                      mt: 1,
                      p: 1.5,
                      bgcolor: "action.hover",
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="h6">
                      Grand Total:{" "}
                      {formatCurrency(autoSubtotal + fixedSubtotal + globalFixedTotal + finesTotal)}
                    </Typography>
                  </Box>
                </>
              ) : (
                <Alert severity="info">No data available</Alert>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <FixedExpenseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveFixedExpense}
        expense={editingExpense}
      />
    </>
  );
};

// --- Main Page ---
const AMExpensesPage = () => {
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Global section toggles (collapsed by default)
  const [ratesOpen, setRatesOpen] = useState(false);
  const [fixedOpen, setFixedOpen] = useState(false);

  // Global fixed expenses
  const [globalFixedExpenses, setGlobalFixedExpenses] = useState([]);
  const [globalDialogOpen, setGlobalDialogOpen] = useState(false);
  const [editingGlobalExpense, setEditingGlobalExpense] = useState(null);

  // Global rate overrides (shared across all AMs for the selected month/year)
  const [rateOverrides, setRateOverrides] = useState({});
  const saveTimerRef = useRef(null);

  const globalFixedTotal = useMemo(
    () => globalFixedExpenses.reduce((sum, fe) => sum + fe.amount, 0),
    [globalFixedExpenses]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const month = selectedDate.month() + 1;
      const year = selectedDate.year();
      const res = await getCalculatedExpenses({ month, year });
      setData(res.data || []);
    } catch (err) {
      console.error("Error fetching AM expenses:", err);
      setError("Failed to load expense data");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchGlobalFixedExpenses = useCallback(async () => {
    try {
      const res = await getGlobalFixedExpenses();
      setGlobalFixedExpenses(res.data || []);
    } catch (err) {
      console.error("Error fetching global fixed expenses:", err);
    }
  }, []);

  const fetchRateOverrides = useCallback(async () => {
    try {
      const month = selectedDate.month() + 1;
      const year = selectedDate.year();
      const res = await getRateOverrides({ month, year });
      setRateOverrides(res.data || {});
    } catch (err) {
      console.error("Error fetching rate overrides:", err);
    }
  }, [selectedDate]);

  const handleRateChange = useCallback((key, value) => {
    const num = parseFloat(value);
    setRateOverrides((prev) => {
      const next = { ...prev };
      if (isNaN(num)) {
        delete next[key];
      } else {
        next[key] = num;
      }

      // Debounce save to backend
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const month = selectedDate.month() + 1;
        const year = selectedDate.year();
        saveRateOverrides({ month, year, overrides: next }).catch((err) =>
          console.error("Error saving rate overrides:", err)
        );
      }, 800);

      return next;
    });
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchGlobalFixedExpenses();
  }, [fetchGlobalFixedExpenses]);

  useEffect(() => {
    fetchRateOverrides();
  }, [fetchRateOverrides]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleAddGlobalExpense = () => {
    setEditingGlobalExpense(null);
    setGlobalDialogOpen(true);
  };

  const handleEditGlobalExpense = (expense) => {
    setEditingGlobalExpense(expense);
    setGlobalDialogOpen(true);
  };

  const handleDeleteGlobalExpense = async (id) => {
    try {
      await deleteGlobalFixedExpense(id);
      await fetchGlobalFixedExpenses();
      await fetchData();
    } catch (err) {
      console.error("Error deleting global fixed expense:", err);
    }
  };

  const handleSaveGlobalExpense = async (data) => {
    try {
      if (editingGlobalExpense) {
        await updateGlobalFixedExpense(editingGlobalExpense._id, data);
      } else {
        await addGlobalFixedExpense(data);
      }
      setGlobalDialogOpen(false);
      await fetchGlobalFixedExpenses();
      await fetchData();
    } catch (err) {
      console.error("Error saving global fixed expense:", err);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <MonthYearSelector
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          showCurrentSelection={false}
        />
      </Paper>

      {/* Global Settings — side by side, collapsible */}
      <Box sx={{ display: "flex", gap: 3, mb: 3, alignItems: "flex-start" }}>
        {/* Global Auto-Calculated Rates */}
        <Paper sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", p: 2, cursor: "pointer" }}
            onClick={() => setRatesOpen((v) => !v)}
          >
            <IconButton size="small" sx={{ mr: 1 }}>
              {ratesOpen ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Global Auto-Calculated Rates
            </Typography>
          </Box>
          <Collapse in={ratesOpen}>
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Rates for the selected month. Changes saved automatically.
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Expense</TableCell>
                      <TableCell align="right">Default</TableCell>
                      <TableCell align="right">Current Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {DEFAULT_RATES.map((item) => {
                      const isPercentage = item.rateType === "percentage";
                      const currentRaw = rateOverrides[item.key];
                      const currentValue = currentRaw !== undefined ? currentRaw : item.defaultRate;
                      const displayValue = isPercentage ? currentValue * 100 : currentValue;
                      const defaultDisplay = isPercentage
                        ? `${(item.defaultRate * 100).toFixed(1)}%`
                        : `$${item.defaultRate}${item.suffix || ""}`;

                      return (
                        <TableRow key={item.key}>
                          <TableCell>{item.label}</TableCell>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>
                            {defaultDisplay}
                          </TableCell>
                          <TableCell align="right">
                            <RateInput
                              value={displayValue}
                              onChange={(v) => {
                                const num = parseFloat(v);
                                if (isPercentage) {
                                  handleRateChange(item.key, isNaN(num) ? "" : (num / 100).toString());
                                } else {
                                  handleRateChange(item.key, v);
                                }
                              }}
                              suffix={isPercentage ? "%" : item.suffix}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Collapse>
        </Paper>

        {/* Global Fixed Expenses */}
        <Paper sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", p: 2, cursor: "pointer" }}
            onClick={() => setFixedOpen((v) => !v)}
          >
            <IconButton size="small" sx={{ mr: 1 }}>
              {fixedOpen ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Global Fixed Expenses
            </Typography>
            <Button
              startIcon={<AddIcon />}
              size="small"
              variant="outlined"
              onClick={(e) => { e.stopPropagation(); handleAddGlobalExpense(); }}
            >
              Add
            </Button>
          </Box>
          <Collapse in={fixedOpen}>
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                These expenses apply to all affiliate managers, every month.
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Label</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Notes</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {globalFixedExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>
                          No global fixed expenses
                        </TableCell>
                      </TableRow>
                    ) : (
                      globalFixedExpenses.map((fe) => (
                        <TableRow key={fe._id}>
                          <TableCell>{fe.label}</TableCell>
                          <TableCell align="right">{formatCurrency(fe.amount)}</TableCell>
                          <TableCell>{fe.notes || "—"}</TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              onClick={() => handleEditGlobalExpense(fe)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteGlobalExpense(fe._id)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {globalFixedExpenses.length > 0 && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold" }}>
                          {formatCurrency(globalFixedTotal)}
                        </TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Collapse>
        </Paper>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50} />
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">Total Money IN</TableCell>
                <TableCell align="right">Auto Expenses</TableCell>
                <TableCell align="right">Fixed Expenses</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Net Value</TableCell>
                <TableCell align="right">Commission Agent</TableCell>
                <TableCell align="right">Global Net Agent</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No affiliate managers found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <AMDetailRow
                    key={row.managerId}
                    row={row}
                    month={selectedDate.month() + 1}
                    year={selectedDate.year()}
                    onFixedExpenseChange={fetchData}
                    globalFixedTotal={globalFixedTotal}
                    rateOverrides={rateOverrides}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <FixedExpenseDialog
        open={globalDialogOpen}
        onClose={() => setGlobalDialogOpen(false)}
        onSave={handleSaveGlobalExpense}
        expense={editingGlobalExpense}
        title={editingGlobalExpense ? "Edit Global Fixed Expense" : "Add Global Fixed Expense"}
      />
    </Box>
  );
};

export default AMExpensesPage;
