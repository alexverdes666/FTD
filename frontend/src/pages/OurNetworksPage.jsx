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
  Snackbar,
  Slide,
  SvgIcon,
  Grid,
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
  CurrencyBitcoin as BitcoinIcon,
} from "@mui/icons-material";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";

// Custom Ethereum Icon
const EthereumIcon = (props) => (
  <SvgIcon {...props}>
    <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
  </SvgIcon>
);

// Custom Tron Icon
const TronIcon = (props) => (
  <SvgIcon {...props}>
    <path d="M16.42 2.5L12 9.5 7.58 2.5h8.84zM6.43 3.09L10.5 9.5 2.5 9.5 6.43 3.09zM17.57 3.09L21.5 9.5 13.5 9.5 17.57 3.09zM12 11.25l4.16-1.5L12 21.5 7.84 9.75 12 11.25zM20.9 10.75l-3.66 1.33L12.5 21.5 22 10.75h-1.1zM3.1 10.75h-1.1L11.5 21.5 6.76 12.08 3.1 10.75z" />
  </SvgIcon>
);
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import NetworkBlockchainControl from "../components/NetworkBlockchainControl";
import TransactionHistoryModal from "../components/TransactionHistoryModal";
import AllNetworksScraperButton from "../components/AllNetworksScraperButton";
import blockchainService from "../services/blockchain";
import MonthYearSelector from "../components/common/MonthYearSelector";
import dayjs from "dayjs";
import SensitiveActionModal from "../components/SensitiveActionModal";
import useSensitiveAction from "../hooks/useSensitiveAction";

