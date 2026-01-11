import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Checkbox,
  FormControlLabel,
  Divider,
  Chip,
  Paper,
  Tooltip,
  Alert,
} from "@mui/material";
import {
  Close as CloseIcon,
  DragIndicator as DragIcon,
  Settings as SettingsIcon,
  ContentCopy as CopyIcon,
  RestartAlt as ResetIcon,
} from "@mui/icons-material";
import { Reorder, useDragControls } from "framer-motion";

// Available fields for copying with display names
const AVAILABLE_FIELDS = [
  { id: "leadType", label: "Lead Type", description: "FTD, Filler, or Cold" },
  { id: "fullName", label: "Full Name", description: "Lead's full name" },
  { id: "newEmail", label: "Email", description: "Lead's email address" },
  { id: "newPhone", label: "Phone", description: "Lead's phone number" },
  { id: "country", label: "Country", description: "Lead's country" },
  { id: "address", label: "Address", description: "Lead's address" },
  { id: "assignedAgent", label: "Agent", description: "Assigned agent name" },
  { id: "ourNetwork", label: "Our Network (ON)", description: "Assigned our network" },
  { id: "campaign", label: "Campaign", description: "Assigned campaign" },
  { id: "clientNetwork", label: "Client Network", description: "Assigned client network" },
  { id: "clientBrokers", label: "Client Brokers", description: "All assigned client brokers" },
  { id: "requester", label: "Requester", description: "Order requester name" },
  { id: "createdAt", label: "Created Date", description: "Order creation date" },
  { id: "plannedDate", label: "Planned Date", description: "Order planned date" },
];

// Default configuration
const DEFAULT_CONFIG = {
  fields: ["leadType", "fullName", "newEmail", "newPhone", "country"],
  separator: "\t", // Tab-separated for spreadsheets
};

const STORAGE_KEY = "ordersCopyPreferences";

// Load preferences from localStorage
export const loadCopyPreferences = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate stored data
      if (parsed.fields && Array.isArray(parsed.fields)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load copy preferences:", err);
  }
  return DEFAULT_CONFIG;
};

// Save preferences to localStorage
export const saveCopyPreferences = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error("Failed to save copy preferences:", err);
  }
};

// Draggable field item component
const DraggableFieldItem = ({ field, isEnabled, onToggle }) => {
  const dragControls = useDragControls();
  const fieldInfo = AVAILABLE_FIELDS.find((f) => f.id === field.id);

  return (
    <Reorder.Item
      value={field}
      dragListener={false}
      dragControls={dragControls}
      style={{ listStyle: "none", margin: 0 }}
    >
      <Paper
        elevation={1}
        sx={{
          display: "flex",
          alignItems: "center",
          p: 1,
          mb: 1,
          borderRadius: 1,
          bgcolor: isEnabled ? "background.paper" : "action.disabledBackground",
          opacity: isEnabled ? 1 : 0.6,
          transition: "all 0.2s",
          "&:hover": {
            boxShadow: 2,
          },
        }}
      >
        <IconButton
          size="small"
          sx={{
            cursor: "grab",
            mr: 1,
            "&:active": { cursor: "grabbing" },
          }}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <DragIcon fontSize="small" />
        </IconButton>

        <FormControlLabel
          control={
            <Checkbox
              checked={isEnabled}
              onChange={() => onToggle(field.id)}
              size="small"
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={500}>
                {fieldInfo?.label || field.id}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {fieldInfo?.description}
              </Typography>
            </Box>
          }
          sx={{ flex: 1, m: 0 }}
        />

        {isEnabled && (
          <Chip
            label={field.order + 1}
            size="small"
            color="primary"
            sx={{ minWidth: 28, height: 24 }}
          />
        )}
      </Paper>
    </Reorder.Item>
  );
};

