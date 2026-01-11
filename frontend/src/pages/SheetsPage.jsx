import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Drawer,
  AppBar,
  Toolbar,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Slider,
  Tooltip,
  CircularProgress,
  Paper,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Alert,
  Snackbar,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  TableChart as SheetIcon,
  MoreVert as MoreVertIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Download as ImportIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatColorFill as FillColorIcon,
  FormatColorText as TextColorIcon,
  FilterList as FilterIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import jspreadsheet from "jspreadsheet-ce";
import "jspreadsheet-ce/dist/jspreadsheet.css";
import "jsuites/dist/jsuites.css";
import api from "../services/api";
import debounce from "lodash.debounce";

const DRAWER_WIDTH = 260;

const SheetsPage = () => {
  // State
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");
  const [sheetToEdit, setSheetToEdit] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedSheetForMenu, setSelectedSheetForMenu] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  
  // Import dialog state
  const [importType, setImportType] = useState("leads");
  const [importFilters, setImportFilters] = useState({});
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);

  // Refs
  const spreadsheetRef = useRef(null);
  const jspreadsheetInstance = useRef(null);
  const containerRef = useRef(null);

  // Fetch sheets on mount
  useEffect(() => {
    fetchSheets();
  }, []);

  // Initialize/update spreadsheet when active sheet changes
  useEffect(() => {
    if (activeSheet && spreadsheetRef.current) {
      initializeSpreadsheet();
    }
    return () => {
      if (jspreadsheetInstance.current) {
        try {
          if (Array.isArray(jspreadsheetInstance.current)) {
            jspreadsheetInstance.current.forEach(ws => {
              if (ws && ws.destroy) ws.destroy();
            });
          } else if (jspreadsheetInstance.current.destroy) {
            jspreadsheetInstance.current.destroy();
          }
        } catch (e) {
          console.warn("Error cleaning up spreadsheet:", e);
        }
        jspreadsheetInstance.current = null;
      }
    };
  }, [activeSheet?._id]);

  // Update zoom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transform = `scale(${zoom / 100})`;
      containerRef.current.style.transformOrigin = "top left";
    }
  }, [zoom]);

  const fetchSheets = async () => {
    try {
      setLoading(true);
      const response = await api.get("/sheets");
      setSheets(response.data.data || []);
    } catch (error) {
      console.error("Error fetching sheets:", error);
      showSnackbar("Failed to fetch sheets", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSheet = async (sheetId) => {
    try {
      const response = await api.get(`/sheets/${sheetId}`);
      return response.data.data;
    } catch (error) {
      console.error("Error fetching sheet:", error);
      showSnackbar("Failed to fetch sheet", "error");
      return null;
    }
  };

  const initializeSpreadsheet = () => {
    if (!spreadsheetRef.current || !activeSheet) return;

    // Destroy existing instance
    if (jspreadsheetInstance.current) {
      try {
        if (Array.isArray(jspreadsheetInstance.current)) {
          jspreadsheetInstance.current.forEach(ws => ws.destroy && ws.destroy());
        } else if (jspreadsheetInstance.current.destroy) {
          jspreadsheetInstance.current.destroy();
        }
      } catch (e) {
        console.warn("Error destroying spreadsheet:", e);
      }
    }

    // Clear the container
    spreadsheetRef.current.innerHTML = "";

    // Prepare data - ensure it's a 2D array with at least some data
    let data = activeSheet.data || [];
    if (!Array.isArray(data) || data.length === 0) {
      // Create a default 50x26 grid
      data = [];
      for (let i = 0; i < 50; i++) {
        data.push(new Array(26).fill(""));
      }
    }

    // Prepare columns
    const columns = activeSheet.columns?.length > 0
      ? activeSheet.columns.map((col) => ({
          title: col.title || "",
          width: col.width || 100,
          type: col.type || "text",
        }))
      : undefined;

    // Create spreadsheet with worksheets array (required for jspreadsheet-ce v5+)
    jspreadsheetInstance.current = jspreadsheet(spreadsheetRef.current, {
      worksheets: [{
        data: data,
        columns: columns,
        minDimensions: [26, 50],
        tableOverflow: true,
        tableWidth: "100%",
        tableHeight: "600px",
        columnSorting: true,
        columnDrag: true,
        columnResize: true,
        rowResize: true,
        allowInsertRow: true,
        allowManualInsertRow: true,
        allowInsertColumn: true,
        allowManualInsertColumn: true,
        allowDeleteRow: true,
        allowDeleteColumn: true,
        allowRenameColumn: true,
        allowComments: true,
        search: true,
        editable: true,
      }],
      // Global callbacks
      onchange: handleCellChange,
      onselection: handleSelection,
      oninsertrow: handleStructureChange,
      oninsertcolumn: handleStructureChange,
      ondeleterow: handleStructureChange,
      ondeletecolumn: handleStructureChange,
      onmoverow: handleStructureChange,
      onmovecolumn: handleStructureChange,
      onresizecolumn: handleStructureChange,
      onresizerow: handleStructureChange,
    });

    // Apply saved styles - get the first worksheet
    const worksheet = Array.isArray(jspreadsheetInstance.current) 
      ? jspreadsheetInstance.current[0] 
      : jspreadsheetInstance.current;
      
    if (activeSheet.styles && worksheet) {
      Object.entries(activeSheet.styles).forEach(([key, style]) => {
        const [row, col] = key.split(":").map(Number);
        if (!isNaN(row) && !isNaN(col) && worksheet.getCell) {
          try {
            const cellName = jspreadsheet.helpers?.getColumnNameFromCoords 
              ? jspreadsheet.helpers.getColumnNameFromCoords(col, row)
              : String.fromCharCode(65 + col) + (row + 1);
            const cell = worksheet.getCell(cellName);
            if (cell && style) {
              Object.assign(cell.style, style);
            }
          } catch (e) {
            console.warn("Error applying style:", e);
          }
        }
      });
    }

    // Set zoom from sheet meta
    if (activeSheet.meta?.zoom) {
      setZoom(activeSheet.meta.zoom);
    }
  };
  
  // Helper to get the active worksheet
  const getWorksheet = () => {
    if (!jspreadsheetInstance.current) return null;
    return Array.isArray(jspreadsheetInstance.current) 
      ? jspreadsheetInstance.current[0] 
      : jspreadsheetInstance.current;
  };

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (sheetId, updates) => {
      try {
        setSaving(true);
        await api.put(`/sheets/${sheetId}`, updates);
      } catch (error) {
        console.error("Error saving sheet:", error);
        showSnackbar("Failed to save changes", "error");
      } finally {
        setSaving(false);
      }
    }, 1000),
    []
  );

  const handleCellChange = (instance, cell, x, y, value) => {
    if (!activeSheet) return;
    const worksheet = getWorksheet();
    if (worksheet && worksheet.getData) {
      const data = worksheet.getData();
      debouncedSave(activeSheet._id, { data });
    }
  };

  const handleStructureChange = () => {
    if (!activeSheet) return;
    const worksheet = getWorksheet();
    if (worksheet && worksheet.getData) {
      const data = worksheet.getData();
      debouncedSave(activeSheet._id, { data });
    }
  };

  const handleSelection = (instance, x1, y1, x2, y2) => {
    // Can be used to show selection info or enable formatting buttons
  };

  const handleCreateSheet = async () => {
    try {
      const response = await api.post("/sheets", {
        name: "Untitled Sheet",
      });
      const newSheet = response.data.data;
      setSheets((prev) => [newSheet, ...prev]);
      handleSelectSheet(newSheet._id);
      showSnackbar("Sheet created successfully", "success");
    } catch (error) {
      console.error("Error creating sheet:", error);
      showSnackbar("Failed to create sheet", "error");
    }
  };

  const handleSelectSheet = async (sheetId) => {
    const fullSheet = await fetchSheet(sheetId);
    if (fullSheet) {
      setActiveSheet(fullSheet);
    }
  };

  const handleRenameSheet = async () => {
    if (!sheetToEdit || !newSheetName.trim()) return;
    try {
      await api.put(`/sheets/${sheetToEdit._id}`, { name: newSheetName.trim() });
      setSheets((prev) =>
        prev.map((s) =>
          s._id === sheetToEdit._id ? { ...s, name: newSheetName.trim() } : s
        )
      );
      if (activeSheet?._id === sheetToEdit._id) {
        setActiveSheet((prev) => ({ ...prev, name: newSheetName.trim() }));
      }
      setRenameDialogOpen(false);
      setSheetToEdit(null);
      setNewSheetName("");
      showSnackbar("Sheet renamed successfully", "success");
    } catch (error) {
      console.error("Error renaming sheet:", error);
      showSnackbar("Failed to rename sheet", "error");
    }
  };

  const handleDeleteSheet = async () => {
    if (!sheetToEdit) return;
    try {
      await api.delete(`/sheets/${sheetToEdit._id}`);
      setSheets((prev) => prev.filter((s) => s._id !== sheetToEdit._id));
      if (activeSheet?._id === sheetToEdit._id) {
        setActiveSheet(null);
      }
      setDeleteDialogOpen(false);
      setSheetToEdit(null);
      showSnackbar("Sheet deleted successfully", "success");
    } catch (error) {
      console.error("Error deleting sheet:", error);
      showSnackbar("Failed to delete sheet", "error");
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      const endpoint = importType === "leads" ? "/sheets/import/leads" : "/sheets/import/orders";
      const response = await api.post(endpoint, {
        name: importName || undefined,
        filters: importFilters,
      });
      const newSheet = response.data.data;
      setSheets((prev) => [newSheet, ...prev]);
      handleSelectSheet(newSheet._id);
      setImportDialogOpen(false);
      setImportName("");
      setImportFilters({});
      showSnackbar(`Imported ${response.data.importedCount} records successfully`, "success");
    } catch (error) {
      console.error("Error importing:", error);
      showSnackbar(error.response?.data?.message || "Failed to import data", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleZoomChange = (event, newValue) => {
    setZoom(newValue);
    if (activeSheet) {
      debouncedSave(activeSheet._id, { meta: { zoom: newValue } });
    }
  };

  const handleMenuOpen = (event, sheet) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedSheetForMenu(sheet);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedSheetForMenu(null);
  };

  const openRenameDialog = () => {
    setSheetToEdit(selectedSheetForMenu);
    setNewSheetName(selectedSheetForMenu?.name || "");
    setRenameDialogOpen(true);
    handleMenuClose();
  };

  const openDeleteDialog = () => {
    setSheetToEdit(selectedSheetForMenu);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  // Helper to convert column index to letter (0 = A, 1 = B, etc.)
  const getColumnLetter = (col) => {
    let letter = '';
    let temp = col;
    while (temp >= 0) {
      letter = String.fromCharCode(65 + (temp % 26)) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  // Formatting functions
  const applyBold = () => {
    const worksheet = getWorksheet();
    if (!worksheet) return;
    
    try {
      const selected = worksheet.selectedCell;
      if (selected && worksheet.getSelectedCells) {
        const cells = worksheet.getSelectedCells();
        if (cells && cells.length > 0) {
          cells.forEach((cell) => {
            if (cell && cell.style) {
              const currentWeight = cell.style.fontWeight;
              cell.style.fontWeight = currentWeight === "bold" ? "normal" : "bold";
            }
          });
          saveStyles();
        }
      }
    } catch (e) {
      console.warn("Error applying bold:", e);
    }
  };

  const applyItalic = () => {
    const worksheet = getWorksheet();
    if (!worksheet) return;
    
    try {
      if (worksheet.getSelectedCells) {
        const cells = worksheet.getSelectedCells();
        if (cells && cells.length > 0) {
          cells.forEach((cell) => {
            if (cell && cell.style) {
              const currentStyle = cell.style.fontStyle;
              cell.style.fontStyle = currentStyle === "italic" ? "normal" : "italic";
            }
          });
          saveStyles();
        }
      }
    } catch (e) {
      console.warn("Error applying italic:", e);
    }
  };

  const saveStyles = () => {
    const worksheet = getWorksheet();
    if (!activeSheet || !worksheet) return;
    
    try {
      // Extract styles from all cells
      const styles = {};
      if (worksheet.getData) {
        const data = worksheet.getData();
        for (let row = 0; row < data.length; row++) {
          for (let col = 0; col < (data[row]?.length || 0); col++) {
            const cellName = getColumnLetter(col) + (row + 1);
            if (worksheet.getCell) {
              const cell = worksheet.getCell(cellName);
              if (cell && cell.style) {
                const styleObj = {};
                if (cell.style.fontWeight === "bold") styleObj.fontWeight = "bold";
                if (cell.style.fontStyle === "italic") styleObj.fontStyle = "italic";
                if (cell.style.backgroundColor) styleObj.backgroundColor = cell.style.backgroundColor;
                if (cell.style.color) styleObj.color = cell.style.color;
                if (Object.keys(styleObj).length > 0) {
                  styles[`${row}:${col}`] = styleObj;
                }
              }
            }
          }
        }
      }
      debouncedSave(activeSheet._id, { styles });
    } catch (e) {
      console.warn("Error saving styles:", e);
    }
  };

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>
      {/* Sidebar */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={sidebarOpen}
        sx={{
          width: sidebarOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            position: "relative",
            height: "100%",
            borderRight: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateSheet}
            fullWidth
            sx={{ mb: 1 }}
          >
            New Sheet
          </Button>
          <Button
            variant="outlined"
            startIcon={<ImportIcon />}
            onClick={() => setImportDialogOpen(true)}
            fullWidth
            size="small"
          >
            Import Data
          </Button>
        </Box>
        <Divider />
        <List sx={{ overflow: "auto", flexGrow: 1 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : sheets.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
              No sheets yet. Create one to get started!
            </Typography>
          ) : (
            sheets.map((sheet) => (
              <ListItem
                key={sheet._id}
                disablePadding
                selected={activeSheet?._id === sheet._id}
                sx={{
                  "&.Mui-selected": {
                    bgcolor: "action.selected",
                  },
                }}
              >
                <ListItemButton onClick={() => handleSelectSheet(sheet._id)}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <SheetIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={sheet.name}
                    secondary={
                      sheet.sourceType !== "manual" && (
                        <Chip
                          label={sheet.sourceType}
                          size="small"
                          sx={{ height: 16, fontSize: "0.65rem" }}
                        />
                      )
                    }
                    primaryTypographyProps={{
                      noWrap: true,
                      fontSize: "0.875rem",
                    }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => handleMenuOpen(e, sheet)}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItemButton>
              </ListItem>
            ))
          )}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Toolbar */}
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            p: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
            flexWrap: "wrap",
          }}
        >
          <IconButton onClick={() => setSidebarOpen(!sidebarOpen)} size="small">
            {sidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
          <Divider orientation="vertical" flexItem />
          
          {activeSheet && (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 500, mr: 2 }}>
                {activeSheet.name}
              </Typography>
              
              {/* Formatting buttons */}
              <Tooltip title="Bold">
                <IconButton onClick={applyBold} size="small">
                  <BoldIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Italic">
                <IconButton onClick={applyItalic} size="small">
                  <ItalicIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Divider orientation="vertical" flexItem />
              
              {/* Zoom controls */}
              <Tooltip title="Zoom Out">
                <IconButton
                  onClick={() => setZoom((z) => Math.max(25, z - 10))}
                  size="small"
                >
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Box sx={{ width: 100 }}>
                <Slider
                  value={zoom}
                  onChange={handleZoomChange}
                  min={25}
                  max={200}
                  size="small"
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
              </Box>
              <Typography variant="caption" sx={{ minWidth: 40 }}>
                {zoom}%
              </Typography>
              <Tooltip title="Zoom In">
                <IconButton
                  onClick={() => setZoom((z) => Math.min(200, z + 10))}
                  size="small"
                >
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Box sx={{ flexGrow: 1 }} />
              
              {saving && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    Saving...
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Paper>

        {/* Spreadsheet Container */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: "auto",
            bgcolor: "background.default",
            p: activeSheet ? 0 : 3,
          }}
        >
          {activeSheet ? (
            <Box
              ref={containerRef}
              sx={{
                width: `${10000 / (zoom / 100)}px`,
                height: "100%",
              }}
            >
              <Box
                ref={spreadsheetRef}
                sx={{
                  height: "100%",
                  "& .jexcel": {
                    fontFamily: "inherit",
                  },
                  "& .jexcel_content": {
                    height: "100% !important",
                  },
                }}
              />
            </Box>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "text.secondary",
              }}
            >
              <SheetIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
              <Typography variant="h6" gutterBottom>
                No Sheet Selected
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select a sheet from the sidebar or create a new one
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateSheet}
              >
                Create New Sheet
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Sheet Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={openRenameDialog}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Rename
        </MenuItem>
        <MenuItem onClick={openDeleteDialog} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>Rename Sheet</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Sheet Name"
            fullWidth
            value={newSheetName}
            onChange={(e) => setNewSheetName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleRenameSheet()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRenameSheet} variant="contained">
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Sheet</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{sheetToEdit?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteSheet} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Import Data</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Import From</InputLabel>
              <Select
                value={importType}
                label="Import From"
                onChange={(e) => setImportType(e.target.value)}
              >
                <MenuItem value="leads">Leads</MenuItem>
                <MenuItem value="orders">Orders</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Sheet Name (optional)"
              fullWidth
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder={`${importType === "leads" ? "Leads" : "Orders"} Import - ${new Date().toLocaleDateString()}`}
            />

            {importType === "leads" && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Lead Type (optional)</InputLabel>
                  <Select
                    value={importFilters.leadType || ""}
                    label="Lead Type (optional)"
                    onChange={(e) =>
                      setImportFilters((prev) => ({
                        ...prev,
                        leadType: e.target.value || undefined,
                      }))
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="ftd">FTD</MenuItem>
                    <MenuItem value="filler">Filler</MenuItem>
                    <MenuItem value="cold">Cold</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Status (optional)</InputLabel>
                  <Select
                    value={importFilters.status || ""}
                    label="Status (optional)"
                    onChange={(e) =>
                      setImportFilters((prev) => ({
                        ...prev,
                        status: e.target.value || undefined,
                      }))
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="contacted">Contacted</MenuItem>
                    <MenuItem value="converted">Converted</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}

            {importType === "orders" && (
              <FormControl fullWidth>
                <InputLabel>Status (optional)</InputLabel>
                <Select
                  value={importFilters.status || ""}
                  label="Status (optional)"
                  onChange={(e) =>
                    setImportFilters((prev) => ({
                      ...prev,
                      status: e.target.value || undefined,
                    }))
                  }
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            )}

            <Alert severity="info">
              Maximum 1000 leads or 500 orders will be imported per sheet.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={importing}
            startIcon={importing ? <CircularProgress size={16} /> : <ImportIcon />}
          >
            {importing ? "Importing..." : "Import"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SheetsPage;
