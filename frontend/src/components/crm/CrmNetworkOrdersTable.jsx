import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  TablePagination,
  CircularProgress,
  Tooltip,
  Chip,
} from "@mui/material";
import api from "../../services/api";

const CrmNetworkOrdersTable = ({ networkId }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 10,
  });
  const [totals, setTotals] = useState({
    confirmedDeposits: 0,
    shavedFtds: 0,
  });

  const fetchOrders = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const response = await api.get(`/client-networks/${networkId}/deals`, {
          params: { page, limit: 10 },
        });
        setOrders(response.data.data);
        setPagination(response.data.pagination);
        if (response.data.totals) {
          setTotals(response.data.totals);
        }
      } catch (error) {
        console.error("Failed to load orders", error);
      } finally {
        setLoading(false);
      }
    },
    [networkId]
  );

  useEffect(() => {
    if (networkId) {
      fetchOrders();
    }
  }, [fetchOrders, networkId]);

  const handlePageChange = (event, newPage) => {
    fetchOrders(newPage + 1);
  };

  const formatOrderId = (id) => {
    const short = id.slice(-8);
    return (
      <Tooltip title={id}>
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          ...{short}
        </Typography>
      </Tooltip>
    );
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {pagination.total} {pagination.total === 1 ? "order" : "orders"} total
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Chip
            label={`Confirmed Deposits: ${totals.confirmedDeposits}`}
            color="success"
            size="small"
            variant="outlined"
          />
          <Chip
            label={`Shaved FTDs: ${totals.shavedFtds}`}
            color={totals.shavedFtds > 0 ? "error" : "default"}
            size="small"
            variant="outlined"
          />
        </Box>
      </Box>

      {!orders.length && !loading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">No orders found</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Order ID
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Requester
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Our Network
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    GEO
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Client Brokers
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Leads
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Confirmed Deposits
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Shaved FTDs
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order._id} hover>
                      <TableCell>{formatOrderId(order._id)}</TableCell>
                      <TableCell>
                        {order.plannedDate
                          ? new Date(order.plannedDate).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {order.requester?.fullName || "-"}
                      </TableCell>
                      <TableCell>
                        {order.selectedOurNetwork?.name || "-"}
                      </TableCell>
                      <TableCell>{order.countryFilter || "-"}</TableCell>
                      <TableCell>
                        {order.selectedClientBrokers?.length
                          ? order.selectedClientBrokers
                              .map((b) => b.name)
                              .join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="medium">
                          {order.leads?.length || 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          color={order.confirmedDeposits > 0 ? "success.main" : "text.primary"}
                        >
                          {order.confirmedDeposits || 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          color={order.shavedFtds > 0 ? "error.main" : "text.primary"}
                        >
                          {order.shavedFtds || 0}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {pagination.total > 0 && (
            <TablePagination
              component="div"
              count={pagination.total}
              page={pagination.current - 1}
              onPageChange={handlePageChange}
              rowsPerPage={pagination.limit}
              rowsPerPageOptions={[pagination.limit]}
            />
          )}
        </Paper>
      )}
    </Box>
  );
};

export default CrmNetworkOrdersTable;