const CopyPreferencesDialog = ({ open, onClose, onSave }) => {
  const [fields, setFields] = useState([]);
  const [enabledFields, setEnabledFields] = useState(new Set());

  // Initialize from localStorage
  useEffect(() => {
    if (open) {
      const config = loadCopyPreferences();
      
      // Build fields array with order
      const orderedFields = [];
      const enabledSet = new Set(config.fields);
      
      // First, add enabled fields in their saved order
      config.fields.forEach((fieldId, index) => {
        const fieldInfo = AVAILABLE_FIELDS.find((f) => f.id === fieldId);
        if (fieldInfo) {
          orderedFields.push({ id: fieldId, order: index });
        }
      });
      
      // Then add disabled fields
      AVAILABLE_FIELDS.forEach((field) => {
        if (!enabledSet.has(field.id)) {
          orderedFields.push({ id: field.id, order: orderedFields.length });
        }
      });
      
      setFields(orderedFields);
      setEnabledFields(enabledSet);
    }
  }, [open]);

  // Handle toggling a field
  const handleToggle = (fieldId) => {
    setEnabledFields((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  };

  // Handle reordering
  const handleReorder = (newOrder) => {
    const updatedFields = newOrder.map((field, index) => ({
      ...field,
      order: index,
    }));
    setFields(updatedFields);
  };

  // Handle save
  const handleSave = () => {
    // Get enabled fields in order
    const orderedEnabledFields = fields
      .filter((f) => enabledFields.has(f.id))
      .sort((a, b) => a.order - b.order)
      .map((f) => f.id);

    const config = {
      fields: orderedEnabledFields,
      separator: "\t",
    };

    saveCopyPreferences(config);
    onSave?.(config);
    onClose();
  };

  // Handle reset to defaults
  const handleReset = () => {
    const orderedFields = DEFAULT_CONFIG.fields.map((fieldId, index) => ({
      id: fieldId,
      order: index,
    }));
    
    AVAILABLE_FIELDS.forEach((field) => {
      if (!DEFAULT_CONFIG.fields.includes(field.id)) {
        orderedFields.push({ id: field.id, order: orderedFields.length });
      }
    });
    
    setFields(orderedFields);
    setEnabledFields(new Set(DEFAULT_CONFIG.fields));
  };

  // Get preview of copy format
  const getPreview = () => {
    const enabledInOrder = fields
      .filter((f) => enabledFields.has(f.id))
      .sort((a, b) => a.order - b.order);

    if (enabledInOrder.length === 0) {
      return "No fields selected";
    }

    return enabledInOrder
      .map((f) => {
        const fieldInfo = AVAILABLE_FIELDS.find((fi) => fi.id === f.id);
        return `[${fieldInfo?.label || f.id}]`;
      })
      .join(" → ");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { maxHeight: "85vh" },
      }}
    >
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SettingsIcon color="primary" />
            <Typography variant="h6">Copy Preferences</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Select and drag fields to customize what gets copied. Fields are copied in order, separated by tabs (for easy pasting into spreadsheets).
        </Alert>

        {/* Preview */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            bgcolor: "grey.50",
            borderRadius: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Copy Format Preview:
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: "monospace",
              wordBreak: "break-word",
              color: enabledFields.size > 0 ? "text.primary" : "text.secondary",
            }}
          >
            {getPreview()}
          </Typography>
        </Paper>

        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Available Fields (drag to reorder, check to include)
        </Typography>

        {/* Draggable list */}
        <Reorder.Group
          axis="y"
          values={fields}
          onReorder={handleReorder}
          style={{ padding: 0, margin: 0 }}
        >
          {fields.map((field) => (
            <DraggableFieldItem
              key={field.id}
              field={field}
              isEnabled={enabledFields.has(field.id)}
              onToggle={handleToggle}
            />
          ))}
        </Reorder.Group>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Tooltip title="Reset to default settings">
          <Button
            onClick={handleReset}
            startIcon={<ResetIcon />}
            color="inherit"
          >
            Reset
          </Button>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<CopyIcon />}
          disabled={enabledFields.size === 0}
        >
          Save Preferences
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CopyPreferencesDialog;

// Helper function to format date
const formatDate = (date) => {
  if (!date) return "";
  try {
    const d = new Date(date);
    return d.toLocaleDateString();
  } catch {
    return "";
  }
};

