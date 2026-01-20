import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Collapse,
  Grid,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  VerifiedUser as VerifiedIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Help as UnknownIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from "@mui/icons-material";
import api from "../services/api";

// Risk status colors and icons
const getRiskConfig = (status) => {
  switch (status) {
    case "clean":
      return {
        color: "success",
        icon: <CheckIcon fontSize="small" />,
        label: "Clean",
        bgcolor: "#e8f5e9",
      };
    case "low_risk":
      return {
        color: "info",
        icon: <VerifiedIcon fontSize="small" />,
        label: "Low Risk",
        bgcolor: "#e3f2fd",
      };
    case "medium_risk":
      return {
        color: "warning",
        icon: <WarningIcon fontSize="small" />,
        label: "Medium Risk",
        bgcolor: "#fff3e0",
      };
    case "high_risk":
      return {
        color: "error",
        icon: <ErrorIcon fontSize="small" />,
        label: "High Risk",
        bgcolor: "#ffebee",
      };
    case "invalid":
      return {
        color: "error",
        icon: <ErrorIcon fontSize="small" />,
        label: "Invalid",
        bgcolor: "#ffebee",
      };
    default:
      return {
        color: "default",
        icon: <UnknownIcon fontSize="small" />,
        label: "Unknown",
        bgcolor: "#fafafa",
      };
  }
};

// Fraud score badge
const FraudScoreBadge = ({ score }) => {
  if (score === null || score === undefined) return <Typography variant="body2">-</Typography>;

  let color = "success";
  if (score >= 75) color = "error";
  else if (score >= 50) color = "warning";
  else if (score >= 25) color = "info";

  return (
    <Chip
      label={`${score}`}
      size="small"
      color={color}
      sx={{ minWidth: 40, fontWeight: "bold" }}
    />
  );
};

// Status chip component
const StatusChip = ({ status }) => {
  const config = getRiskConfig(status);
  return (
    <Chip
      icon={config.icon}
      label={config.label}
      size="small"
      color={config.color}
      sx={{ minWidth: 100 }}
    />
  );
};

