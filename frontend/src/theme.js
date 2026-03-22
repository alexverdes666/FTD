import { createTheme, alpha } from "@mui/material/styles";

// ── Color tokens ──────────────────────────────────────────────────────
const primary = {
  main: "#1e3a5f",
  light: "#2d5a8e",
  dark: "#0f2440",
  contrastText: "#ffffff",
};

const secondary = {
  main: "#f57c00",
  light: "#ff9d3f",
  dark: "#c56200",
  contrastText: "#ffffff",
};

const success = { main: "#2e7d32", light: "#4caf50", dark: "#1b5e20" };
const error = { main: "#c62828", light: "#ef5350", dark: "#8e0000" };
const warning = { main: "#f9a825", light: "#fdd835", dark: "#c17900", contrastText: "#1e3a5f" };
const info = { main: "#0277bd", light: "#03a9f4", dark: "#01579b" };

const background = {
  default: "#f8f9fa",
  paper: "#ffffff",
};

// ── Custom shadow scale (24 entries) ──────────────────────────────────
const shadows = [
  "none",
  "0px 1px 2px rgba(0,0,0,0.04)",
  "0px 1px 4px rgba(0,0,0,0.06)",
  "0px 2px 6px rgba(0,0,0,0.06)",
  "0px 2px 8px rgba(0,0,0,0.08)",
  "0px 3px 10px rgba(0,0,0,0.08)",
  "0px 4px 12px rgba(0,0,0,0.08)",
  "0px 4px 14px rgba(0,0,0,0.10)",
  "0px 5px 16px rgba(0,0,0,0.10)",
  "0px 6px 18px rgba(0,0,0,0.10)",
  "0px 6px 20px rgba(0,0,0,0.12)",
  "0px 7px 22px rgba(0,0,0,0.12)",
  "0px 8px 24px rgba(0,0,0,0.12)",
  "0px 8px 26px rgba(0,0,0,0.14)",
  "0px 9px 28px rgba(0,0,0,0.14)",
  "0px 10px 30px rgba(0,0,0,0.14)",
  "0px 10px 32px rgba(0,0,0,0.16)",
  "0px 11px 34px rgba(0,0,0,0.16)",
  "0px 12px 36px rgba(0,0,0,0.16)",
  "0px 12px 38px rgba(0,0,0,0.18)",
  "0px 13px 40px rgba(0,0,0,0.18)",
  "0px 14px 42px rgba(0,0,0,0.18)",
  "0px 14px 44px rgba(0,0,0,0.20)",
  "0px 15px 46px rgba(0,0,0,0.20)",
  "0px 16px 48px rgba(0,0,0,0.20)",
];

