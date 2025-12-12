import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
const clientInfoSchema = yup.object({
  client: yup.string().max(100, 'Client name must be less than 100 characters').trim(),
  clientBroker: yup.string().required('Client broker is required').max(100, 'Client broker must be less than 100 characters').trim(),
  clientNetwork: yup.string().max(100, 'Client network must be less than 100 characters').trim(),
});
const AssignClientInfoDialog = ({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
  orderData = null
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(clientInfoSchema),
    defaultValues: {
      client: '',
      clientBroker: '',
      clientNetwork: '',
    },
  });
  const handleFormSubmit = (data) => {
    onSubmit(data);
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="assign-client-info-dialog-title"
    >
      <DialogTitle id="assign-client-info-dialog-title">
        Assign Client Information
      </DialogTitle>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will assign the client information to all {orderData?.leads?.length || 0} leads in this order.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Controller
                name="client"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Client"
                    placeholder="Enter client name"
                    error={!!errors.client}
                    helperText={errors.client?.message}
                    disabled={isSubmitting}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="clientBroker"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Client Broker *"
                    placeholder="Enter client broker"
                    required
                    error={!!errors.clientBroker}
                    helperText={errors.clientBroker?.message}
                    disabled={isSubmitting}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="clientNetwork"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Client Network"
                    placeholder="Enter client network"
                    error={!!errors.clientNetwork}
                    helperText={errors.clientNetwork?.message}
                    disabled={isSubmitting}
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
          >
            {isSubmitting ? 'Assigning...' : 'Assign to All Leads'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
export default AssignClientInfoDialog;