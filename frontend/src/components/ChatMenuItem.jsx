import React, { useState } from 'react';
import { MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { Chat as ChatIcon } from '@mui/icons-material';
import chatService from '../services/chatService';
import ChatWindow from './ChatWindow';

const ChatMenuItem = ({ user, onClose, context = {} }) => {
  const [chatOpen, setChatOpen] = useState(false);

  const handleStartChat = async () => {
    try {
      // Create or get conversation with the user
      const response = await chatService.createOrGetConversation(user._id, {
        contextType: context.contextType || 'general',
        relatedOrder: context.relatedOrder || null,
        relatedLead: context.relatedLead || null
      });

      // Close the context menu
      if (onClose) {
        onClose();
      }

      // Open chat window with the conversation
      setChatOpen(true);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  return (
    <>
      <MenuItem onClick={handleStartChat}>
        <ListItemIcon>
          <ChatIcon />
        </ListItemIcon>
        <ListItemText primary={`Chat with ${user.fullName}`} />
      </MenuItem>

      {/* Chat Window */}
      <ChatWindow
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        initialParticipantId={user._id}
      />
    </>
  );
};

export default ChatMenuItem; 