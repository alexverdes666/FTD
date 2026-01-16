import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Paper,
  IconButton,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Chip,
  Tooltip,
  Slider,
  Menu,
  MenuItem,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Mouse as MouseIcon,
  Keyboard as KeyboardIcon,
  PhotoCamera as ScreenshotIcon,
  Settings as SettingsIcon,
  Send as SendIcon,
  Stop as StopIcon,
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  Link as LinkIcon,
} from "@mui/icons-material";
import browserService from "../services/browserService";

const RemoteBrowserViewer = ({
  lead,
  sessionId: initialSessionId,
  onClose,
  onSessionCreated,
}) => {
  // State
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(null);
  const [pageUrl, setPageUrl] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fps, setFps] = useState(5);
  const [quality, setQuality] = useState(60);
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [interactionMode, setInteractionMode] = useState("view"); // view, mouse, keyboard
  const [fillFormDialog, setFillFormDialog] = useState(false);
  const [formFields, setFormFields] = useState([
    { selector: "", value: "", type: "type" },
  ]);

  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const frameUnsubscribeRef = useRef(null);

  // Initialize browser service connection
  useEffect(() => {
    browserService.connect();

    return () => {
      if (frameUnsubscribeRef.current) {
        frameUnsubscribeRef.current();
      }
    };
  }, []);

  // Create session if not provided
  useEffect(() => {
    if (!sessionId && lead?._id) {
      createSession();
    } else if (sessionId) {
      fetchSessionInfo();
    }
  }, [lead?._id, sessionId]);

  // Handle frame updates
  useEffect(() => {
    if (isStreaming) {
      frameUnsubscribeRef.current = browserService.onFrame((data) => {
        if (data.sessionId === sessionId) {
          setCurrentFrame(data.image);
          setPageUrl(data.url);
          setPageTitle(data.title);
          drawFrame(data.image);
        }
      });
    }

    return () => {
      if (frameUnsubscribeRef.current) {
        frameUnsubscribeRef.current();
        frameUnsubscribeRef.current = null;
      }
    };
  }, [isStreaming, sessionId]);

  // Create a new browser session
  const createSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await browserService.createSession(lead._id);
      setSessionId(session.sessionId);
      setSessionInfo(session);

      if (onSessionCreated) {
        onSessionCreated(session);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch session info
  const fetchSessionInfo = async () => {
    try {
      const info = await browserService.getSession(sessionId);
      setSessionInfo(info);
    } catch (err) {
      console.error("Error fetching session info:", err);
    }
  };

  // Start streaming
  const startStream = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await browserService.startStream(sessionId, { fps, quality });
      setIsStreaming(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop streaming
  const stopStream = async () => {
    try {
      await browserService.stopStream(sessionId);
      setIsStreaming(false);
    } catch (err) {
      console.error("Error stopping stream:", err);
    }
  };

  // Draw frame on canvas
  const drawFrame = useCallback((base64Image) => {
    const canvas = canvasRef.current;
    if (!canvas || !base64Image) return;

    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/jpeg;base64,${base64Image}`;
  }, []);

  // Navigate to URL
  const handleNavigate = async () => {
    if (!urlInput.trim()) return;

    setIsLoading(true);
    try {
      let url = urlInput.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }

      const result = await browserService.navigateTo(sessionId, url);
      setPageUrl(result.url);
      setPageTitle(result.title);
      setUrlInput(result.url);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle canvas mouse events
  const handleCanvasClick = async (e) => {
    if (interactionMode !== "mouse" || !sessionId) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    try {
      await browserService.sendMouseEvent(sessionId, {
        type: "click",
        x,
        y,
        button: "left",
      });
    } catch (err) {
      console.error("Mouse event error:", err);
    }
  };

  // Handle keyboard events
  const handleKeyDown = async (e) => {
    if (interactionMode !== "keyboard" || !sessionId) return;

    e.preventDefault();

    try {
      await browserService.sendKeyboardEvent(sessionId, {
        type: "keypress",
        key: e.key,
      });
    } catch (err) {
      console.error("Keyboard event error:", err);
    }
  };

  // Handle scroll events
  const handleWheel = async (e) => {
    if (interactionMode !== "mouse" || !sessionId) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    try {
      await browserService.sendScrollEvent(sessionId, {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        x,
        y,
      });
    } catch (err) {
      console.error("Scroll event error:", err);
    }
  };

  // Take screenshot
  const handleScreenshot = async () => {
    try {
      const result = await browserService.takeScreenshot(sessionId, {
        type: "png",
        quality: 100,
        fullPage: true,
      });

      // Download screenshot
      const link = document.createElement("a");
      link.href = `data:image/png;base64,${result.image}`;
      link.download = `screenshot-${sessionId}-${Date.now()}.png`;
      link.click();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  // Close session
  const handleClose = async () => {
    if (isStreaming) {
      await stopStream();
    }

    if (sessionId) {
      try {
        await browserService.closeSession(sessionId, true);
      } catch (err) {
        console.error("Error closing session:", err);
      }
    }

    if (onClose) {
      onClose();
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Fill form with lead data
  const handleFillForm = async () => {
    const fields = [
      { selector: 'input[name="firstName"], input[name="first_name"]', value: lead.firstName, type: "type" },
      { selector: 'input[name="lastName"], input[name="last_name"]', value: lead.lastName, type: "type" },
      { selector: 'input[name="email"], input[type="email"]', value: lead.newEmail || lead.email, type: "type" },
      { selector: 'input[name="phone"], input[type="tel"]', value: lead.newPhone || lead.phone, type: "type" },
    ].filter(f => f.value);

    try {
      setIsLoading(true);
      const result = await browserService.fillForm(sessionId, fields);
      console.log("Form fill result:", result);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Custom form fill
  const handleCustomFillForm = async () => {
    const validFields = formFields.filter(f => f.selector && f.value);
    if (validFields.length === 0) return;

    try {
      setIsLoading(true);
      await browserService.fillForm(sessionId, validFields);
      setFillFormDialog(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: isFullscreen ? "100vh" : "80vh",
        backgroundColor: "#1e1e1e",
        borderRadius: isFullscreen ? 0 : 2,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1,
          backgroundColor: "#2d2d2d",
          borderBottom: "1px solid #404040",
        }}
      >
        {/* URL Bar */}
        <TextField
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
          placeholder="Enter URL..."
          size="small"
          sx={{
            flex: 1,
            "& .MuiOutlinedInput-root": {
              backgroundColor: "#1e1e1e",
              color: "white",
              "& fieldset": { borderColor: "#404040" },
              "&:hover fieldset": { borderColor: "#606060" },
            },
            "& input": { color: "white" },
          }}
          InputProps={{
            startAdornment: <LinkIcon sx={{ color: "#888", mr: 1 }} />,
            endAdornment: (
              <IconButton size="small" onClick={handleNavigate} disabled={isLoading}>
                <SendIcon sx={{ color: "#888" }} />
              </IconButton>
            ),
          }}
        />

        {/* Session Info */}
        {sessionInfo && (
          <Chip
            label={sessionInfo.fingerprint?.deviceType || "Device"}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}

        {/* Stream Controls */}
        {!isStreaming ? (
          <Tooltip title="Start Stream">
            <IconButton onClick={startStream} disabled={!sessionId || isLoading}>
              <PlayIcon sx={{ color: "#4caf50" }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="Stop Stream">
            <IconButton onClick={stopStream}>
              <StopIcon sx={{ color: "#f44336" }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Interaction Mode */}
        <Tooltip title={`Mode: ${interactionMode}`}>
          <IconButton
            onClick={() =>
              setInteractionMode(
                interactionMode === "view"
                  ? "mouse"
                  : interactionMode === "mouse"
                  ? "keyboard"
                  : "view"
              )
            }
          >
            {interactionMode === "mouse" ? (
              <MouseIcon sx={{ color: "#4caf50" }} />
            ) : interactionMode === "keyboard" ? (
              <KeyboardIcon sx={{ color: "#2196f3" }} />
            ) : (
              <MouseIcon sx={{ color: "#888" }} />
            )}
          </IconButton>
        </Tooltip>

        {/* Screenshot */}
        <Tooltip title="Take Screenshot">
          <IconButton onClick={handleScreenshot} disabled={!sessionId}>
            <ScreenshotIcon sx={{ color: "#888" }} />
          </IconButton>
        </Tooltip>

        {/* Auto-fill Form */}
        <Tooltip title="Auto-fill Form with Lead Data">
          <IconButton onClick={handleFillForm} disabled={!sessionId || isLoading}>
            <SaveIcon sx={{ color: "#ff9800" }} />
          </IconButton>
        </Tooltip>

        {/* Settings */}
        <Tooltip title="Settings">
          <IconButton onClick={(e) => setSettingsAnchor(e.currentTarget)}>
            <SettingsIcon sx={{ color: "#888" }} />
          </IconButton>
        </Tooltip>

        {/* Fullscreen */}
        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
          <IconButton onClick={toggleFullscreen}>
            {isFullscreen ? (
              <FullscreenExitIcon sx={{ color: "#888" }} />
            ) : (
              <FullscreenIcon sx={{ color: "#888" }} />
            )}
          </IconButton>
        </Tooltip>

        {/* Close */}
        <Tooltip title="Close Session">
          <IconButton onClick={handleClose}>
            <CloseIcon sx={{ color: "#f44336" }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ m: 1 }}>
          {error}
        </Alert>
      )}

      {/* Page Title Bar */}
      {pageTitle && (
        <Box sx={{ px: 2, py: 0.5, backgroundColor: "#252525" }}>
          <Typography variant="caption" sx={{ color: "#aaa" }}>
            {pageTitle}
          </Typography>
        </Box>
      )}

      {/* Canvas / Loading */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {isLoading && !isStreaming ? (
          <Box sx={{ textAlign: "center" }}>
            <CircularProgress sx={{ color: "#888" }} />
            <Typography variant="body2" sx={{ color: "#888", mt: 2 }}>
              {sessionId ? "Loading..." : "Creating browser session..."}
            </Typography>
          </Box>
        ) : !isStreaming && sessionId ? (
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h6" sx={{ color: "#888" }}>
              Browser session ready
            </Typography>
            <Typography variant="body2" sx={{ color: "#666", mb: 2 }}>
              Click the play button to start streaming
            </Typography>
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={startStream}
              disabled={isLoading}
            >
              Start Streaming
            </Button>
          </Box>
        ) : !sessionId ? (
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" sx={{ color: "#888" }}>
              No active session
            </Typography>
          </Box>
        ) : (
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              cursor:
                interactionMode === "mouse"
                  ? "crosshair"
                  : interactionMode === "keyboard"
                  ? "text"
                  : "default",
            }}
          />
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <Chip
            label="LIVE"
            size="small"
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: "#f44336",
              color: "white",
              animation: "pulse 2s infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.5 },
              },
            }}
          />
        )}
      </Box>

      {/* Status Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 0.5,
          backgroundColor: "#2d2d2d",
          borderTop: "1px solid #404040",
        }}
      >
        <Typography variant="caption" sx={{ color: "#888" }}>
          {pageUrl || "No page loaded"}
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Typography variant="caption" sx={{ color: "#888" }}>
            FPS: {fps}
          </Typography>
          <Typography variant="caption" sx={{ color: "#888" }}>
            Quality: {quality}%
          </Typography>
          <Typography variant="caption" sx={{ color: "#888" }}>
            Mode: {interactionMode}
          </Typography>
        </Box>
      </Box>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
      >
        <MenuItem>
          <Box sx={{ width: 200 }}>
            <Typography variant="caption">FPS</Typography>
            <Slider
              value={fps}
              onChange={(_, v) => setFps(v)}
              min={1}
              max={15}
              valueLabelDisplay="auto"
            />
          </Box>
        </MenuItem>
        <MenuItem>
          <Box sx={{ width: 200 }}>
            <Typography variant="caption">Quality</Typography>
            <Slider
              value={quality}
              onChange={(_, v) => setQuality(v)}
              min={10}
              max={100}
              valueLabelDisplay="auto"
            />
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setFillFormDialog(true); setSettingsAnchor(null); }}>
          Custom Form Fill
        </MenuItem>
      </Menu>

      {/* Custom Form Fill Dialog */}
      <Dialog
        open={fillFormDialog}
        onClose={() => setFillFormDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Custom Form Fill</DialogTitle>
        <DialogContent>
          {formFields.map((field, index) => (
            <Box key={index} sx={{ display: "flex", gap: 1, mb: 1 }}>
              <TextField
                label="CSS Selector"
                value={field.selector}
                onChange={(e) => {
                  const newFields = [...formFields];
                  newFields[index].selector = e.target.value;
                  setFormFields(newFields);
                }}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Value"
                value={field.value}
                onChange={(e) => {
                  const newFields = [...formFields];
                  newFields[index].value = e.target.value;
                  setFormFields(newFields);
                }}
                size="small"
                sx={{ flex: 1 }}
              />
            </Box>
          ))}
          <Button
            size="small"
            onClick={() =>
              setFormFields([...formFields, { selector: "", value: "", type: "type" }])
            }
          >
            Add Field
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFillFormDialog(false)}>Cancel</Button>
          <Button onClick={handleCustomFillForm} variant="contained">
            Fill Form
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RemoteBrowserViewer;
