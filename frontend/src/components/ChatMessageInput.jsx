import React, { memo } from 'react';
import {
  IconButton,
  Box
} from '@mui/material';
import {
  Send as SendIcon,
  EmojiEmotions as EmojiIcon,
  Image as ImageIcon
} from '@mui/icons-material';

/**
 * High-performance message input using native textarea instead of MUI TextField
 * This provides instant text response with zero lag
 */
const ChatMessageInput = memo(({
  messageInputRef,
  newMessage,
  pasteUploading,
  isSending,
  hasConversation,
  onMessageChange,
  onKeyPress,
  onPaste,
  onSendMessage,
  onEmojiClick,
  onImageUpload
}) => {
  const isEmpty = !newMessage || newMessage.trim().length === 0;
  
  return (
    <Box sx={{ 
      display: 'flex', 
      gap: 1, 
      alignItems: 'flex-end',
      width: '100%',
      position: 'relative'
    }}>
      {/* Left buttons */}
      <Box sx={{ display: 'flex', gap: 0.5, pb: 0.5 }}>
        <IconButton
          onClick={onEmojiClick}
          color="default"
          size="small"
          sx={{ 
            p: 0.75,
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <EmojiIcon fontSize="small" />
        </IconButton>
        <IconButton
          onClick={onImageUpload}
          color="default"
          size="small"
          disabled={!hasConversation}
          sx={{ 
            p: 0.75,
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <ImageIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Native textarea for optimal performance */}
      <textarea
        ref={messageInputRef}
        value={newMessage}
        onChange={onMessageChange}
        onKeyPress={onKeyPress}
        onPaste={onPaste}
        disabled={pasteUploading}
        placeholder={pasteUploading ? "Uploading image..." : "Type a message or paste an image..."}
        rows={1}
        style={{
          flex: 1,
          minHeight: '40px',
          maxHeight: '120px',
          padding: '10px 12px',
          fontSize: '14px',
          lineHeight: '1.5',
          fontFamily: 'inherit',
          border: '1px solid rgba(0, 0, 0, 0.23)',
          borderRadius: '4px',
          outline: 'none',
          resize: 'none',
          transition: 'border-color 0.2s',
          backgroundColor: pasteUploading ? '#f5f5f5' : '#fff',
          color: pasteUploading ? '#999' : 'inherit',
          cursor: pasteUploading ? 'not-allowed' : 'text',
          overflow: 'auto'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#1976d2';
          e.target.style.borderWidth = '2px';
          e.target.style.padding = '9px 11px'; // Adjust padding to maintain size
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'rgba(0, 0, 0, 0.23)';
          e.target.style.borderWidth = '1px';
          e.target.style.padding = '10px 12px';
        }}
        onInput={(e) => {
          // Auto-expand textarea height based on content
          e.target.style.height = 'auto';
          e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        }}
      />

      {/* Send button */}
      <IconButton
        onClick={onSendMessage}
        disabled={isEmpty || isSending}
        color="primary"
        sx={{ 
          mb: 0.5,
          p: 0.75,
          bgcolor: isEmpty || isSending ? 'transparent' : 'primary.main',
          color: isEmpty || isSending ? 'action.disabled' : 'white',
          '&:hover': {
            bgcolor: isEmpty || isSending ? 'transparent' : 'primary.dark'
          },
          '&.Mui-disabled': {
            bgcolor: 'transparent',
            color: 'action.disabled'
          }
        }}
      >
        <SendIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal performance
  return (
    prevProps.newMessage === nextProps.newMessage &&
    prevProps.pasteUploading === nextProps.pasteUploading &&
    prevProps.isSending === nextProps.isSending &&
    prevProps.hasConversation === nextProps.hasConversation
  );
});

ChatMessageInput.displayName = 'ChatMessageInput';

export default ChatMessageInput;

