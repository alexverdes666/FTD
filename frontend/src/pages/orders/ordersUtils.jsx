import React, { useState, useEffect } from "react";
import { Box, Typography, alpha } from "@mui/material";
import * as yup from "yup";

// ── Yup schema for the Create Order form ──
export const createOrderSchema = (userRole) => {
  return yup.object({
    ftd: yup
      .number()
      .integer("Must be a whole number")
      .min(0, "Cannot be negative")
      .default(0),
    filler: yup
      .number()
      .integer("Must be a whole number")
      .min(0, "Cannot be negative")
      .default(0),
    cold: yup
      .number()
      .integer("Must be a whole number")
      .min(0, "Cannot be negative")
      .default(0),
    live: yup
      .number()
      .integer("Must be a whole number")
      .min(0, "Cannot be negative")
      .default(0),
    countryFilter: yup.string().default(""), // Country filter is only required in non-manual mode (validated in onSubmitOrder)
    genderFilter: yup.string().oneOf(["", "male", "female"]).default(""),
    priority: yup.string().oneOf(["low", "medium", "high"]).default("medium"),
    notes: yup.string().default(""),
    selectedClientNetwork:
      userRole === "admin" || userRole === "affiliate_manager"
        ? yup
            .string()
            .required("Client Network selection is required")
            .default("")
        : yup.string().default(""),
    selectedOurNetwork: yup
      .string()
      .required("Our Network selection is required")
      .default(""),
    selectedCampaign: yup
      .string()
      .required("Campaign selection is mandatory for all orders")
      .default(""),
    selectedClientBrokers: yup.array().of(yup.string()).default([]),
    agentFilter: yup.string().default(""),
    ftdAgents: yup.array().of(yup.string()).default([]),
    fillerAgents: yup.array().of(yup.string()).default([]),
    plannedDate: yup
      .date()
      .required("Planned date is required")
      .test("not-same-day", "Cannot create order for the same day", (value) => {
        // Admin users can bypass same-day restriction
        if (userRole === "admin") return true;

        if (!value) return false;
        const today = new Date();
        const plannedDay = new Date(value);
        today.setHours(0, 0, 0, 0);
        plannedDay.setHours(0, 0, 0, 0);
        return plannedDay.getTime() !== today.getTime();
      })
      .test(
        "not-tomorrow-after-7pm",
        "Cannot create order for tomorrow after 7:00 PM today",
        (value) => {
          // Admin users can bypass time restriction
          if (userRole === "admin") return true;

          if (!value) return false;
          const now = new Date();
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const plannedDay = new Date(value);
          plannedDay.setHours(0, 0, 0, 0);

          // If planning for tomorrow and current time is after 7 PM
          if (
            plannedDay.getTime() === tomorrow.getTime() &&
            now.getHours() >= 19
          ) {
            return false;
          }
          return true;
        }
      )
      .test("not-past-date", "Cannot create order for past dates", (value) => {
        if (!value) return false;
        const today = new Date();
        const plannedDay = new Date(value);
        today.setHours(0, 0, 0, 0);
        plannedDay.setHours(0, 0, 0, 0);
        return plannedDay >= today;
      })
      .default(() => {
        // Default to tomorrow if before 7 PM today (or if admin), otherwise day after tomorrow
        const now = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (userRole === "admin" || now.getHours() < 19) {
          return tomorrow;
        } else {
          const dayAfterTomorrow = new Date();
          dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
          return dayAfterTomorrow;
        }
      }),
  });
  // Note: "at-least-one lead type" validation is done in onSubmitOrder
  // to support manual selection mode which doesn't use lead counts
};

// ── Color / chip helpers ──
export const getStatusColor = (status) => {
  const colors = {
    fulfilled: "success",
    pending: "warning",
    cancelled: "error",
    partial: "info",
  };
  return colors[status] || "default";
};

export const getPriorityColor = (priority) => {
  const colors = {
    high: "error",
    medium: "warning",
    low: "info",
  };
  return colors[priority] || "default";
};

