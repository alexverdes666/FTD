import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  CircularProgress,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

const positionOptions = [
  { value: "finance", label: "Finance" },
  { value: "boss", label: "Boss" },
  { value: "manager", label: "Manager" },
  { value: "affiliate_manager", label: "Affiliate Manager" },
  { value: "tech_support", label: "Tech Support" },
];

const employeeSchema = yup.object({
  name: yup
    .string()
    .required("Name is required")
    .max(100, "Name must be less than 100 characters"),
  telegramUsername: yup
    .string()
    .max(100, "Telegram username must be less than 100 characters"),
  position: yup
    .string()
    .required("Position is required")
    .oneOf(
      positionOptions.map((p) => p.value),
      "Invalid position"
    ),
});

const EmployeeForm = ({ open, onClose, onSubmit, employee = null, loading = false }) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(employeeSchema),
    defaultValues: {
      name: employee?.name || "",
      telegramUsername: employee?.telegramUsername || "",
      position: employee?.position || "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: employee?.name || "",
        telegramUsername: employee?.telegramUsername || "",
        position: employee?.position || "",
      });
    }
  }, [open, employee, reset]);

  const handleFormSubmit = (data) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogTitle>
          {employee ? "Edit Employee" : "Add Employee"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Employee Name"
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              )}
            />
            <Controller
              name="telegramUsername"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Telegram Username"
                  fullWidth
                  placeholder="@username"
                  error={!!errors.telegramUsername}
                  helperText={errors.telegramUsername?.message}
                />
              )}
            />
            <Controller
              name="position"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.position}>
                  <InputLabel>Position</InputLabel>
                  <Select {...field} label="Position">
                    {positionOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.position && (
                    <FormHelperText>{errors.position.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? (
              <CircularProgress size={20} />
            ) : employee ? (
              "Update"
            ) : (
              "Add"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export const getPositionLabel = (position) => {
  const option = positionOptions.find((p) => p.value === position);
  return option?.label || position;
};

export default EmployeeForm;
