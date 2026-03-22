import React, { useMemo } from "react";
import { Chip } from "@mui/material";

/**
 * Status-to-color mapping. Each key is a normalized status string.
 * The values define { bg, color, label } for the badge.
 */
const STATUS_COLORS = {
  // Blue - new / pending
  new: { bg: "#e3f2fd", color: "#1976d2" },
  pending: { bg: "#e3f2fd", color: "#1976d2" },
  open: { bg: "#e3f2fd", color: "#1976d2" },
  draft: { bg: "#e3f2fd", color: "#1976d2" },

  // Green - active / approved / positive outcomes
  active: { bg: "#e8f5e9", color: "#2e7d32" },
  approved: { bg: "#e8f5e9", color: "#2e7d32" },
  qualified: { bg: "#e8f5e9", color: "#2e7d32" },
  completed: { bg: "#e8f5e9", color: "#2e7d32" },
  converted: { bg: "#e8f5e9", color: "#2e7d32" },
  resolved: { bg: "#e8f5e9", color: "#2e7d32" },
  verified: { bg: "#e8f5e9", color: "#2e7d32" },
  success: { bg: "#e8f5e9", color: "#2e7d32" },

  // Red - inactive / cancelled / negative outcomes
  inactive: { bg: "#ffebee", color: "#c62828" },
  cancelled: { bg: "#ffebee", color: "#c62828" },
  canceled: { bg: "#ffebee", color: "#c62828" },
  lost: { bg: "#ffebee", color: "#c62828" },
  rejected: { bg: "#ffebee", color: "#c62828" },
  failed: { bg: "#ffebee", color: "#c62828" },
  declined: { bg: "#ffebee", color: "#c62828" },
  deleted: { bg: "#ffebee", color: "#c62828" },

  // Orange - in-progress / processing
  processing: { bg: "#fff3e0", color: "#f57c00" },
  "in progress": { bg: "#fff3e0", color: "#f57c00" },
  in_progress: { bg: "#fff3e0", color: "#f57c00" },
  contacted: { bg: "#fff3e0", color: "#f57c00" },
  working: { bg: "#fff3e0", color: "#f57c00" },
  assigned: { bg: "#fff3e0", color: "#f57c00" },

  // Gray - on hold / waiting
  "on hold": { bg: "#f5f5f5", color: "#757575" },
  on_hold: { bg: "#f5f5f5", color: "#757575" },
  waiting: { bg: "#f5f5f5", color: "#757575" },
  paused: { bg: "#f5f5f5", color: "#757575" },
  suspended: { bg: "#f5f5f5", color: "#757575" },
  unknown: { bg: "#f5f5f5", color: "#757575" },
};

/** Fallback color config for unrecognized statuses */
const DEFAULT_STATUS = { bg: "#f5f5f5", color: "#757575" };

/**
 * Normalize a status string for lookup: lowercase, trim.
 */
function normalizeStatus(status) {
  if (!status) return "";
  return status.toString().toLowerCase().trim();
}

/**
 * Format a status label for display: capitalize first letter of each word.
 */
function formatLabel(status) {
  if (!status) return "";
  return status
    .toString()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * StatusBadge - Consistent status indicator using MUI Chip with a dot indicator.
 *
 * @param {string} status - The status string (matched case-insensitively)
 * @param {'order'|'lead'|'user'|'ticket'} [type] - Context type (reserved for future per-type overrides)
 * @param {'small'|'medium'} [size='small'] - Chip size
 * @param {'filled'|'outlined'} [variant='filled'] - Visual variant
 */
function StatusBadge({
  status,
  type,
  size = "small",
  variant = "filled",
}) {
  const normalized = normalizeStatus(status);
  const config = useMemo(
    () => STATUS_COLORS[normalized] || DEFAULT_STATUS,
    [normalized]
  );
  const label = formatLabel(status);

  const isFilled = variant === "filled";

  return (
    <Chip
      size={size}
      label={label}
      icon={
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: config.color,
            marginLeft: size === "small" ? 6 : 8,
          }}
        />
      }
      sx={{
        borderRadius: "8px",
        fontWeight: 600,
        fontSize: size === "small" ? "0.75rem" : "0.8125rem",
        height: size === "small" ? 26 : 32,
        letterSpacing: "0.3px",
        bgcolor: isFilled ? config.bg : "transparent",
        color: config.color,
        border: isFilled ? "none" : `1px solid ${config.color}`,
        "& .MuiChip-icon": {
          marginRight: -0.5,
        },
        transition: "background-color 200ms ease",
      }}
    />
  );
}

StatusBadge.defaultProps = {
  type: undefined,
  size: "small",
  variant: "filled",
};

export default StatusBadge;
