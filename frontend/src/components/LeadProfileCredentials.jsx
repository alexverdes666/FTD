import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Collapse,
  LinearProgress,
} from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Key as KeyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import { leadProfileService } from "../services/leadProfileService";
import AddEditProfileDialog from "./AddEditProfileDialog";

const AUTHORIZED_ROLES = ["admin", "affiliate_manager", "lead_manager"];

// Blurred text display
const BlurredText = ({ text, unlocked, mono }) => (
  <Typography
    variant="body2"
    sx={{
      filter: unlocked ? "none" : "blur(6px)",
      userSelect: unlocked ? "auto" : "none",
      transition: "filter 0.3s",
      fontFamily: mono ? "monospace" : "inherit",
      fontSize: mono ? "0.85rem" : "inherit",
      wordBreak: "break-all",
    }}
  >
    {unlocked ? text : "••••••••••••"}
  </Typography>
);

// TOTP code display with countdown
const TotpDisplay = ({ profileId, unlockToken }) => {
  const [code, setCode] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const fetchCode = useCallback(async () => {
    if (!unlockToken) return;
    setLoading(true);
    try {
      const result = await leadProfileService.getTotpCode(profileId, unlockToken);
      if (result.success) {
        setCode(result.data.code);
        setTimeRemaining(result.data.timeRemaining);
      }
    } catch {
      // Token expired or error - stop polling
      setCode(null);
    } finally {
      setLoading(false);
    }
  }, [profileId, unlockToken]);

  useEffect(() => {
    if (!unlockToken) return;
    fetchCode();
    intervalRef.current = setInterval(fetchCode, 5000);
    return () => clearInterval(intervalRef.current);
  }, [fetchCode, unlockToken]);

  // Local countdown between fetches
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, []);

  if (loading && !code) {
    return <CircularProgress size={16} />;
  }

  if (!code) {
    return (
      <Typography variant="caption" color="text.secondary">
        Unable to generate code
      </Typography>
    );
  }

  const progress = (timeRemaining / 30) * 100;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography
        variant="h6"
        sx={{
          fontFamily: "monospace",
          fontWeight: "bold",
          letterSpacing: 4,
          color: "primary.main",
        }}
      >
        {code.slice(0, 3)} {code.slice(3)}
      </Typography>
      <Box sx={{ position: "relative", display: "inline-flex" }}>
        <CircularProgress
          variant="determinate"
          value={progress}
          size={32}
          thickness={4}
          color={timeRemaining <= 5 ? "error" : "primary"}
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="caption" sx={{ fontSize: "0.6rem", fontWeight: "bold" }}>
            {timeRemaining}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

