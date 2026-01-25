import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Chip,
  Avatar,
  Stack,
  Button,
  Collapse,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as ResolvedIcon,
  Warning as UnresolvedIcon,
  Reply as ReplyIcon,
} from "@mui/icons-material";

const formatStatus = (status) => {
  const statusMap = {
    working_ok: "Working OK",
    shaving: "Shaving",
    playing_games: "Playing Games",
    other: "Other",
  };
  return statusMap[status] || status;
};

const getStatusColor = (status) => {
  const colorMap = {
    working_ok: "success",
    shaving: "error",
    playing_games: "warning",
    other: "default",
  };
  return colorMap[status] || "default";
};

const CommentItem = ({ comment }) => {
  const [showReplies, setShowReplies] = useState(true);
  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <Box
      sx={{
        p: 2,
        border: 1,
        borderColor: comment.isResolved ? "success.light" : "warning.light",
        borderRadius: 1,
        backgroundColor: comment.isResolved
          ? "rgba(76, 175, 80, 0.05)"
          : "rgba(255, 152, 0, 0.05)",
        mb: 1,
      }}
    >
      {/* Comment Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Avatar sx={{ width: 28, height: 28, fontSize: "0.875rem" }}>
            {comment.agent?.fullName?.charAt(0)?.toUpperCase() || "?"}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {comment.agent?.fullName || "Unknown"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(comment.createdAt).toLocaleString()}
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={formatStatus(comment.status)}
            color={getStatusColor(comment.status)}
            size="small"
          />
          <Tooltip title={comment.isResolved ? "Resolved" : "Unresolved"}>
            {comment.isResolved ? (
              <ResolvedIcon color="success" fontSize="small" />
            ) : (
              <UnresolvedIcon color="warning" fontSize="small" />
            )}
          </Tooltip>
        </Stack>
      </Box>

      {/* Comment Content */}
      <Typography variant="body2" sx={{ mb: 1 }}>
        {comment.comment}
      </Typography>

      {/* Resolution Info */}
      {comment.isResolved && comment.resolvedBy && (
        <Box
          sx={{
            mt: 1,
            p: 1,
            backgroundColor: "rgba(76, 175, 80, 0.1)",
            borderRadius: 1,
          }}
        >
          <Typography variant="caption" color="success.dark">
            Resolved by {comment.resolvedBy.fullName} on{" "}
            {new Date(comment.resolvedAt).toLocaleString()}
          </Typography>
          {comment.resolutionNote && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {comment.resolutionNote}
            </Typography>
          )}
        </Box>
      )}

      {/* Replies */}
      {hasReplies && (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            onClick={() => setShowReplies(!showReplies)}
            startIcon={showReplies ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: "none" }}
          >
            {showReplies ? "Hide" : "Show"} {comment.replies.length}{" "}
            {comment.replies.length === 1 ? "reply" : "replies"}
          </Button>
          <Collapse in={showReplies}>
            <Stack spacing={1} sx={{ ml: 3, mt: 1 }}>
              {comment.replies.map((reply) => (
                <Box
                  key={reply._id}
                  sx={{
                    p: 1.5,
                    backgroundColor: "background.paper",
                    borderLeft: 2,
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <ReplyIcon fontSize="small" color="action" />
                    <Avatar sx={{ width: 20, height: 20, fontSize: "0.75rem" }}>
                      {reply.agent?.fullName?.charAt(0)?.toUpperCase() || "?"}
                    </Avatar>
                    <Typography variant="body2" fontWeight="bold">
                      {reply.agent?.fullName || "Unknown"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(reply.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Typography variant="body2">{reply.comment}</Typography>
                </Box>
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}
    </Box>
  );
};

const GroupedComments = ({ groupedComments = [] }) => {
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  if (!groupedComments.length) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">No comments yet</Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {groupedComments.map((group) => {
        const groupKey = group.ourNetwork?._id || "unassigned";
        const isExpanded = expandedGroups[groupKey] !== false; // Default expanded

        return (
          <Paper key={groupKey} sx={{ mb: 2, overflow: "hidden" }}>
            {/* Group Header */}
            <Box
              sx={{
                p: 2,
                backgroundColor: "grey.100",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
              }}
              onClick={() => toggleGroup(groupKey)}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {group.ourNetwork?.name || "Unassigned"}
                </Typography>
                <Chip
                  label={`${group.comments.length} ${
                    group.comments.length === 1 ? "comment" : "comments"
                  }`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`${
                    group.comments.filter((c) => !c.isResolved).length
                  } unresolved`}
                  size="small"
                  color={
                    group.comments.filter((c) => !c.isResolved).length > 0
                      ? "warning"
                      : "success"
                  }
                />
              </Box>
              <IconButton size="small">
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            {/* Group Content */}
            <Collapse in={isExpanded}>
              <Box sx={{ p: 2 }}>
                {group.comments.map((comment) => (
                  <CommentItem key={comment._id} comment={comment} />
                ))}
              </Box>
            </Collapse>
          </Paper>
        );
      })}
    </Box>
  );
};

export default GroupedComments;