// ── Theme definition ──────────────────────────────────────────────────
const theme = createTheme({
  // ─── Palette ────────────────────────────────────────────────────────
  palette: {
    primary,
    secondary,
    success,
    error,
    warning,
    info,
    background,
    text: {
      primary: "#1a1a2e",
      secondary: "#5a6478",
      disabled: "#9e9e9e",
    },
    divider: "rgba(0,0,0,0.08)",
    action: {
      hover: "rgba(30,58,95,0.04)",
      selected: "rgba(30,58,95,0.08)",
      focus: "rgba(30,58,95,0.12)",
    },
  },

  // ─── Typography ─────────────────────────────────────────────────────
  typography: {
    fontFamily: "'Inter', 'Segoe UI', 'Roboto', sans-serif",
    h1: {
      fontWeight: 700,
      fontSize: "2.25rem",
      lineHeight: 1.2,
      letterSpacing: "-0.02em",
      color: primary.main,
    },
    h2: {
      fontWeight: 700,
      fontSize: "1.875rem",
      lineHeight: 1.25,
      letterSpacing: "-0.015em",
      color: primary.main,
    },
    h3: {
      fontWeight: 600,
      fontSize: "1.5rem",
      lineHeight: 1.3,
      letterSpacing: "-0.01em",
      color: primary.main,
    },
    h4: {
      fontWeight: 600,
      fontSize: "1.25rem",
      lineHeight: 1.35,
      letterSpacing: "-0.005em",
      color: primary.dark,
    },
    h5: {
      fontWeight: 600,
      fontSize: "1.1rem",
      lineHeight: 1.4,
      color: primary.dark,
    },
    h6: {
      fontWeight: 600,
      fontSize: "1rem",
      lineHeight: 1.45,
      color: primary.dark,
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: "0.95rem",
      lineHeight: 1.5,
      letterSpacing: "0.005em",
    },
    subtitle2: {
      fontWeight: 500,
      fontSize: "0.85rem",
      lineHeight: 1.5,
      letterSpacing: "0.005em",
    },
    body1: {
      fontSize: "0.938rem",
      lineHeight: 1.6,
      letterSpacing: "0.005em",
    },
    body2: {
      fontSize: "0.85rem",
      lineHeight: 1.55,
      letterSpacing: "0.005em",
    },
    button: {
      fontWeight: 600,
      fontSize: "0.875rem",
      letterSpacing: "0.01em",
    },
    caption: {
      fontSize: "0.75rem",
      lineHeight: 1.5,
      letterSpacing: "0.02em",
      color: "#5a6478",
    },
    overline: {
      fontSize: "0.7rem",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#5a6478",
    },
  },

  // ─── Shape ──────────────────────────────────────────────────────────
  shape: {
    borderRadius: 12,
  },

  // ─── Shadows ────────────────────────────────────────────────────────
  shadows,

  // ─── Transitions ────────────────────────────────────────────────────
  transitions: {
    duration: {
      shortest: 120,
      shorter: 180,
      short: 220,
      standard: 280,
      complex: 350,
      enteringScreen: 250,
      leavingScreen: 200,
    },
    easing: {
      easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
      easeOut: "cubic-bezier(0.0, 0, 0.2, 1)",
      easeIn: "cubic-bezier(0.4, 0, 1, 1)",
      sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
    },
  },

  // ─── Component overrides ────────────────────────────────────────────
  components: {
    // ── Global baseline ───────────────────────────────────────────────
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: background.default,
        },
      },
    },

    // ── Cards ─────────────────────────────────────────────────────────
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0px 2px 8px rgba(0,0,0,0.06)",
          borderRadius: 14,
          transition: "box-shadow 0.28s ease, transform 0.28s ease",
          "&:hover": {
            boxShadow: "0px 6px 20px rgba(0,0,0,0.10)",
            transform: "translateY(-2px)",
          },
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        title: {
          fontWeight: 600,
          fontSize: "1rem",
        },
      },
    },

    // ── Buttons ───────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 10,
          padding: "8px 20px",
          transition: "all 0.22s ease",
        },
        contained: {
          boxShadow: "0px 2px 6px rgba(0,0,0,0.10)",
          "&:hover": {
            boxShadow: "0px 4px 12px rgba(0,0,0,0.16)",
          },
        },
        outlined: {
          borderWidth: "1.5px",
          "&:hover": {
            borderWidth: "1.5px",
            backgroundColor: alpha(primary.main, 0.04),
          },
        },
        text: {
          "&:hover": {
            backgroundColor: alpha(primary.main, 0.06),
          },
        },
        sizeSmall: {
          padding: "5px 14px",
          fontSize: "0.8125rem",
        },
        sizeLarge: {
          padding: "11px 28px",
          fontSize: "0.95rem",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: "all 0.22s ease",
          "&:hover": {
            backgroundColor: alpha(primary.main, 0.06),
          },
        },
      },
    },

    // ── Inputs ────────────────────────────────────────────────────────
    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: "box-shadow 0.22s ease",
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: primary.light,
          },
          "&.Mui-focused": {
            boxShadow: `0 0 0 3px ${alpha(primary.main, 0.10)}`,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: primary.main,
            borderWidth: 2,
          },
        },
        notchedOutline: {
          borderColor: "rgba(0,0,0,0.12)",
          transition: "border-color 0.22s ease",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
          "&.Mui-focused": {
            color: primary.main,
          },
        },
      },
    },

    // ── Chips ─────────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          fontSize: "0.8125rem",
        },
        filled: {
          "&.MuiChip-colorDefault": {
            backgroundColor: alpha(primary.main, 0.08),
            color: primary.main,
          },
        },
        outlined: {
          borderWidth: "1.5px",
        },
      },
    },

    // ── Tables ────────────────────────────────────────────────────────
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            backgroundColor: alpha(primary.main, 0.06),
            color: primary.dark,
            fontWeight: 700,
            fontSize: "0.8125rem",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            borderBottom: `2px solid ${alpha(primary.main, 0.12)}`,
            padding: "12px 16px",
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: "background-color 0.18s ease",
          "&:nth-of-type(even)": {
            backgroundColor: alpha(primary.main, 0.015),
          },
          "&:hover": {
            backgroundColor: alpha(primary.main, 0.04),
          },
          "&.Mui-selected": {
            backgroundColor: alpha(primary.main, 0.08),
            "&:hover": {
              backgroundColor: alpha(primary.main, 0.10),
            },
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          padding: "10px 16px",
          fontSize: "0.85rem",
        },
      },
    },

    // ── Paper ──────────────────────────────────────────────────────────
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: 14,
        },
        elevation1: {
          boxShadow: "0px 2px 8px rgba(0,0,0,0.06)",
          border: "1px solid rgba(0,0,0,0.06)",
        },
        elevation2: {
          boxShadow: "0px 3px 12px rgba(0,0,0,0.08)",
        },
        elevation3: {
          boxShadow: "0px 4px 16px rgba(0,0,0,0.10)",
        },
      },
    },

    // ── Dialogs ───────────────────────────────────────────────────────
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: "0px 12px 40px rgba(0,0,0,0.14)",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: "1.15rem",
          padding: "20px 24px 12px",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "12px 24px 20px",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: "12px 24px 20px",
        },
      },
    },

    // ── Tabs ──────────────────────────────────────────────────────────
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 44,
        },
        indicator: {
          height: 3,
          borderRadius: "3px 3px 0 0",
          backgroundColor: primary.main,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          fontSize: "0.875rem",
          minHeight: 44,
          padding: "10px 18px",
          transition: "color 0.22s ease",
          "&.Mui-selected": {
            fontWeight: 600,
            color: primary.main,
          },
        },
      },
    },

    // ── Tooltips ──────────────────────────────────────────────────────
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#1a1a2e",
          color: "#ffffff",
          fontSize: "0.75rem",
          fontWeight: 500,
          borderRadius: 8,
          padding: "6px 12px",
          boxShadow: "0px 4px 14px rgba(0,0,0,0.18)",
        },
        arrow: {
          color: "#1a1a2e",
        },
      },
    },

    // ── Alerts ────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontSize: "0.85rem",
          alignItems: "center",
        },
        standardSuccess: {
          backgroundColor: alpha(success.main, 0.08),
          color: success.dark,
          "& .MuiAlert-icon": { color: success.main },
        },
        standardError: {
          backgroundColor: alpha(error.main, 0.08),
          color: error.dark,
          "& .MuiAlert-icon": { color: error.main },
        },
        standardWarning: {
          backgroundColor: alpha(warning.main, 0.12),
          color: warning.dark,
          "& .MuiAlert-icon": { color: warning.main },
        },
        standardInfo: {
          backgroundColor: alpha(info.main, 0.08),
          color: info.dark,
          "& .MuiAlert-icon": { color: info.main },
        },
      },
    },

    // ── Drawer / Sidebar ──────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "1px solid rgba(0,0,0,0.06)",
          backgroundColor: "#ffffff",
          boxShadow: "none",
        },
      },
    },

    // ── AppBar ────────────────────────────────────────────────────────
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: primary.dark,
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0px 1px 4px rgba(0,0,0,0.04)",
        },
      },
    },

    // ── List items ────────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: "2px 8px",
          padding: "8px 14px",
          transition: "all 0.22s ease",
          "&:hover": {
            backgroundColor: alpha(primary.main, 0.06),
          },
          "&.Mui-selected": {
            backgroundColor: alpha(primary.main, 0.10),
            color: primary.main,
            fontWeight: 600,
            "&:hover": {
              backgroundColor: alpha(primary.main, 0.14),
            },
            "& .MuiListItemIcon-root": {
              color: primary.main,
            },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 38,
          color: "#5a6478",
        },
      },
    },

    // ── DataGrid ──────────────────────────────────────────────────────
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 14,
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: alpha(primary.main, 0.05),
            borderBottom: `2px solid ${alpha(primary.main, 0.10)}`,
          },
          "& .MuiDataGrid-columnHeaderTitle": {
            fontWeight: 700,
            fontSize: "0.8125rem",
            letterSpacing: "0.01em",
          },
          "& .MuiDataGrid-row": {
            transition: "background-color 0.18s ease",
            "&:hover": {
              backgroundColor: alpha(primary.main, 0.03),
            },
            "&:nth-of-type(even)": {
              backgroundColor: alpha(primary.main, 0.015),
            },
          },
          "& .MuiDataGrid-cell": {
            borderBottom: "1px solid rgba(0,0,0,0.04)",
            fontSize: "0.85rem",
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "1px solid rgba(0,0,0,0.06)",
          },
        },
      },
    },

    // ── Badge ─────────────────────────────────────────────────────────
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 600,
          fontSize: "0.7rem",
          minWidth: 18,
          height: 18,
          padding: "0 5px",
        },
        colorPrimary: {
          backgroundColor: primary.main,
        },
        colorSecondary: {
          backgroundColor: secondary.main,
        },
        colorError: {
          backgroundColor: error.main,
        },
      },
    },

    // ── Avatar ────────────────────────────────────────────────────────
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: "0.9rem",
        },
        colorDefault: {
          backgroundColor: alpha(primary.main, 0.12),
          color: primary.main,
        },
      },
    },

    // ── Progress ──────────────────────────────────────────────────────
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          height: 6,
          backgroundColor: alpha(primary.main, 0.08),
        },
        bar: {
          borderRadius: 6,
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        colorPrimary: {
          color: primary.main,
        },
      },
    },

    // ── Switch ────────────────────────────────────────────────────────
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 46,
          height: 26,
          padding: 0,
        },
        switchBase: {
          padding: 3,
          "&.Mui-checked": {
            transform: "translateX(20px)",
            color: "#ffffff",
            "& + .MuiSwitch-track": {
              backgroundColor: primary.main,
              opacity: 1,
            },
          },
        },
        thumb: {
          width: 20,
          height: 20,
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        },
        track: {
          borderRadius: 13,
          backgroundColor: "rgba(0,0,0,0.16)",
          opacity: 1,
          transition: "background-color 0.22s ease",
        },
      },
    },

    // ── Menu / Dropdown ───────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: "0px 6px 24px rgba(0,0,0,0.10)",
          border: "1px solid rgba(0,0,0,0.06)",
          marginTop: 4,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
          borderRadius: 8,
          margin: "2px 6px",
          padding: "8px 14px",
          transition: "background-color 0.18s ease",
          "&:hover": {
            backgroundColor: alpha(primary.main, 0.06),
          },
          "&.Mui-selected": {
            backgroundColor: alpha(primary.main, 0.10),
            "&:hover": {
              backgroundColor: alpha(primary.main, 0.14),
            },
          },
        },
      },
    },

    // ── Select ────────────────────────────────────────────────────────
    MuiSelect: {
      styleOverrides: {
        select: {
          borderRadius: 10,
        },
      },
    },

    // ── Pagination ────────────────────────────────────────────────────
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          "&.Mui-selected": {
            backgroundColor: primary.main,
            color: "#ffffff",
            fontWeight: 600,
            "&:hover": {
              backgroundColor: primary.dark,
            },
          },
        },
      },
    },

    // ── Breadcrumbs ───────────────────────────────────────────────────
    MuiBreadcrumbs: {
      styleOverrides: {
        root: {
          fontSize: "0.85rem",
        },
      },
    },

    // ── Autocomplete ──────────────────────────────────────────────────
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: "0px 6px 24px rgba(0,0,0,0.10)",
          border: "1px solid rgba(0,0,0,0.06)",
        },
        option: {
          borderRadius: 8,
          margin: "2px 6px",
          padding: "8px 12px",
          transition: "background-color 0.18s ease",
          '&[aria-selected="true"]': {
            backgroundColor: alpha(primary.main, 0.10),
          },
          "&:hover": {
            backgroundColor: alpha(primary.main, 0.06),
          },
        },
      },
    },

    // ── Snackbar ──────────────────────────────────────────────────────
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontSize: "0.85rem",
          fontWeight: 500,
        },
      },
    },

    // ── Accordion ─────────────────────────────────────────────────────
    MuiAccordion: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: "14px !important",
          marginBottom: 8,
          "&:before": { display: "none" },
          "&.Mui-expanded": {
            margin: "0 0 8px 0",
          },
        },
      },
    },

    // ── Skeleton ──────────────────────────────────────────────────────
    MuiSkeleton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        rectangular: {
          borderRadius: 12,
        },
      },
    },

    // ── Divider ───────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "rgba(0,0,0,0.06)",
        },
      },
    },

    // ── Popover ───────────────────────────────────────────────────────
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: "0px 6px 24px rgba(0,0,0,0.10)",
          border: "1px solid rgba(0,0,0,0.06)",
        },
      },
    },
  },
});

export default theme;