export const getStatusChipSx = (status) => {
  const styles = {
    fulfilled: { bgcolor: "rgba(46,125,50,0.08)", color: "#2e7d32", borderColor: "#2e7d32" },
    pending: { bgcolor: "rgba(237,108,2,0.08)", color: "#ed6c02", borderColor: "#ed6c02" },
    cancelled: { bgcolor: "rgba(211,47,47,0.08)", color: "#d32f2f", borderColor: "#d32f2f" },
    partial: { bgcolor: "rgba(2,136,209,0.08)", color: "#0288d1", borderColor: "#0288d1" },
  };
  return styles[status] || { bgcolor: "rgba(0,0,0,0.04)", color: "text.secondary", borderColor: "grey.400" };
};

export const getPriorityChipSx = (priority) => {
  const styles = {
    high: { bgcolor: "rgba(211,47,47,0.08)", color: "#d32f2f", borderColor: "#d32f2f" },
    medium: { bgcolor: "rgba(237,108,2,0.08)", color: "#ed6c02", borderColor: "#ed6c02" },
    low: { bgcolor: "rgba(2,136,209,0.08)", color: "#0288d1", borderColor: "#0288d1" },
  };
  return styles[priority] || { bgcolor: "rgba(0,0,0,0.04)", color: "text.secondary", borderColor: "grey.400" };
};

// Helper function to get the display lead type (orderedAs takes precedence over leadType)
export const getDisplayLeadType = (lead) => {
  return lead.orderedAs || lead.leadType;
};

// Helper function to calculate FTD cooldown status
export const getFTDCooldownStatus = (lead) => {
  const leadType = getDisplayLeadType(lead);
  if (leadType !== "ftd" && leadType !== "filler") {
    return null; // Not an FTD/Filler lead
  }

  if (!lead.lastUsedInOrder) {
    return null; // Never used, no cooldown
  }

  const lastUsedDate = new Date(lead.lastUsedInOrder);
  const now = new Date();
  const cooldownEnd = new Date(lastUsedDate.getTime() + 10 * 24 * 60 * 60 * 1000);

  if (now < cooldownEnd) {
    const daysRemaining = Math.ceil((cooldownEnd - now) / (1000 * 60 * 60 * 24));
    return {
      inCooldown: true,
      daysRemaining: daysRemaining,
      lastUsedDate: lastUsedDate,
    };
  }

  return { inCooldown: false };
};

// ── useDebounce hook ──
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

// IPQS Status color helper - bold colors matching IPQS validation dialog
export const getIPQSStatusConfig = (status) => {
  switch (status) {
    case "clean":
      return { color: "#2e7d32", bgcolor: "#c8e6c9", label: "Clean", textColor: "#1b5e20" };
    case "low_risk":
      return { color: "#1565c0", bgcolor: "#bbdefb", label: "Low Risk", textColor: "#0d47a1" };
    case "medium_risk":
      return { color: "#ef6c00", bgcolor: "#ffe0b2", label: "Medium Risk", textColor: "#e65100" };
    case "high_risk":
      return { color: "#c62828", bgcolor: "#ffcdd2", label: "High Risk", textColor: "#b71c1c" };
    case "invalid":
      return { color: "#c62828", bgcolor: "#ffcdd2", label: "Invalid", textColor: "#b71c1c" };
    default:
      return { color: "inherit", bgcolor: "transparent", label: "Unknown", textColor: "inherit" };
  }
};

