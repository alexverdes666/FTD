import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Grid,
  Divider,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardMedia,
  IconButton,
  ImageList,
  ImageListItem,
  LinearProgress,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ThumbUp as ApproveIcon,
  ThumbDown as DisputeIcon,
  Image as ImageIcon,
  ZoomIn as ZoomInIcon,
  AddPhotoAlternate as AddPhotoIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { respondToFine, adminDecideFine } from '../services/agentFines';
import fineImagesService from '../services/fineImages';

const FineDetailDialog = ({ open, onClose, fine, onFineUpdated }) => {
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [responseDescription, setResponseDescription] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Agent response images
  const [responseImages, setResponseImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showResponseDetails, setShowResponseDetails] = useState(false);

  if (!fine) return null;

  const isAgent = user?.role === 'agent';
  const isAdmin = user?.role === 'admin';
  const isManager = ['admin', 'affiliate_manager'].includes(user?.role);
  const isOwnFine = fine.agent?._id === user?._id;

  const canAgentRespond = isAgent && isOwnFine && fine.status === 'pending_approval';
  const canAdminDecide = isAdmin && fine.status === 'disputed';

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_approval': return 'warning';
      case 'approved': return 'success';
      case 'disputed': return 'error';
      case 'admin_approved': return 'success';
      case 'admin_rejected': return 'default';
      case 'paid': return 'info';
      case 'waived': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending_approval': return 'Pending Approval';
      case 'approved': return 'Approved';
      case 'disputed': return 'Disputed';
      case 'admin_approved': return 'Admin Approved';
      case 'admin_rejected': return 'Admin Rejected';
      case 'paid': return 'Paid';
      case 'waived': return 'Waived';
      default: return status;
    }
  };

  const formatCurrency = (value) => `$${Number(value).toFixed(2)}`;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  // Handle image upload for agent response
  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploadingImage(true);
    setError(null);

    try {
      for (const file of files) {
        // Validate file
        const validation = fineImagesService.validateImageFile(file);
        if (!validation.valid) {
          setError(validation.errors.join(', '));
          continue;
        }

        // Upload image
        const result = await fineImagesService.uploadFineImage(file, null, (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        });

        if (result.success && result.data) {
          setResponseImages((prev) => [...prev, result.data]);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = (imageId) => {
    setResponseImages((prev) => prev.filter((img) => img._id !== imageId));
  };

  const handleAgentApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const imageIds = responseImages.map((img) => img._id);
      const updatedFine = await respondToFine(
        fine._id,
        'approved',
        null,
        responseDescription.trim() || null,
        imageIds.length > 0 ? imageIds : null
      );
      onFineUpdated(updatedFine);
      resetForm();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve fine');
    } finally {
      setLoading(false);
    }
  };

  const handleAgentDispute = async () => {
    if (!disputeReason.trim()) {
      setError('Please provide a reason for disputing this fine');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const imageIds = responseImages.map((img) => img._id);
      const updatedFine = await respondToFine(
        fine._id,
        'disputed',
        disputeReason,
        responseDescription.trim() || null,
        imageIds.length > 0 ? imageIds : null
      );
      onFineUpdated(updatedFine);
      resetForm();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to dispute fine');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDisputeReason('');
    setResponseDescription('');
    setResponseImages([]);
    setShowDisputeInput(false);
    setShowAdminInput(false);
    setShowResponseDetails(false);
    setError(null);
  };

  const handleAdminApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const updatedFine = await adminDecideFine(fine._id, 'approved', adminNotes);
      onFineUpdated(updatedFine);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve disputed fine');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminReject = async () => {
    setLoading(true);
    setError(null);
    try {
      const updatedFine = await adminDecideFine(fine._id, 'rejected', adminNotes);
      onFineUpdated(updatedFine);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject disputed fine');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (image) => {
    return fineImagesService.getFineImageUrl(image._id);
  };

  const getThumbnailUrl = (image) => {
    return fineImagesService.getFineImageThumbnailUrl(image._id);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <GavelIcon />
            <Typography variant="h6">Fine Details</Typography>
            <Box sx={{ ml: 'auto' }}>
              <Chip
                label={getStatusLabel(fine.status)}
                color={getStatusColor(fine.status)}
                size="small"
              />
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            {/* Basic Info */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Agent</Typography>
              <Typography variant="body1" gutterBottom>
                {fine.agent?.fullName || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Amount</Typography>
              <Typography variant="body1" fontWeight="bold" color="error.main" gutterBottom>
                {formatCurrency(fine.amount)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Fine Period</Typography>
              <Typography variant="body1" gutterBottom>
                {fine.fineMonth && fine.fineYear
                  ? `${String(fine.fineMonth).padStart(2, '0')}/${fine.fineYear}`
                  : 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Imposed By</Typography>
              <Typography variant="body1" gutterBottom>
                {fine.imposedBy?.fullName || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Reason</Typography>
              <Typography variant="body1" gutterBottom>
                {fine.reason}
              </Typography>
            </Grid>
            {fine.description && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography variant="body1" gutterBottom>
                  {fine.description}
                </Typography>
              </Grid>
            )}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Imposed Date</Typography>
              <Typography variant="body1" gutterBottom>
                {formatDate(fine.imposedDate)}
              </Typography>
            </Grid>

            {/* Lead Reference */}
            {fine.lead && (
              <>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Related Lead
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1" gutterBottom>
                    {fine.lead.firstName && fine.lead.lastName
                      ? `${fine.lead.firstName} ${fine.lead.lastName}`
                      : fine.lead.email || fine.lead.phone || 'N/A'}
                  </Typography>
                </Grid>
              </>
            )}

            {/* Evidence Images */}
            {fine.images && fine.images.length > 0 && (
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <ImageIcon fontSize="small" />
                    Evidence Images ({fine.images.length})
                  </Box>
                </Typography>
                <ImageList cols={3} gap={8} sx={{ mt: 1 }}>
                  {fine.images.map((image) => (
                    <ImageListItem key={image._id}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { boxShadow: 3 },
                        }}
                        onClick={() => setSelectedImage(image)}
                      >
                        <CardMedia
                          component="img"
                          height="120"
                          image={getThumbnailUrl(image)}
                          alt={image.originalName}
                          sx={{ objectFit: 'cover' }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            p: 0.5,
                            bgcolor: 'rgba(0,0,0,0.5)',
                            borderRadius: '4px 0 0 0',
                          }}
                        >
                          <ZoomInIcon sx={{ color: 'white', fontSize: 18 }} />
                        </Box>
                      </Card>
                    </ImageListItem>
                  ))}
                </ImageList>
              </Grid>
            )}

            {/* Agent Response */}
            {fine.agentResponse?.action && (
              <>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Agent Response
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Action</Typography>
                  <Chip
                    label={fine.agentResponse.action === 'approved' ? 'Approved' : 'Disputed'}
                    color={fine.agentResponse.action === 'approved' ? 'success' : 'error'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Response Date</Typography>
                  <Typography variant="body1">
                    {formatDate(fine.agentResponse.respondedAt)}
                  </Typography>
                </Grid>
                {fine.agentResponse.disputeReason && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Dispute Reason</Typography>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      {fine.agentResponse.disputeReason}
                    </Alert>
                  </Grid>
                )}
                {fine.agentResponse.description && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Additional Description</Typography>
                    <Typography variant="body1" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                      {fine.agentResponse.description}
                    </Typography>
                  </Grid>
                )}
                {fine.agentResponse.images && fine.agentResponse.images.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <ImageIcon fontSize="small" />
                        Agent Evidence Images ({fine.agentResponse.images.length})
                      </Box>
                    </Typography>
                    <ImageList cols={3} gap={8} sx={{ mt: 1 }}>
                      {fine.agentResponse.images.map((image) => (
                        <ImageListItem key={image._id}>
                          <Card
                            sx={{
                              cursor: 'pointer',
                              '&:hover': { boxShadow: 3 },
                            }}
                            onClick={() => setSelectedImage(image)}
                          >
                            <CardMedia
                              component="img"
                              height="120"
                              image={getThumbnailUrl(image)}
                              alt={image.originalName}
                              sx={{ objectFit: 'cover' }}
                            />
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                p: 0.5,
                                bgcolor: 'rgba(0,0,0,0.5)',
                                borderRadius: '4px 0 0 0',
                              }}
                            >
                              <ZoomInIcon sx={{ color: 'white', fontSize: 18 }} />
                            </Box>
                          </Card>
                        </ImageListItem>
                      ))}
                    </ImageList>
                  </Grid>
                )}
              </>
            )}

            {/* Admin Decision */}
            {fine.adminDecision?.action && (
              <>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Admin Decision
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Decision</Typography>
                  <Chip
                    label={fine.adminDecision.action === 'approved' ? 'Approved' : 'Rejected'}
                    color={fine.adminDecision.action === 'approved' ? 'success' : 'default'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Decided By</Typography>
                  <Typography variant="body1">
                    {fine.adminDecision.decidedBy?.fullName || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Decision Date</Typography>
                  <Typography variant="body1">
                    {formatDate(fine.adminDecision.decidedAt)}
                  </Typography>
                </Grid>
                {fine.adminDecision.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Admin Notes</Typography>
                    <Typography variant="body1">
                      {fine.adminDecision.notes}
                    </Typography>
                  </Grid>
                )}
              </>
            )}

            {/* Agent Action - Dispute Input */}
            {canAgentRespond && showDisputeInput && (
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Dispute This Fine
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Reason for Dispute *"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Explain why you are disputing this fine..."
                  required
                  disabled={loading}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Additional Description (optional)"
                  value={responseDescription}
                  onChange={(e) => setResponseDescription(e.target.value)}
                  placeholder="Provide any additional context or details..."
                  disabled={loading}
                  sx={{ mb: 2 }}
                />

                {/* Image Upload Section */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <ImageIcon fontSize="small" />
                      Evidence Images (optional)
                    </Box>
                  </Typography>
                  <input
                    accept="image/*"
                    type="file"
                    id="agent-response-image-upload"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                    disabled={loading || uploadingImage}
                  />
                  <label htmlFor="agent-response-image-upload">
                    <Button
                      component="span"
                      variant="outlined"
                      size="small"
                      startIcon={uploadingImage ? <CircularProgress size={16} /> : <AddPhotoIcon />}
                      disabled={loading || uploadingImage}
                    >
                      {uploadingImage ? 'Uploading...' : 'Add Images'}
                    </Button>
                  </label>
                  {uploadingImage && (
                    <Box sx={{ mt: 1 }}>
                      <LinearProgress variant="determinate" value={uploadProgress} />
                    </Box>
                  )}

                  {/* Preview uploaded images */}
                  {responseImages.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {responseImages.map((image) => (
                        <Box
                          key={image._id}
                          sx={{
                            position: 'relative',
                            width: 80,
                            height: 80,
                            borderRadius: 1,
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Box
                            component="img"
                            src={fineImagesService.getFineImageThumbnailUrl(image._id)}
                            alt={image.originalName}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveImage(image._id)}
                            sx={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              bgcolor: 'rgba(0,0,0,0.5)',
                              color: 'white',
                              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                              padding: '2px',
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>

                <Box display="flex" gap={1}>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleAgentDispute}
                    disabled={loading || !disputeReason.trim() || uploadingImage}
                    startIcon={loading ? <CircularProgress size={16} /> : <DisputeIcon />}
                  >
                    Submit Dispute
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setShowDisputeInput(false);
                      setDisputeReason('');
                      setResponseDescription('');
                      setResponseImages([]);
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </Box>
              </Grid>
            )}

            {/* Admin Action - Decision Input */}
            {canAdminDecide && showAdminInput && (
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Admin Decision
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Decision Notes (optional)"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add any notes about your decision..."
                  disabled={loading}
                  sx={{ mb: 2 }}
                />
                <Box display="flex" gap={1}>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleAdminApprove}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <CheckIcon />}
                  >
                    Approve Fine
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleAdminReject}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <CloseIcon />}
                  >
                    Reject Fine
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setShowAdminInput(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, flexDirection: 'column', alignItems: 'stretch' }}>
          {/* Agent Response Details - Optional section to add images/description */}
          {canAgentRespond && !showDisputeInput && (
            <Box sx={{ width: '100%', mb: showResponseDetails ? 2 : 0 }}>
              {!showResponseDetails ? (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowResponseDetails(true)}
                  startIcon={<AddPhotoIcon />}
                  sx={{ mb: 1 }}
                >
                  Add Response Details (optional)
                </Button>
              ) : (
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Add Additional Information (optional)
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Description"
                    value={responseDescription}
                    onChange={(e) => setResponseDescription(e.target.value)}
                    placeholder="Provide any additional context..."
                    disabled={loading}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Box>
                    <input
                      accept="image/*"
                      type="file"
                      id="agent-approve-image-upload"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleImageUpload}
                      disabled={loading || uploadingImage}
                    />
                    <label htmlFor="agent-approve-image-upload">
                      <Button
                        component="span"
                        variant="outlined"
                        size="small"
                        startIcon={uploadingImage ? <CircularProgress size={14} /> : <AddPhotoIcon />}
                        disabled={loading || uploadingImage}
                      >
                        {uploadingImage ? 'Uploading...' : 'Add Images'}
                      </Button>
                    </label>
                    {uploadingImage && (
                      <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 1 }} />
                    )}
                    {responseImages.length > 0 && (
                      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {responseImages.map((image) => (
                          <Box
                            key={image._id}
                            sx={{
                              position: 'relative',
                              width: 60,
                              height: 60,
                              borderRadius: 1,
                              overflow: 'hidden',
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <Box
                              component="img"
                              src={fineImagesService.getFineImageThumbnailUrl(image._id)}
                              alt={image.originalName}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveImage(image._id)}
                              sx={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                bgcolor: 'rgba(0,0,0,0.5)',
                                color: 'white',
                                padding: '1px',
                                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                              }}
                            >
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                  <Button
                    size="small"
                    onClick={() => {
                      setShowResponseDetails(false);
                      setResponseDescription('');
                      setResponseImages([]);
                    }}
                    sx={{ mt: 1 }}
                  >
                    Hide Details
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Agent Action Buttons */}
          {canAgentRespond && !showDisputeInput && (
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%' }}>
              <Button
                variant="contained"
                color="success"
                onClick={handleAgentApprove}
                disabled={loading || uploadingImage}
                startIcon={loading ? <CircularProgress size={16} /> : <ApproveIcon />}
              >
                Approve Fine
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => setShowDisputeInput(true)}
                disabled={loading}
                startIcon={<DisputeIcon />}
              >
                Dispute Fine
              </Button>
            </Box>
          )}

          {/* Admin Actions */}
          {canAdminDecide && !showAdminInput && (
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setShowAdminInput(true)}
                disabled={loading}
              >
                Make Decision
              </Button>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', mt: 1 }}>
            <Button onClick={onClose} disabled={loading}>
              Close
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        maxWidth="lg"
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography>{selectedImage?.originalName}</Typography>
            <IconButton onClick={() => setSelectedImage(null)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedImage && (
            <Box
              component="img"
              src={getImageUrl(selectedImage)}
              alt={selectedImage.originalName}
              sx={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FineDetailDialog;
