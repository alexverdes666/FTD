import React, { useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";

const ACCOUNT_TYPES = [
  "Google",
  "Facebook",
  "Instagram",
  "Twitter",
  "LinkedIn",
  "WhatsApp",
  "Telegram",
  "Trading Platform",
  "Email Provider",
  "Other",
];

const schema = yup.object().shape({
  accountType: yup.string().required("Account type is required"),
  username: yup.string().optional(),
  password: yup.string().optional(),
  twoFactorSecret: yup.string().optional(),
  recoveryCodes: yup.string().optional(),
  notes: yup.string().optional(),
});

const AddEditProfileDialog = ({ open, onClose, onSubmit, profile, loading, error }) => {
  const isEdit = !!profile;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      accountType: "",
      username: "",
      password: "",
      twoFactorSecret: "",
      recoveryCodes: "",
      notes: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (open) {
      if (profile) {
        reset({
          accountType: profile.accountType || "",
          username: profile.username || "",
          password: "",
          twoFactorSecret: "",
          recoveryCodes: "",
          notes: profile.notes || "",
        });
      } else {
        reset({
          accountType: "",
          username: "",
          password: "",
          twoFactorSecret: "",
          recoveryCodes: "",
          notes: "",
        });
      }
    }
  }, [open, profile, reset]);

  const handleFormSubmit = (data) => {
    const payload = { ...data };

    // Parse recovery codes: split by newlines, commas, or spaces into individual codes
    if (payload.recoveryCodes) {
      payload.recoveryCodes = payload.recoveryCodes
        .split(/[\n,]+/)
        .map((code) => code.trim())
        .filter((code) => code.length > 0);
    } else {
      payload.recoveryCodes = [];
    }

    // For edit, only send fields that have values (don't overwrite with empty)
    if (isEdit) {
      if (!payload.password) delete payload.password;
      if (!payload.twoFactorSecret) delete payload.twoFactorSecret;
      if (payload.recoveryCodes.length === 0) delete payload.recoveryCodes;
    }

    onSubmit(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Edit Profile Credential" : "Add Profile Credential"}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="accountType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Account Type"
                  fullWidth
                  size="small"
                  required
                  error={!!errors.accountType}
                  helperText={errors.accountType?.message}
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="username"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Username / Email"
                  fullWidth
                  size="small"
                  error={!!errors.username}
                  helperText={errors.username?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={isEdit ? "Password (leave blank to keep current)" : "Password"}
                  type="password"
                  fullWidth
                  size="small"
                  error={!!errors.password}
                  helperText={errors.password?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="twoFactorSecret"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={
                    isEdit
                      ? "2FA Secret (leave blank to keep current)"
                      : "2FA Secret"
                  }
                  fullWidth
                  size="small"
                  error={!!errors.twoFactorSecret}
                  helperText={
                    errors.twoFactorSecret?.message ||
                    "Base32 secret from authenticator setup (spaces will be stripped)"
                  }
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="recoveryCodes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={
                    isEdit
                      ? "Recovery Codes (leave blank to keep current)"
                      : "Recovery Codes"
                  }
                  fullWidth
                  size="small"
                  multiline
                  minRows={3}
                  maxRows={8}
                  error={!!errors.recoveryCodes}
                  helperText={
                    errors.recoveryCodes?.message ||
                    "One code per line"
                  }
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Notes"
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                  maxRows={4}
                  error={!!errors.notes}
                  helperText={errors.notes?.message}
                />
              )}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit(handleFormSubmit)}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {isEdit ? "Update" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddEditProfileDialog;