// Lead validation row
const LeadValidationRow = ({ result, isExpanded, onToggle }) => {
  const lead = result;
  const validation = result.ipqsValidation || result;
  const summary = validation?.summary || result?.summary;

  return (
    <>
      <TableRow
        sx={{
          bgcolor: summary ? getRiskConfig(summary.overallRisk).bgcolor : "inherit",
          "&:hover": { bgcolor: "action.hover" },
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              {lead.firstName} {lead.lastName}
            </Typography>
            <Chip label={lead.leadType?.toUpperCase()} size="small" variant="outlined" />
          </Box>
        </TableCell>
        <TableCell>
          <Tooltip title={lead.newEmail}>
            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
              {lead.newEmail}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{lead.newPhone}</Typography>
        </TableCell>
        <TableCell align="center">
          {summary ? (
            <StatusChip status={summary.emailStatus} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not validated
            </Typography>
          )}
        </TableCell>
        <TableCell align="center">
          {summary ? (
            <StatusChip status={summary.phoneStatus} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not validated
            </Typography>
          )}
        </TableCell>
        <TableCell align="center">
          {summary ? (
            <StatusChip status={summary.overallRisk} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              -
            </Typography>
          )}
        </TableCell>
        <TableCell align="center">
          <IconButton size="small">
            <ExpandMoreIcon
              sx={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0, border: isExpanded ? undefined : 0 }}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 1 }}>
              <Grid container spacing={2}>
                {/* Email Details */}
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                      <EmailIcon color="primary" />
                      <Typography variant="subtitle2">Email Validation</Typography>
                      {summary && <FraudScoreBadge score={summary.emailFraudScore} />}
                    </Box>
                    {validation?.email?.success ? (
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Valid
                          </Typography>
                          <Typography variant="body2">
                            {validation.email.valid ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Disposable
                          </Typography>
                          <Typography variant="body2">
                            {validation.email.disposable ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Honeypot
                          </Typography>
                          <Typography variant="body2">
                            {validation.email.honeypot ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Recent Abuse
                          </Typography>
                          <Typography variant="body2">
                            {validation.email.recent_abuse ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Catch All
                          </Typography>
                          <Typography variant="body2">
                            {validation.email.catch_all ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            DNS Valid
                          </Typography>
                          <Typography variant="body2">
                            {validation.email.dns_valid ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Deliverability
                          </Typography>
                          <Typography variant="body2">
                            {validation.email.deliverability || "-"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Leaked
                          </Typography>
                          <Typography variant="body2">
                            {validation.email.leaked ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                      </Grid>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {validation?.email?.error || "Not validated"}
                      </Typography>
                    )}
                  </Paper>
                </Grid>

                {/* Phone Details */}
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                      <PhoneIcon color="primary" />
                      <Typography variant="subtitle2">Phone Validation</Typography>
                      {summary && <FraudScoreBadge score={summary.phoneFraudScore} />}
                    </Box>
                    {validation?.phone?.success ? (
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Valid
                          </Typography>
                          <Typography variant="body2">
                            {validation.phone.valid ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Active
                          </Typography>
                          <Typography variant="body2">
                            {validation.phone.active ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            VOIP
                          </Typography>
                          <Typography
                            variant="body2"
                            color={validation.phone.VOIP ? "error" : "inherit"}
                          >
                            {validation.phone.VOIP ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Prepaid
                          </Typography>
                          <Typography variant="body2">
                            {validation.phone.prepaid ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Line Type
                          </Typography>
                          <Typography variant="body2">
                            {validation.phone.line_type || "-"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Carrier
                          </Typography>
                          <Typography variant="body2" noWrap>
                            {validation.phone.carrier || "-"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Country
                          </Typography>
                          <Typography variant="body2">
                            {validation.phone.country || "-"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Do Not Call
                          </Typography>
                          <Typography variant="body2">
                            {validation.phone.do_not_call ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Risky
                          </Typography>
                          <Typography
                            variant="body2"
                            color={validation.phone.risky ? "error" : "inherit"}
                          >
                            {validation.phone.risky ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Spammer
                          </Typography>
                          <Typography variant="body2">
                            {validation.phone.spammer ? "Yes" : "No"}
                          </Typography>
                        </Grid>
                      </Grid>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {validation?.phone?.error || "Not validated"}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// Stats summary component
const StatsSummary = ({ stats }) => {
  if (!stats) return null;

  const categories = [
    { key: "clean", label: "Clean", color: "success" },
    { key: "low_risk", label: "Low Risk", color: "info" },
    { key: "medium_risk", label: "Medium Risk", color: "warning" },
    { key: "high_risk", label: "High Risk", color: "error" },
    { key: "invalid", label: "Invalid", color: "error" },
  ];

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Overall Risk Distribution
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {categories.map(
          (cat) =>
            stats.overallStats[cat.key] > 0 && (
              <Chip
                key={cat.key}
                label={`${cat.label}: ${stats.overallStats[cat.key]}`}
                color={cat.color}
                size="small"
                variant="outlined"
              />
            )
        )}
      </Box>
    </Box>
  );
};

// Main dialog component
const IPQSValidationDialog = ({ open, onClose, orderId, orderDetails, onValidationComplete }) => {
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Fetch existing validation results when dialog opens
  useEffect(() => {
    if (open && orderId) {
      fetchValidationResults();
    }
  }, [open, orderId]);

  const fetchValidationResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/orders/${orderId}/validation-results`);
      if (response.data.success) {
        setResults(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching validation results:", err);
      // Don't show error for 400 (no leads) - just show empty state
      if (err.response?.status !== 400) {
        setError(err.response?.data?.message || "Failed to fetch validation results");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    try {
      const response = await api.post(`/orders/${orderId}/validate-leads`);
      if (response.data.success) {
        setResults(response.data.data);
        // Notify parent component about validation completion
        if (onValidationComplete) {
          onValidationComplete(response.data.data);
        }
      }
    } catch (err) {
      console.error("Error validating leads:", err);
      setError(err.response?.data?.message || "Failed to validate leads");
    } finally {
      setValidating(false);
    }
  };

  const toggleRow = (leadId) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const hasValidatedLeads = results?.stats?.validated > 0 || results?.results?.some(r => r.ipqsValidation || r.summary);
  const allLeadsValidated = results?.stats?.total > 0 && results?.stats?.validated === results?.stats?.total;
  const hasUnvalidatedLeads = results?.stats?.notValidated > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <VerifiedIcon color="primary" />
            <Typography variant="h6">IPQS Lead Validation</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            {/* Stats Summary */}
            {results?.stats && <StatsSummary stats={results.stats} />}

            {/* Validation info */}
            <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {results?.stats?.total || 0} leads total
                {results?.stats?.validated !== undefined && (
                  <> | {results.stats.validated} validated</>
                )}
                {results?.validatedAt && (
                  <> | Last validated: {new Date(results.validatedAt).toLocaleString()}</>
                )}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={handleValidate}
                disabled={validating || allLeadsValidated}
                startIcon={validating ? <CircularProgress size={16} /> : <RefreshIcon />}
              >
                {validating
                  ? "Validating..."
                  : allLeadsValidated
                    ? "All Leads Validated"
                    : hasUnvalidatedLeads
                      ? `Validate ${results?.stats?.notValidated || 0} Unvalidated Lead(s)`
                      : "Validate Leads"}
              </Button>
            </Box>

            {validating && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  Validating leads with IPQS... This may take a moment.
                </Typography>
              </Box>
            )}

            {/* Results Table */}
            {results?.results?.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Lead</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell align="center">Email Status</TableCell>
                      <TableCell align="center">Phone Status</TableCell>
                      <TableCell align="center">Overall Risk</TableCell>
                      <TableCell align="center">Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.results.map((result) => (
                      <LeadValidationRow
                        key={result.leadId}
                        result={result}
                        isExpanded={expandedRows.has(result.leadId)}
                        onToggle={() => toggleRow(result.leadId)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No validation results yet. Click "Validate Leads" to check email and phone quality.
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default IPQSValidationDialog;
