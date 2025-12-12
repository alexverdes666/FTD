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
  Link,
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
} from '@mui/material';
import {
  FileUpload as ImportIcon,
  Preview as PreviewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import api from '../services/api';
const LEAD_TYPES = {
  FTD: "ftd",
  FILLER: "filler",
  COLD: "cold",
};
const ImportLeadsDialog = ({ open, onClose, onImportComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedLeadType, setSelectedLeadType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
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
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("leadType", selectedLeadType);
      const response = await api.post("/leads/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        }
      });
      if (response.data.success) {
        setSuccess(response.data.message);
        if (onImportComplete) {
          onImportComplete();
        }
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(response.data.message || "Import failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to import leads"
      );
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
    onClose();
  };
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Leads</DialogTitle>
      <DialogContent>
        <Box sx={{ my: 2 }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
            id="csv-file-input"
          />
          <label htmlFor="csv-file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<ImportIcon />}
              fullWidth
            >
              {selectedFile ? selectedFile.name : "Select CSV File"}
            </Button>
          </label>
        </Box>
        <Box sx={{ my: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Lead Type</InputLabel>
            <Select
              value={selectedLeadType}
              label="Lead Type"
              onChange={(e) => setSelectedLeadType(e.target.value)}
            >
              {Object.entries(LEAD_TYPES).map(([key, value]) => (
                <MenuItem key={value} value={value}>
                  {key}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {}
        {csvPreview && (
          <Box sx={{ my: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Button
                onClick={() => setShowPreview(!showPreview)}
                startIcon={<PreviewIcon />}
                endIcon={showPreview ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                variant="outlined"
                size="small"
              >
                {showPreview ? 'Hide Preview' : `Preview CSV (${csvPreview.totalRows} rows)`}
              </Button>
            </Box>
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
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Expected CSV format: First name, Last name, Email, Phone number, GEO, Gender, Prefix
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Optional fields: ID front, ID back, Selfie front, Selfie back, Facebook, Twitter, Linkedin, Instagram, Telegram, WhatsApp, Date of birth, Address
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Download a{" "}
            <Link
              href="/sample-cold-leads.csv"
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              sample CSV template
            </Link>
            {" "}(Cold Leads format)
          </Typography>
        </Box>
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