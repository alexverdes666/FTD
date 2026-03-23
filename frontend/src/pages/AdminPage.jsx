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
  People as UsersIcon,
  Announcement as AnnouncementsIcon,
  SupportAgent as TicketsIcon,
} from "@mui/icons-material";

const UsersPage = lazy(() => import("./UsersPage.jsx"));
const AnnouncementsPage = lazy(() => import("./AnnouncementsPage.jsx"));
const TicketsPage = lazy(() => import("./TicketsPage.jsx"));

const tabFallback = (
  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 6 }}>
    <CircularProgress size={28} />
  </Box>
);

const tabs = [
  { label: "Users", icon: <UsersIcon sx={{ fontSize: 16 }} /> },
  { label: "Announcements", icon: <AnnouncementsIcon sx={{ fontSize: 16 }} /> },
  { label: "Tickets", icon: <TicketsIcon sx={{ fontSize: 16 }} /> },
];

const AdminPage = () => {
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
          {tab === 0 && <UsersPage />}
          {tab === 1 && <AnnouncementsPage />}
          {tab === 2 && <TicketsPage />}
        </Suspense>
      </Box>
    </Box>
  );
};

export default AdminPage;
