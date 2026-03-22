import React from "react";
import { Box, Paper, Typography } from "@mui/material";

/**
 * InfoCard - Versatile info/metric card with icon, title, and value.
 *
 * @param {string} title - Card title
 * @param {string|number|React.ReactNode} value - Primary value or content
 * @param {React.ReactNode} [icon] - Icon element
 * @param {string} [color='#1e3a5f'] - Accent color
 * @param {string} [description] - Secondary description text
 * @param {Function} [onClick] - Click handler
 * @param {'default'|'outlined'|'gradient'} [variant='default'] - Visual variant
 */
function InfoCard({
  title,
  value,
  icon,
  color = "#1e3a5f",
  description,
  onClick,
  variant = "default",
}) {
  const isGradient = variant === "gradient";
  const isOutlined = variant === "outlined";

  /**
   * Build the sx object based on variant.
   */
  const paperSx = {
    p: 2.5,
    borderRadius: "12px",
    cursor: onClick ? "pointer" : "default",
    transition: "transform 200ms ease, box-shadow 200ms ease",
    "&:hover": onClick
      ? {
          transform: "translateY(-2px)",
          boxShadow:
            "0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)",
        }
      : {},

    // Default variant
    ...(variant === "default" && {
      boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
      bgcolor: "#ffffff",
    }),

    // Outlined variant
    ...(isOutlined && {
      boxShadow: "none",
      bgcolor: "transparent",
      border: `1px solid ${color}30`,
    }),

    // Gradient variant
    ...(isGradient && {
      boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
      background: `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)`,
      borderLeft: `4px solid ${color}`,
    }),
  };

  const textColor = isGradient ? color : "#1e3a5f";
  const subtitleColor = isGradient ? `${color}99` : "#9e9e9e";

  return (
    <Paper onClick={onClick} sx={paperSx} elevation={0}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        {/* Icon */}
        {icon && (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "10px",
              bgcolor: `${color}14`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: color,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}

        {/* Text content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              color: subtitleColor,
              fontWeight: 500,
              fontSize: "0.8rem",
              mb: 0.5,
            }}
          >
            {title}
          </Typography>

          {typeof value === "string" || typeof value === "number" ? (
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: textColor,
                lineHeight: 1.2,
              }}
            >
              {value}
            </Typography>
          ) : (
            value
          )}

          {description && (
            <Typography
              variant="caption"
              sx={{
                color: subtitleColor,
                display: "block",
                mt: 0.5,
                lineHeight: 1.4,
              }}
            >
              {description}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

InfoCard.defaultProps = {
  icon: undefined,
  color: "#1e3a5f",
  description: undefined,
  onClick: undefined,
  variant: "default",
};

export default InfoCard;
