import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  useTheme,
  alpha,
} from "@mui/material";
import {
  AttachMoney as SalaryIcon,
  Gavel as FineIcon,
  CardGiftcard as BonusIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from "@mui/icons-material";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FINE_STATUS_COLORS = {
  pending_approval: "warning",
  approved: "success",
  disputed: "info",
  admin_approved: "success",
  admin_rejected: "error",
  paid: "default",
  waived: "default",
};

const FINE_STATUS_LABELS = {
  pending_approval: "Pending",
  approved: "Approved",
  disputed: "Disputed",
  admin_approved: "Confirmed",
  admin_rejected: "Rejected",
  paid: "Paid",
  waived: "Waived",
};

const SummaryCard = ({ icon, title, value, subtitle, color = "primary" }) => {
  const theme = useTheme();
  return (
    <Card
      variant="outlined"
      sx={{ height: "100%", borderLeft: 4, borderLeftColor: `${color}.main` }}
    >
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              p: 0.8,
              borderRadius: 1,
              bgcolor: alpha(theme.palette[color].main, 0.1),
              color: `${color}.main`,
              display: "flex",
            }}
          >
            {icon}
          </Box>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
        </Box>
        <Typography variant="h5" fontWeight="bold">{value}</Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        )}
      </CardContent>
    </Card>
  );
};

const SectionHeader = ({ icon, title }) => (
  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
    {React.cloneElement(icon, { sx: { fontSize: 20 } })}
    {title}
  </Typography>
);

const EmployeeDashboardPage = () => {
  const user = useSelector(selectUser);
  const now = new Date();

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [salary, setSalary] = useState(null);
  const [bonuses, setBonuses] = useState([]);
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Salary is fixed — fetch once, no month/year
  const fetchSalary = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api.get(`/employee-pay/salary/${user.id}`);
      setSalary(res.data.data);
    } catch {
      setSalary(null);
    }
  }, [user?.id]);

  // Bonuses & fines are per-month
  const fetchMonthly = useCallback(async () => {
    if (!user?.id) return;
    try {
      const params = { year: selectedYear, month: selectedMonth };
      const [bonusRes, finesRes] = await Promise.allSettled([
        api.get(`/employee-pay/bonus/${user.id}`, { params }),
        api.get(`/agent-fines/agent/${user.id}`, {
          params: { includeResolved: true, year: selectedYear, month: selectedMonth },
        }),
      ]);
      setBonuses(bonusRes.status === "fulfilled" ? bonusRes.value.data.data || [] : []);
      setFines(finesRes.status === "fulfilled" ? finesRes.value.data.data || [] : []);
    } catch {
      setError("Failed to load data");
    }
  }, [user?.id, selectedMonth, selectedYear]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSalary(), fetchMonthly()]).finally(() => setLoading(false));
  }, [fetchSalary, fetchMonthly]);

  const fixedSalary = salary?.amount || 0;
  const currency = salary?.currency || "USD";
  const totalBonuses = bonuses.reduce((sum, b) => sum + (b.amount || 0), 0);
  const activeFines = fines.filter((f) => ["approved", "admin_approved"].includes(f.status));
  const totalFines = activeFines.reduce((sum, f) => sum + (f.amount || 0), 0);
  const netPay = fixedSalary + totalBonuses - totalFines;

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) years.push(y);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      {/* Period Selector */}
      <Paper sx={{ px: 2, py: 1, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="subtitle1" fontWeight="bold">My Pay Overview</Typography>
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
        </Stack>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={<SalaryIcon />}
            title="Fixed Salary"
            value={`${fixedSalary.toLocaleString()} ${currency}`}
            subtitle={salary ? "Monthly fixed" : "Not set"}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={<BonusIcon />}
            title="Bonuses"
            value={`+${totalBonuses.toLocaleString()} ${currency}`}
            subtitle={`${bonuses.length} bonus(es) this month`}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={<FineIcon />}
            title="Fines"
            value={`-${totalFines.toLocaleString()} ${currency}`}
            subtitle={`${activeFines.length} active fine(s)`}
            color="error"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            icon={netPay >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
            title="Net Pay"
            value={`${netPay.toLocaleString()} ${currency}`}
            subtitle="Salary + Bonuses - Fines"
            color={netPay >= 0 ? "success" : "error"}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Salary Info */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: "100%" }}>
            <SectionHeader icon={<SalaryIcon />} title="Salary" />
            {salary ? (
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" color="text.secondary">Amount</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {fixedSalary.toLocaleString()} {currency} / month
                  </Typography>
                </Box>
                {salary.notes && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">Notes</Typography>
                    <Typography variant="body2">{salary.notes}</Typography>
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary">
                  Last updated: {new Date(salary.updatedAt).toLocaleDateString()}
                  {salary.lastUpdatedBy && ` by ${salary.lastUpdatedBy.fullName}`}
                </Typography>
              </Stack>
            ) : (
              <Alert severity="info" variant="outlined">
                No salary configured. Contact your administrator.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Bonus History */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <SectionHeader icon={<BonusIcon />} title={`Bonuses - ${MONTHS[selectedMonth - 1]} ${selectedYear}`} />
            {bonuses.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Reason</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Added By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bonuses.map((b) => (
                      <TableRow key={b._id} hover>
                        <TableCell>{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            +{b.amount?.toLocaleString()} {b.currency}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{b.reason}</Typography>
                          {b.notes && (
                            <Typography variant="caption" color="text.secondary">{b.notes}</Typography>
                          )}
                        </TableCell>
                        <TableCell>{b.createdBy?.fullName || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info" variant="outlined">No bonuses for this period.</Alert>
            )}
          </Paper>
        </Grid>

        {/* Fines History */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <SectionHeader icon={<FineIcon />} title={`Fines - ${MONTHS[selectedMonth - 1]} ${selectedYear}`} />
            {fines.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Reason</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "grey.100" }}>Imposed By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fines.map((fine) => (
                      <TableRow key={fine._id} hover>
                        <TableCell>{new Date(fine.imposedDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{fine.reason}</Typography>
                          {fine.description && (
                            <Typography variant="caption" color="text.secondary">{fine.description}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" color="error.main">
                            -{fine.amount?.toLocaleString()} {currency}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={FINE_STATUS_LABELS[fine.status] || fine.status}
                            color={FINE_STATUS_COLORS[fine.status] || "default"}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{fine.imposedBy?.fullName || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="success" variant="outlined">No fines for this period.</Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmployeeDashboardPage;
