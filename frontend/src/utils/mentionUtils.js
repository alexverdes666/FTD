/**
 * Utility functions for handling @mentions in chat messages
 */

/**
 * Parse message content and convert @[DisplayName](userId) format to highlighted HTML
 * @param {string} content - The message content with mentions
 * @param {string} currentUserId - The current user's ID to highlight their mentions differently
 * @returns {string} - HTML string with highlighted mentions
 */
export const parseMentions = (content, currentUserId = null) => {
  if (!content) return '';

  // Match @[DisplayName](userId) format
  const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9]{24})\)/g;
  
  return content.replace(mentionRegex, (match, displayName, userId) => {
    const isCurrentUser = userId === currentUserId;
    const className = isCurrentUser ? 'mention mention-current-user' : 'mention';
    const style = isCurrentUser
      ? 'background-color: #ff9800; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;'
      : 'background-color: #1976d2; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;';
    
    return `<span class="${className}" style="${style}" data-user-id="${userId}">@${displayName}</span>`;
  });
};

/**
 * Insert a mention into text at the cursor position
 * @param {string} text - Current text content
 * @param {number} cursorPosition - Current cursor position
 * @param {string} userId - The user ID to mention
 * @param {string} displayName - The display name to show
 * @param {string} triggerText - The text that triggered the mention (e.g., "@joh")
 * @returns {Object} - New text and cursor position
 */
export const insertMention = (text, cursorPosition, userId, displayName, triggerText) => {
  // Find the start of the trigger text (the @ symbol)
  const beforeCursor = text.substring(0, cursorPosition);
  const lastAtIndex = beforeCursor.lastIndexOf('@');
  
  if (lastAtIndex === -1) {
    // Shouldn't happen, but fallback to inserting at cursor
    const mention = `@[${displayName}](${userId})`;
    const newText = text.substring(0, cursorPosition) + mention + text.substring(cursorPosition);
    return {
      newText,
      newCursorPosition: cursorPosition + mention.length
    };
  }

  // Replace from @ to cursor position with the mention
  const mention = `@[${displayName}](${userId}) `;
  const newText = text.substring(0, lastAtIndex) + mention + text.substring(cursorPosition);
  
  return {
    newText,
    newCursorPosition: lastAtIndex + mention.length
  };
};

/**
 * Detect if user is typing a mention
 * @param {string} text - Current text content
 * @param {number} cursorPosition - Current cursor position
 * @returns {Object|null} - { isTypingMention: boolean, searchTerm: string, atIndex: number } or null
 */
export const detectMentionTyping = (text, cursorPosition) => {
  if (!text || cursorPosition === 0) return null;

  const beforeCursor = text.substring(0, cursorPosition);
  
  // Find the last @ symbol before cursor
  const lastAtIndex = beforeCursor.lastIndexOf('@');
  
  if (lastAtIndex === -1) return null;

  // Check if there's a space between @ and cursor (which would break the mention)
  const textAfterAt = beforeCursor.substring(lastAtIndex);
  if (textAfterAt.includes(' ')) return null;

  // Check if @ is at the start or has a space/newline before it
  const charBeforeAt = lastAtIndex > 0 ? beforeCursor[lastAtIndex - 1] : ' ';
  if (charBeforeAt !== ' ' && charBeforeAt !== '\n' && lastAtIndex !== 0) {
    return null;
  }

  // Extract the search term (text after @)
  const searchTerm = textAfterAt.substring(1); // Remove the @ symbol

  return {
    isTypingMention: true,
    searchTerm,
    atIndex: lastAtIndex
  };
};

/**
 * Extract mentioned user IDs from message content
 * @param {string} content - The message content
 * @returns {Array<string>} - Array of user IDs
 */
export const extractMentionedUserIds = (content) => {
  if (!content) return [];

  const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9]{24})\)/g;
  const userIds = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const userId = match[2];
    if (!userIds.includes(userId)) {
      userIds.push(userId);
    }
  }

  return userIds;
};

/**
 * Clean display text from mentions (for preview, etc.)
 * Converts @[DisplayName](userId) to @DisplayName
 * @param {string} content - The message content with mentions
 * @returns {string} - Cleaned text
 */
export const cleanMentionsForDisplay = (content) => {
  if (!content) return '';

  const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9]{24})\)/g;
  return content.replace(mentionRegex, '@$1');
};

