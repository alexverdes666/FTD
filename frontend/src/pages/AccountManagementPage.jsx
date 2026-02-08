import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Alert,
} from "@mui/material";
import {
  Hub as NetworkIcon,
  Business as BrokerIcon,
  Link as LinkIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import ClientNetworksTab from "../components/accountManagement/ClientNetworksTab";
import ClientBrokersTab from "../components/accountManagement/ClientBrokersTab";
import LinkedAccountsTab from "../components/accountManagement/LinkedAccountsTab";

function TabPanel({ children, value, index }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`account-tabpanel-${index}`}
      aria-labelledby={`account-tab-${index}`}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const TAB_NAMES = ["linked", "networks", "brokers"];

const AccountManagementPage = () => {
  const user = useSelector(selectUser);
  const [searchParams, setSearchParams] = useSearchParams();

  // Get tab from URL or default to 0
  const tabParam = searchParams.get("tab");
  const initialTab = TAB_NAMES.indexOf(tabParam) !== -1 ? TAB_NAMES.indexOf(tabParam) : 0;
  const [tabValue, setTabValue] = useState(initialTab);

  // Sync tab value with URL params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const tabIndex = TAB_NAMES.indexOf(tabParam);
    if (tabIndex !== -1 && tabIndex !== tabValue) {
      setTabValue(tabIndex);
    }
  }, [searchParams]);

  // Check access - admin and affiliate_manager can view
  const canAccess = user?.role === "admin" || user?.role === "affiliate_manager";

  if (!canAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You need administrator or affiliate manager privileges to access account management.
        </Alert>
      </Box>
    );
  }

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setSearchParams({ tab: TAB_NAMES[newValue] });
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": {
              minHeight: 64,
              textTransform: "none",
              fontSize: "1rem",
            },
          }}
        >
          <Tab
            icon={<LinkIcon />}
            iconPosition="start"
            label="Linked Accounts"
          />
          <Tab
            icon={<NetworkIcon />}
            iconPosition="start"
            label="Client Networks"
          />
          <Tab
            icon={<BrokerIcon />}
            iconPosition="start"
            label="Client Brokers"
          />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <LinkedAccountsTab />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <ClientNetworksTab />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        <ClientBrokersTab />
      </TabPanel>
    </Box>
  );
};

export default AccountManagementPage;
