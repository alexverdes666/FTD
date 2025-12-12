import React, { useState } from 'react';
import { Box, Paper, Typography, Modal, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
const PreviewPopup = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  zIndex: 1300,
  padding: theme.spacing(2),
  maxWidth: '400px',
  maxHeight: '400px',
  overflow: 'auto',
  boxShadow: theme.shadows[8],
  backgroundColor: theme.palette.background.paper,
  animation: 'fadeIn 0.2s ease-in-out',
  '@keyframes fadeIn': {
    from: {
      opacity: 0,
      transform: 'translateY(-10px)'
    },
    to: {
      opacity: 1,
      transform: 'translateY(0)'
    }
  }
}));
const ModalContent = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  padding: theme.spacing(3),
  maxWidth: '90vw',
  maxHeight: '90vh',
  overflow: 'auto',
  outline: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
}));
const ImagePlaceholder = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: theme.palette.action.focus,
  }
}));
const DocumentPreview = ({ url, type, children }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const handleMouseEnter = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    let yPos = rect.top;
    if (rect.top + 400 > viewportHeight) {
      yPos = rect.bottom - 400;
    }
    setPosition({
      x: rect.right + 10,
      y: yPos,
    });
    setShowPreview(true);
  };
  const handleMouseLeave = () => {
    setShowPreview(false);
  };
  const handleClick = (event) => {
    event.preventDefault();
    setShowModal(true);
  };
  const handleCloseModal = (event) => {
    if (event) {
      event.stopPropagation();
    }
    setShowModal(false);
  };
  const isImage = url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url?.startsWith('data:image/');
  const renderContent = (inModal = false) => {
    const styles = inModal ? {
      maxWidth: '100%',
      maxHeight: 'calc(90vh - 100px)',
      objectFit: 'contain',
    } : {
      maxWidth: '100%',
      maxHeight: '360px',
      objectFit: 'contain',
    };
    return isImage ? (
      <img
        src={url}
        alt={type}
        style={styles}
        loading="lazy"
      />
    ) : (
      <Box>
        <Typography variant="subtitle2" gutterBottom color="text.primary">
          {type} Document
        </Typography>
        <Typography variant="body2" component="div" color="text.primary">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit' }}
          >
            View Document
          </a>
        </Typography>
      </Box>
    );
  };
  return (
    <Box
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      sx={{ display: 'inline-block', cursor: 'pointer' }}
    >
      {isImage ? (
        <ImagePlaceholder>
          <ImageIcon fontSize="small" />
          <Typography variant="body2">
            {type || 'View Image'}
          </Typography>
        </ImagePlaceholder>
      ) : (
        children
      )}
      {showPreview && url && (
        <PreviewPopup
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {renderContent()}
        </PreviewPopup>
      )}
      <Modal
        open={showModal}
        onClose={handleCloseModal}
        aria-labelledby="document-preview-modal"
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}
      >
        <ModalContent>
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            pb: 1
          }}>
            <Typography variant="h6" component="h2" color="text.primary">
              {type}
            </Typography>
            <IconButton
              onClick={handleCloseModal}
              size="small"
              sx={{
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: 'action.hover',
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          {renderContent(true)}
        </ModalContent>
      </Modal>
    </Box>
  );
};
export default DocumentPreview;