// Single profile credential card
const ProfileCard = ({
  profile,
  unlocked,
  unlockToken,
  onEdit,
  onDelete,
  sensitiveData,
  onCopy,
}) => {
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  const password = sensitiveData?.password;
  const twoFactorSecret = sensitiveData?.twoFactorSecret;
  const recoveryCodes = sensitiveData?.recoveryCodes || [];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={profile.accountType}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: "medium", fontSize: "0.75rem" }}
          />
          {profile.username && (
            <Typography variant="body2" color="text.secondary">
              {profile.username}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEdit(profile)}>
              <EditIcon sx={{ fontSize: "1rem" }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => onDelete(profile)}>
              <DeleteIcon sx={{ fontSize: "1rem" }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Stack spacing={1}>
        {/* Password */}
        {profile.hasPassword && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: "bold" }}>
              Password
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <BlurredText text={password || "••••••••"} unlocked={unlocked && !!password} mono />
              {unlocked && password && (
                <Tooltip title="Copy password">
                  <IconButton size="small" onClick={() => onCopy(password, "Password")}>
                    <CopyIcon sx={{ fontSize: "0.9rem" }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        )}

        {/* 2FA Code */}
        {profile.hasTwoFactor && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: "bold" }}>
              2FA Code
            </Typography>
            {unlocked ? (
              <TotpDisplay profileId={profile._id} unlockToken={unlockToken} />
            ) : (
              <BlurredText text="000 000" unlocked={false} mono />
            )}
          </Box>
        )}

        {/* 2FA Secret */}
        {profile.hasTwoFactor && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: "bold" }}>
              2FA Secret
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <BlurredText
                text={twoFactorSecret || "••••••••"}
                unlocked={unlocked && !!twoFactorSecret}
                mono
              />
              {unlocked && twoFactorSecret && (
                <Tooltip title="Copy 2FA secret">
                  <IconButton size="small" onClick={() => onCopy(twoFactorSecret, "2FA Secret")}>
                    <CopyIcon sx={{ fontSize: "0.9rem" }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        )}

        {/* Recovery Codes */}
        {profile.recoveryCodesCount > 0 && (
          <Box>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: unlocked ? "pointer" : "default" }}
              onClick={() => unlocked && setShowRecoveryCodes((prev) => !prev)}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: "bold" }}>
                Recovery Codes ({profile.recoveryCodesCount})
              </Typography>
              {unlocked &&
                (showRecoveryCodes ? (
                  <ExpandLessIcon sx={{ fontSize: "1rem" }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: "1rem" }} />
                ))}
            </Box>
            {unlocked ? (
              <Collapse in={showRecoveryCodes}>
                <Box
                  sx={{
                    mt: 0.5,
                    p: 1,
                    bgcolor: "grey.50",
                    borderRadius: 1,
                    fontFamily: "monospace",
                  }}
                >
                  {recoveryCodes.map((code, idx) => (
                    <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                        {code}
                      </Typography>
                      <Tooltip title="Copy code">
                        <IconButton
                          size="small"
                          onClick={() => onCopy(code, `Recovery code ${idx + 1}`)}
                          sx={{ p: 0.25 }}
                        >
                          <CopyIcon sx={{ fontSize: "0.75rem" }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            ) : (
              <BlurredText text="XXXX XXXX XXXX" unlocked={false} mono />
            )}
          </Box>
        )}

        {/* Notes */}
        {profile.notes && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: "bold" }}>
              Notes
            </Typography>
            <Typography variant="caption" display="block">
              {profile.notes}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

// Main component
const LeadProfileCredentials = ({ leadId }) => {
  const user = useSelector(selectUser);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copyMsg, setCopyMsg] = useState(null);

  // Unlock state
  const [unlockToken, setUnlockToken] = useState(null);
  const [unlockExpiresAt, setUnlockExpiresAt] = useState(null);
  const [unlockTimeLeft, setUnlockTimeLeft] = useState(0);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Sensitive data cache (keyed by profile id)
  const [sensitiveDataMap, setSensitiveDataMap] = useState({});

  // Add/Edit dialog
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isAuthorized =
    user && AUTHORIZED_ROLES.includes(user.role);

  // Fetch profiles
  const fetchProfiles = useCallback(async () => {
    if (!leadId || !isAuthorized) return;
    setLoading(true);
    setError(null);
    try {
      const result = await leadProfileService.getProfilesByLead(leadId);
      if (result.success) {
        setProfiles(result.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load profile credentials");
    } finally {
      setLoading(false);
    }
  }, [leadId, isAuthorized]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Unlock countdown timer
  useEffect(() => {
    if (!unlockExpiresAt) return;
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(unlockExpiresAt) - Date.now()) / 1000)
      );
      setUnlockTimeLeft(remaining);
      if (remaining <= 0) {
        setUnlockToken(null);
        setUnlockExpiresAt(null);
        setSensitiveDataMap({});
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [unlockExpiresAt]);

  // Fetch sensitive data for all profiles when unlocked
  useEffect(() => {
    if (!unlockToken || profiles.length === 0) return;
    const fetchSensitive = async () => {
      const map = {};
      for (const p of profiles) {
        try {
          const result = await leadProfileService.getSensitiveFields(
            p._id,
            unlockToken
          );
          if (result.success) {
            map[p._id] = result.data;
          }
        } catch {
          // ignore individual failures
        }
      }
      setSensitiveDataMap(map);
    };
    fetchSensitive();
  }, [unlockToken, profiles]);

  // Password verification
  const handleVerifyPassword = async () => {
    if (!passwordValue) return;
    setVerifying(true);
    setPasswordError("");
    try {
      const result = await leadProfileService.verifyPassword(passwordValue);
      if (result.success) {
        setUnlockToken(result.data.unlockToken);
        setUnlockExpiresAt(result.data.expiresAt);
        setPasswordDialogOpen(false);
        setPasswordValue("");
      }
    } catch (err) {
      setPasswordError(err.message || "Invalid password");
    } finally {
      setVerifying(false);
    }
  };

  const handleLock = () => {
    setUnlockToken(null);
    setUnlockExpiresAt(null);
    setSensitiveDataMap({});
    setUnlockTimeLeft(0);
  };

  // Copy to clipboard
  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`${label} copied`);
      setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg("Failed to copy");
      setTimeout(() => setCopyMsg(null), 2000);
    }
  };

  // Add/Edit handlers
  const handleOpenAdd = () => {
    setEditingProfile(null);
    setSaveError(null);
    setAddEditOpen(true);
  };

  const handleOpenEdit = (profile) => {
    setEditingProfile(profile);
    setSaveError(null);
    setAddEditOpen(true);
  };

  const handleSave = async (data) => {
    setSaving(true);
    setSaveError(null);
    try {
      if (editingProfile) {
        await leadProfileService.updateProfile(editingProfile._id, data);
      } else {
        await leadProfileService.createProfile({ ...data, leadId });
      }
      setAddEditOpen(false);
      setEditingProfile(null);
      // Re-fetch profiles and sensitive data
      fetchProfiles();
      if (unlockToken) {
        setSensitiveDataMap({});
      }
    } catch (err) {
      setSaveError(err.message || "Failed to save profile credential");
    } finally {
      setSaving(false);
    }
  };

  // Delete handlers
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await leadProfileService.deleteProfile(deleteTarget._id);
      setDeleteTarget(null);
      fetchProfiles();
    } catch (err) {
      setError(err.message || "Failed to delete profile credential");
    } finally {
      setDeleting(false);
    }
  };

  if (!isAuthorized) return null;

  const unlocked = !!unlockToken;

  return (
    <Paper
      elevation={0}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      sx={{
        p: 1.5,
        bgcolor: "background.paper",
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            color: "primary.main",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            fontSize: "0.8rem",
          }}
        >
          <KeyIcon sx={{ fontSize: "1rem" }} />
          Profile Credentials
          {profiles.length > 0 && (
            <Chip label={profiles.length} size="small" sx={{ height: 18, fontSize: "0.65rem", ml: 0.5 }} />
          )}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {copyMsg && (
            <Typography variant="caption" color="success.main" sx={{ fontSize: "0.7rem" }}>
              {copyMsg}
            </Typography>
          )}
          {unlocked && (
            <Chip
              label={`Unlocked ${Math.floor(unlockTimeLeft / 60)}:${String(unlockTimeLeft % 60).padStart(2, "0")}`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: "0.65rem", height: 20 }}
              onDelete={handleLock}
            />
          )}
          {!unlocked && profiles.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<LockOpenIcon sx={{ fontSize: "0.9rem !important" }} />}
              onClick={() => setPasswordDialogOpen(true)}
              sx={{ fontSize: "0.7rem", py: 0.25, textTransform: "none" }}
            >
              Unlock
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: "0.9rem !important" }} />}
            onClick={handleOpenAdd}
            sx={{ fontSize: "0.7rem", py: 0.25, textTransform: "none" }}
          >
            Add Profile
          </Button>
        </Stack>
      </Box>

      {/* Unlock progress bar */}
      {unlocked && (
        <LinearProgress
          variant="determinate"
          value={(unlockTimeLeft / 300) * 100}
          sx={{ mb: 1, height: 2, borderRadius: 1 }}
          color={unlockTimeLeft <= 30 ? "error" : "primary"}
        />
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Profiles list */}
      {!loading && profiles.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          No profile credentials added yet.
        </Typography>
      )}
      {!loading && profiles.length > 0 && (
        <Stack spacing={1}>
          {profiles.map((profile) => (
            <ProfileCard
              key={profile._id}
              profile={profile}
              unlocked={unlocked}
              unlockToken={unlockToken}
              sensitiveData={sensitiveDataMap[profile._id]}
              onEdit={handleOpenEdit}
              onDelete={setDeleteTarget}
              onCopy={handleCopy}
            />
          ))}
        </Stack>
      )}

      {/* Password verification dialog */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => {
          setPasswordDialogOpen(false);
          setPasswordValue("");
          setPasswordError("");
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Verify Password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter your account password to unlock sensitive credentials for 5 minutes.
          </Typography>
          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            type="password"
            label="Your Password"
            size="small"
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyPassword()}
            error={!!passwordError}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPasswordDialogOpen(false);
              setPasswordValue("");
              setPasswordError("");
            }}
            disabled={verifying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleVerifyPassword}
            variant="contained"
            disabled={verifying || !passwordValue}
            startIcon={verifying ? <CircularProgress size={16} /> : <LockOpenIcon />}
          >
            Unlock
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Edit dialog */}
      <AddEditProfileDialog
        open={addEditOpen}
        onClose={() => {
          setAddEditOpen(false);
          setEditingProfile(null);
          setSaveError(null);
        }}
        onSubmit={handleSave}
        profile={editingProfile}
        loading={saving}
        error={saveError}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Profile Credential</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete the{" "}
            <strong>{deleteTarget?.accountType}</strong> profile credential
            {deleteTarget?.username ? ` for ${deleteTarget.username}` : ""}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default LeadProfileCredentials;
