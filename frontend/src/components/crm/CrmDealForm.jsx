import React, { useState, useEffect } from "react";
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
  InputAdornment,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../../services/api";

const crmDealSchema = yup.object({
  date: yup.string().required("Date is required"),
  ourNetwork: yup.string().required("Our network is required"),
  affiliateManager: yup.string().required("Affiliate manager is required"),
  totalSentLeads: yup
    .number()
    .typeError("Must be a number")
    .min(0, "Cannot be negative")
    .integer("Must be a whole number")
    .default(0),
  firedFtds: yup
    .number()
    .typeError("Must be a number")
    .min(0, "Cannot be negative")
    .integer("Must be a whole number")
    .default(0),
  shavedFtds: yup
    .number()
    .typeError("Must be a number")
    .min(0, "Cannot be negative")
    .integer("Must be a whole number")
    .default(0),
  totalPaid: yup
    .number()
    .typeError("Must be a number")
    .min(0, "Cannot be negative")
    .default(0),
  notes: yup.string().max(1000, "Notes must be less than 1000 characters").optional(),
});

const formatDateForInput = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toISOString().split("T")[0];
};

const CrmDealForm = ({ open, onClose, onSubmit, deal = null, loading = false }) => {
  const [ourNetworks, setOurNetworks] = useState([]);
  const [affiliateManagers, setAffiliateManagers] = useState([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(crmDealSchema),
    defaultValues: {
      date: "",
      ourNetwork: "",
      affiliateManager: "",
      totalSentLeads: 0,
      firedFtds: 0,
      shavedFtds: 0,
      totalPaid: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        date: deal ? formatDateForInput(deal.date) : "",
        ourNetwork: deal?.ourNetwork?._id || deal?.ourNetwork || "",
        affiliateManager:
          deal?.affiliateManager?._id || deal?.affiliateManager || "",
        totalSentLeads: deal?.totalSentLeads || 0,
        firedFtds: deal?.firedFtds || 0,
        shavedFtds: deal?.shavedFtds || 0,
        totalPaid: deal?.totalPaid || 0,
        notes: deal?.notes || "",
      });
      fetchDropdownData();
    }
  }, [open, deal, reset]);

  const fetchDropdownData = async () => {
    try {
      setDropdownsLoading(true);
      const [networksRes, usersRes] = await Promise.all([
        api.get("/our-networks", { params: { limit: 100 } }),
        api.get("/users", { params: { role: "affiliate_manager", limit: 100 } }),
      ]);
      setOurNetworks(networksRes.data.data || []);
      setAffiliateManagers(usersRes.data.data || []);
    } catch (error) {
      console.error("Failed to load dropdown data", error);
    } finally {
      setDropdownsLoading(false);
    }
  };

  const handleFormSubmit = (data) => {
    onSubmit({
      ...data,
      date: new Date(data.date).toISOString(),
      totalSentLeads: Number(data.totalSentLeads),
      firedFtds: Number(data.firedFtds),
      shavedFtds: Number(data.shavedFtds),
      totalPaid: Number(data.totalPaid),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogTitle>{deal ? "Edit Deal" : "Add Deal"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  error={!!errors.date}
                  helperText={errors.date?.message}
                />
              )}
            />
            <Controller
              name="ourNetwork"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.ourNetwork}>
                  <InputLabel>Our Network</InputLabel>
                  <Select
                    {...field}
                    label="Our Network"
                    disabled={dropdownsLoading}
                  >
                    {ourNetworks.map((network) => (
                      <MenuItem key={network._id} value={network._id}>
                        {network.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.ourNetwork && (
                    <FormHelperText>{errors.ourNetwork.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />
            <Controller
              name="affiliateManager"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.affiliateManager}>
                  <InputLabel>Affiliate Manager</InputLabel>
                  <Select
                    {...field}
                    label="Affiliate Manager"
                    disabled={dropdownsLoading}
                  >
                    {affiliateManagers.map((user) => (
                      <MenuItem key={user._id} value={user._id}>
                        {user.fullName}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.affiliateManager && (
                    <FormHelperText>
                      {errors.affiliateManager.message}
                    </FormHelperText>
                  )}
                </FormControl>
              )}
            />
            <Controller
              name="totalSentLeads"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Total Sent Leads"
                  type="number"
                  fullWidth
                  inputProps={{ min: 0 }}
                  error={!!errors.totalSentLeads}
                  helperText={errors.totalSentLeads?.message}
                />
              )}
            />
            <Controller
              name="firedFtds"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Fired FTDs"
                  type="number"
                  fullWidth
                  inputProps={{ min: 0 }}
                  error={!!errors.firedFtds}
                  helperText={errors.firedFtds?.message}
                />
              )}
            />
            <Controller
              name="shavedFtds"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Shaved FTDs"
                  type="number"
                  fullWidth
                  inputProps={{ min: 0 }}
                  error={!!errors.shavedFtds}
                  helperText={errors.shavedFtds?.message}
                />
              )}
            />
            <Controller
              name="totalPaid"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Total Paid"
                  type="number"
                  fullWidth
                  inputProps={{ min: 0, step: "0.01" }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">$</InputAdornment>
                    ),
                  }}
                  error={!!errors.totalPaid}
                  helperText={errors.totalPaid?.message}
                />
              )}
            />
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Notes"
                  fullWidth
                  multiline
                  rows={3}
                  error={!!errors.notes}
                  helperText={errors.notes?.message}
                />
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
            ) : deal ? (
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

export default CrmDealForm;
