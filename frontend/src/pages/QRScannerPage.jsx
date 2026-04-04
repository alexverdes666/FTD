import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Fade,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import api from "../services/api";

const QR_PREFIX = "ftd-login:";

const QRScannerPage = () => {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const [status, setStatus] = useState("scanning"); // scanning, approving, success, error
  const [error, setError] = useState("");
  const processedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) { // SCANNING
          await html5QrCodeRef.current.stop();
        }
      } catch {
        // ignore
      }
      html5QrCodeRef.current = null;
    }
  }, []);

  const handleScan = useCallback(
    async (decodedText) => {
      if (processedRef.current) return;
      if (!decodedText.startsWith(QR_PREFIX)) return;

      processedRef.current = true;
      const sessionToken = decodedText.slice(QR_PREFIX.length);

      setStatus("approving");
      await stopScanner();

      try {
        const res = await api.post("/qr-auth/approve-authenticated", {
          sessionToken,
        });
        if (res.data.success) {
          setStatus("success");
          // Brief success screen, then go back
          setTimeout(() => navigate(-1), 1500);
        } else {
          setError(res.data.message || "Approval failed");
          setStatus("error");
        }
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to approve login"
        );
        setStatus("error");
      }
    },
    [navigate, stopScanner]
  );

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mounted || !scannerRef.current) return;

      const scanner = new Html5Qrcode(scannerRef.current.id);
      html5QrCodeRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
          (text) => handleScan(text),
          () => {} // ignore continuous scan errors
        );
      } catch (err) {
        if (mounted) {
          setError("Camera access denied. Please allow camera permissions.");
          setStatus("error");
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [handleScan, stopScanner]);

  const handleRetry = () => {
    processedRef.current = false;
    setStatus("scanning");
    setError("");
    // Re-mount by navigating to same page
    navigate("/scan", { replace: true });
    window.location.reload();
  };

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "#000",
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 2,
          gap: 1,
          bgcolor: "rgba(0,0,0,0.8)",
          zIndex: 1,
        }}
      >
        <IconButton onClick={() => navigate("/dashboard")} sx={{ color: "#fff" }}>
          <ArrowBackIcon />
        </IconButton>
        <QrCodeScannerIcon sx={{ color: "#fff" }} />
        <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600 }}>
          Scan to Login
        </Typography>
      </Box>

      {/* Camera / Status */}
      <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {status === "scanning" && (
          <>
            <Box
              id="qr-scanner-region"
              ref={scannerRef}
              sx={{
                width: "100%",
                height: "100%",
                "& video": { objectFit: "cover !important" },
              }}
            />
            <Typography
              sx={{
                position: "absolute",
                bottom: 40,
                left: 0,
                right: 0,
                textAlign: "center",
                color: "#fff",
                textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                fontSize: 16,
                px: 2,
              }}
            >
              Point at the QR code on the login screen
            </Typography>
          </>
        )}

        {status === "approving" && (
          <Fade in>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 2,
              }}
            >
              <CircularProgress size={64} sx={{ color: "#fff" }} />
              <Typography sx={{ color: "#fff", fontSize: 18 }}>
                Approving login...
              </Typography>
            </Box>
          </Fade>
        )}

        {status === "success" && (
          <Fade in>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 2,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 96, color: "#4caf50" }} />
              <Typography
                sx={{ color: "#fff", fontSize: 22, fontWeight: 600 }}
              >
                Login Approved
              </Typography>
            </Box>
          </Fade>
        )}

        {status === "error" && (
          <Fade in>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 2,
                px: 3,
              }}
            >
              <ErrorOutlineIcon sx={{ fontSize: 96, color: "#f44336" }} />
              <Typography
                sx={{
                  color: "#fff",
                  fontSize: 18,
                  textAlign: "center",
                }}
              >
                {error}
              </Typography>
              <Typography
                onClick={handleRetry}
                sx={{
                  color: "#42a5f5",
                  fontSize: 16,
                  cursor: "pointer",
                  mt: 2,
                  textDecoration: "underline",
                }}
              >
                Try Again
              </Typography>
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  );
};

export default QRScannerPage;
