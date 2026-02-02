import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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

const CrmPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");

  // Client Networks state
  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [networksPagination, setNetworksPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 15,
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
    limit: 15,
  });

  const fetchNetworks = useCallback(
    async (page = 1) => {
      try {
        setNetworksLoading(true);
        const response = await api.get("/client-networks", {
          params: { page, limit: 15, search: search || undefined },
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
          params: { page, limit: 15, search: search || undefined },
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
    return networkStats.networkStats?.[networkId]?.dealsCount || 0;
  };

  const getNetworkUnresolvedComments = (networkId) => {
    return networkStats.commentStats?.[networkId] || 0;
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
          Affiliate Managers CRM
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ width: 300 }}
          />
        </Box>
        <Tabs value={tab} onChange={(e, v) => setTab(v)}>
          <Tab icon={<NetworkIcon />} iconPosition="start" label="Client Networks" />
          <Tab icon={<BrokerIcon />} iconPosition="start" label="Client Brokers" />
        </Tabs>
      </Paper>

      {/* Client Networks Tab */}
      {tab === 0 && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Name
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Status
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Employees
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    CRM Deals
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Open Comments
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {networksLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                ) : networks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No client networks found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  networks.map((network) => (
                    <TableRow
                      key={network._id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => navigate(`/client-network/${network._id}`)}
                    >
                      <TableCell>
                        <Typography fontWeight="medium">
                          {network.name}
                        </Typography>
                        {network.description && (
                          <Typography variant="caption" color="text.secondary">
                            {network.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={network.isActive ? "Active" : "Inactive"}
                          color={network.isActive ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {network.employees?.length || 0}
                      </TableCell>
                      <TableCell align="center">
                        {getNetworkDealsCount(network._id)}
                      </TableCell>
                      <TableCell align="center">
                        {getNetworkUnresolvedComments(network._id) > 0 ? (
                          <Chip
                            label={getNetworkUnresolvedComments(network._id)}
                            color="warning"
                            size="small"
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            0
                          </Typography>
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
            />
          )}
        </Paper>
      )}

      {/* Client Brokers Tab */}
      {tab === 1 && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Domain
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Status
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    PSPs
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Total Leads
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {brokersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                ) : brokers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No client brokers found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  brokers.map((broker) => (
                    <TableRow
                      key={broker._id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => navigate(`/client-broker/${broker._id}`)}
                    >
                      <TableCell>
                        <Typography fontWeight="medium">
                          {broker.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {broker.domain && !broker.domain.startsWith("autogen-")
                            ? broker.domain
                            : "-"}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={broker.isActive ? "Active" : "Inactive"}
                          color={broker.isActive ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {broker.psps?.length || 0}
                      </TableCell>
                      <TableCell align="center">
                        {broker.totalLeadsAssigned || 0}
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
            />
          )}
        </Paper>
      )}
    </Box>
  );
};

export default CrmPage;
