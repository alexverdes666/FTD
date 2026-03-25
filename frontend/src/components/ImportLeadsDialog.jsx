import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Chip,
  Divider,
} from '@mui/material';
import {
  FileUpload as ImportIcon,
  Preview as PreviewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import api from '../services/api';

const LEAD_TYPES = {
  FTD: "ftd",
  FILLER: "filler",
  COLD: "cold",
};

const REQUIRED_COLUMNS = [
  { name: "First Name", example: "John" },
  { name: "Last Name", example: "Doe" },
  { name: "Email", example: "john@example.com" },
  { name: "Phone", example: "6045551234 (no country code)" },
  { name: "Country", example: "Canada, United Kingdom, Spain" },
  { name: "Gender", example: "male / female / other" },
  { name: "Date of Birth", example: "DD/MM/YYYY" },
  { name: "Address", example: "123 Main St, Toronto" },
  { name: "Status", example: "active / inactive / contacted / converted" },
];

const DOCUMENT_COLUMNS = [
  { name: "Doc 1 URL + Doc 1 Description", description: "At least one document required" },
  { name: "Doc 2 URL + Doc 2 Description", description: "Up to 10 document pairs supported" },
  { name: "...", description: "e.g. ID Front, ID Back, Selfie, ID Front with Selfie, ID Back with Selfie" },
];

const ImportLeadsDialog = ({ open, onClose, onImportComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedLeadType, setSelectedLeadType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [validationErrors, setValidationErrors] = useState(null);
  const [showValidationErrors, setShowValidationErrors] = useState(true);
  const [duplicateDetails, setDuplicateDetails] = useState(null);
  const [showDuplicates, setShowDuplicates] = useState(true);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        setError("Please upload a valid CSV file");
        setSelectedFile(null);
        return;
      }
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError("File size must be less than 10MB");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
      setSuccess(null);
      setCsvPreview(null);
      setValidationErrors(null);
      setDuplicateDetails(null);
      generatePreview(file);
    } else {
      setSelectedFile(null);
      setCsvPreview(null);
    }
  };

  const generatePreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvData = e.target.result;
        const rows = csvData.split('\n').map(row => row.trim()).filter(row => row.length > 0);
        if (rows.length > 0) {
          const headers = rows[0].split(',').map(header => header.trim().replace(/"/g, ''));
          const dataRows = rows.slice(1, Math.min(6, rows.length));
          setCsvPreview({
            headers,
            dataRows: dataRows.map(row => {
              const fields = row.split(',').map(field => field.trim().replace(/"/g, ''));
              return fields;
            }),
            totalRows: rows.length - 1
          });
        }
      } catch (error) {
        console.error('Error generating preview:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedLeadType) {
      setError("Please select both a file and a lead type");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    setValidationErrors(null);
    setDuplicateDetails(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("leadType", selectedLeadType);
      const response = await api.post("/leads/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.data.success) {
        setSuccess(response.data.message);
        if (response.data.duplicateDetails?.length > 0) {
          setDuplicateDetails(response.data.duplicateDetails);
        }
        if (onImportComplete) onImportComplete();
      } else {
        setError(response.data.message || "Import failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      const data = error.response?.data;
      if (data?.validationErrors) {
        setValidationErrors(data.validationErrors);
        setShowValidationErrors(true);
        setError(data.message);
      } else if (data?.duplicateDetails) {
        setDuplicateDetails(data.duplicateDetails);
        setShowDuplicates(true);
        setError(data.message);
      } else {
        setError(data?.message || error.message || "Failed to import leads");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setSelectedLeadType("");
    setError(null);
    setSuccess(null);
    setCsvPreview(null);
    setShowPreview(false);
    setShowTemplate(false);
    setValidationErrors(null);
    setDuplicateDetails(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Leads</DialogTitle>
      <DialogContent>
        {/* File Upload */}
        <Box sx={{ my: 2 }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
            id="csv-file-input"
          />
          <label htmlFor="csv-file-input">
            <Button variant="outlined" component="span" startIcon={<ImportIcon />} fullWidth>
              {selectedFile ? selectedFile.name : "Select CSV File"}
            </Button>
          </label>
        </Box>

        {/* Lead Type */}
        <Box sx={{ my: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Lead Type (FTD)</InputLabel>
            <Select
              value={selectedLeadType}
              label="Lead Type (FTD)"
              onChange={(e) => setSelectedLeadType(e.target.value)}
            >
              {Object.entries(LEAD_TYPES).map(([key, value]) => (
                <MenuItem key={value} value={value}>{key}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Template Section */}
        <Box sx={{ my: 2 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
            <Button
              onClick={() => setShowTemplate(!showTemplate)}
              variant="outlined"
              size="small"
              endIcon={showTemplate ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              {showTemplate ? "Hide Template Info" : "View Required Columns"}
            </Button>
            <Button
              href="/sample-import-template.csv"
              download
              variant="contained"
              size="small"
              startIcon={<DownloadIcon />}
              color="primary"
            >
              Download Template
            </Button>
          </Box>
          <Collapse in={showTemplate}>
            <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>
                Required Columns:
              </Typography>
              <Table size="small">
                <TableBody>
                  {REQUIRED_COLUMNS.map((col) => (
                    <TableRow key={col.name}>
                      <TableCell sx={{ fontWeight: 600, width: 140, py: 0.5, fontSize: "0.8rem" }}>{col.name}</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: "0.8rem", color: "text.secondary" }}>{col.example}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>
                Document Columns (at least one required):
              </Typography>
              <Table size="small">
                <TableBody>
                  {DOCUMENT_COLUMNS.map((col) => (
                    <TableRow key={col.name}>
                      <TableCell sx={{ fontWeight: 600, width: 180, py: 0.5, fontSize: "0.8rem" }}>{col.name}</TableCell>
                      <TableCell sx={{ py: 0.5, fontSize: "0.8rem", color: "text.secondary" }}>{col.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, color: "warning.main" }}>
                  Important Rules:
                </Typography>
                <Typography variant="body2" color="text.secondary" component="ul" sx={{ fontSize: "0.75rem", pl: 2, m: 0 }}>
                  <li><b>Country</b> must be the full name (e.g., &quot;United Kingdom&quot;, not &quot;UK&quot;)</li>
                  <li><b>Phone</b> must be without country code (e.g., &quot;7911123456&quot; not &quot;+447911123456&quot;)</li>
                  <li><b>Gender</b> must be: male, female, or other</li>
                  <li><b>Date of Birth</b> format: DD/MM/YYYY</li>
                  <li><b>Status</b> must be: active, inactive, contacted, or converted</li>
                  <li>Duplicate leads (same name, phone, email, document URL, or address) will be rejected</li>
                </Typography>
              </Box>
            </Paper>
          </Collapse>
        </Box>

        {/* CSV Preview */}
        {csvPreview && (
          <Box sx={{ my: 2 }}>
            <Button
              onClick={() => setShowPreview(!showPreview)}
              startIcon={<PreviewIcon />}
              endIcon={showPreview ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              variant="outlined"
              size="small"
            >
              {showPreview ? 'Hide Preview' : `Preview CSV (${csvPreview.totalRows} rows)`}
            </Button>
            <Collapse in={showPreview}>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  CSV Preview - First 5 rows:
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {csvPreview.headers.map((header, index) => (
                          <TableCell key={index} sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                            {header}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {csvPreview.dataRows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex} sx={{ fontSize: '0.75rem', maxWidth: 100 }}>
                              {cell || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Validation Errors */}
        {validationErrors && validationErrors.length > 0 && (
          <Box sx={{ my: 2 }}>
            <Button
              onClick={() => setShowValidationErrors(!showValidationErrors)}
              startIcon={<ErrorIcon />}
              endIcon={showValidationErrors ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              variant="outlined"
              size="small"
              color="error"
            >
              {showValidationErrors ? "Hide" : "Show"} Validation Errors ({validationErrors.length})
            </Button>
            <Collapse in={showValidationErrors}>
              <TableContainer component={Paper} sx={{ mt: 1, maxHeight: 350, border: "1px solid", borderColor: "error.main" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 50, bgcolor: "error.main", color: "#fff" }}>Row</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 150, bgcolor: "error.main", color: "#fff" }}>Lead Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", bgcolor: "error.main", color: "#fff" }}>Issues</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {validationErrors.map((err, idx) => (
                      <TableRow key={idx} sx={{ "&:nth-of-type(odd)": { bgcolor: "error.50" } }}>
                        <TableCell sx={{ fontSize: "0.75rem", fontWeight: 600 }}>{err.row}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>{err.firstName} {err.lastName}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>
                          {err.issues.map((issue, i) => (
                            <Chip
                              key={i}
                              label={issue}
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ mr: 0.5, mb: 0.5, fontSize: "0.7rem", height: "auto", "& .MuiChip-label": { whiteSpace: "normal", py: 0.3 } }}
                            />
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Box>
        )}

        {/* Duplicate Details */}
        {duplicateDetails && duplicateDetails.length > 0 && (
          <Box sx={{ my: 2 }}>
            <Button
              onClick={() => setShowDuplicates(!showDuplicates)}
              startIcon={<WarningIcon />}
              endIcon={showDuplicates ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              variant="outlined"
              size="small"
              color="warning"
            >
              {showDuplicates ? "Hide" : "Show"} Duplicates Skipped ({duplicateDetails.length})
            </Button>
            <Collapse in={showDuplicates}>
              <TableContainer component={Paper} sx={{ mt: 1, maxHeight: 300, border: "1px solid", borderColor: "warning.main" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 50, bgcolor: "warning.main", color: "#fff" }}>Row</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", width: 150, bgcolor: "warning.main", color: "#fff" }}>Lead Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", bgcolor: "warning.main", color: "#fff" }}>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {duplicateDetails.map((dup, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontSize: "0.75rem", fontWeight: 600 }}>{dup.row}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>{dup.firstName} {dup.lastName}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem" }}>
                          {dup.reasons.map((reason, i) => (
                            <Chip
                              key={i}
                              label={reason}
                              size="small"
                              color="warning"
                              variant="outlined"
                              sx={{ mr: 0.5, mb: 0.5, fontSize: "0.7rem", height: "auto", "& .MuiChip-label": { whiteSpace: "normal", py: 0.3 } }}
                            />
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Box>
        )}

        {/* Error / Success Messages */}
        {error && !validationErrors && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}
        {error && validationErrors && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error} — Fix the CSV and re-upload. No leads were imported.
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={!selectedFile || !selectedLeadType || loading}
        >
          {loading ? <CircularProgress size={24} /> : "Import"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportLeadsDialog;
