import React from "react";
import {
  Box,
  Typography,
  Dialog,
  DialogContent,
  TextField,
  Paper,
  IconButton,
} from "@mui/material";
import {
  Close as CloseIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import LeadQuickView from "../../components/LeadQuickView";

export default function AssignedLeadsModal({
  modal,
  filteredLeads,
  leadsSearchQuery,
  setLeadsSearchQuery,
  showLeadsSearch,
  setShowLeadsSearch,
  onClose,
  onNext,
  onPrev,
  getLeadWithOrderMetadata,
  expandedRowData,
  onLeadUpdate,
  onConfirmDeposit,
  onUnconfirmDeposit,
  onMarkAsShaved,
  onUnmarkAsShaved,
  user,
}) {
  if (!modal.open) return null;

  return (
      <Dialog
        open
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "transparent",
            boxShadow: "none",
            backgroundImage: "none",
          },
        }}
      >
        <DialogContent sx={{ p: 0, overflow: "visible" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{
                position: "absolute",
                top: -40,
                right: 0,
                color: "white",
                bgcolor: "rgba(0,0,0,0.5)",
                "&:hover": {
                  bgcolor: "rgba(0,0,0,0.7)",
                },
              }}
            >
              <CloseIcon />
            </IconButton>

            {filteredLeads.length > 0 ? (
              filteredLeads[modal.currentIndex] && (() => {
                // Get order data to merge metadata into lead
                const orderId = modal.orderId;
                const orderData = orderId && expandedRowData[orderId];
                const currentLead = filteredLeads[modal.currentIndex];
                const leadWithMetadata = orderData
                  ? getLeadWithOrderMetadata(currentLead, orderData)
                  : currentLead;

                return (
                <LeadQuickView
                  lead={leadWithMetadata}
                  onLeadUpdate={
                    user?.role !== "lead_manager" ? onLeadUpdate : undefined
                  }
                  readOnly={user?.role === "lead_manager"}
                  onConfirmDeposit={
                    user?.role !== "lead_manager"
                      ? (lead) => onConfirmDeposit(lead, orderId)
                      : undefined
                  }
                  onUnconfirmDeposit={
                    user?.role === "admin"
                      ? (lead) => onUnconfirmDeposit(lead, orderId)
                      : undefined
                  }
                  onMarkAsShaved={
                    user?.role !== "lead_manager"
                      ? (lead) => onMarkAsShaved(lead, orderId)
                      : undefined
                  }
                  onUnmarkAsShaved={
                    user?.role === "admin"
                      ? (lead) => onUnmarkAsShaved(lead, orderId)
                      : undefined
                  }
                  userRole={user?.role}
                  titleExtra={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {!showLeadsSearch ? (
                        <>
                          <IconButton
                            size="small"
                            onClick={() => setShowLeadsSearch(true)}
                            sx={{
                              color: "text.secondary",
                              "&:hover": { color: "primary.main" },
                            }}
                          >
                            <SearchIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                          <Typography
                            component="div"
                            variant="subtitle1"
                            color="text.secondary"
                            sx={{ fontWeight: "bold" }}
                          >
                            {modal.currentIndex + 1} /{" "}
                            {filteredLeads.length}
                            {leadsSearchQuery && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ ml: 0.5, opacity: 0.7 }}
                              >
                                (of {modal.leads.length})
                              </Typography>
                            )}
                          </Typography>
                        </>
                      ) : (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <TextField
                            size="small"
                            placeholder="Search leads..."
                            value={leadsSearchQuery}
                            onChange={(e) =>
                              setLeadsSearchQuery(e.target.value)
                            }
                            autoFocus
                            sx={{
                              width: 200,
                              "& .MuiOutlinedInput-root": {
                                height: 32,
                                fontSize: "0.875rem",
                              },
                            }}
                            InputProps={{
                              startAdornment: (
                                <SearchIcon
                                  sx={{
                                    fontSize: 16,
                                    mr: 0.5,
                                    color: "text.secondary",
                                  }}
                                />
                              ),
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => {
                              setLeadsSearchQuery("");
                              setShowLeadsSearch(false);
                            }}
                            sx={{ color: "text.secondary" }}
                          >
                            <CloseIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                          <Typography
                            component="div"
                            variant="subtitle1"
                            color="text.secondary"
                            sx={{ fontWeight: "bold", ml: 0.5 }}
                          >
                            {modal.currentIndex + 1} /{" "}
                            {filteredLeads.length}
                            {leadsSearchQuery && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ ml: 0.5, opacity: 0.7 }}
                              >
                                (of {modal.leads.length})
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
                );
              })()
            ) : (
              <Paper
                elevation={8}
                sx={{
                  width: 1000,
                  maxWidth: "95vw",
                  p: 2,
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  border: 1,
                  borderColor: "divider",
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {!showLeadsSearch ? (
                    <>
                      <IconButton
                        size="small"
                        onClick={() => setShowLeadsSearch(true)}
                        sx={{
                          color: "text.secondary",
                          "&:hover": { color: "primary.main" },
                        }}
                      >
                        <SearchIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                      <Typography
                        component="div"
                        variant="subtitle1"
                        color="text.secondary"
                        sx={{ fontWeight: "bold" }}
                      >
                        0 / {modal.leads.length}
                      </Typography>
                    </>
                  ) : (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <TextField
                        size="small"
                        placeholder="Search leads..."
                        value={leadsSearchQuery}
                        onChange={(e) => setLeadsSearchQuery(e.target.value)}
                        autoFocus
                        sx={{
                          width: 200,
                          "& .MuiOutlinedInput-root": {
                            height: 32,
                            fontSize: "0.875rem",
                          },
                        }}
                        InputProps={{
                          startAdornment: (
                            <SearchIcon
                              sx={{
                                fontSize: 16,
                                mr: 0.5,
                                color: "text.secondary",
                              }}
                            />
                          ),
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          setLeadsSearchQuery("");
                          setShowLeadsSearch(false);
                        }}
                        sx={{ color: "text.secondary" }}
                      >
                        <CloseIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                      <Typography
                        component="div"
                        variant="subtitle1"
                        color="text.secondary"
                        sx={{ fontWeight: "bold", ml: 0.5 }}
                      >
                        0 / {modal.leads.length}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            )}
          </Box>
        </DialogContent>
      </Dialog>
  );
}
