/**
 * Utility functions for lead-related operations
 */

export const LEAD_STATUSES = {
  ACTIVE: "active",
  CONTACTED: "contacted",
  CONVERTED: "converted",
  INACTIVE: "inactive",
};

export const LEAD_TYPES = {
  FTD: "ftd",
  FILLER: "filler",
  COLD: "cold",
};

/**
 * Get color for lead status chip
 */
export const getStatusColor = (status) => {
  switch (status) {
    case LEAD_STATUSES.ACTIVE:
    case LEAD_STATUSES.CONVERTED:
      return "success";
    case LEAD_STATUSES.CONTACTED:
      return "info";
    case LEAD_STATUSES.INACTIVE:
      return "error";
    default:
      return "default";
  }
};

/**
 * Get color for lead type chip
 */
export const getLeadTypeColor = (leadType) => {
  if (!leadType) return "default";
  switch (leadType.toLowerCase()) {
    case LEAD_TYPES.FTD:
      return "success";
    case LEAD_TYPES.FILLER:
      return "warning";
    case LEAD_TYPES.COLD:
      return "info";
    default:
      return "default";
  }
};

/**
 * Get display lead type (orderedAs takes precedence over leadType)
 */
export const getDisplayLeadType = (lead) => {
  return lead.orderedAs || lead.leadType;
};

/**
 * Calculate cooldown status for FTD/Filler leads (10-day cooldown)
 */
export const getCooldownStatus = (lead) => {
  const leadType = getDisplayLeadType(lead);

  // Only FTD and Filler leads have cooldown
  if (leadType !== "ftd" && leadType !== "filler") {
    return { hasCooldown: false, text: "N/A", color: "default" };
  }

  // If never used in an order, no cooldown
  if (!lead.lastUsedInOrder) {
    return { hasCooldown: false, text: "Available", color: "success" };
  }

  const lastUsedDate = new Date(lead.lastUsedInOrder);
  const now = new Date();
  const daysSinceUsed = Math.floor(
    (now - lastUsedDate) / (1000 * 60 * 60 * 24)
  );
  const cooldownPeriod = 10; // 10 days

  if (daysSinceUsed < cooldownPeriod) {
    const daysRemaining = cooldownPeriod - daysSinceUsed;
    return {
      hasCooldown: true,
      inCooldown: true,
      daysRemaining,
      text: `${daysRemaining}d left`,
      color: daysRemaining <= 2 ? "warning" : "error",
    };
  }

  return {
    hasCooldown: true,
    inCooldown: false,
    text: "Available",
    color: "success",
  };
};
