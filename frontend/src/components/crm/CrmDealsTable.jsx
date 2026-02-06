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
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import api from "../../services/api";
import toast from "react-hot-toast";
import CrmDealForm from "./CrmDealForm";

const CrmDealsTable = ({ networkId, isAdmin }) => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 10,
  });

  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [dealLoading, setDealLoading] = useState(false);

  const fetchDeals = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const response = await api.get(`/crm-deals/network/${networkId}`, {
          params: { page, limit: 10 },
        });
        setDeals(response.data.data);
        setPagination(response.data.pagination);
      } catch (error) {
        console.error("Failed to load deals", error);
      } finally {
        setLoading(false);
      }
    },
    [networkId]
  );

  useEffect(() => {
    if (networkId) {
      fetchDeals();
    }
  }, [fetchDeals, networkId]);

  const handleAddDeal = () => {
    setEditingDeal(null);
    setDealDialogOpen(true);
  };

  const handleEditDeal = (deal) => {
    setEditingDeal(deal);
    setDealDialogOpen(true);
  };

  const handleDealSubmit = async (data) => {
    try {
      setDealLoading(true);
      if (editingDeal) {
        await api.put(`/crm-deals/${editingDeal._id}`, data);
        toast.success("Deal updated");
      } else {
        await api.post("/crm-deals", {
          ...data,
          clientNetwork: networkId,
        });
        toast.success("Deal added");
      }
      setDealDialogOpen(false);
      fetchDeals(pagination.current);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save deal");
    } finally {
      setDealLoading(false);
    }
  };

  const handleDeleteDeal = async (dealId) => {
    if (!window.confirm("Delete this deal?")) return;
    try {
      await api.delete(`/crm-deals/${dealId}`);
      toast.success("Deal deleted");
      fetchDeals(pagination.current);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete deal");
    }
  };

  const handlePageChange = (event, newPage) => {
    fetchDeals(newPage + 1);
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
          {pagination.total} {pagination.total === 1 ? "deal" : "deals"} total
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={handleAddDeal}>
          Add Deal
        </Button>
      </Box>

      {!deals.length && !loading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">No deals found</Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Our Network
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                    Affiliate Manager
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Total Sent
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Fired FTDs
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Shaved FTDs
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Total Paid
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : (
                  deals.map((deal) => (
                    <TableRow key={deal._id} hover>
                      <TableCell>
                        {new Date(deal.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {deal.ourNetwork?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {deal.affiliateManager?.fullName || "-"}
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="medium">
                          {deal.totalSentLeads}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="medium">
                          {deal.firedFtds}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          color={deal.shavedFtds > 0 ? "error.main" : "text.primary"}
                        >
                          {deal.shavedFtds}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          ${deal.totalPaid.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEditDeal(deal)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteDeal(deal._id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
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

      <CrmDealForm
        open={dealDialogOpen}
        onClose={() => setDealDialogOpen(false)}
        onSubmit={handleDealSubmit}
        deal={editingDeal}
        loading={dealLoading}
      />
    </Box>
  );
};

export default React.memo(CrmDealsTable);
