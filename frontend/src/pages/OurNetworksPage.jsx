import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Alert,
  Collapse,
  Switch,
  FormControlLabel,
  Tooltip,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  OpenInNew as OpenInNewIcon,
  PlayArrow as PlayArrowIcon,
  AccountBalanceWallet as WalletIcon,
  TrendingUp as TrendingUpIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  FlashOn as FlashOnIcon,
  Rocket as RocketIcon,
} from "@mui/icons-material";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import NetworkBlockchainControl from "../components/NetworkBlockchainControl";
import TransactionHistoryModal from "../components/TransactionHistoryModal";
import AllNetworksScraperButton from "../components/AllNetworksScraperButton";
import blockchainService from "../services/blockchain";
import MonthYearSelector from "../components/common/MonthYearSelector";
import dayjs from "dayjs";

const ourNetworkSchema = yup.object({
  name: yup
    .string()
    .required("Name is required")
    .max(100, "Name must be less than 100 characters"),
  description: yup
    .string()
    .max(500, "Description must be less than 500 characters"),
  assignedAffiliateManager: yup.string().optional(),
  cryptoWallets: yup.object({
    ethereum: yup
      .array()
      .of(
        yup
          .string()
          .test(
            "ethereum-format",
            "Invalid Ethereum wallet address format",
            function (value) {
              return !value || /^0x[a-fA-F0-9]{40}$/.test(value);
            }
          )
      )
      .optional()
      .default([]),
    bitcoin: yup
      .array()
      .of(
        yup
          .string()
          .test(
            "bitcoin-format",
            "Invalid Bitcoin wallet address format",
            function (value) {
              return (
                !value ||
                /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(value)
              );
            }
          )
      )
      .optional()
      .default([]),
    tron: yup
      .array()
      .of(
        yup
          .string()
          .test(
            "tron-format",
            "Invalid TRON wallet address format",
            function (value) {
              return !value || /^T[A-Za-z1-9]{33}$/.test(value);
            }
          )
      )
      .optional()
      .default([]),
  }),
});

const OurNetworksPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const user = useSelector(selectUser);

  const [ourNetworks, setOurNetworks] = useState([]);
  const [affiliateManagers, setAffiliateManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState(null);
  const [viewingNetwork, setViewingNetwork] = useState(null);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [notification, setNotification] = useState({
    message: "",
    severity: "info",
  });
  
  // Scraper state management
  const [scrapingNetworks, setScrapingNetworks] = useState(new Set());
  const [scraperNotifications, setScraperNotifications] = useState({});
  
  // Network summaries state
  const [networkSummaries, setNetworkSummaries] = useState({});
  const [summariesLoading, setSummariesLoading] = useState(new Set());
  
  // Transaction history state
  const [transactionHistoryOpen, setTransactionHistoryOpen] = useState(false);
  const [selectedNetworkForHistory, setSelectedNetworkForHistory] = useState(null);
  
  // Month filter state
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [useMonthFilter, setUseMonthFilter] = useState(true);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(ourNetworkSchema),
    defaultValues: {
      name: "",
      description: "",
      assignedAffiliateManager: "",
      cryptoWallets: {
        ethereum: [""],
        bitcoin: [""],
        tron: [""],
      },
    },
  });

  // Field arrays for managing multiple wallet addresses
  const {
    fields: ethereumFields,
    append: appendEthereum,
    remove: removeEthereum,
  } = useFieldArray({
    control,
    name: "cryptoWallets.ethereum",
  });

  const {
    fields: bitcoinFields,
    append: appendBitcoin,
    remove: removeBitcoin,
  } = useFieldArray({
    control,
    name: "cryptoWallets.bitcoin",
  });

  const {
    fields: tronFields,
    append: appendTron,
    remove: removeTron,
  } = useFieldArray({
    control,
    name: "cryptoWallets.tron",
  });

  const fetchOurNetworks = useCallback(async () => {
    try {
      setLoading(true);

      let endpoint = "/our-networks";
      const params = new URLSearchParams();

      if (user?.role === "affiliate_manager") {
        endpoint = "/our-networks/my-networks";
      } else {
        params.append("page", page + 1);
        params.append("limit", rowsPerPage);
        if (searchTerm) params.append("search", searchTerm);
        if (showActiveOnly) params.append("isActive", "true");
      }

      const url =
        user?.role === "affiliate_manager" ? endpoint : `${endpoint}?${params}`;
      const response = await api.get(url);

      if (user?.role === "affiliate_manager") {
        // For affiliate managers, apply search and filter on frontend
        let filteredNetworks = response.data.data || [];

        // Apply search filter
        if (searchTerm) {
          filteredNetworks = filteredNetworks.filter(
            (network) =>
              network.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (network.description &&
                network.description
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase()))
          );
        }

        // Apply active filter (though backend already returns only active networks)
        if (showActiveOnly) {
          filteredNetworks = filteredNetworks.filter(
            (network) => network.isActive
          );
        }

        setOurNetworks(filteredNetworks);
        setTotalCount(filteredNetworks.length);
      } else {
        setOurNetworks(response.data.data);
        setTotalCount(response.data.pagination.total);
      }
    } catch (error) {
      setNotification({
        message:
          error.response?.data?.message || "Failed to fetch our networks",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, showActiveOnly, user?.role]);

  const fetchNetworkSummary = useCallback(async (networkId) => {
    try {
      setSummariesLoading(prev => new Set([...prev, networkId]));
      
      let response;
      if (useMonthFilter) {
        response = await blockchainService.getNetworkSummary(
          networkId, 
          0, // days not used when month filter is active
          selectedMonth.month() + 1, // Convert 0-based month to 1-based
          selectedMonth.year()
        );
      } else {
        response = await blockchainService.getNetworkSummary(networkId, 0); // 0 = all time
      }
      
      setNetworkSummaries(prev => ({
        ...prev,
        [networkId]: response.data
      }));
    } catch (error) {
      console.error(`Error fetching network summary for ${networkId}:`, error);
      setNetworkSummaries(prev => ({
        ...prev,
        [networkId]: null
      }));
    } finally {
      setSummariesLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(networkId);
        return newSet;
      });
    }
  }, [useMonthFilter, selectedMonth]);

  const fetchAffiliateManagers = useCallback(async () => {
    // Only admins need to fetch affiliate managers for the form
    if (user?.role !== "admin") return;

    try {
      const response = await api.get("/users?role=affiliate_manager");
      setAffiliateManagers(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch affiliate managers:", error);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchOurNetworks();
  }, [fetchOurNetworks]);

  useEffect(() => {
    fetchAffiliateManagers();
  }, [fetchAffiliateManagers]);

  // Helper function to check if network has wallets
  const hasWallets = useCallback((network) => {
    if (!network.cryptoWallets) return false;
    
    const getWalletArray = (wallet) => {
      if (Array.isArray(wallet)) return wallet.filter(addr => addr && addr.trim() !== "");
      return wallet ? [wallet] : [];
    };

    const ethereumWallets = getWalletArray(network.cryptoWallets.ethereum);
    const bitcoinWallets = getWalletArray(network.cryptoWallets.bitcoin);
    const tronWallets = getWalletArray(network.cryptoWallets.tron);

    return ethereumWallets.length > 0 || bitcoinWallets.length > 0 || tronWallets.length > 0;
  }, []);

  // Fetch network summaries when networks are loaded
  useEffect(() => {
    if (ourNetworks.length > 0) {
      ourNetworks.forEach(network => {
        if (hasWallets(network)) {
          fetchNetworkSummary(network._id);
        }
      });
    }
  }, [ourNetworks, fetchNetworkSummary, hasWallets]);

  // Auto-refresh summaries when month filter changes
  useEffect(() => {
    if (ourNetworks.length > 0 && useMonthFilter) {
      ourNetworks.forEach(network => {
        if (hasWallets(network)) {
          fetchNetworkSummary(network._id);
        }
      });
    }
  }, [useMonthFilter, selectedMonth, ourNetworks, fetchNetworkSummary, hasWallets]);

  const handleOpenDialog = (network = null) => {
    setEditingNetwork(network);
    if (network) {
      // Convert single addresses to arrays for backward compatibility
      const convertToArray = (value) => {
        if (Array.isArray(value)) return value.length > 0 ? value : [""];
        return value ? [value] : [""];
      };
      
      reset({
        name: network.name,
        description: network.description || "",
        assignedAffiliateManager: network.assignedAffiliateManager?._id || "",
        cryptoWallets: {
          ethereum: convertToArray(network.cryptoWallets?.ethereum),
          bitcoin: convertToArray(network.cryptoWallets?.bitcoin),
          tron: convertToArray(network.cryptoWallets?.tron),
        },
      });
    } else {
      reset({
        name: "",
        description: "",
        assignedAffiliateManager: "",
        cryptoWallets: {
          ethereum: [""],
          bitcoin: [""],
          tron: [""],
        },
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingNetwork(null);
    reset();
  };

  const handleViewNetwork = (network) => {
    setViewingNetwork(network);
    setOpenViewDialog(true);
  };

  const handleViewTransactionHistory = (network) => {
    setSelectedNetworkForHistory(network);
    setTransactionHistoryOpen(true);
  };

  const handleCloseTransactionHistory = () => {
    setTransactionHistoryOpen(false);
    setSelectedNetworkForHistory(null);
  };

  const onSubmit = async (data) => {
    try {
      // Clean up the data by removing empty addresses
      const cleanedData = {
        ...data,
        cryptoWallets: {
          ethereum: data.cryptoWallets.ethereum.filter(addr => addr && addr.trim() !== ""),
          bitcoin: data.cryptoWallets.bitcoin.filter(addr => addr && addr.trim() !== ""),
          tron: data.cryptoWallets.tron.filter(addr => addr && addr.trim() !== ""),
        },
      };

      if (editingNetwork) {
        await api.put(`/our-networks/${editingNetwork._id}`, cleanedData);
        setNotification({
          message: "Our network updated successfully!",
          severity: "success",
        });
      } else {
        await api.post("/our-networks", cleanedData);
        setNotification({
          message: "Our network created successfully!",
          severity: "success",
        });
      }
      handleCloseDialog();
      fetchOurNetworks();
    } catch (error) {
      setNotification({
        message: error.response?.data?.message || "Failed to save our network",
        severity: "error",
      });
    }
  };

  const handleDelete = async (networkId) => {
    if (!window.confirm("Are you sure you want to delete this our network?")) {
      return;
    }

    try {
      await api.delete(`/our-networks/${networkId}`);
      setNotification({
        message: "Our network deleted successfully!",
        severity: "success",
      });
      fetchOurNetworks();
    } catch (error) {
      setNotification({
        message:
          error.response?.data?.message || "Failed to delete our network",
        severity: "error",
      });
    }
  };

  const handleToggleActive = async (network) => {
    try {
      await api.put(`/our-networks/${network._id}`, {
        isActive: !network.isActive,
      });
      setNotification({
        message: `Our network ${
          !network.isActive ? "activated" : "deactivated"
        } successfully!`,
        severity: "success",
      });
      fetchOurNetworks();
    } catch (error) {
      setNotification({
        message:
          error.response?.data?.message ||
          "Failed to update our network status",
        severity: "error",
      });
    }
  };

  const handleRunScrapers = async (network) => {
    const networkId = network._id;
    
    // Check if network has crypto wallets using our helper function
    if (!hasWallets(network)) {
      setNotification({
        message: `Network "${network.name}" has no crypto wallets configured.`,
        severity: "warning",
      });
      return;
    }

    // Add network to scraping set
    setScrapingNetworks(prev => new Set([...prev, networkId]));
    
    // Clear previous notifications for this network
    setScraperNotifications(prev => ({
      ...prev,
      [networkId]: null
    }));

    try {
      const response = await blockchainService.triggerNetworkScrapers(networkId);
      const { newTransactions, totalUsdValue } = response.data.summary;
      const valueText = totalUsdValue ? ` with total value $${totalUsdValue.toFixed(2)}` : '';
      
      setScraperNotifications(prev => ({
        ...prev,
        [networkId]: {
          message: `Scrapers completed for "${network.name}"! Found ${newTransactions} new transactions${valueText}.`,
          severity: "success"
        }
      }));
      
      // Auto-clear scraper notification after 10 seconds
      setTimeout(() => {
        setScraperNotifications(prev => ({
          ...prev,
          [networkId]: null
        }));
      }, 10000);
      
      // Show global notification too
      setNotification({
        message: `Scrapers completed for "${network.name}"! Found ${newTransactions} new transactions${valueText}.`,
        severity: "success",
      });
      
      // Refresh network summary to update total value
      fetchNetworkSummary(networkId);
      
    } catch (error) {
      console.error('Error triggering network scrapers:', error);
      
      setScraperNotifications(prev => ({
        ...prev,
        [networkId]: {
          message: error.response?.data?.message || `Failed to run scrapers for "${network.name}"`,
          severity: "error"
        }
      }));
      
      // Auto-clear scraper notification after 10 seconds
      setTimeout(() => {
        setScraperNotifications(prev => ({
          ...prev,
          [networkId]: null
        }));
      }, 10000);
      
      setNotification({
        message: error.response?.data?.message || `Failed to run scrapers for "${network.name}"`,
        severity: "error",
      });
    } finally {
      // Remove network from scraping set
      setScrapingNetworks(prev => {
        const newSet = new Set(prev);
        newSet.delete(networkId);
        return newSet;
      });
    }
  };

  if (user?.role !== "admin" && user?.role !== "affiliate_manager") {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Only admins and affiliate managers can view our
          networks.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1" fontWeight="bold">
          {user?.role === "admin" ? "Our Networks" : "My Assigned Networks"}
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          {/* Run All Scrapers Button */}
          <AllNetworksScraperButton 
            variant="contained" 
            size="medium"
            onComplete={fetchOurNetworks}
          />
          
          {/* Add Network Button (Admin only) */}
          {user?.role === "admin" && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ minWidth: isMobile ? "auto" : "200px" }}
            >
              {isMobile ? "Add" : "Add Our Network"}
            </Button>
          )}
        </Box>
      </Box>



      <Collapse in={!!notification.message}>
        <Alert
          severity={notification.severity}
          onClose={() => setNotification({ message: "", severity: "info" })}
          sx={{ mb: 2 }}
        >
          {notification.message}
        </Alert>
      </Collapse>

      {/* Scraper Notifications */}
      {Object.entries(scraperNotifications).map(([networkId, notif]) => (
        notif && (
          <Alert
            key={networkId}
            severity={notif.severity}
            onClose={() => setScraperNotifications(prev => ({ ...prev, [networkId]: null }))}
            sx={{ mb: 1 }}
          >
            {notif.message}
          </Alert>
        )
      ))}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <TextField
            label={
              user?.role === "admin"
                ? "Search our networks"
                : "Search my networks"
            }
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: isMobile ? "100%" : "300px" }}
          />
          {user?.role === "admin" && (
            <FormControlLabel
              control={
                <Switch
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                />
              }
              label="Show active only"
            />
          )}
          <Button
            variant="outlined"
            onClick={fetchOurNetworks}
            disabled={loading}
          >
            Search
          </Button>
        </Box>
        
        {/* Month Filter Section */}
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={useMonthFilter}
                  onChange={(e) => setUseMonthFilter(e.target.checked)}
                />
              }
              label="Filter by Month"
            />
            
            {useMonthFilter && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <MonthYearSelector
                  selectedDate={selectedMonth}
                  onDateChange={setSelectedMonth}
                  label="Filter Month & Year"
                  showCurrentSelection={false}
                  size="small"
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => {
                    // Refresh all network summaries with the new month filter
                    ourNetworks.forEach(network => {
                      if (hasWallets(network)) {
                        fetchNetworkSummary(network._id);
                      }
                    });
                  }}
                  disabled={summariesLoading.size > 0}
                >
                  Apply Filter
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Assigned Managers</TableCell>
              <TableCell>Crypto Wallets</TableCell>
              <TableCell>
                Total Value
                {useMonthFilter && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    {selectedMonth.format('MMMM YYYY')}
                  </Typography>
                )}
              </TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">
                {user?.role === "admin" ? "Actions" : "View"}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : ourNetworks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  {user?.role === "admin"
                    ? "No our networks found"
                    : "No assigned networks found"}
                </TableCell>
              </TableRow>
            ) : (
              ourNetworks.map((network) => (
                <TableRow key={network._id} hover>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="medium">
                      {network.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {network.description || "No description"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {network.assignedAffiliateManager ? (
                      <Chip
                        label={network.assignedAffiliateManager.fullName}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No manager assigned
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        minWidth: 200,
                      }}
                    >
                      {/* Helper function to get wallet addresses as array */}
                      {(() => {
                        const getWalletArray = (wallet) => {
                          if (Array.isArray(wallet)) return wallet.filter(addr => addr && addr.trim() !== "");
                          return wallet ? [wallet] : [];
                        };

                        // Get wallet arrays
                        const ethereumWallets = getWalletArray(network.cryptoWallets?.ethereum);
                        const bitcoinWallets = getWalletArray(network.cryptoWallets?.bitcoin);
                        const tronWallets = getWalletArray(network.cryptoWallets?.tron);

                        const hasAnyWallets = ethereumWallets.length > 0 || bitcoinWallets.length > 0 || tronWallets.length > 0;

                        // Get network summary for wallet balances
                        const summary = networkSummaries[network._id];
                        const getWalletBalance = (blockchain, address) => {
                          if (!summary?.breakdown?.[blockchain]?.wallets) return null;
                          const walletData = summary.breakdown[blockchain].wallets.find(w => w.address === address);
                          return walletData?.totalUsdValue || 0;
                        };

                        return (
                          <>
                            {/* Ethereum Wallets */}
                            {ethereumWallets.map((address, index) => {
                              const balance = getWalletBalance('ethereum', address);
                              return (
                                <Box
                                  key={`eth-${index}`}
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    p: 0.5,
                                    borderRadius: 1,
                                    backgroundColor: "primary.50",
                                    border: 1,
                                    borderColor: "primary.200",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    '&:hover': {
                                      backgroundColor: "primary.100",
                                      borderColor: "primary.300",
                                      transform: "translateY(-1px)",
                                      boxShadow: "0 2px 8px rgba(33, 150, 243, 0.2)",
                                    },
                                  }}
                                >
                                  <WalletIcon sx={{ color: "primary.main", fontSize: 16 }} />
                                  <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                                    <Typography variant="caption" color="primary.main" fontWeight="bold">
                                      ETH{ethereumWallets.length > 1 ? ` ${index + 1}` : ''}:
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                                      {address.slice(0, 6)}...{address.slice(-4)}
                                    </Typography>
                                    {balance !== null && (
                                      <Typography variant="caption" color="success.main" fontWeight="bold">
                                        ${balance.toFixed(2)}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Button
                                    size="small"
                                    variant="text"
                                    sx={{ minWidth: "auto", p: 0.5 }}
                                    onClick={() =>
                                      window.open(
                                        `https://etherscan.io/address/${address}#tokentxns`,
                                        "_blank"
                                      )
                                    }
                                  >
                                    <OpenInNewIcon fontSize="small" />
                                  </Button>
                                </Box>
                              );
                            })}

                            {/* Bitcoin Wallets */}
                            {bitcoinWallets.map((address, index) => {
                              const balance = getWalletBalance('bitcoin', address);
                              return (
                                <Box
                                  key={`btc-${index}`}
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    p: 0.5,
                                    borderRadius: 1,
                                    backgroundColor: "orange.50",
                                    border: 1,
                                    borderColor: "orange.200",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    '&:hover': {
                                      backgroundColor: "orange.100",
                                      borderColor: "orange.300",
                                      transform: "translateY(-1px)",
                                      boxShadow: "0 2px 8px rgba(255, 152, 0, 0.2)",
                                    },
                                  }}
                                >
                                  <WalletIcon sx={{ color: "orange.main", fontSize: 16 }} />
                                  <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                                    <Typography variant="caption" color="orange.main" fontWeight="bold">
                                      BTC{bitcoinWallets.length > 1 ? ` ${index + 1}` : ''}:
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                                      {address.slice(0, 6)}...{address.slice(-4)}
                                    </Typography>
                                    {balance !== null && (
                                      <Typography variant="caption" color="success.main" fontWeight="bold">
                                        ${balance.toFixed(2)}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Button
                                    size="small"
                                    variant="text"
                                    sx={{ minWidth: "auto", p: 0.5 }}
                                    onClick={() =>
                                      window.open(
                                        `https://www.blockchain.com/explorer/addresses/btc/${address}`,
                                        "_blank"
                                      )
                                    }
                                  >
                                    <OpenInNewIcon fontSize="small" />
                                  </Button>
                                </Box>
                              );
                            })}

                            {/* TRON Wallets */}
                            {tronWallets.map((address, index) => {
                              const balance = getWalletBalance('tron', address);
                              return (
                                <Box
                                  key={`trx-${index}`}
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    p: 0.5,
                                    borderRadius: 1,
                                    backgroundColor: "purple.50",
                                    border: 1,
                                    borderColor: "purple.200",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    '&:hover': {
                                      backgroundColor: "purple.100",
                                      borderColor: "purple.300",
                                      transform: "translateY(-1px)",
                                      boxShadow: "0 2px 8px rgba(156, 39, 176, 0.2)",
                                    },
                                  }}
                                >
                                  <WalletIcon sx={{ color: "purple.main", fontSize: 16 }} />
                                  <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                                    <Typography variant="caption" color="purple.main" fontWeight="bold">
                                      TRX{tronWallets.length > 1 ? ` ${index + 1}` : ''}:
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                                      {address.slice(0, 6)}...{address.slice(-4)}
                                    </Typography>
                                    {balance !== null && (
                                      <Typography variant="caption" color="success.main" fontWeight="bold">
                                        ${balance.toFixed(2)}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Button
                                    size="small"
                                    variant="text"
                                    sx={{ minWidth: "auto", p: 0.5 }}
                                    onClick={() =>
                                      window.open(
                                        `https://tronscan.org/#/address/${address}/transfers`,
                                        "_blank"
                                      )
                                    }
                                  >
                                    <OpenInNewIcon fontSize="small" />
                                  </Button>
                                </Box>
                              );
                            })}

                            {/* No wallets message */}
                            {!hasAnyWallets && (
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  p: 0.5,
                                  borderRadius: 1,
                                  backgroundColor: "grey.50",
                                  border: 1,
                                  borderColor: "grey.200",
                                }}
                              >
                                <WalletIcon sx={{ color: "grey.400", fontSize: 16 }} />
                                <Typography variant="caption" color="text.secondary">
                                  No wallets configured
                                </Typography>
                              </Box>
                            )}
                          </>
                        );
                      })()}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const summary = networkSummaries[network._id];
                      const isLoading = summariesLoading.has(network._id);
                      const networkHasWallets = hasWallets(network);
                      
                      if (!networkHasWallets) {
                        return (
                          <Typography variant="body2" color="text.secondary">
                            No wallets
                          </Typography>
                        );
                      }
                      
                      if (isLoading) {
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={16} />
                            <Typography variant="body2" color="text.secondary">
                              Loading...
                            </Typography>
                          </Box>
                        );
                      }
                      
                      if (summary && summary.totalUsdValue !== undefined) {
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TrendingUpIcon sx={{ color: 'success.main', fontSize: 16 }} />
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              ${summary.totalUsdValue.toFixed(2)}
                            </Typography>
                          </Box>
                        );
                      }
                      
                      return (
                        <Typography variant="body2" color="text.secondary">
                          $0.00
                        </Typography>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={network.isActive ? "Active" : "Inactive"}
                      color={network.isActive ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(network.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewNetwork(network)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      
                      {/* Transaction History Button */}
                      <Tooltip title={
                        !hasWallets(network)
                          ? "No crypto wallets configured"
                          : "View Transaction History"
                      }>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleViewTransactionHistory(network)}
                            disabled={!hasWallets(network)}
                            color="primary"
                          >
                            <TimelineIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      
                      {/* Run Scrapers Button */}
                      <Tooltip title={
                        !hasWallets(network)
                          ? "No crypto wallets configured"
                          : scrapingNetworks.has(network._id)
                          ? "Scraping in progress..."
                          : "Run Blockchain Scrapers"
                      }>
                        <span>
                          <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleRunScrapers(network)}
                          disabled={
                            scrapingNetworks.has(network._id) ||
                            !hasWallets(network)
                          }
                          sx={{
                            minWidth: 'auto',
                            px: 1.5,
                            py: 0.5,
                            background: scrapingNetworks.has(network._id) 
                              ? 'linear-gradient(45deg, #FF6B6B 30%, #4ECDC4 90%)'
                              : 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                            boxShadow: scrapingNetworks.has(network._id)
                              ? '0 3px 5px 2px rgba(255, 107, 107, .3)'
                              : '0 3px 5px 2px rgba(33, 150, 243, .3)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              background: scrapingNetworks.has(network._id)
                                ? 'linear-gradient(45deg, #FF6B6B 30%, #4ECDC4 90%)'
                                : 'linear-gradient(45deg, #1976D2 30%, #1CB5E0 90%)',
                              transform: 'translateY(-2px)',
                              boxShadow: scrapingNetworks.has(network._id)
                                ? '0 6px 10px 4px rgba(255, 107, 107, .3)'
                                : '0 6px 10px 4px rgba(33, 150, 243, .3)',
                            },
                            '&:disabled': {
                              background: 'linear-gradient(45deg, #BDBDBD 30%, #E0E0E0 90%)',
                              color: 'rgba(0, 0, 0, 0.26)',
                              boxShadow: 'none',
                            },
                          }}
                        >
                          {scrapingNetworks.has(network._id) ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CircularProgress size={16} color="inherit" />
                              <SpeedIcon sx={{ fontSize: 16 }} />
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <RocketIcon sx={{ fontSize: 16 }} />
                              <FlashOnIcon sx={{ fontSize: 14 }} />
                            </Box>
                          )}
                        </Button>
                        </span>
                      </Tooltip>
                      
                      {user?.role === "admin" && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(network)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip
                            title={network.isActive ? "Deactivate" : "Activate"}
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleToggleActive(network)}
                            >
                              <Switch checked={network.isActive} size="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(network._id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {user?.role === "admin" && (
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      )}

      {/* Add/Edit Dialog */}
      {user?.role === "admin" && (
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {editingNetwork ? "Edit Our Network" : "Add Our Network"}
          </DialogTitle>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogContent>
              <Box
                sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
              >
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Name"
                      fullWidth
                      error={!!errors.name}
                      helperText={errors.name?.message}
                    />
                  )}
                />
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Description"
                      fullWidth
                      multiline
                      rows={3}
                      error={!!errors.description}
                      helperText={errors.description?.message}
                    />
                  )}
                />
                <Controller
                  name="assignedAffiliateManager"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Assigned Affiliate Manager</InputLabel>
                      <Select
                        {...field}
                        input={
                          <OutlinedInput label="Assigned Affiliate Manager" />
                        }
                      >
                        <MenuItem value="">
                          <em>No manager assigned</em>
                        </MenuItem>
                        {affiliateManagers.map((manager) => (
                          <MenuItem key={manager._id} value={manager._id}>
                            <Box>
                              <Typography variant="body2">
                                {manager.fullName}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {manager.email}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                <Box sx={{ mt: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Crypto Wallets
                  </Typography>
                  
                  {/* Ethereum Wallets */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography variant="subtitle2" color="primary.main" fontWeight="bold">
                        Ethereum Wallets
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => appendEthereum("")}
                        startIcon={<AddIcon />}
                        variant="outlined"
                        sx={{ minWidth: "auto" }}
                      >
                        Add
                      </Button>
                    </Box>
                    {ethereumFields.map((field, index) => (
                      <Box key={field.id} sx={{ display: "flex", gap: 1, mb: 1 }}>
                        <Controller
                          name={`cryptoWallets.ethereum.${index}`}
                          control={control}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              label={`Ethereum Address ${index + 1}`}
                              fullWidth
                              placeholder="0x..."
                              error={!!errors.cryptoWallets?.ethereum?.[index]}
                              helperText={errors.cryptoWallets?.ethereum?.[index]?.message}
                              size="small"
                            />
                          )}
                        />
                        <IconButton
                          onClick={() => removeEthereum(index)}
                          disabled={ethereumFields.length === 1}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>

                  {/* Bitcoin Wallets */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography variant="subtitle2" color="orange.main" fontWeight="bold">
                        Bitcoin Wallets
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => appendBitcoin("")}
                        startIcon={<AddIcon />}
                        variant="outlined"
                        sx={{ minWidth: "auto" }}
                      >
                        Add
                      </Button>
                    </Box>
                    {bitcoinFields.map((field, index) => (
                      <Box key={field.id} sx={{ display: "flex", gap: 1, mb: 1 }}>
                        <Controller
                          name={`cryptoWallets.bitcoin.${index}`}
                          control={control}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              label={`Bitcoin Address ${index + 1}`}
                              fullWidth
                              placeholder="bc1... or 1... or 3..."
                              error={!!errors.cryptoWallets?.bitcoin?.[index]}
                              helperText={errors.cryptoWallets?.bitcoin?.[index]?.message}
                              size="small"
                            />
                          )}
                        />
                        <IconButton
                          onClick={() => removeBitcoin(index)}
                          disabled={bitcoinFields.length === 1}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>

                  {/* TRON Wallets */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Typography variant="subtitle2" color="purple.main" fontWeight="bold">
                        TRON Wallets
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => appendTron("")}
                        startIcon={<AddIcon />}
                        variant="outlined"
                        sx={{ minWidth: "auto" }}
                      >
                        Add
                      </Button>
                    </Box>
                    {tronFields.map((field, index) => (
                      <Box key={field.id} sx={{ display: "flex", gap: 1, mb: 1 }}>
                        <Controller
                          name={`cryptoWallets.tron.${index}`}
                          control={control}
                          render={({ field: controllerField }) => (
                            <TextField
                              {...controllerField}
                              label={`TRON Address ${index + 1}`}
                              fullWidth
                              placeholder="T..."
                              error={!!errors.cryptoWallets?.tron?.[index]}
                              helperText={errors.cryptoWallets?.tron?.[index]?.message}
                              size="small"
                            />
                          )}
                        />
                        <IconButton
                          onClick={() => removeTron(index)}
                          disabled={tronFields.length === 1}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                {editingNetwork ? "Update" : "Create"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}

      {/* View Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Our Network Details</DialogTitle>
        <DialogContent>
          {viewingNetwork && (
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
            >
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="body1">{viewingNetwork.name}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body1">
                  {viewingNetwork.description || "No description"}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={viewingNetwork.isActive ? "Active" : "Inactive"}
                  color={viewingNetwork.isActive ? "success" : "default"}
                  size="small"
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Assigned Affiliate Manager
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {viewingNetwork.assignedAffiliateManager ? (
                    <Chip
                      label={viewingNetwork.assignedAffiliateManager.fullName}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No manager assigned
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Crypto Wallets
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    mt: 1,
                  }}
                >
                  {(() => {
                    const getWalletArray = (wallet) => {
                      if (Array.isArray(wallet)) return wallet.filter(addr => addr && addr.trim() !== "");
                      return wallet ? [wallet] : [];
                    };

                    // Get wallet arrays
                    const ethereumWallets = getWalletArray(viewingNetwork.cryptoWallets?.ethereum);
                    const bitcoinWallets = getWalletArray(viewingNetwork.cryptoWallets?.bitcoin);
                    const tronWallets = getWalletArray(viewingNetwork.cryptoWallets?.tron);

                    const hasAnyWallets = ethereumWallets.length > 0 || bitcoinWallets.length > 0 || tronWallets.length > 0;

                    // Get network summary for wallet balances
                    const summary = networkSummaries[viewingNetwork._id];
                    const getWalletBalance = (blockchain, address) => {
                      if (!summary?.breakdown?.[blockchain]?.wallets) return null;
                      return summary.breakdown[blockchain].wallets.find(w => w.address === address);
                    };

                    return (
                      <>
                        {/* Ethereum Wallets */}
                        {ethereumWallets.map((address, index) => {
                          const walletData = getWalletBalance('ethereum', address);
                          return (
                            <Box 
                              key={`eth-${index}`}
                              sx={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: 1,
                                p: 2,
                                borderRadius: 2,
                                backgroundColor: "primary.50",
                                border: 1,
                                borderColor: "primary.200",
                                mb: 1,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                '&:hover': {
                                  backgroundColor: "primary.100",
                                  borderColor: "primary.300",
                                  transform: "translateY(-1px)",
                                  boxShadow: "0 4px 12px rgba(33, 150, 243, 0.2)",
                                },
                              }}
                            >
                              <WalletIcon sx={{ color: "primary.main", fontSize: 24 }} />
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                  <Typography variant="subtitle2" color="primary.main" fontWeight="bold">
                                    Ethereum{ethereumWallets.length > 1 ? ` ${index + 1}` : ''}
                                  </Typography>
                                  {walletData && (
                                    <Chip 
                                      size="small" 
                                      label={`$${walletData.totalUsdValue.toFixed(2)}`}
                                      color="success"
                                      sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all", mb: 1 }}>
                                  {address}
                                </Typography>
                                {walletData && walletData.count > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    {walletData.count} transactions
                                  </Typography>
                                )}
                              </Box>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<OpenInNewIcon />}
                                onClick={() =>
                                  window.open(
                                    `https://etherscan.io/address/${address}#tokentxns`,
                                    "_blank"
                                  )
                                }
                              >
                                View
                              </Button>
                            </Box>
                          );
                        })}

                        {/* Bitcoin Wallets */}
                        {bitcoinWallets.map((address, index) => {
                          const walletData = getWalletBalance('bitcoin', address);
                          return (
                            <Box 
                              key={`btc-${index}`}
                              sx={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: 1,
                                p: 2,
                                borderRadius: 2,
                                backgroundColor: "orange.50",
                                border: 1,
                                borderColor: "orange.200",
                                mb: 1,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                '&:hover': {
                                  backgroundColor: "orange.100",
                                  borderColor: "orange.300",
                                  transform: "translateY(-1px)",
                                  boxShadow: "0 4px 12px rgba(255, 152, 0, 0.2)",
                                },
                              }}
                            >
                              <WalletIcon sx={{ color: "orange.main", fontSize: 24 }} />
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                  <Typography variant="subtitle2" color="orange.main" fontWeight="bold">
                                    Bitcoin{bitcoinWallets.length > 1 ? ` ${index + 1}` : ''}
                                  </Typography>
                                  {walletData && (
                                    <Chip 
                                      size="small" 
                                      label={`$${walletData.totalUsdValue.toFixed(2)}`}
                                      color="success"
                                      sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all", mb: 1 }}>
                                  {address}
                                </Typography>
                                {walletData && walletData.count > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    {walletData.count} transactions
                                  </Typography>
                                )}
                              </Box>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<OpenInNewIcon />}
                                onClick={() =>
                                  window.open(
                                    `https://www.blockchain.com/explorer/addresses/btc/${address}`,
                                    "_blank"
                                  )
                                }
                              >
                                View
                              </Button>
                            </Box>
                          );
                        })}

                        {/* TRON Wallets */}
                        {tronWallets.map((address, index) => {
                          const walletData = getWalletBalance('tron', address);
                          return (
                            <Box 
                              key={`trx-${index}`}
                              sx={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: 1,
                                p: 2,
                                borderRadius: 2,
                                backgroundColor: "purple.50",
                                border: 1,
                                borderColor: "purple.200",
                                mb: 1,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                '&:hover': {
                                  backgroundColor: "purple.100",
                                  borderColor: "purple.300",
                                  transform: "translateY(-1px)",
                                  boxShadow: "0 4px 12px rgba(156, 39, 176, 0.2)",
                                },
                              }}
                            >
                              <WalletIcon sx={{ color: "purple.main", fontSize: 24 }} />
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                  <Typography variant="subtitle2" color="purple.main" fontWeight="bold">
                                    TRON{tronWallets.length > 1 ? ` ${index + 1}` : ''}
                                  </Typography>
                                  {walletData && (
                                    <Chip 
                                      size="small" 
                                      label={`$${walletData.totalUsdValue.toFixed(2)}`}
                                      color="success"
                                      sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all", mb: 1 }}>
                                  {address}
                                </Typography>
                                {walletData && walletData.count > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    {walletData.count} transactions
                                  </Typography>
                                )}
                              </Box>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<OpenInNewIcon />}
                                onClick={() =>
                                  window.open(
                                    `https://tronscan.org/#/address/${address}/transfers`,
                                    "_blank"
                                  )
                                }
                              >
                                View
                              </Button>
                            </Box>
                          );
                        })}

                        {/* No wallets message */}
                        {!hasAnyWallets && (
                          <Box 
                            sx={{ 
                              display: "flex", 
                              alignItems: "center", 
                              gap: 1,
                              p: 2,
                              borderRadius: 2,
                              backgroundColor: "grey.50",
                              border: 1,
                              borderColor: "grey.200",
                              mb: 1
                            }}
                          >
                            <WalletIcon sx={{ color: "grey.400", fontSize: 24 }} />
                            <Typography variant="body2" color="text.secondary">
                              No wallets configured
                            </Typography>
                          </Box>
                        )}
                      </>
                    );
                  })()}
                </Box>
              </Box>
              
              {/* Blockchain Control Component */}
              <Box>
                <NetworkBlockchainControl 
                  network={viewingNetwork} 
                  useMonthFilter={useMonthFilter}
                  selectedMonth={selectedMonth}
                />
              </Box>
              
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Created By
                </Typography>
                <Typography variant="body1">
                  {viewingNetwork.createdBy?.fullName}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Created At
                </Typography>
                <Typography variant="body1">
                  {new Date(viewingNetwork.createdAt).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Transaction History Modal */}
      <TransactionHistoryModal
        open={transactionHistoryOpen}
        onClose={handleCloseTransactionHistory}
        network={selectedNetworkForHistory}
      />
    </Box>
  );
};

export default OurNetworksPage;