// Helper function to copy leads with preferences
// orderData is optional and used for order-level fields (requester, createdAt, plannedDate)
export const copyLeadsWithPreferences = (leads, orderData, getDisplayLeadType) => {
  const config = loadCopyPreferences();
  
  if (!leads || leads.length === 0) {
    return { success: false, message: "No leads to copy" };
  }
  
  if (!config.fields || config.fields.length === 0) {
    return { success: false, message: "No fields configured for copying" };
  }

  const lines = leads.map((lead) => {
    const values = config.fields.map((fieldId) => {
      switch (fieldId) {
        case "leadType":
          return getDisplayLeadType ? getDisplayLeadType(lead)?.toUpperCase() : (lead.leadType?.toUpperCase() || "");
        case "fullName":
          return `${lead.firstName || ""} ${lead.lastName || ""}`.trim();
        case "newEmail":
          return lead.newEmail || lead.email || "";
        case "newPhone":
          return lead.newPhone || lead.phone || "";
        case "country":
          return lead.country || "";
        case "address":
          return lead.address || "";
        case "assignedAgent":
          return lead.assignedAgent?.fullName || "";
        case "ourNetwork":
          // First try order-level, then lead-level
          if (orderData?.selectedOurNetwork) {
            if (typeof orderData.selectedOurNetwork === "object" && orderData.selectedOurNetwork?.name) {
              return orderData.selectedOurNetwork.name;
            }
            return orderData.selectedOurNetwork;
          }
          if (typeof lead.ourNetwork === "object" && lead.ourNetwork?.name) {
            return lead.ourNetwork.name;
          }
          return lead.ourNetwork || "";
        case "campaign":
          // First try order-level, then lead-level
          if (orderData?.selectedCampaign) {
            if (typeof orderData.selectedCampaign === "object" && orderData.selectedCampaign?.name) {
              return orderData.selectedCampaign.name;
            }
            return orderData.selectedCampaign;
          }
          if (typeof lead.campaign === "object" && lead.campaign?.name) {
            return lead.campaign.name;
          }
          return lead.campaign || "";
        case "clientNetwork":
          // First try order-level, then lead-level
          if (orderData?.selectedClientNetwork) {
            if (typeof orderData.selectedClientNetwork === "object" && orderData.selectedClientNetwork?.name) {
              return orderData.selectedClientNetwork.name;
            }
            return orderData.selectedClientNetwork;
          }
          if (typeof lead.clientNetwork === "object" && lead.clientNetwork?.name) {
            return lead.clientNetwork.name;
          }
          return lead.clientNetwork || "";
        case "clientBrokers":
          // First try order-level, then lead-level
          if (Array.isArray(orderData?.selectedClientBrokers) && orderData.selectedClientBrokers.length > 0) {
            return orderData.selectedClientBrokers
              .map((broker) => (typeof broker === "object" ? broker.name : broker) || "")
              .filter(Boolean)
              .join(", ");
          }
          if (Array.isArray(lead.assignedClientBrokers) && lead.assignedClientBrokers.length > 0) {
            return lead.assignedClientBrokers
              .map((broker) => (typeof broker === "object" ? broker.name : broker) || "")
              .filter(Boolean)
              .join(", ");
          }
          if (typeof lead.clientBroker === "object" && lead.clientBroker?.name) {
            return lead.clientBroker.name;
          }
          return lead.clientBroker || "";
        case "requester":
          // Order-level field
          if (orderData?.requester) {
            if (typeof orderData.requester === "object" && orderData.requester?.fullName) {
              return orderData.requester.fullName;
            }
            return orderData.requester;
          }
          return "";
        case "createdAt":
          // Order-level field
          return formatDate(orderData?.createdAt);
        case "plannedDate":
          // Order-level field
          return formatDate(orderData?.plannedDate);
        default:
          return "";
      }
    });
    
    return values.join(config.separator || "\t");
  });

  const copyText = lines.join("\n");
  
  navigator.clipboard.writeText(copyText);
  
  return {
    success: true,
    message: `Copied ${leads.length} lead${leads.length > 1 ? "s" : ""} to clipboard`,
    count: leads.length,
  };
};
