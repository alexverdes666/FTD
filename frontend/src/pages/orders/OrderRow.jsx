import React, { useMemo } from "react";
import {
  Box,
  Typography,
  Chip,
  TableCell,
  TableRow,
  IconButton,
  Tooltip,
  Divider,
  alpha,
} from "@mui/material";
import {
  Edit as EditIcon,
  History as HistoryIcon,
  Visibility as ViewIcon,
  ChevronRight as ChevronRightIcon,
  ContentCopy as ContentCopyIcon,
} from "@mui/icons-material";
import {
  ROW_BORDER_SX,
  ROW_CELL_HIDDEN_MD,
  ROW_CELL_HIDDEN_SM,
  ID_CELL_SX,
  REQUESTER_BOX_SX,
  REQUESTER_NAME_SX,
  EDIT_REQUESTER_BTN_SX,
  EDIT_ICON_SX,
  FULFILLMENT_BOX_SX,
  FULFILLMENT_ITEM_SX,
  CELL_FONT_TINY,
  PROGRESS_BAR_BG_SX,
  CHIP_BASE_SX,
  TOOLTIP_WIDE_SX,
  CELL_FONT_SMALL,
  ACTION_BTN_PRIMARY_SX,
  ACTION_BTN_INFO_SX,
  ICON_16_SX,
  ICON_18_SX,
  ACTIONS_BOX_SX,
  DIVIDER_SX,
  getStatusChipSx,
  getPriorityChipSx,
} from "./ordersUtils";

const OrderRow = React.memo(({
  order,
  orderPanelId,
  user,
  onPreviewLeads,
  onCopyLeads,
  onOpenAudit,
  onOpenPanel,
  onChangeRequester,
}) => {
  const isSelected = orderPanelId === order._id;

  const rowSx = useMemo(() => isSelected ? {
    ...ROW_BORDER_SX,
    bgcolor: (theme) => `${alpha(theme.palette.success.main, 0.18)} !important`,
    "&:hover": { bgcolor: (theme) => `${alpha(theme.palette.success.main, 0.25)} !important` },
  } : ROW_BORDER_SX, [isSelected]);

  const fulfillmentItems = useMemo(() => [
    { fulfilled: order.fulfilled?.ftd || 0, requested: order.requests?.ftd || 0, label: "FTD", color: "#3b82f6" },
    { fulfilled: order.fulfilled?.filler || 0, requested: order.requests?.filler || 0, label: "Filler", color: "#f59e0b" },
    { fulfilled: order.fulfilled?.cold || 0, requested: order.requests?.cold || 0, label: "Cold", color: "#8b5cf6" },
  ].filter(item => item.requested > 0), [order.fulfilled, order.requests]);

  const statusTooltip = useMemo(() => {
    if (order.status === "cancelled" && order.cancellationReason) {
      const parts = order.cancellationReason.split(" | ");
      return `Cancellation Details: ${parts.length > 1 ? parts.length + " issues found" : order.cancellationReason}`;
    }
    if (order.status === "partial" && order.partialFulfillmentReason) {
      const parts = order.partialFulfillmentReason.split(" | ");
      return `Partial Fulfillment: ${parts.length > 1 ? parts.length + " lead types affected" : order.partialFulfillmentReason}`;
    }
    return "";
  }, [order.status, order.cancellationReason, order.partialFulfillmentReason]);

  return (
    <React.Fragment>
      <TableRow hover={!isSelected} sx={rowSx}>
        <TableCell>
          <Typography noWrap sx={ID_CELL_SX}>
            {order._id.slice(-8)}
          </Typography>
        </TableCell>
        <TableCell align="center" sx={ROW_CELL_HIDDEN_MD}>
          <Box sx={REQUESTER_BOX_SX}>
            <Typography noWrap sx={REQUESTER_NAME_SX}>
              {order.requester?.fullName}
            </Typography>
            {user?.role === "admin" && (
              <IconButton
                className="edit-requester-icon"
                size="small"
                onClick={(e) => { e.stopPropagation(); onChangeRequester(order); }}
                title="Change Requester"
                sx={EDIT_REQUESTER_BTN_SX}
              >
                <EditIcon sx={EDIT_ICON_SX} />
              </IconButton>
            )}
          </Box>
        </TableCell>
        <TableCell align="center" sx={ROW_CELL_HIDDEN_MD}>
          <Typography noWrap sx={CELL_FONT_SMALL}>
            {order.selectedClientNetwork?.name || "-"}
          </Typography>
        </TableCell>
        <TableCell align="center" sx={ROW_CELL_HIDDEN_MD}>
          <Typography noWrap sx={CELL_FONT_SMALL}>
            {order.selectedOurNetwork?.name || "-"}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Box sx={FULFILLMENT_BOX_SX}>
            {fulfillmentItems.map((item, idx) => {
              const pct = Math.min((item.fulfilled / item.requested) * 100, 100);
              return (
                <Tooltip key={idx} title={`${item.label}: ${item.fulfilled}/${item.requested}`} arrow placement="top">
                  <Box sx={FULFILLMENT_ITEM_SX}>
                    <Typography variant="caption" sx={{ ...CELL_FONT_TINY, fontWeight: 600, color: item.color, lineHeight: 1 }}>
                      {item.fulfilled}/{item.requested}
                    </Typography>
                    <Box sx={PROGRESS_BAR_BG_SX}>
                      <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: item.color, borderRadius: 1, transition: "width 0.3s ease" }} />
                    </Box>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </TableCell>
        <TableCell align="center">
          <Tooltip title={statusTooltip} placement="top" arrow componentsProps={TOOLTIP_WIDE_SX}>
            <Chip
              label={order.status}
              variant="outlined"
              size="small"
              sx={{ ...CHIP_BASE_SX, ...getStatusChipSx(order.status) }}
            />
          </Tooltip>
        </TableCell>
        <TableCell align="center" sx={ROW_CELL_HIDDEN_SM}>
          <Typography noWrap sx={CELL_FONT_SMALL}>
            {order.countryFilter || "Any"}
          </Typography>
        </TableCell>
        <TableCell align="center" sx={ROW_CELL_HIDDEN_SM}>
          <Chip
            label={order.priority}
            variant="outlined"
            size="small"
            sx={{ ...CHIP_BASE_SX, ...getPriorityChipSx(order.priority) }}
          />
        </TableCell>
        <TableCell align="center" sx={ROW_CELL_HIDDEN_SM}>
          <Typography noWrap sx={CELL_FONT_SMALL}>
            {order.plannedDate ? new Date(order.plannedDate).toLocaleDateString() : "N/A"}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Box sx={ACTIONS_BOX_SX}>
            <Tooltip title="Preview Leads" arrow>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onPreviewLeads(order._id); }} sx={ACTION_BTN_PRIMARY_SX}>
                <ViewIcon sx={ICON_16_SX} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copy Leads to Clipboard" arrow>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onCopyLeads(order._id); }} sx={ACTION_BTN_INFO_SX}>
                <ContentCopyIcon sx={ICON_16_SX} />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={DIVIDER_SX} />
            <Tooltip title="View Audit Log" arrow>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onOpenAudit(order); }} sx={ACTION_BTN_INFO_SX}>
                <HistoryIcon sx={ICON_16_SX} />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={DIVIDER_SX} />
            <Tooltip title="View Order Details" arrow>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onOpenPanel(order._id); }} sx={ACTION_BTN_PRIMARY_SX}>
                <ChevronRightIcon sx={ICON_18_SX} />
              </IconButton>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
});

export default OrderRow;
