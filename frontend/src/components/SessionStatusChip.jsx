import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import {
  CheckCircle as ActiveIcon,
  Schedule as ExpiredIcon,
  Block as NoSessionIcon,
  Warning as WarningIcon,
  AccessTime as ExpiringIcon,
} from '@mui/icons-material';
const SessionStatusChip = ({ sessionData, size = 'small' }) => {
  if (!sessionData || !sessionData.sessionId) {
    return (
      <Tooltip title="No session data available">
        <Chip
          icon={<NoSessionIcon />}
          label="No Session"
          size={size}
          color="default"
          variant="outlined"
        />
      </Tooltip>
    );
  }
  const isActive = sessionData.isActive;
  const createdAt = new Date(sessionData.createdAt);
  const lastAccessedAt = new Date(sessionData.lastAccessedAt);
  const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const sevenDaysFromNow = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
  const expirationDate = new Date(createdAt.getTime() + (30 * 24 * 60 * 60 * 1000));
  const isExpired = createdAt < thirtyDaysAgo;
  const isExpiringSoon = !isExpired && expirationDate < sevenDaysFromNow;
  const daysUntilExpiration = Math.ceil((expirationDate - new Date()) / (24 * 60 * 60 * 1000));
  const getStatusConfig = () => {
    if (isExpired) {
      return {
        icon: <ExpiredIcon />,
        label: 'Expired',
        color: 'error',
        tooltip: `Session expired (created ${createdAt.toLocaleDateString()})`
      };
    }
    if (isExpiringSoon && isActive) {
      return {
        icon: <ExpiringIcon />,
        label: `Expires in ${daysUntilExpiration}d`,
        color: 'warning',
        tooltip: `Session expires in ${daysUntilExpiration} day(s) (${expirationDate.toLocaleDateString()})`
      };
    }
    if (isActive) {
      return {
        icon: <ActiveIcon />,
        label: 'Active',
        color: 'success',
        tooltip: `Active session (last accessed ${lastAccessedAt.toLocaleString()})`
      };
    }
    return {
      icon: <WarningIcon />,
      label: 'Inactive',
      color: 'warning',
      tooltip: `Inactive session (created ${createdAt.toLocaleDateString()})`
    };
  };
  const config = getStatusConfig();
  return (
    <Tooltip title={config.tooltip}>
      <Chip
        icon={config.icon}
        label={config.label}
        size={size}
        color={config.color}
        variant="outlined"
      />
    </Tooltip>
  );
};
export default SessionStatusChip;