const ourNetworkSchema = yup.object({
  name: yup
    .string()
    .required("Name is required")
    .max(100, "Name must be less than 100 characters"),
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
                /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(
                  value
                )
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

  // Sensitive action hook for 2FA verification
  const { executeSensitiveAction, sensitiveActionState, resetSensitiveAction } =
    useSensitiveAction();

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
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);

  // Scraper state management
  const [scrapingNetworks, setScrapingNetworks] = useState(new Set());
  // Removed scraperNotifications state to avoid duplication and layout shifts

  // Network summaries state
  const [networkSummaries, setNetworkSummaries] = useState({});
  const [summariesLoading, setSummariesLoading] = useState(new Set());

  // Transaction history state
  const [transactionHistoryOpen, setTransactionHistoryOpen] = useState(false);
  const [selectedNetworkForHistory, setSelectedNetworkForHistory] =
    useState(null);

  // Month filter state
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [useMonthFilter, setUseMonthFilter] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(ourNetworkSchema),
    defaultValues: {
      name: "",
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

  useEffect(() => {
    if (notification.message) {
      setIsSnackbarOpen(true);
    }
  }, [notification.message]);

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setIsSnackbarOpen(false);
  };

  const handleSnackbarExited = () => {
    setNotification((prev) => ({ ...prev, message: "" }));
  };

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

  const fetchNetworkSummary = useCallback(
    async (networkId) => {
      try {
        setSummariesLoading((prev) => new Set([...prev, networkId]));

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

        setNetworkSummaries((prev) => ({
          ...prev,
          [networkId]: response.data,
        }));
      } catch (error) {
        console.error(
          `Error fetching network summary for ${networkId}:`,
          error
        );
        setNetworkSummaries((prev) => ({
          ...prev,
          [networkId]: null,
        }));
      } finally {
        setSummariesLoading((prev) => {
          const newSet = new Set(prev);
          newSet.delete(networkId);
          return newSet;
        });
      }
    },
    [useMonthFilter, selectedMonth]
  );

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
      if (Array.isArray(wallet))
        return wallet.filter((addr) => addr && addr.trim() !== "");
      return wallet ? [wallet] : [];
    };

    const ethereumWallets = getWalletArray(network.cryptoWallets.ethereum);
    const bitcoinWallets = getWalletArray(network.cryptoWallets.bitcoin);
    const tronWallets = getWalletArray(network.cryptoWallets.tron);

    return (
      ethereumWallets.length > 0 ||
      bitcoinWallets.length > 0 ||
      tronWallets.length > 0
    );
  }, []);

  // Fetch network summaries when networks are loaded or filter changes
  useEffect(() => {
    if (ourNetworks.length > 0) {
      ourNetworks.forEach((network) => {
        if (hasWallets(network)) {
          fetchNetworkSummary(network._id);
        }
      });
    }
  }, [ourNetworks, fetchNetworkSummary, hasWallets]);

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
          ethereum: data.cryptoWallets.ethereum.filter(
            (addr) => addr && addr.trim() !== ""
          ),
          bitcoin: data.cryptoWallets.bitcoin.filter(
            (addr) => addr && addr.trim() !== ""
          ),
          tron: data.cryptoWallets.tron.filter(
            (addr) => addr && addr.trim() !== ""
          ),
        },
      };

      if (editingNetwork) {
        // Use sensitive action verification for updating networks
        await executeSensitiveAction({
          actionName: "Update Network",
          actionDescription: `This will update the network "${editingNetwork.name}" including any wallet changes.`,
          apiCall: async (headers) => {
            return await api.put(
              `/our-networks/${editingNetwork._id}`,
              cleanedData,
              { headers }
            );
          },
        });
        setNotification({
          message: "Our network updated successfully!",
          severity: "success",
        });
      } else {
        // Use sensitive action verification for creating networks
        await executeSensitiveAction({
          actionName: "Create Network",
          actionDescription:
            "This will create a new network with the specified wallet addresses.",
          apiCall: async (headers) => {
            return await api.post("/our-networks", cleanedData, { headers });
          },
        });
        setNotification({
          message: "Our network created successfully!",
          severity: "success",
        });
      }
      handleCloseDialog();
      fetchOurNetworks();
    } catch (error) {
      // Don't show error if user cancelled the action
      if (error.message === "User cancelled sensitive action") {
        return;
      }
      setNotification({
        message: error.response?.data?.message || "Failed to save our network",
        severity: "error",
      });
    }
  };

  const handleDelete = async (networkId) => {
    // Find the network name for the confirmation message
    const networkToDelete = ourNetworks.find((n) => n._id === networkId);
    const networkName = networkToDelete?.name || "this network";

    if (
      !window.confirm(
        `Are you sure you want to delete "${networkName}"? This action requires 2FA verification.`
      )
    ) {
      return;
    }

    try {
      // Use sensitive action verification for deleting networks
      await executeSensitiveAction({
        actionName: "Delete Network",
        actionDescription: `This will permanently delete the network "${networkName}" and all associated wallet configurations.`,
        apiCall: async (headers) => {
          return await api.delete(`/our-networks/${networkId}`, { headers });
        },
      });
      setNotification({
        message: "Our network deleted successfully!",
        severity: "success",
      });
      fetchOurNetworks();
    } catch (error) {
      // Don't show error if user cancelled the action
      if (error.message === "User cancelled sensitive action") {
        return;
      }
      setNotification({
        message:
          error.response?.data?.message || "Failed to delete our network",
        severity: "error",
      });
    }
  };

  const handleToggleActive = async (network) => {
    const newStatus = !network.isActive;
    try {
      // Use sensitive action verification for toggling network status
      await executeSensitiveAction({
        actionName: newStatus ? "Activate Network" : "Deactivate Network",
        actionDescription: `This will ${
          newStatus ? "activate" : "deactivate"
        } the network "${network.name}".`,
        apiCall: async (headers) => {
          return await api.put(
            `/our-networks/${network._id}`,
            { isActive: newStatus },
            { headers }
          );
        },
      });
      setNotification({
        message: `Our network ${
          newStatus ? "activated" : "deactivated"
        } successfully!`,
        severity: "success",
      });
      fetchOurNetworks();
    } catch (error) {
      // Don't show error if user cancelled the action
      if (error.message === "User cancelled sensitive action") {
        return;
      }
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
    setScrapingNetworks((prev) => new Set([...prev, networkId]));

    // Clear previous notifications for this network
    // setScraperNotifications((prev) => ({ ...prev, [networkId]: null }));

    try {
      const response = await blockchainService.triggerNetworkScrapers(
        networkId
      );
      const { newTransactions, totalUsdValue } = response.data.summary;
      const valueText = totalUsdValue
        ? ` with total value $${totalUsdValue}`
        : "";

      // Show global notification only, don't use per-network notifications to avoid duplication and layout shifts
      setNotification({
        message: `Scrapers completed for "${network.name}"! Found ${newTransactions} new transactions${valueText}.`,
        severity: "success",
      });

      // Refresh network summary to update total value
      fetchNetworkSummary(networkId);
    } catch (error) {
      console.error("Error triggering network scrapers:", error);

      setNotification({
        message:
          error.response?.data?.message ||
          `Failed to run scrapers for "${network.name}"`,
        severity: "error",
      });
    } finally {
      // Remove network from scraping set
      setScrapingNetworks((prev) => {
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
    <Box sx={{ p: isMobile ? 2 : 3, pt: 0, mt: -2 }}>
      <Snackbar
        open={isSnackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        TransitionComponent={Slide}
        TransitionProps={{
          direction: "down",
          timeout: 1000,
          onExited: handleSnackbarExited,
        }}
        sx={{ top: { xs: 16, sm: 24 }, right: { xs: 16, sm: 24 } }}
      >
        <Alert
          severity={notification.severity}
          sx={{ width: "100%", boxShadow: 3 }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Add spacing to prevent top content from being hidden if notification is persistent (though it overlays now) */}
      <Box sx={{ height: 0 }} />

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              label={
                user?.role === "admin"
                  ? "Search our networks"
                  : "Search my networks"
              }
              variant="outlined"
              size="small"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={5}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                justifyContent: "flex-start",
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={useMonthFilter}
                    onChange={(e) => setUseMonthFilter(e.target.checked)}
                  />
                }
                label="Month Filter"
                sx={{ whiteSpace: "nowrap" }}
              />

              {useMonthFilter && (
                <MonthYearSelector
                  selectedDate={selectedMonth}
                  onDateChange={setSelectedMonth}
                  showCurrentSelection={false}
                  size="small"
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                alignItems: "center",
                justifyContent: { xs: "flex-start", md: "flex-end" },
              }}
            >
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
                  sx={{ minWidth: isMobile ? "auto" : "fit-content" }}
                >
                  {isMobile ? "Add" : "Add Our Network"}
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{ fontWeight: "bold", backgroundColor: "grey.200" }}
              >
                Name
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  backgroundColor: "grey.200",
                  textAlign: "center",
                }}
              >
                Assigned Managers
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  backgroundColor: "grey.200",
                  textAlign: "center",
                }}
              >
                Crypto Wallets
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  backgroundColor: "grey.200",
                  textAlign: "center",
                }}
              >
                Total Value
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  backgroundColor: "grey.200",
                  textAlign: "center",
                }}
              >
                Status
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  backgroundColor: "grey.200",
                  textAlign: "center",
                }}
              >
                Created
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  fontWeight: "bold",
                  backgroundColor: "grey.200",
                  textAlign: "right",
                }}
              >
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
                  <TableCell align="center">
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
                  <TableCell align="center">
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        flexWrap: "nowrap",
                        overflowX: "auto",
                        justifyContent: "center",
                      }}
                    >
                      {(() => {
                        const getWalletCount = (wallet) => {
                          if (Array.isArray(wallet))
                            return wallet.filter(
                              (addr) => addr && addr.trim() !== ""
                            ).length;
                          return wallet ? 1 : 0;
                        };

                        const ethCount = getWalletCount(
                          network.cryptoWallets?.ethereum
                        );
                        const btcCount = getWalletCount(
                          network.cryptoWallets?.bitcoin
                        );
                        const tronCount = getWalletCount(
                          network.cryptoWallets?.tron
                        );

                        if (
                          ethCount === 0 &&
                          btcCount === 0 &&
                          tronCount === 0
                        ) {
                          return (
                            <Typography
                              variant="h6"
                              fontWeight="bold"
                              color="text.secondary"
                            >
                              -
                            </Typography>
                          );
                        }

                        return (
                          <>
                            {ethCount > 0 && (
                              <Tooltip
                                title={`${ethCount} Ethereum Wallet${
                                  ethCount > 1 ? "s" : ""
                                }`}
                              >
                                <Chip
                                  icon={
                                    <EthereumIcon
                                      style={{ fontSize: 16, color: "#627EEA" }}
                                    />
                                  }
                                  label={ethCount}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    borderColor: "#627EEA",
                                    color: "#627EEA",
                                    "& .MuiChip-label": { px: 1 },
                                  }}
                                />
                              </Tooltip>
                            )}
                            {btcCount > 0 && (
                              <Tooltip
                                title={`${btcCount} Bitcoin Wallet${
                                  btcCount > 1 ? "s" : ""
                                }`}
                              >
                                <Chip
                                  icon={
                                    <BitcoinIcon
                                      style={{ fontSize: 16, color: "#F7931A" }}
                                    />
                                  }
                                  label={btcCount}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    borderColor: "#F7931A",
                                    color: "#F7931A",
                                    "& .MuiChip-label": { px: 1 },
                                  }}
                                />
                              </Tooltip>
                            )}
                            {tronCount > 0 && (
                              <Tooltip
                                title={`${tronCount} TRON Wallet${
                                  tronCount > 1 ? "s" : ""
                                }`}
                              >
                                <Chip
                                  icon={
                                    <TronIcon
                                      style={{ fontSize: 16, color: "#EB0029" }}
                                    />
                                  }
                                  label={tronCount}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    borderColor: "#EB0029",
                                    color: "#EB0029",
                                    "& .MuiChip-label": { px: 1 },
                                  }}
                                />
                              </Tooltip>
                            )}
                          </>
                        );
                      })()}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    {(() => {
                      const summary = networkSummaries[network._id];
                      // const isLoading = summariesLoading.has(network._id);
                      const networkHasWallets = hasWallets(network);

                      if (!networkHasWallets) {
                        return (
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            color="text.secondary"
                          >
                            -
                          </Typography>
                        );
                      }

                      if (summary && summary.totalUsdValue !== undefined) {
                        return (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              justifyContent: "center",
                            }}
                          >
                            <TrendingUpIcon
                              sx={{ color: "success.main", fontSize: 16 }}
                            />
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              color="success.main"
                            >
                              ${summary.totalUsdValue}
                            </Typography>
                          </Box>
                        );
                      }

                      return (
                        <Typography
                          variant="h6"
                          fontWeight="bold"
                          color="text.secondary"
                        >
                          -
                        </Typography>
                      );
                    })()}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={network.isActive ? "Active" : "Inactive"}
                      color={network.isActive ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" color="text.secondary">
                      {new Date(network.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: "flex",
                        gap: 0.5,
                        justifyContent: "flex-end",
                      }}
                    >
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewNetwork(network)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>

                      {/* Transaction History Button */}
                      {hasWallets(network) && (
                        <Tooltip title="View Transaction History">
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleViewTransactionHistory(network)
                            }
                            color="primary"
                          >
                            <TimelineIcon />
                          </IconButton>
                        </Tooltip>
                      )}

                      {/* Run Scrapers Button */}
                      {hasWallets(network) && (
                        <Tooltip
                          title={
                            scrapingNetworks.has(network._id)
                              ? "Scraping in progress..."
                              : "Run Blockchain Scrapers"
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleRunScrapers(network)}
                              disabled={scrapingNetworks.has(network._id)}
                              color="success"
                            >
                              {scrapingNetworks.has(network._id) ? (
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <CircularProgress
                                    size={16}
                                    color="inherit"
                                    sx={{ color: "success.main" }}
                                  />
                                </Box>
                              ) : (
                                <RocketIcon />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}

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
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        color="primary.main"
                        fontWeight="bold"
                      >
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
                      <Box
                        key={field.id}
                        sx={{ display: "flex", gap: 1, mb: 1 }}
                      >
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
                              helperText={
                                errors.cryptoWallets?.ethereum?.[index]?.message
                              }
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
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        color="orange.main"
                        fontWeight="bold"
                      >
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
                      <Box
                        key={field.id}
                        sx={{ display: "flex", gap: 1, mb: 1 }}
                      >
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
                              helperText={
                                errors.cryptoWallets?.bitcoin?.[index]?.message
                              }
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
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        color="purple.main"
                        fontWeight="bold"
                      >
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
                      <Box
                        key={field.id}
                        sx={{ display: "flex", gap: 1, mb: 1 }}
                      >
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
                              helperText={
                                errors.cryptoWallets?.tron?.[index]?.message
                              }
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
                      if (Array.isArray(wallet))
                        return wallet.filter(
                          (addr) => addr && addr.trim() !== ""
                        );
                      return wallet ? [wallet] : [];
                    };

                    // Get wallet arrays
                    const ethereumWallets = getWalletArray(
                      viewingNetwork.cryptoWallets?.ethereum
                    );
                    const bitcoinWallets = getWalletArray(
                      viewingNetwork.cryptoWallets?.bitcoin
                    );
                    const tronWallets = getWalletArray(
                      viewingNetwork.cryptoWallets?.tron
                    );

                    const hasAnyWallets =
                      ethereumWallets.length > 0 ||
                      bitcoinWallets.length > 0 ||
                      tronWallets.length > 0;

                    // Get network summary for wallet balances
                    const summary = networkSummaries[viewingNetwork._id];
                    const getWalletBalance = (blockchain, address) => {
                      if (!summary?.breakdown?.[blockchain]?.wallets)
                        return null;
                      return summary.breakdown[blockchain].wallets.find(
                        (w) => w.address === address
                      );
                    };

                    return (
                      <>
                        {/* Ethereum Wallets */}
                        {ethereumWallets.map((address, index) => {
                          const walletData = getWalletBalance(
                            "ethereum",
                            address
                          );
                          return (
                            <Box
                              key={`eth-${index}`}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                p: 2,
                                borderRadius: 2,
                                backgroundColor: "rgba(98, 126, 234, 0.04)",
                                border: 1,
                                borderColor: "rgba(98, 126, 234, 0.3)",
                                mb: 1,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                  backgroundColor: "rgba(98, 126, 234, 0.08)",
                                  borderColor: "#627EEA",
                                  transform: "translateY(-1px)",
                                  boxShadow:
                                    "0 4px 12px rgba(98, 126, 234, 0.2)",
                                },
                              }}
                            >
                              <EthereumIcon
                                sx={{ color: "#627EEA", fontSize: 24 }}
                              />
                              <Box sx={{ flex: 1 }}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                  }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    color="primary.main"
                                    fontWeight="bold"
                                  >
                                    Ethereum
                                    {ethereumWallets.length > 1
                                      ? ` ${index + 1}`
                                      : ""}
                                  </Typography>
                                  {walletData && (
                                    <Chip
                                      size="small"
                                      label={`$${walletData.totalUsdValue}`}
                                      color="success"
                                      sx={{
                                        fontWeight: "bold",
                                        fontSize: "0.75rem",
                                      }}
                                    />
                                  )}
                                </Box>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontFamily: "monospace",
                                    wordBreak: "break-all",
                                    mb: 1,
                                  }}
                                >
                                  {address}
                                </Typography>
                                {walletData && walletData.count > 0 && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
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
                          const walletData = getWalletBalance(
                            "bitcoin",
                            address
                          );
                          return (
                            <Box
                              key={`btc-${index}`}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                p: 2,
                                borderRadius: 2,
                                backgroundColor: "rgba(247, 147, 26, 0.04)",
                                border: 1,
                                borderColor: "rgba(247, 147, 26, 0.3)",
                                mb: 1,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                  backgroundColor: "rgba(247, 147, 26, 0.08)",
                                  borderColor: "#F7931A",
                                  transform: "translateY(-1px)",
                                  boxShadow:
                                    "0 4px 12px rgba(247, 147, 26, 0.2)",
                                },
                              }}
                            >
                              <BitcoinIcon
                                sx={{ color: "#F7931A", fontSize: 24 }}
                              />
                              <Box sx={{ flex: 1 }}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                  }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    color="orange.main"
                                    fontWeight="bold"
                                  >
                                    Bitcoin
                                    {bitcoinWallets.length > 1
                                      ? ` ${index + 1}`
                                      : ""}
                                  </Typography>
                                  {walletData && (
                                    <Chip
                                      size="small"
                                      label={`$${walletData.totalUsdValue}`}
                                      color="success"
                                      sx={{
                                        fontWeight: "bold",
                                        fontSize: "0.75rem",
                                      }}
                                    />
                                  )}
                                </Box>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontFamily: "monospace",
                                    wordBreak: "break-all",
                                    mb: 1,
                                  }}
                                >
                                  {address}
                                </Typography>
                                {walletData && walletData.count > 0 && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
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
                          const walletData = getWalletBalance("tron", address);
                          return (
                            <Box
                              key={`trx-${index}`}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                p: 2,
                                borderRadius: 2,
                                backgroundColor: "rgba(235, 0, 41, 0.04)",
                                border: 1,
                                borderColor: "rgba(235, 0, 41, 0.3)",
                                mb: 1,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                  backgroundColor: "rgba(235, 0, 41, 0.08)",
                                  borderColor: "#EB0029",
                                  transform: "translateY(-1px)",
                                  boxShadow: "0 4px 12px rgba(235, 0, 41, 0.2)",
                                },
                              }}
                            >
                              <TronIcon
                                sx={{ color: "#EB0029", fontSize: 24 }}
                              />
                              <Box sx={{ flex: 1 }}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                  }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    color="purple.main"
                                    fontWeight="bold"
                                  >
                                    TRON
                                    {tronWallets.length > 1
                                      ? ` ${index + 1}`
                                      : ""}
                                  </Typography>
                                  {walletData && (
                                    <Chip
                                      size="small"
                                      label={`$${walletData.totalUsdValue}`}
                                      color="success"
                                      sx={{
                                        fontWeight: "bold",
                                        fontSize: "0.75rem",
                                      }}
                                    />
                                  )}
                                </Box>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontFamily: "monospace",
                                    wordBreak: "break-all",
                                    mb: 1,
                                  }}
                                >
                                  {address}
                                </Typography>
                                {walletData && walletData.count > 0 && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
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
                              mb: 1,
                            }}
                          >
                            <WalletIcon
                              sx={{ color: "grey.400", fontSize: 24 }}
                            />
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

      {/* Sensitive Action 2FA Verification Modal */}
      <SensitiveActionModal
        open={sensitiveActionState.showModal}
        onClose={resetSensitiveAction}
        onVerify={sensitiveActionState.handleVerify}
        actionName={sensitiveActionState.actionName}
        actionDescription={sensitiveActionState.actionDescription}
        loading={sensitiveActionState.verifying}
        error={sensitiveActionState.error}
        requires2FASetup={sensitiveActionState.requires2FASetup}
      />
    </Box>
  );
};

export default OurNetworksPage;
