import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  Box,
  TablePagination,
} from "@mui/material";

const getStatusColor = (status) => {
  const colors = {
    fulfilled: "success",
    partial: "warning",
    pending: "info",
    cancelled: "error",
  };
  return colors[status] || "default";
};

const DealsTable = ({
  deals = [],
  pagination = { current: 1, pages: 1, total: 0, limit: 10 },
  onPageChange,
  loading = false,
}) => {
  const handlePageChange = (event, newPage) => {
    if (onPageChange) {
      onPageChange(newPage + 1);
    }
  };

  if (!deals.length && !loading) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">No deals found</Typography>
      </Paper>
    );
  }

  return (
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
              <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                Campaign
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
              >
                FTD Req
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
              >
                FTD Done
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
              >
                Filler Req
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
              >
                Filler Done
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
              >
                Status
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => (
                <TableRow key={deal._id} hover>
                  <TableCell>
                    {new Date(deal.plannedDate || deal.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {deal.selectedOurNetwork?.name || "-"}
                  </TableCell>
                  <TableCell>
                    {deal.requester?.fullName || "-"}
                  </TableCell>
                  <TableCell>
                    {deal.selectedCampaign?.name || "-"}
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight="medium">
                      {deal.requests?.ftd || 0}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography
                      variant="body2"
                      color={
                        deal.fulfilled?.ftd >= deal.requests?.ftd
                          ? "success.main"
                          : "text.primary"
                      }
                      fontWeight="medium"
                    >
                      {deal.fulfilled?.ftd || 0}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {deal.requests?.filler || 0}
                  </TableCell>
                  <TableCell align="center">
                    {deal.fulfilled?.filler || 0}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={deal.status}
                      color={getStatusColor(deal.status)}
                      size="small"
                      variant="outlined"
                    />
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
  );
};

export default DealsTable;
