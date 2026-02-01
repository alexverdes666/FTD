import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Avatar,
  Divider,
  Stack,
  Card,
  CardContent,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  alpha,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Assignment as AssignIcon,
  AssignmentInd as AssignmentIndIcon,
  CheckCircle as ResolveIcon,
  Comment as CommentIcon,
  Image as ImageIcon,
  Send as SendIcon,
  Gavel as GavelIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { selectUser } from '../store/slices/authSlice';
import ticketsService from '../services/tickets';
import { adminDecideFine } from '../services/agentFines';
import { getFineImageUrl, getFineImageThumbnailUrl } from '../services/fineImages';

const TicketDetailDialog = ({
  open,
  onClose,
  ticketId,
  onTicketUpdate
}) => {
  const theme = useTheme();
  const user = useSelector(selectUser);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Resolve ticket states
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);

  // Fine dispute decision states
  const [decidingFine, setDecidingFine] = useState(false);
  const [showDecisionNotes, setShowDecisionNotes] = useState(null); // 'approve' or 'reject'
  const [decisionNotes, setDecisionNotes] = useState('');

  // Assignment states
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loadingAssignableUsers, setLoadingAssignableUsers] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);

  // Image upload states
  const [uploadingImages, setUploadingImages] = useState(false);
  const [commentImages, setCommentImages] = useState([]);
  const [commentImageIds, setCommentImageIds] = useState([]);

  // Ticket images state
  const [ticketImages, setTicketImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // Image preview state
  const [previewImage, setPreviewImage] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  // Track whether preview is a fine image or ticket image
  const [previewIsFineImage, setPreviewIsFineImage] = useState(false);

  const handleImageMouseEnter = (event, img, isFineImage = false) => {
    setPreviewPosition({ x: 20, y: 20 });
    setPreviewImage(img);
    setPreviewIsFineImage(isFineImage);
  };

  const handleImageMouseLeave = () => {
    setPreviewImage(null);
    setPreviewIsFineImage(false);
  };

  // Load ticket details
  useEffect(() => {
    if (open && ticketId) {
      loadTicketDetails();
      loadTicketImages();
    }
    if (!open) {
      setShowAssignForm(false);
      setSelectedAssignee('');
    }
  }, [open, ticketId]);

  const loadTicketDetails = async () => {
    try {
      setLoading(true);
      const response = await ticketsService.getTicket(ticketId);
      setTicket(response.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load ticket details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const loadTicketImages = async () => {
    try {
      setLoadingImages(true);
      const response = await ticketsService.getTicketImages(ticketId);
      if (response.success) {
        setTicketImages(response.data);
      }
    } catch (error) {
      console.error('Failed to load ticket images:', error);
    } finally {
      setLoadingImages(false);
    }
  };

  const loadAssignableUsers = async () => {
    try {
      setLoadingAssignableUsers(true);
      const response = await ticketsService.getAssignableUsers();
      if (response.success) {
        setAssignableUsers(response.data);
      }
    } catch (error) {
      console.error('Failed to load assignable users:', error);
    } finally {
      setLoadingAssignableUsers(false);
    }
  };

  const handleAssignTicket = async () => {
    if (!selectedAssignee) {
      toast.error('Please select a user to assign');
      return;
    }

    try {
      setAssigning(true);
      const response = await ticketsService.assignTicket(ticketId, selectedAssignee);
      toast.success(response.message || 'Ticket assigned successfully');
      setTicket(response.data);
      setShowAssignForm(false);
      setSelectedAssignee('');

      if (onTicketUpdate) {
        onTicketUpdate(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign ticket');
    } finally {
      setAssigning(false);
    }
  };

  const handleShowAssignForm = () => {
    setShowAssignForm(true);
    if (assignableUsers.length === 0) {
      loadAssignableUsers();
    }
  };

  const handleCommentImageSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      toast.error('Only JPEG, PNG, GIF, and WebP images are allowed');
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > maxSize);

    if (oversizedFiles.length > 0) {
      toast.error('Image files must be under 50MB');
      return;
    }

    setUploadingImages(true);
    const newImageIds = [];

    try {
      for (const file of files) {
        const response = await ticketsService.uploadTicketImage(file, ticketId);
        if (response.success) {
          newImageIds.push(response.data._id);
          setCommentImages(prev => [...prev, {
            id: response.data._id,
            name: file.name,
            url: ticketsService.getTicketImageThumbnailUrl(response.data._id)
          }]);
        }
      }
      setCommentImageIds(prev => [...prev, ...newImageIds]);
      toast.success(`${files.length} image(s) uploaded successfully`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveCommentImage = async (imageId) => {
    try {
      await ticketsService.deleteTicketImage(imageId);
      setCommentImages(prev => prev.filter(img => img.id !== imageId));
      setCommentImageIds(prev => prev.filter(id => id !== imageId));
      toast.success('Image removed');
    } catch (error) {
      toast.error('Failed to remove image');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    try {
      setAddingComment(true);
      const response = await ticketsService.addComment(ticketId, {
        message: newComment.trim(),
        isInternal: false,
        imageIds: commentImageIds
      });
      setTicket(response.data);
      setNewComment('');
      setCommentImages([]);
      setCommentImageIds([]);

      await loadTicketImages();

      toast.success('Comment added successfully');

      if (onTicketUpdate) {
        onTicketUpdate(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const handleResolveTicket = async () => {
    try {
      setResolving(true);
      const response = await ticketsService.resolveTicket(ticketId, resolutionNote);
      toast.success('Ticket resolved successfully');
      setShowResolveForm(false);
      setResolutionNote('');

      setTicket(response.data);

      if (onTicketUpdate) {
        onTicketUpdate(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resolve ticket');
    } finally {
      setResolving(false);
    }
  };

  // Handle fine dispute decision (approve = drop fine, reject = keep fine)
  const handleFineDecision = async (decision) => {
    if (!ticket?.relatedFine?._id) return;

    try {
      setDecidingFine(true);
      // "approve" the dispute = reject the fine (fine is dropped)
      // "reject" the dispute = approve the fine (fine stands)
      const apiAction = decision === 'approve' ? 'rejected' : 'approved';
      await adminDecideFine(ticket.relatedFine._id, apiAction, decisionNotes || null);

      toast.success(
        decision === 'approve'
          ? 'Dispute approved - fine has been dropped'
          : 'Dispute rejected - fine still stands'
      );

      setShowDecisionNotes(null);
      setDecisionNotes('');

      // Reload ticket to get updated fine status
      await loadTicketDetails();

      if (onTicketUpdate && ticket) {
        onTicketUpdate(ticket);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to make decision on fine');
    } finally {
      setDecidingFine(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isTicketOwner = ticket && ticket.createdBy._id === user?._id;
  const isAssignee = ticket && ticket.assignedTo && ticket.assignedTo._id === user?._id;

  // Fine dispute helpers
  const isFineDispute = ticket?.category === 'fine_dispute' && ticket?.relatedFine;
  const fine = ticket?.relatedFine;
  const fineIsDecided = fine && ['admin_approved', 'admin_rejected'].includes(fine.status);
  const fineStatusLabel = fine ? {
    'pending_approval': 'Pending',
    'approved': 'Approved by Agent',
    'disputed': 'Disputed',
    'admin_approved': 'Fine Stands (Dispute Rejected)',
    'admin_rejected': 'Fine Dropped (Dispute Approved)',
    'paid': 'Paid',
    'waived': 'Waived'
  }[fine.status] || fine.status : '';
  const fineStatusColor = fine ? {
    'disputed': 'warning',
    'admin_approved': 'error',
    'admin_rejected': 'success',
    'paid': 'info',
    'waived': 'default'
  }[fine.status] || 'default' : 'default';

  if (!ticket && loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={28} />
        </DialogContent>
      </Dialog>
    );
  }

  if (!ticket) return null;

  // Helper to render fine image thumbnails
  const renderFineImages = (imageIds, label) => {
    if (!imageIds || imageIds.length === 0) return null;
    return (
      <Box>
        <Typography variant="caption" fontWeight={600}>{label}:</Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          {imageIds.map((imgId) => {
            const id = typeof imgId === 'object' ? imgId._id || imgId : imgId;
            return (
              <Box
                key={id}
                sx={{
                  width: 50,
                  height: 50,
                  borderRadius: 1,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: `1px solid ${theme.palette.divider}`,
                  '&:hover': { boxShadow: 2, borderColor: theme.palette.primary.main }
                }}
                onClick={() => window.open(getFineImageUrl(id), '_blank')}
                onMouseEnter={(e) => handleImageMouseEnter(e, { _id: id }, true)}
                onMouseLeave={handleImageMouseLeave}
              >
                <Box
                  component="img"
                  src={getFineImageThumbnailUrl(id)}
                  alt="Evidence"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Box>
            );
          })}
        </Stack>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {isFineDispute ? 'Fine Dispute Details' : 'Ticket Details'}
          </Typography>
          {ticketsService.isTicketOverdue(ticket) && (
            <ScheduleIcon color="warning" fontSize="small" />
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 1.5 }}>
        <Stack spacing={1.5}>
          {/* Ticket Header */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
              {ticket.title}
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              <Chip
                label={ticketsService.formatTicketStatus(ticket.status)}
                color={ticketsService.getStatusColor(ticket.status)}
                size="small"
                sx={{ height: 22, fontSize: '0.75rem' }}
              />
              <Chip
                label={ticketsService.formatTicketPriority(ticket.priority)}
                color={ticketsService.getPriorityColor(ticket.priority)}
                size="small"
                sx={{ height: 22, fontSize: '0.75rem' }}
              />
              <Chip
                label={ticketsService.formatTicketCategory(ticket.category)}
                variant="outlined"
                size="small"
                sx={{ height: 22, fontSize: '0.75rem' }}
              />
              {ticket.tags && ticket.tags.map(tag => (
                <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.75rem' }} />
              ))}
            </Stack>
          </Box>

          {/* Fine Dispute Details Section */}
          {isFineDispute && fine && (
            <Card variant="outlined" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.04), borderColor: alpha(theme.palette.warning.main, 0.3) }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack spacing={1.5}>
                  {/* Fine Status */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <GavelIcon sx={{ fontSize: 18 }} color="warning" />
                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.8rem' }}>
                        Fine Details
                      </Typography>
                    </Box>
                    <Chip
                      label={fineStatusLabel}
                      color={fineStatusColor}
                      size="small"
                      sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                    />
                  </Box>

                  <Divider />

                  {/* Manager / Fine Imposer Side */}
                  <Box>
                    <Typography variant="caption" fontWeight={700} color="error.main" sx={{ fontSize: '0.75rem', mb: 0.5, display: 'block' }}>
                      Imposed By (Manager)
                    </Typography>
                    <Stack spacing={0.75} sx={{ pl: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Avatar sx={{ width: 22, height: 22, fontSize: '0.65rem', bgcolor: theme.palette.error.main }}>
                          {fine.imposedBy?.fullName?.charAt(0) || '?'}
                        </Avatar>
                        <Typography variant="caption" fontWeight={600}>
                          {fine.imposedBy?.fullName || 'Unknown'}
                        </Typography>
                        {fine.imposedDate && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                            {new Date(fine.imposedDate).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Amount</Typography>
                          <Typography variant="caption" fontWeight={700} display="block" color="error.main" sx={{ fontSize: '0.85rem' }}>
                            ${fine.amount}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Reason</Typography>
                          <Typography variant="caption" fontWeight={600} display="block">
                            {fine.reason}
                          </Typography>
                        </Box>
                        {fine.fineMonth && fine.fineYear && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Period</Typography>
                            <Typography variant="caption" fontWeight={600} display="block">
                              {fine.fineMonth}/{fine.fineYear}
                            </Typography>
                          </Box>
                        )}
                        {fine.orderId && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Order ID</Typography>
                            <Typography variant="caption" fontWeight={600} display="block" sx={{ fontSize: '0.7rem' }}>
                              {typeof fine.orderId === 'object' ? fine.orderId._id : fine.orderId}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      {fine.description && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Description</Typography>
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.75rem' }}>
                            {fine.description}
                          </Typography>
                        </Box>
                      )}
                      {fine.notes && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Notes</Typography>
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.75rem' }}>
                            {fine.notes}
                          </Typography>
                        </Box>
                      )}
                      {renderFineImages(fine.images, 'Evidence')}
                    </Stack>
                  </Box>

                  <Divider />

                  {/* Agent / Dispute Side */}
                  <Box>
                    <Typography variant="caption" fontWeight={700} color="info.main" sx={{ fontSize: '0.75rem', mb: 0.5, display: 'block' }}>
                      Agent Dispute
                    </Typography>
                    <Stack spacing={0.75} sx={{ pl: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Avatar sx={{ width: 22, height: 22, fontSize: '0.65rem', bgcolor: theme.palette.info.main }}>
                          {fine.agent?.fullName?.charAt(0) || '?'}
                        </Avatar>
                        <Typography variant="caption" fontWeight={600}>
                          {fine.agent?.fullName || 'Unknown'}
                        </Typography>
                        {fine.agentResponse?.respondedAt && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                            {new Date(fine.agentResponse.respondedAt).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                      {fine.agentResponse?.disputeReason && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Dispute Reason</Typography>
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.75rem' }}>
                            {fine.agentResponse.disputeReason}
                          </Typography>
                        </Box>
                      )}
                      {fine.agentResponse?.description && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Additional Details</Typography>
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.75rem' }}>
                            {fine.agentResponse.description}
                          </Typography>
                        </Box>
                      )}
                      {renderFineImages(fine.agentResponse?.images, 'Agent Evidence')}
                    </Stack>
                  </Box>

                  {/* Admin Decision (if already decided) */}
                  {fine.adminDecision?.action && (
                    <>
                      <Divider />
                      <Alert
                        severity={fine.status === 'admin_rejected' ? 'success' : 'error'}
                        sx={{ py: 0.25, px: 1, '& .MuiAlert-message': { py: 0.5 } }}
                      >
                        <Typography variant="caption" fontWeight={600}>
                          {fine.status === 'admin_rejected'
                            ? 'Dispute Approved - Fine has been dropped'
                            : 'Dispute Rejected - Fine still stands'}
                        </Typography>
                        {fine.adminDecision.decidedBy && (
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem' }}>
                            Decided by: {fine.adminDecision.decidedBy?.fullName || 'Admin'}
                            {fine.adminDecision.decidedAt && ` on ${new Date(fine.adminDecision.decidedAt).toLocaleDateString()}`}
                          </Typography>
                        )}
                        {fine.adminDecision.notes && (
                          <Typography variant="caption" display="block" sx={{ mt: 0.25 }}>
                            {fine.adminDecision.notes}
                          </Typography>
                        )}
                      </Alert>
                    </>
                  )}

                  {/* Decision Buttons (only for admin, only if fine is still disputed) */}
                  {isAdmin && fine.status === 'disputed' && (
                    <>
                      <Divider />
                      {showDecisionNotes ? (
                        <Stack spacing={0.75}>
                          <Typography variant="caption" fontWeight={600}>
                            {showDecisionNotes === 'approve' ? 'Approve dispute (drop the fine):' : 'Reject dispute (fine still stands):'}
                          </Typography>
                          <TextField
                            size="small"
                            placeholder="Add notes (optional)..."
                            value={decisionNotes}
                            onChange={(e) => setDecisionNotes(e.target.value)}
                            fullWidth
                            multiline
                            rows={2}
                            sx={{
                              '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: '0.75rem' },
                            }}
                          />
                          <Stack direction="row" spacing={0.5}>
                            <Button
                              variant="contained"
                              color={showDecisionNotes === 'approve' ? 'success' : 'error'}
                              onClick={() => handleFineDecision(showDecisionNotes)}
                              disabled={decidingFine}
                              size="small"
                              sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.7rem', py: 0.5 }}
                            >
                              {decidingFine ? <CircularProgress size={14} color="inherit" /> : 'Confirm'}
                            </Button>
                            <Button
                              variant="outlined"
                              onClick={() => { setShowDecisionNotes(null); setDecisionNotes(''); }}
                              size="small"
                              sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.7rem', py: 0.5 }}
                            >
                              Cancel
                            </Button>
                          </Stack>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<ThumbUpIcon sx={{ fontSize: 14 }} />}
                            onClick={() => setShowDecisionNotes('approve')}
                            sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.75rem', py: 0.5, flex: 1 }}
                          >
                            Approve Dispute
                          </Button>
                          <Button
                            variant="contained"
                            color="error"
                            size="small"
                            startIcon={<ThumbDownIcon sx={{ fontSize: 14 }} />}
                            onClick={() => setShowDecisionNotes('reject')}
                            sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.75rem', py: 0.5, flex: 1 }}
                          >
                            Reject Dispute
                          </Button>
                        </Stack>
                      )}
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Ticket Info */}
          <Card variant="outlined" sx={{ bgcolor: alpha(theme.palette.background.default, 0.5) }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                      {ticket.createdBy.fullName?.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="caption" fontWeight={600} display="block" lineHeight={1.2}>
                        {ticket.createdBy.fullName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.65rem' }}>
                        {ticketsService.formatExactDateTime(ticket.createdAt)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {ticket.assignedTo ? (
                      <>
                        <AssignmentIndIcon sx={{ fontSize: 16 }} color="primary" />
                        <Typography variant="caption" fontWeight={600} color="primary.main">
                          {ticket.assignedTo.fullName}
                        </Typography>
                      </>
                    ) : (
                      <>
                        <AssignIcon sx={{ fontSize: 16 }} color="action" />
                        <Typography variant="caption" fontWeight={600}>Unassigned</Typography>
                      </>
                    )}
                  </Box>
                </Box>

                <Divider sx={{ my: 0.5 }} />

                <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                  {ticket.description}
                </Typography>

                {/* Display ticket images (not associated with comments) */}
                {ticketImages.filter(img => img.commentIndex === null).length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight={600}>Attachments:</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      {ticketImages
                        .filter(img => img.commentIndex === null)
                        .map((img) => (
                          <Box
                            key={img._id}
                            sx={{
                              width: 60,
                              height: 60,
                              borderRadius: 1,
                              overflow: 'hidden',
                              cursor: 'pointer',
                              border: `1px solid ${theme.palette.divider}`,
                              '&:hover': { boxShadow: 2, borderColor: theme.palette.primary.main }
                            }}
                            onClick={() => window.open(ticketsService.getTicketImageUrl(img._id), '_blank')}
                            onMouseEnter={(e) => handleImageMouseEnter(e, img)}
                            onMouseLeave={handleImageMouseLeave}
                          >
                            <Box
                              component="img"
                              src={ticketsService.getTicketImageThumbnailUrl(img._id)}
                              alt={img.originalName}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </Box>
                        ))}
                    </Stack>
                  </Box>
                )}

                {ticket.dueDate && (
                  <Alert
                    severity={ticketsService.isTicketOverdue(ticket) ? 'warning' : 'info'}
                    sx={{ py: 0.25, px: 1, '& .MuiAlert-message': { py: 0.5 } }}
                  >
                    <Typography variant="caption">
                      Due: {new Date(ticket.dueDate).toLocaleDateString()} at {new Date(ticket.dueDate).toLocaleTimeString()}
                    </Typography>
                  </Alert>
                )}

                {ticket.resolution && ticket.status === 'resolved' && (
                  <Alert severity="success" sx={{ py: 0.25, px: 1, '& .MuiAlert-message': { py: 0.5 } }}>
                    <Typography variant="caption" fontWeight={600}>
                      Resolved by {ticket.resolution.resolvedBy.fullName}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {ticketsService.formatExactDateTime(ticket.resolution.resolvedAt)}
                    </Typography>
                    {ticket.resolution.resolutionNote && (
                      <Typography variant="caption" display="block" sx={{ mt: 0.25 }}>
                        {ticket.resolution.resolutionNote}
                      </Typography>
                    )}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Comments Section - Chat Bubbles */}
          {ticket.comments && ticket.comments.length > 0 && (
            <Box
              sx={{
                bgcolor: alpha(theme.palette.grey[500], 0.04),
                borderRadius: 1.5,
                p: 1,
                maxHeight: 200,
                overflowY: 'auto',
                '&::-webkit-scrollbar': { width: 4 },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                  borderRadius: 2,
                },
              }}
            >
              <Stack spacing={1}>
                {ticket.comments.map((comment, index) => {
                  const isOwnComment = comment.user._id === user?._id;
                  return (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        flexDirection: isOwnComment ? 'row-reverse' : 'row',
                        gap: 0.75,
                        alignItems: 'flex-start',
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 24,
                          height: 24,
                          bgcolor: isOwnComment
                            ? theme.palette.primary.main
                            : theme.palette.secondary.main,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}
                      >
                        {comment.user.fullName?.charAt(0)}
                      </Avatar>

                      <Box
                        sx={{
                          maxWidth: '80%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isOwnComment ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            {comment.user.fullName}
                          </Typography>
                          {comment.isInternal && (
                            <Chip
                              label="Internal"
                              size="small"
                              color="warning"
                              sx={{ height: 14, fontSize: '0.55rem', '& .MuiChip-label': { px: 0.5 } }}
                            />
                          )}
                        </Box>

                        <Box
                          sx={{
                            bgcolor: isOwnComment
                              ? theme.palette.primary.main
                              : alpha(theme.palette.grey[500], 0.1),
                            color: isOwnComment ? 'white' : 'text.primary',
                            px: 1.25,
                            py: 0.75,
                            borderRadius: 2,
                            borderTopRightRadius: isOwnComment ? 3 : 16,
                            borderTopLeftRadius: isOwnComment ? 16 : 3,
                            boxShadow: isOwnComment
                              ? `0 1px 4px ${alpha(theme.palette.primary.main, 0.25)}`
                              : 'none',
                          }}
                        >
                          <Typography variant="caption" sx={{ lineHeight: 1.4, fontSize: '0.75rem' }}>
                            {comment.message}
                          </Typography>
                        </Box>

                        {/* Display comment images */}
                        {ticketImages.filter(img => img.commentIndex === index).length > 0 && (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                            {ticketImages
                              .filter(img => img.commentIndex === index)
                              .map((img) => (
                                <Box
                                  key={img._id}
                                  sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                                    transition: 'all 0.15s ease',
                                    '&:hover': {
                                      boxShadow: 2,
                                      borderColor: theme.palette.primary.main,
                                      transform: 'scale(1.05)'
                                    }
                                  }}
                                  onClick={() => window.open(ticketsService.getTicketImageUrl(img._id), '_blank')}
                                  onMouseEnter={(e) => handleImageMouseEnter(e, img)}
                                  onMouseLeave={handleImageMouseLeave}
                                >
                                  <Box
                                    component="img"
                                    src={ticketsService.getTicketImageThumbnailUrl(img._id)}
                                    alt={img.originalName}
                                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </Box>
                              ))}
                          </Stack>
                        )}

                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ mt: 0.25, fontSize: '0.6rem' }}
                        >
                          {ticketsService.formatExactDateTime(comment.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}

          {/* Add Comment */}
          {(isTicketOwner || isAdmin || isAssignee) && ticket.status !== 'closed' && (
            <Box
              sx={{
                bgcolor: alpha(theme.palette.background.paper, 0.6),
                borderRadius: 1.5,
                p: 1,
                border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              }}
            >
              <Stack spacing={0.75}>
                <TextField
                  multiline
                  rows={1}
                  placeholder="Write a message..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                      fontSize: '0.8rem',
                    },
                    '& .MuiOutlinedInput-input': {
                      py: 0.75,
                    }
                  }}
                />

                {/* Image Upload for Comment */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <input
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="comment-image-upload"
                      multiple
                      type="file"
                      onChange={handleCommentImageSelect}
                      disabled={uploadingImages}
                    />
                    <label htmlFor="comment-image-upload">
                      <IconButton
                        component="span"
                        size="small"
                        disabled={uploadingImages}
                        sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                      >
                        {uploadingImages ? <CircularProgress size={16} /> : <ImageIcon fontSize="small" />}
                      </IconButton>
                    </label>
                  </Box>

                  <Button
                    variant="contained"
                    onClick={handleAddComment}
                    disabled={addingComment || !newComment.trim()}
                    size="small"
                    endIcon={addingComment ? <CircularProgress size={12} color="inherit" /> : <SendIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      borderRadius: 1.5,
                      px: 1.5,
                      py: 0.25,
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      minHeight: 28,
                    }}
                  >
                    Send
                  </Button>
                </Box>

                {/* Display selected comment images */}
                {commentImages.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {commentImages.map((img) => (
                      <Box
                        key={img.id}
                        sx={{ position: 'relative', width: 36, height: 36, borderRadius: 0.75, overflow: 'hidden' }}
                      >
                        <Box
                          component="img"
                          src={img.url}
                          alt={img.name}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveCommentImage(img.id)}
                          sx={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            bgcolor: 'error.main',
                            color: 'white',
                            padding: '1px',
                            '&:hover': { bgcolor: 'error.dark' }
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 10 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 1.5, py: 1, gap: 0.5, flexWrap: 'wrap' }}>
        {/* Assign Ticket Section - Admin only, unresolved tickets */}
        {isAdmin && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
          <>
            {!showAssignForm ? (
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<AssignmentIndIcon sx={{ fontSize: 16 }} />}
                onClick={handleShowAssignForm}
                sx={{
                  textTransform: 'none',
                  borderRadius: 1.5,
                  fontSize: '0.75rem',
                  py: 0.5,
                }}
              >
                {ticket.assignedTo ? 'Reassign' : 'Assign'}
              </Button>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, maxWidth: '65%' }}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ fontSize: '0.75rem' }}>Assign to</InputLabel>
                  <Select
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    label="Assign to"
                    disabled={loadingAssignableUsers}
                    sx={{ borderRadius: 1.5, fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.625 } }}
                  >
                    {assignableUsers.map((u) => (
                      <MenuItem key={u._id} value={u._id} sx={{ fontSize: '0.75rem' }}>
                        {u.fullName} ({u.role.replace('_', ' ')})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleAssignTicket}
                  disabled={assigning || !selectedAssignee}
                  size="small"
                  sx={{ minWidth: 'auto', px: 1.5, borderRadius: 1.5, textTransform: 'none', fontSize: '0.7rem', py: 0.5 }}
                >
                  {assigning ? <CircularProgress size={14} color="inherit" /> : 'OK'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => { setShowAssignForm(false); setSelectedAssignee(''); }}
                  size="small"
                  sx={{ minWidth: 'auto', px: 1, borderRadius: 1.5, textTransform: 'none', fontSize: '0.7rem', py: 0.5 }}
                >
                  ✕
                </Button>
              </Box>
            )}
          </>
        )}

        {/* Resolve Ticket Section - Admin or Assignee */}
        {(isAdmin || isAssignee) && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
          <>
            {/* For fine dispute tickets, only allow resolve after fine is decided */}
            {isFineDispute && !fineIsDecided ? (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto', fontSize: '0.7rem', fontStyle: 'italic' }}>
                Decide on the dispute before resolving the ticket
              </Typography>
            ) : (
              <>
                {!showResolveForm ? (
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<ResolveIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setShowResolveForm(true)}
                    sx={{
                      mr: 'auto',
                      textTransform: 'none',
                      borderRadius: 1.5,
                      fontSize: '0.75rem',
                      py: 0.5,
                    }}
                  >
                    Resolve
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 'auto', flex: 1, maxWidth: '65%' }}>
                    <TextField
                      size="small"
                      placeholder="Resolution note..."
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: '0.75rem' },
                        '& .MuiOutlinedInput-input': { py: 0.5 }
                      }}
                    />
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleResolveTicket}
                      disabled={resolving}
                      size="small"
                      sx={{ minWidth: 'auto', px: 1.5, borderRadius: 1.5, textTransform: 'none', fontSize: '0.7rem', py: 0.5 }}
                    >
                      {resolving ? <CircularProgress size={14} color="inherit" /> : 'OK'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => { setShowResolveForm(false); setResolutionNote(''); }}
                      size="small"
                      sx={{ minWidth: 'auto', px: 1, borderRadius: 1.5, textTransform: 'none', fontSize: '0.7rem', py: 0.5 }}
                    >
                      ✕
                    </Button>
                  </Box>
                )}
              </>
            )}
          </>
        )}
        <Button
          onClick={onClose}
          variant="contained"
          size="small"
          sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: '0.75rem', py: 0.5 }}
        >
          Close
        </Button>
      </DialogActions>

      {/* Image Preview */}
      {previewImage && (
        <Box
          component="img"
          src={previewIsFineImage
            ? getFineImageUrl(previewImage._id)
            : ticketsService.getTicketImageUrl(previewImage._id)
          }
          alt="Preview"
          onMouseEnter={() => setPreviewImage(previewImage)}
          onMouseLeave={handleImageMouseLeave}
          sx={{
            position: 'fixed',
            left: previewPosition.x,
            top: previewPosition.y,
            right: 20,
            bottom: 20,
            zIndex: 1400,
            objectFit: 'contain',
            borderRadius: 1,
            pointerEvents: 'none',
            animation: 'fadeIn 0.15s ease-out',
            '@keyframes fadeIn': {
              from: {
                opacity: 0,
              },
              to: {
                opacity: 1,
              }
            }
          }}
        />
      )}
    </Dialog>
  );
};

export default TicketDetailDialog;
