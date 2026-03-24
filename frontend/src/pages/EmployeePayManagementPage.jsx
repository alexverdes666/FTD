import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Chip,
  Tabs,
  Tab,
  Tooltip,
  Stack,
  Autocomplete,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AttachMoney as SalaryIcon,
  CardGiftcard as BonusIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import api from "../services/api";
import toast from "react-hot-toast";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const now = new Date();

const EmployeePayManagementPage = () => {
  const [tab, setTab] = useState(0); // 0 = Salary, 1 = Bonuses
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [employees, setEmployees] = useState([]);
  const [salaryData, setSalaryData] = useState([]); // { employee, salary }
  const [bonuses, setBonuses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Salary inline edit
  const [editingSalary, setEditingSalary] = useState({}); // { [empId]: { amount, notes } }

  // Bonus dialog
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [editingBonus, setEditingBonus] = useState(null);
  const [bonusForm, setBonusForm] = useState({
    employeeId: null,
    amount: "",
    reason: "",
    notes: "",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get("/users", { params: { role: "employee", limit: 10000, isActive: true } });
      setEmployees(res.data.data || []);
    } catch {
      toast.error("Failed to load employees");
    }
  }, []);

  const fetchSalaries = useCallback(async () => {
    try {
      const res = await api.get("/employee-pay/salaries");
      setSalaryData(res.data.data || []);
    } catch {
      toast.error("Failed to load salaries");
    }
  }, []);

  const fetchBonuses = useCallback(async () => {
    if (employees.length === 0) return;
    try {
      const params = { year: selectedYear, month: selectedMonth };
      const results = await Promise.all(
        employees.map((emp) =>
          api.get(`/employee-pay/bonus/${emp._id}`, { params }).catch(() => ({ data: { data: [] } }))
        )
      );
      setBonuses(results.flatMap((r) => r.data.data || []));
    } catch {
      toast.error("Failed to load bonuses");
    }
  }, [employees, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSalaries(), fetchBonuses()]).finally(() => setLoading(false));
  }, [fetchSalaries, fetchBonuses]);

  // --- Salary handlers ---
  const startEditSalary = (empId, current) => {
    setEditingSalary((prev) => ({
      ...prev,
      [empId]: { amount: current?.amount?.toString() || "", notes: current?.notes || "" },
    }));
  };

  const cancelEditSalary = (empId) => {
    setEditingSalary((prev) => {
      const copy = { ...prev };
      delete copy[empId];
      return copy;
    });
  };

  const saveSalary = async (empId) => {
    const edit = editingSalary[empId];
    if (!edit?.amount || parseFloat(edit.amount) < 0) {
      toast.error("Valid amount required");
      return;
    }
    try {
      await api.put(`/employee-pay/salary/${empId}`, {
        amount: parseFloat(edit.amount),
        notes: edit.notes || undefined,
      });
      toast.success("Salary saved");
      cancelEditSalary(empId);
      fetchSalaries();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    }
  };

  const deleteSalary = async (empId) => {
    if (!window.confirm("Remove salary for this employee?")) return;
    try {
      await api.delete(`/employee-pay/salary/${empId}`);
      toast.success("Salary removed");
      fetchSalaries();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  // --- Bonus handlers ---
  const openBonusDialog = (record = null) => {
    setEditingBonus(record);
    if (record) {
      setBonusForm({
        employeeId: record.employee?._id || record.employee,
        amount: record.amount?.toString() || "",
        reason: record.reason || "",
        notes: record.notes || "",
        month: record.month,
        year: record.year,
      });
    } else {
      setBonusForm({
        employeeId: null,
        amount: "",
        reason: "",
        notes: "",
        month: selectedMonth,
        year: selectedYear,
      });
    }
    setBonusDialogOpen(true);
  };

  const handleBonusSubmit = async () => {
    if (!bonusForm.employeeId || !bonusForm.amount || !bonusForm.reason) {
      toast.error("Employee, amount, and reason are required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        employeeId: bonusForm.employeeId,
        amount: parseFloat(bonusForm.amount),
        reason: bonusForm.reason,
        month: bonusForm.month,
        year: bonusForm.year,
        notes: bonusForm.notes || undefined,
      };
      if (editingBonus) {
        await api.put(`/employee-pay/bonus/${editingBonus._id}`, payload);
        toast.success("Bonus updated");
      } else {
        await api.post("/employee-pay/bonus", payload);
        toast.success("Bonus added");
      }
      setBonusDialogOpen(false);
      fetchBonuses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBonus = async (id) => {
    if (!window.confirm("Delete this bonus?")) return;
    try {
      await api.delete(`/employee-pay/bonus/${id}`);
      toast.success("Bonus deleted");
      fetchBonuses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) years.push(y);

  const selectedBonusEmployee = employees.find((e) => e._id === bonusForm.employeeId) || null;

  return (
    <Box sx={{ width: "100%" }}>
      {/* Header */}
      <Paper sx={{ px: 2, py: 1, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.3, fontSize: "0.8rem" } }}
          >
            <Tab icon={<SalaryIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Salary" />
            <Tab icon={<BonusIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Bonuses" />
          </Tabs>
          <Box sx={{ ml: "auto" }} />
          {tab === 1 && (
            <>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Month</InputLabel>
                <Select value={selectedMonth} label="Month" onChange={(e) => setSelectedMonth(e.target.value)}>
                  {MONTHS.map((m, i) => (
                    <MenuItem key={i} value={i + 1}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Year</InputLabel>
                <Select value={selectedYear} label="Year" onChange={(e) => setSelectedYear(e.target.value)}>
                  {years.map((y) => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openBonusDialog()}>
                Add Bonus
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      {/* Content */}
      <Paper>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        ) : tab === 0 ? (
          /* ---- Salary Tab ---- */
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100", width: "20%" }}>Monthly Salary</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Notes</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Last Updated</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100", textAlign: "right", width: "12%" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {salaryData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No employees found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  salaryData.map(({ employee, salary }) => {
                    const isEditing = editingSalary[employee._id] !== undefined;
                    const edit = editingSalary[employee._id];
                    return (
                      <TableRow key={employee._id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{employee.fullName}</Typography>
                          <Typography variant="caption" color="text.secondary">{employee.email}</Typography>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <TextField
                              size="small"
                              type="number"
                              value={edit.amount}
                              onChange={(e) =>
                                setEditingSalary((prev) => ({
                                  ...prev,
                                  [employee._id]: { ...prev[employee._id], amount: e.target.value },
                                }))
                              }
                              inputProps={{ min: 0, step: 0.01 }}
                              sx={{ width: 130 }}
                            />
                          ) : salary ? (
                            <Typography variant="body2" fontWeight="bold" color="primary.main">
                              {salary.amount?.toLocaleString()} {salary.currency}
                            </Typography>
                          ) : (
                            <Chip label="Not set" size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <TextField
                              size="small"
                              value={edit.notes}
                              onChange={(e) =>
                                setEditingSalary((prev) => ({
                                  ...prev,
                                  [employee._id]: { ...prev[employee._id], notes: e.target.value },
                                }))
                              }
                              placeholder="Notes..."
                              sx={{ width: "100%" }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {salary?.notes || "—"}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {salary ? (
                            <Typography variant="caption">
                              {new Date(salary.updatedAt).toLocaleDateString()}
                              {salary.lastUpdatedBy && ` by ${salary.lastUpdatedBy.fullName}`}
                            </Typography>
                          ) : "—"}
                        </TableCell>
                        <TableCell align="right">
                          {isEditing ? (
                            <>
                              <Tooltip title="Save">
                                <IconButton size="small" color="primary" onClick={() => saveSalary(employee._id)}>
                                  <SaveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Cancel">
                                <IconButton size="small" onClick={() => cancelEditSalary(employee._id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <>
                              <Tooltip title={salary ? "Edit Salary" : "Set Salary"}>
                                <IconButton size="small" onClick={() => startEditSalary(employee._id, salary)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {salary && (
                                <Tooltip title="Remove Salary">
                                  <IconButton size="small" color="error" onClick={() => deleteSalary(employee._id)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          /* ---- Bonuses Tab ---- */
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Reason</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Notes</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Added</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100", textAlign: "right" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bonuses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No bonuses for {MONTHS[selectedMonth - 1]} {selectedYear}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  bonuses.map((b) => (
                    <TableRow key={b._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{b.employee?.fullName || "—"}</Typography>
                        <Typography variant="caption" color="text.secondary">{b.employee?.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold" color="success.main">
                          +{b.amount?.toLocaleString()} {b.currency}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{b.reason}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{b.notes || "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {b.createdBy?.fullName} - {new Date(b.createdAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openBonusDialog(b)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => deleteBonus(b._id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add/Edit Bonus Dialog */}
      <Dialog open={bonusDialogOpen} onClose={() => setBonusDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingBonus ? "Edit" : "Add"} Bonus</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={employees}
                getOptionLabel={(o) => `${o.fullName} (${o.email})`}
                value={selectedBonusEmployee}
                onChange={(e, v) => setBonusForm((f) => ({ ...f, employeeId: v?._id || null }))}
                disabled={!!editingBonus}
                renderInput={(params) => <TextField {...params} label="Employee" size="small" />}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Amount (USD)"
                type="number"
                size="small"
                fullWidth
                value={bonusForm.amount}
                onChange={(e) => setBonusForm((f) => ({ ...f, amount: e.target.value }))}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={3}>
              <FormControl size="small" fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={bonusForm.month}
                  label="Month"
                  onChange={(e) => setBonusForm((f) => ({ ...f, month: e.target.value }))}
                >
                  {MONTHS.map((m, i) => (
                    <MenuItem key={i} value={i + 1}>{m.slice(0, 3)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={3}>
              <FormControl size="small" fullWidth>
                <InputLabel>Year</InputLabel>
                <Select
                  value={bonusForm.year}
                  label="Year"
                  onChange={(e) => setBonusForm((f) => ({ ...f, year: e.target.value }))}
                >
                  {years.map((y) => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Reason"
                size="small"
                fullWidth
                value={bonusForm.reason}
                onChange={(e) => setBonusForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes (optional)"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={bonusForm.notes}
                onChange={(e) => setBonusForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBonusDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBonusSubmit}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {editingBonus ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeePayManagementPage;
