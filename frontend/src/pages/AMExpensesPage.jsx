import React, { useState, useEffect, useCallback } from "react";
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
} from "../services/amExpenses";

// --- Fixed Expense Dialog ---
const FixedExpenseDialog = ({ open, onClose, onSave, expense }) => {
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
      <DialogTitle>{expense ? "Edit Fixed Expense" : "Add Fixed Expense"}</DialogTitle>
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

// --- AM Detail Row (Expandable) ---
const AMDetailRow = ({ row, month, year, onFixedExpenseChange }) => {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [fixedExpensesList, setFixedExpensesList] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!open) return;
    setLoadingDetail(true);
    try {
      const [expenseRes, fixedRes] = await Promise.all([
        getCalculatedExpensesForAM(row.managerId, { month, year }),
        getFixedExpenses(row.managerId, { month, year }),
      ]);
      setDetail(expenseRes.data);
      setFixedExpensesList(fixedRes.data);
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

  const renderRateDisplay = (category) => {
    if (category.rateType === "percentage") {
      return `${(category.rate * 100).toFixed(0)}%`;
    }
    if (category.rate) {
      return formatCurrency(category.rate);
    }
    return "—";
  };

  const renderQuantityDisplay = (category) => {
    if (category.rateType === "percentage" && category.base !== undefined) {
      return formatCurrency(category.base);
    }
    if (category.count !== undefined) {
      return category.count;
    }
    return "—";
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
        <TableCell align="right">{formatCurrency(row.autoExpenses)}</TableCell>
        <TableCell align="right">{formatCurrency(row.fixedExpenses)}</TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold" }}>
          {formatCurrency(row.totalExpenses)}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
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
                            return cat.breakdown.map((sim) => (
                              <TableRow key={`sim-${sim.geo}`}>
                                <TableCell>SIM Cards ({sim.geo})</TableCell>
                                <TableCell align="right">
                                  {formatCurrency(sim.rate)}
                                </TableCell>
                                <TableCell align="right">{sim.count}</TableCell>
                                <TableCell align="right">
                                  {formatCurrency(sim.total)}
                                </TableCell>
                              </TableRow>
                            ));
                          }
                          // Total talking time - display hours with $10/hr rate
                          if (cat.displayType === "hours") {
                            const hours = Math.floor(cat.value || 0);
                            const minutes = Math.round(((cat.value || 0) - hours) * 60);
                            return (
                              <TableRow key={cat.key} sx={{ bgcolor: "action.hover" }}>
                                <TableCell sx={{ fontWeight: "medium" }}>
                                  {cat.label} ({hours}h {minutes}m)
                                </TableCell>
                                <TableCell align="right">
                                  {formatCurrency(cat.rate || 10)}/hr
                                </TableCell>
                                <TableCell align="right">{hours} hrs</TableCell>
                                <TableCell align="right" sx={{ fontWeight: "medium" }}>
                                  {formatCurrency(cat.total || 0)}
                                </TableCell>
                              </TableRow>
                            );
                          }
                          return (
                            <TableRow key={cat.key}>
                              <TableCell>{cat.label}</TableCell>
                              <TableCell align="right">
                                {renderRateDisplay(cat)}
                              </TableCell>
                              <TableCell align="right">
                                {renderQuantityDisplay(cat)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(cat.total)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow>
                          <TableCell colSpan={3} sx={{ fontWeight: "bold" }}>
                            Auto Subtotal
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: "bold" }}>
                            {formatCurrency(detail.grandTotal)}
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
                              {formatCurrency(
                                fixedExpensesList.reduce((sum, fe) => sum + fe.amount, 0)
                              )}
                            </TableCell>
                            <TableCell colSpan={2} />
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

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
                      {formatCurrency(
                        detail.grandTotal +
                          fixedExpensesList.reduce((sum, fe) => sum + fe.amount, 0)
                      )}
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const month = selectedDate.month() + 1; // dayjs months are 0-indexed
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <MonthYearSelector
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          showCurrentSelection={false}
        />
      </Paper>

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
                <TableCell align="right">Auto Expenses</TableCell>
                <TableCell align="right">Fixed Expenses</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
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
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default AMExpensesPage;
