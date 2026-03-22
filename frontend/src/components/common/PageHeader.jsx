import React from "react";
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

/**
 * PageHeader - Clean page header with title, optional icon, breadcrumbs, and actions.
 *
 * @param {string} title - Page title
 * @param {string} [subtitle] - Optional subtitle text
 * @param {React.ReactNode} [icon] - Optional icon element displayed before the title
 * @param {Array<{label: string, href?: string, onClick?: Function}>} [breadcrumbs] - Breadcrumb items
 * @param {React.ReactNode} [actions] - Action buttons rendered on the right
 * @param {React.ReactNode} [children] - Additional content below the header
 */
function PageHeader({
  title,
  subtitle,
  icon,
  breadcrumbs,
  actions,
  children,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box sx={{ mb: 3 }}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={
            <NavigateNextIcon sx={{ fontSize: 16, color: "#9e9e9e" }} />
          }
          sx={{ mb: 1 }}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return isLast ? (
              <Typography
                key={index}
                variant="body2"
                sx={{ color: "#1e3a5f", fontWeight: 500 }}
              >
                {crumb.label}
              </Typography>
            ) : (
              <Link
                key={index}
                href={crumb.href || "#"}
                onClick={(e) => {
                  if (crumb.onClick) {
                    e.preventDefault();
                    crumb.onClick();
                  }
                }}
                underline="hover"
                sx={{
                  color: "#9e9e9e",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  "&:hover": { color: "#1e3a5f" },
                }}
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}

      {/* Title row */}
      <Box
        sx={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: isMobile ? 1.5 : 2,
        }}
      >
        {/* Left: icon + title + subtitle */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {icon && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#1e3a5f",
                fontSize: 28,
              }}
            >
              {icon}
            </Box>
          )}
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: "#1e3a5f",
                fontSize: { xs: "1.5rem", sm: "2rem" },
                lineHeight: 1.2,
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                sx={{ color: "#9e9e9e", mt: 0.25 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Right: actions */}
        {actions && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexShrink: 0,
              width: isMobile ? "100%" : "auto",
            }}
          >
            {actions}
          </Box>
        )}
      </Box>

      {/* Optional children */}
      {children && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Box>
  );
}

PageHeader.defaultProps = {
  subtitle: undefined,
  icon: undefined,
  breadcrumbs: undefined,
  actions: undefined,
  children: undefined,
};

export default PageHeader;
