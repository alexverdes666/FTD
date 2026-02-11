import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  Search as SearchIcon,
  Hub as NetworkIcon,
  Business as BrokerIcon,
} from "@mui/icons-material";
import api from "../services/api";
import toast from "react-hot-toast";

const compactTableSx = {
  tableLayout: "fixed",
  "& .MuiTableHead-root .MuiTableCell-head": {
    background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.65rem",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    borderBottom: "2px solid #3b82f6",
    py: 0.4,
    px: 1,
    lineHeight: 1.1,
  },
  "& .MuiTableBody-root .MuiTableCell-root": {
    py: 0.25,
    px: 1,
    fontSize: "0.78rem",
    lineHeight: 1.3,
  },
  "& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)": {
    bgcolor: "rgba(0, 0, 0, 0.015)",
  },
  "& .MuiTableBody-root .MuiTableRow-root:hover": {
    bgcolor: "rgba(25, 118, 210, 0.06) !important",
    transition: "background-color 0.15s ease",
  },
  "& .MuiChip-root": {
    height: "18px",
    fontSize: "0.65rem",
  },
};

const CrmPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab ?? 0);
  const [search, setSearch] = useState("");

  // Client Networks state
  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [networksPagination, setNetworksPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 50,
  });
  const [networkStats, setNetworkStats] = useState({
    networkStats: {},
    commentStats: {},
  });

  // Client Brokers state
  const [brokers, setBrokers] = useState([]);
  const [brokersLoading, setBrokersLoading] = useState(false);
  const [brokersPagination, setBrokersPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 50,
  });

  const fetchNetworks = useCallback(
    async (page = 1) => {
      try {
        setNetworksLoading(true);
        const response = await api.get("/client-networks", {
          params: { page, limit: 50, search: search || undefined },
        });
        setNetworks(response.data.data);
        setNetworksPagination(response.data.pagination);
      } catch (error) {
        toast.error("Failed to load client networks");
      } finally {
        setNetworksLoading(false);
      }
    },
    [search]
  );

  const fetchNetworkStats = useCallback(async () => {
    try {
      const response = await api.get("/crm-deals/dashboard-stats");
      setNetworkStats(response.data.data);
    } catch (error) {
      console.error("Failed to load CRM stats", error);
    }
  }, []);

  const fetchBrokers = useCallback(
    async (page = 1) => {
      try {
        setBrokersLoading(true);
        const response = await api.get("/client-brokers", {
          params: { page, limit: 50, search: search || undefined },
        });
        setBrokers(response.data.data);
        setBrokersPagination({
          current: response.data.pagination.page,
          pages: response.data.pagination.pages,
          total: response.data.pagination.total,
          limit: response.data.pagination.limit,
        });
      } catch (error) {
        toast.error("Failed to load client brokers");
      } finally {
        setBrokersLoading(false);
      }
    },
    [search]
  );

  useEffect(() => {
    if (tab === 0) {
      fetchNetworks();
      fetchNetworkStats();
    } else {
      fetchBrokers();
      fetchNetworkStats();
    }
  }, [tab, fetchNetworks, fetchBrokers, fetchNetworkStats]);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      if (tab === 0) {
        fetchNetworks(1);
        fetchNetworkStats();
      } else {
        fetchBrokers(1);
      }
    }
  };

  const getNetworkDealsCount = (networkId) => {
    return networkStats.networkStats?.[networkId]?.ordersCount || 0;
  };

  const getNetworkUnresolvedComments = (networkId) => {
    return networkStats.commentStats?.[networkId] || 0;
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Paper sx={{ px: 2, py: 0.5, mb: 1, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.3, fontSize: "0.8rem" } }}>
            <Tab icon={<NetworkIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Client Networks" />
            <Tab icon={<BrokerIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Client Brokers" />
          </Tabs>
          <TextField
            size="small"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16 }} />
                </InputAdornment>
              ),
            }}
            sx={{ width: 220, "& .MuiInputBase-root": { height: 30, fontSize: "0.8rem" } }}
          />
        </Box>
      </Paper>

      {/* Client Networks Tab */}
      {tab === 0 && (
        <Paper sx={{ borderRadius: 2, border: 1, borderColor: "divider", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <TableContainer sx={{ flex: 1, overflow: "auto" }}>
            <Table size="small" stickyHeader sx={compactTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: "30%" }}>Name</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "10%" }}>Status</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "12%" }}>Deal Type</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "12%" }}>Employees</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "14%" }}>CRM Deals</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "14%" }}>Open Comments</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {networksLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={22} />
                    </TableCell>
                  </TableRow>
                ) : networks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography variant="caption" color="text.secondary">
                        No client networks found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  networks.map((network) => (
                    <TableRow
                      key={network._id}
                      hover
                      sx={{ cursor: "pointer", height: 32 }}
                      onClick={() => navigate(`/client-network/${network._id}`)}
                    >
                      <TableCell>
                        <Typography noWrap sx={{ fontWeight: 500, fontSize: "0.78rem" }}>
                          {network.name}
                        </Typography>
                        {network.description && (
                          <Typography noWrap sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                            {network.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        <Chip
                          label={network.isActive ? "Active" : "Inactive"}
                          color={network.isActive ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        {network.dealType ? (
                          <Chip
                            label={network.dealType === "both" ? "Both" : network.dealType === "buy" ? "Buy" : "Sell"}
                            color={network.dealType === "buy" ? "success" : network.dealType === "sell" ? "error" : "info"}
                            size="small"
                            variant="outlined"
                          />
                        ) : (
                          <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>-</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        {network.employees?.length || 0}
                      </TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        {getNetworkDealsCount(network._id)}
                      </TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        {getNetworkUnresolvedComments(network._id) > 0 ? (
                          <Chip
                            label={getNetworkUnresolvedComments(network._id)}
                            color="warning"
                            size="small"
                          />
                        ) : (
                          <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>0</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {networksPagination.total > 0 && (
            <TablePagination
              component="div"
              count={networksPagination.total}
              page={networksPagination.current - 1}
              onPageChange={(e, p) => fetchNetworks(p + 1)}
              rowsPerPage={networksPagination.limit}
              rowsPerPageOptions={[networksPagination.limit]}
              sx={{ flexShrink: 0, borderTop: 1, borderColor: "divider", "& .MuiTablePagination-toolbar": { minHeight: 36 }, "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.75rem" } }}
            />
          )}
        </Paper>
      )}

      {/* Client Brokers Tab */}
      {tab === 1 && (
        <Paper sx={{ borderRadius: 2, border: 1, borderColor: "divider", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <TableContainer sx={{ flex: 1, overflow: "auto" }}>
            <Table size="small" stickyHeader sx={compactTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: "30%" }}>Name</TableCell>
                  <TableCell sx={{ width: "25%" }}>Domain</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "15%" }}>Status</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "15%" }}>PSPs</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "15%" }}>Total Leads</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {brokersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={22} />
                    </TableCell>
                  </TableRow>
                ) : brokers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      <Typography variant="caption" color="text.secondary">
                        No client brokers found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  brokers.map((broker) => (
                    <TableRow
                      key={broker._id}
                      hover
                      sx={{ cursor: "pointer", height: 32 }}
                      onClick={() => navigate(`/client-broker/${broker._id}`)}
                    >
                      <TableCell>
                        <Typography noWrap sx={{ fontWeight: 500, fontSize: "0.78rem" }}>
                          {broker.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography noWrap sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                          {broker.domain && !broker.domain.startsWith("autogen-")
                            ? broker.domain
                            : "-"}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        <Chip
                          label={broker.isActive ? "Active" : "Inactive"}
                          color={broker.isActive ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        {broker.psps?.length || 0}
                      </TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        {networkStats.brokerStats?.[broker._id]?.totalLeads || 0}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {brokersPagination.total > 0 && (
            <TablePagination
              component="div"
              count={brokersPagination.total}
              page={brokersPagination.current - 1}
              onPageChange={(e, p) => fetchBrokers(p + 1)}
              rowsPerPage={brokersPagination.limit}
              rowsPerPageOptions={[brokersPagination.limit]}
              sx={{ flexShrink: 0, borderTop: 1, borderColor: "divider", "& .MuiTablePagination-toolbar": { minHeight: 36 }, "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.75rem" } }}
            />
          )}
        </Paper>
      )}
    </Box>
  );
};

export default CrmPage;
