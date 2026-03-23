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
  Alert,
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
  const [salaries, setSalaries] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState("salary"); // "salary" or "bonus"
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState({
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
    } catch (err) {
      toast.error("Failed to load employees");
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { year: selectedYear, month: selectedMonth };
      const [salaryRes, bonusRes] = await Promise.allSettled(
        employees.map((emp) => [
          api.get(`/employee-pay/salary/${emp._id}`, { params }),
          api.get(`/employee-pay/bonus/${emp._id}`, { params }),
        ]).flat()
      );

      const allSalaries = [];
      const allBonuses = [];
      for (let i = 0; i < employees.length; i++) {
        const sRes = salaryRes ? salaryRes[i * 2] : null;
        const bRes = bonusRes ? bonusRes[i * 2 + 1] : null;
        // Actually we need a different approach - fetch all at once
      }
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [employees, selectedMonth, selectedYear]);

  // Simpler approach: fetch all employee data per employee
  const fetchAllData = useCallback(async () => {
    if (employees.length === 0) return;
    setLoading(true);
    try {
      const params = { year: selectedYear, month: selectedMonth };
      const salaryPromises = employees.map((emp) =>
        api.get(`/employee-pay/salary/${emp._id}`, { params }).catch(() => ({ data: { data: [] } }))
      );
      const bonusPromises = employees.map((emp) =>
        api.get(`/employee-pay/bonus/${emp._id}`, { params }).catch(() => ({ data: { data: [] } }))
      );

      const [salaryResults, bonusResults] = await Promise.all([
        Promise.all(salaryPromises),
        Promise.all(bonusPromises),
      ]);

      setSalaries(salaryResults.flatMap((r) => r.data.data || []));
      setBonuses(bonusResults.flatMap((r) => r.data.data || []));
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [employees, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const openDialog = (type, record = null) => {
    setDialogType(type);
    setEditingRecord(record);
    if (record) {
      setForm({
        employeeId: record.employee?._id || record.employee,
        amount: record.amount?.toString() || "",
        reason: record.reason || "",
        notes: record.notes || "",
        month: record.month,
        year: record.year,
      });
    } else {
      setForm({
        employeeId: null,
        amount: "",
        reason: "",
        notes: "",
        month: selectedMonth,
        year: selectedYear,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.employeeId || !form.amount) {
      toast.error("Employee and amount are required");
      return;
    }
    if (dialogType === "bonus" && !form.reason) {
      toast.error("Reason is required for bonuses");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = dialogType === "salary" ? "/employee-pay/salary" : "/employee-pay/bonus";
      const payload = {
        employeeId: form.employeeId,
        amount: parseFloat(form.amount),
        month: form.month,
        year: form.year,
        notes: form.notes || undefined,
        ...(dialogType === "bonus" && { reason: form.reason }),
      };

      if (editingRecord) {
        await api.put(`${endpoint}/${editingRecord._id}`, payload);
        toast.success(`${dialogType === "salary" ? "Salary" : "Bonus"} updated`);
      } else {
        await api.post(endpoint, payload);
        toast.success(`${dialogType === "salary" ? "Salary" : "Bonus"} added`);
      }

      setDialogOpen(false);
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      const endpoint = type === "salary" ? "/employee-pay/salary" : "/employee-pay/bonus";
      await api.delete(`${endpoint}/${id}`);
      toast.success("Record deleted");
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
    years.push(y);
  }

  const selectedEmployee = employees.find((e) => e._id === form.employeeId) || null;

  return (
    <Box sx={{ width: "100%" }}>
      {/* Filters */}
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
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => openDialog(tab === 0 ? "salary" : "bonus")}
          >
            Add {tab === 0 ? "Salary" : "Bonus"}
          </Button>
        </Stack>
      </Paper>

      {/* Data Table */}
      <Paper>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Amount</TableCell>
                  {tab === 1 && (
                    <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Reason</TableCell>
                  )}
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Period</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Notes</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Added</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100", textAlign: "right" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(tab === 0 ? salaries : bonuses).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tab === 1 ? 7 : 6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No {tab === 0 ? "salary" : "bonus"} records for {MONTHS[selectedMonth - 1]} {selectedYear}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (tab === 0 ? salaries : bonuses).map((record) => (
                    <TableRow key={record._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {record.employee?.fullName || "—"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {record.employee?.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color={tab === 0 ? "primary.main" : "success.main"}
                        >
                          {tab === 1 && "+"}{record.amount?.toLocaleString()} {record.currency}
                        </Typography>
                      </TableCell>
                      {tab === 1 && (
                        <TableCell>
                          <Typography variant="body2">{record.reason}</Typography>
                        </TableCell>
                      )}
                      <TableCell>
                        <Chip
                          label={`${MONTHS[record.month - 1]?.slice(0, 3)} ${record.year}`}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {record.notes || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {record.createdBy?.fullName} - {new Date(record.createdAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => openDialog(tab === 0 ? "salary" : "bonus", record)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(tab === 0 ? "salary" : "bonus", record._id)}
                          >
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRecord ? "Edit" : "Add"} {dialogType === "salary" ? "Salary" : "Bonus"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={employees}
                getOptionLabel={(o) => `${o.fullName} (${o.email})`}
                value={selectedEmployee}
                onChange={(e, v) => setForm((f) => ({ ...f, employeeId: v?._id || null }))}
                disabled={!!editingRecord}
                renderInput={(params) => (
                  <TextField {...params} label="Employee" size="small" />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Amount (USD)"
                type="number"
                size="small"
                fullWidth
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={3}>
              <FormControl size="small" fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={form.month}
                  label="Month"
                  onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
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
                  value={form.year}
                  label="Year"
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                >
                  {years.map((y) => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {dialogType === "bonus" && (
              <Grid item xs={12}>
                <TextField
                  label="Reason"
                  size="small"
                  fullWidth
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                label="Notes (optional)"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {editingRecord ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeePayManagementPage;
