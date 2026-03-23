import React, { lazy, Suspense, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
} from "@mui/material";
import {
  TableChart as TableIcon,
  TrackChanges as TargetIcon,
  ReceiptLong as ExpensesIcon,
  Gavel as FinesIcon,
  AccountBalanceWallet as WithdrawIcon,
  BadgeOutlined as EmployeeIcon,
} from "@mui/icons-material";

const AffiliateManagersPage = lazy(() => import("./AffiliateManagersPage.jsx"));
const AMTargetsPage = lazy(() => import("./AMTargetsPage.jsx"));
const AMExpensesPage = lazy(() => import("./AMExpensesPage.jsx"));
const FinesPage = lazy(() => import("./FinesPage.jsx"));
const WithdrawalsPage = lazy(() => import("./WithdrawalsPage.jsx"));
const EmployeePayManagementPage = lazy(() => import("./EmployeePayManagementPage.jsx"));

const tabFallback = (
  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 6 }}>
    <CircularProgress size={28} />
  </Box>
);

const tabs = [
  { label: "AM Payrolls", icon: <TableIcon sx={{ fontSize: 16 }} /> },
  { label: "Targets", icon: <TargetIcon sx={{ fontSize: 16 }} /> },
  { label: "AM Expenses", icon: <ExpensesIcon sx={{ fontSize: 16 }} /> },
  { label: "Fines", icon: <FinesIcon sx={{ fontSize: 16 }} /> },
  { label: "Withdraw", icon: <WithdrawIcon sx={{ fontSize: 16 }} /> },
  { label: "Employees", icon: <EmployeeIcon sx={{ fontSize: 16 }} /> },
];

const FinancePage = () => {
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab ?? 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Paper sx={{ px: 2, py: 0.5, mb: 1, flexShrink: 0 }}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 36,
            "& .MuiTab-root": { minHeight: 36, py: 0.3, fontSize: "0.8rem", minWidth: "auto", px: 1.5 },
          }}
        >
          {tabs.map((t, i) => (
            <Tab key={i} icon={t.icon} iconPosition="start" label={t.label} />
          ))}
        </Tabs>
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Suspense fallback={tabFallback}>
          {tab === 0 && <AffiliateManagersPage embedded />}
          {tab === 1 && <AMTargetsPage embedded />}
          {tab === 2 && <AMExpensesPage />}
          {tab === 3 && <FinesPage />}
          {tab === 4 && <WithdrawalsPage />}
          {tab === 5 && <EmployeePayManagementPage />}
        </Suspense>
      </Box>
    </Box>
  );
};

export default FinancePage;
