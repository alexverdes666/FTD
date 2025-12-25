import React, { useState, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import {
  DragIndicator as DragIndicatorIcon,
  Visibility as VisibilityIcon,
  Comment as CommentIcon,
} from "@mui/icons-material";
import { getStatusColor, getLeadTypeColor } from "../../utils/leadUtils";

/**
 * LeadKanban - Kanban board view for leads organized by status
 * Provides a visual drag-and-drop interface for managing lead statuses
 */
const LeadKanban = ({
  leads = [],
  loading = false,
  onStatusChange,
  onViewLead,
  onCommentLead,
  userRole = "agent",
}) => {
  const [draggedLead, setDraggedLead] = useState(null);

  const columns = [
    {
      id: "active",
      title: "Active",
      color: "success",
      leads: leads.filter((lead) => lead.status === "active"),
    },
    {
      id: "contacted",
      title: "Contacted",
      color: "info",
      leads: leads.filter((lead) => lead.status === "contacted"),
    },
    {
      id: "converted",
      title: "Converted",
      color: "success",
      leads: leads.filter((lead) => lead.status === "converted"),
    },
    {
      id: "inactive",
      title: "Inactive",
      color: "error",
      leads: leads.filter((lead) => lead.status === "inactive"),
    },
  ];

  const handleDragStart = useCallback((e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e, targetStatus) => {
      e.preventDefault();
      if (draggedLead && draggedLead.status !== targetStatus) {
        if (onStatusChange) {
          onStatusChange(draggedLead._id || draggedLead.leadId, targetStatus);
        }
      }
      setDraggedLead(null);
    },
    [draggedLead, onStatusChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedLead(null);
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        overflowX: "auto",
        pb: 2,
        minHeight: "calc(100vh - 200px)",
      }}
    >
      {columns.map((column) => (
        <Paper
          key={column.id}
          sx={{
            minWidth: 300,
            maxWidth: 300,
            bgcolor: "background.paper",
            borderRadius: 2,
            p: 2,
            display: "flex",
            flexDirection: "column",
            border: "1px solid",
            borderColor: "divider",
          }}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
              pb: 1,
              borderBottom: "2px solid",
              borderColor: `${column.color}.main`,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: "bold",
                color: `${column.color}.main`,
                textTransform: "uppercase",
                fontSize: "0.875rem",
              }}
            >
              {column.title}
            </Typography>
            <Chip
              label={column.leads.length}
              size="small"
              color={column.color}
              sx={{ fontWeight: "bold" }}
            />
          </Box>

          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            {column.leads.length === 0 ? (
              <Box
                sx={{
                  textAlign: "center",
                  py: 4,
                  color: "text.secondary",
                  fontStyle: "italic",
                }}
              >
                No leads
              </Box>
            ) : (
              column.leads.map((lead) => {
                const leadInfo = lead.leadInfo || lead;
                const isDragging =
                  draggedLead?._id === lead._id ||
                  draggedLead?.leadId === lead.leadId;

                return (
                  <Card
                    key={lead._id || lead.leadId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead)}
                    onDragEnd={handleDragEnd}
                    sx={{
                      cursor: "move",
                      opacity: isDragging ? 0.5 : 1,
                      transition: "all 0.2s",
                      "&:hover": {
                        boxShadow: 4,
                        transform: "translateY(-2px)",
                      },
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          mb: 1,
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="subtitle2"
                            fontWeight="bold"
                            sx={{ mb: 0.5 }}
                          >
                            {leadInfo.prefix && `${leadInfo.prefix} `}
                            {leadInfo.firstName || "N/A"}{" "}
                            {leadInfo.lastName || ""}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {leadInfo.newEmail || leadInfo.email || "No email"}
                          </Typography>
                        </Box>
                        <DragIndicatorIcon
                          sx={{ color: "text.disabled", fontSize: 18 }}
                        />
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.5,
                          flexWrap: "wrap",
                          mb: 1,
                        }}
                      >
                        <Chip
                          label={leadInfo.leadType?.toUpperCase() || "UNKNOWN"}
                          color={getLeadTypeColor(leadInfo.leadType)}
                          size="small"
                          sx={{ fontSize: "0.65rem", height: 20 }}
                        />
                        <Chip
                          label={leadInfo.country || "N/A"}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: "0.65rem", height: 20 }}
                        />
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mt: 1,
                          pt: 1,
                          borderTop: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {leadInfo.assignedAgentAt || leadInfo.createdAt
                            ? new Date(
                                leadInfo.assignedAgentAt || leadInfo.createdAt
                              ).toLocaleDateString()
                            : "N/A"}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          {onViewLead && (
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  onViewLead(lead._id || lead.leadId)
                                }
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {onCommentLead && (
                            <Tooltip title="Add Comment">
                              <IconButton
                                size="small"
                                onClick={() =>
                                  onCommentLead(lead._id || lead.leadId)
                                }
                              >
                                <CommentIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default LeadKanban;

