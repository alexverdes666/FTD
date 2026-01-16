import React from "react";
import {
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Slide,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import RemoteBrowserViewer from "./RemoteBrowserViewer";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/**
 * Dialog wrapper for RemoteBrowserViewer
 * Opens a full-screen dialog with the browser viewer
 */
const RemoteBrowserDialog = ({
  open,
  onClose,
  lead,
  sessionId,
  onSessionCreated,
}) => {
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      TransitionComponent={Transition}
      PaperProps={{
        sx: {
          backgroundColor: "#1e1e1e",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1,
          backgroundColor: "#252525",
          borderBottom: "1px solid #404040",
        }}
      >
        <Typography variant="h6" sx={{ color: "white" }}>
          {lead ? `Browser Session - ${lead.firstName} ${lead.lastName}` : "Remote Browser"}
        </Typography>
        <IconButton onClick={handleClose} sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent sx={{ p: 0, backgroundColor: "#1e1e1e" }}>
        {open && (
          <RemoteBrowserViewer
            lead={lead}
            sessionId={sessionId}
            onClose={handleClose}
            onSessionCreated={onSessionCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RemoteBrowserDialog;