// Build IPQS tooltip content
export const buildIPQSTooltip = (validation, type) => {
  if (!validation) return "Not validated";

  const data = type === "email" ? validation.email : validation.phone;
  const summary = validation.summary;

  if (!data?.success) return data?.error || "Validation failed";

  if (type === "email") {
    const status = summary?.emailStatus || "unknown";
    const config = getIPQSStatusConfig(status);
    return (
      <Box sx={{ p: 1, bgcolor: config.bgcolor, borderRadius: 1, borderLeft: `4px solid ${config.color}` }}>
        <Typography variant="subtitle2" sx={{ color: config.textColor, fontWeight: "bold", mb: 0.5 }}>
          {config.label} (Score: {data.fraud_score ?? "N/A"})
        </Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Valid: {data.valid ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Disposable: {data.disposable ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Honeypot: {data.honeypot ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Recent Abuse: {data.recent_abuse ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Catch All: {data.catch_all ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>DNS Valid: {data.dns_valid ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Deliverability: {data.deliverability || "N/A"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Leaked: {data.leaked ? "Yes" : "No"}</Typography>
      </Box>
    );
  } else {
    const status = summary?.phoneStatus || "unknown";
    const config = getIPQSStatusConfig(status);
    return (
      <Box sx={{ p: 1, bgcolor: config.bgcolor, borderRadius: 1, borderLeft: `4px solid ${config.color}` }}>
        <Typography variant="subtitle2" sx={{ color: config.textColor, fontWeight: "bold", mb: 0.5 }}>
          {config.label} (Score: {data.fraud_score ?? "N/A"})
        </Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Valid: {data.valid ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Active: {data.active ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>VOIP: {data.VOIP ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Prepaid: {data.prepaid ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Risky: {data.risky ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Line Type: {data.line_type || "N/A"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Carrier: {data.carrier || "N/A"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Country: {data.country || "N/A"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Do Not Call: {data.do_not_call ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Spammer: {data.spammer ? "Yes" : "No"}</Typography>
      </Box>
    );
  }
};

// ── Hoisted sx constants (stable references, no re-creation per render) ──
export const ROW_CELL_HIDDEN_MD = { display: { xs: "none", md: "table-cell" } };
export const ROW_CELL_HIDDEN_SM = { display: { xs: "none", sm: "table-cell" } };
export const CELL_FONT_SMALL = { fontSize: "0.75rem" };
export const CELL_FONT_TINY = { fontSize: "0.6rem" };
export const ID_CELL_SX = { fontFamily: "monospace", color: "primary.dark", fontWeight: 500, fontSize: "0.75rem" };
export const REQUESTER_BOX_SX = { display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, "&:hover .edit-requester-icon": { opacity: 1 } };
export const REQUESTER_NAME_SX = { maxWidth: "100%", fontSize: "0.75rem" };
export const EDIT_REQUESTER_BTN_SX = { opacity: 0, transition: "opacity 0.2s", p: 0.25 };
export const EDIT_ICON_SX = { fontSize: 13 };
export const FULFILLMENT_BOX_SX = { display: "flex", justifyContent: "center", gap: 0.5 };
export const FULFILLMENT_ITEM_SX = { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 32 };
export const PROGRESS_BAR_BG_SX = { width: "100%", height: 2.5, bgcolor: "grey.200", borderRadius: 1, mt: 0.2, overflow: "hidden" };
export const CHIP_BASE_SX = { textTransform: "capitalize", fontWeight: 600, height: 20, fontSize: "0.68rem", "& .MuiChip-label": { px: 0.75 } };
export const TOOLTIP_WIDE_SX = { tooltip: { sx: { maxWidth: 400, fontSize: "0.875rem" } } };
export const ACTION_BTN_PRIMARY_SX = { p: 0.35, "&:hover": { color: "primary.main", bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) } };
export const ACTION_BTN_INFO_SX = { p: 0.35, "&:hover": { color: "info.main", bgcolor: (theme) => alpha(theme.palette.info.main, 0.08) } };
export const ICON_16_SX = { fontSize: 16 };
export const ICON_18_SX = { fontSize: 18 };
export const ACTIONS_BOX_SX = { display: "flex", flexDirection: "row", gap: 0, justifyContent: "flex-end", alignItems: "center" };
export const DIVIDER_SX = { mx: 0.15, my: 0.5 };
export const ROW_BORDER_SX = { "& td": { borderColor: "grey.100" } };

// ── Constants ──
export const LEAD_CHANGE_REASONS = [
  "Lead is not sent",
  "Email not working",
  "Phone not working",
  "One or more leads from this order were already shaved",
  "Lead failed",
  "Agent is missing",
  "Other",
];

// Keep alias for backward compatibility
export const REMOVE_LEAD_REASONS = LEAD_CHANGE_REASONS;

// Country mapping function to convert full country names to two-letter codes
export const getCountryCode = (countryName) => {
  const countryMapping = {
    "United States": "US",
    Germany: "DE",
    "United Kingdom": "GB",
    UK: "UK", // Handle both GB and UK variants
    France: "FR",
    Canada: "CA",
    Australia: "AU",
    Japan: "JP",
  };
  return countryMapping[countryName] || countryName;
};

// Render lead counts utility
export const renderLeadCounts = (label, requested, fulfilled) => (
  <Typography variant="body2">
    {label}: {requested || 0} requested, {fulfilled || 0} fulfilled
  </Typography>
);
