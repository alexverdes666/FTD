import React from "react";
import { Box, Typography, Button } from "@mui/material";
import InboxIcon from "@mui/icons-material/InboxOutlined";

/**
 * EmptyState - Centered placeholder shown when there is no data to display.
 *
 * @param {React.ReactNode} [icon] - Icon element (defaults to InboxOutlined)
 * @param {string} [title='No data'] - Title text
 * @param {string} [description] - Description text
 * @param {string} [actionLabel] - Label for the CTA button
 * @param {Function} [onAction] - Called when the CTA button is clicked
 * @param {boolean} [compact=false] - Reduced padding for use inside cards/sections
 */
function EmptyState({
  icon,
  title = "No data",
  description,
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        py: compact ? 4 : 8,
        px: 3,
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          mb: 2,
          color: "#bdbdbd",
          fontSize: compact ? 40 : 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon || <InboxIcon sx={{ fontSize: "inherit" }} />}
      </Box>

      {/* Title */}
      <Typography
        variant={compact ? "body1" : "h6"}
        sx={{
          fontWeight: 600,
          color: "#455a64",
          mb: 0.5,
        }}
      >
        {title}
      </Typography>

      {/* Description */}
      {description && (
        <Typography
          variant="body2"
          sx={{
            color: "#9e9e9e",
            maxWidth: 360,
            lineHeight: 1.6,
          }}
        >
          {description}
        </Typography>
      )}

      {/* Action button */}
      {actionLabel && onAction && (
        <Button
          variant="contained"
          onClick={onAction}
          sx={{
            mt: 2.5,
            textTransform: "none",
            fontWeight: 600,
            borderRadius: "8px",
            bgcolor: "#1e3a5f",
            px: 3,
            "&:hover": {
              bgcolor: "#15304f",
            },
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

EmptyState.defaultProps = {
  icon: undefined,
  title: "No data",
  description: undefined,
  actionLabel: undefined,
  onAction: undefined,
  compact: false,
};

export default EmptyState;
