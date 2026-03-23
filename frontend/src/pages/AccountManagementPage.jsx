import React from "react";
import {
  Box,
  Alert,
} from "@mui/material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import LinkedAccountsTab from "../components/accountManagement/LinkedAccountsTab";

const AccountManagementPage = () => {
  const user = useSelector(selectUser);

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

  return (
    <Box sx={{ width: "100%" }}>
      <LinkedAccountsTab />
    </Box>
  );
};

export default AccountManagementPage;
