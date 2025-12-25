import React from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  CircularProgress,
  Chip,
} from "@mui/material";
import { getStatusColor, getLeadTypeColor } from "../../utils/leadUtils";

/**
 * LeadTable - Extracted table component for displaying leads
 * This component handles the rendering of the leads table, separating
 * presentation logic from the main LeadsPage component.
 */
const LeadTable = ({
  leads,
  loading,
  totalLeads,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  isAgent = false,
  isAdminOrManager = false,
  renderRow,
  columns = [],
}) => {
  const getColumnCount = () => {
    if (isAgent) return 8;
    if (isAdminOrManager) return 11;
    return 10;
  };

  return (
    <Paper>
      <TableContainer sx={{ maxHeight: "calc(100vh - 180px)" }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((column, index) => (
                <TableCell
                  key={column.id || index}
                  padding={column.padding || "normal"}
                  sx={{
                    borderRight:
                      index < columns.length - 1
                        ? "1px solid rgba(224, 224, 224, 1)"
                        : "none",
                    backgroundColor: "background.paper",
                    fontSize: "0.875rem",
                    py: 1,
                    ...column.sx,
                  }}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={getColumnCount()}
                  align="center"
                  sx={{ py: 4 }}
                >
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={getColumnCount()}
                  align="center"
                  sx={{ py: 4 }}
                >
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead, index) => (
                <React.Fragment key={lead._id || lead.leadId || index}>
                  {renderRow ? (
                    renderRow(lead, index)
                  ) : (
                    <DefaultRow lead={lead} />
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalLeads}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
      />
    </Paper>
  );
};

/**
 * Default row renderer - fallback if no custom renderRow is provided
 */
const DefaultRow = ({ lead }) => {
  return (
    <TableRow hover>
      <TableCell>
        {lead.firstName} {lead.lastName}
      </TableCell>
      <TableCell>
        <Chip
          label={lead.leadType?.toUpperCase() || "UNKNOWN"}
          color={getLeadTypeColor(lead.leadType)}
          size="small"
        />
      </TableCell>
      <TableCell>{lead.country || "N/A"}</TableCell>
      <TableCell>
        <Chip
          label={
            lead.status
              ? lead.status.charAt(0).toUpperCase() + lead.status.slice(1)
              : "Unknown"
          }
          color={getStatusColor(lead.status)}
          size="small"
        />
      </TableCell>
    </TableRow>
  );
};

export default LeadTable;
