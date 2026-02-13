const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const ClientNetwork = require("../models/ClientNetwork");
const ClientBroker = require("../models/ClientBroker");
const Campaign = require("../models/Campaign");
const CallChangeRequest = require("../models/CallChangeRequest");
const referenceCache = require("../services/referenceCache");
const leadSearchCache = require("../services/leadSearchCache");

// Helper function to merge order's leadsMetadata with populated leads
// This ensures each lead shows the correct orderedAs value for THIS specific order
const mergeLeadsWithMetadata = (order) => {
  if (!order.leadsMetadata || !order.leads) return order;

  // Convert order to plain object if it's a mongoose document
  const orderObj = order.toObject ? order.toObject() : order;

  // Create a map of leadId -> orderedAs from metadata
  const metadataMap = new Map();
  if (orderObj.leadsMetadata && Array.isArray(orderObj.leadsMetadata)) {
    orderObj.leadsMetadata.forEach((meta) => {
      metadataMap.set(meta.leadId.toString(), meta.orderedAs);
    });
  }

  // Merge metadata into leads
  if (Array.isArray(orderObj.leads)) {
    orderObj.leads = orderObj.leads.map((lead) => {
      // Handle both populated objects and ObjectIds
      if (!lead || typeof lead !== "object") return lead;

      const leadObj = lead.toObject ? lead.toObject() : lead;
      const leadId = leadObj._id ? leadObj._id.toString() : lead.toString();

      if (metadataMap.has(leadId)) {
        leadObj.orderedAs = metadataMap.get(leadId);
      }
      return leadObj;
    });
  }

  return orderObj;
};

const getFirstFourDigitsAfterPrefix = (phoneNumber) => {
  console.log(`[DEBUG-PHONE] Input: ${phoneNumber}`);
  if (!phoneNumber) {
    console.log(`[DEBUG-PHONE] No phone number provided`);
    return null;
  }
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  console.log(`[DEBUG-PHONE] Cleaned: ${cleanPhone}`);
  if (cleanPhone.length < 5) {
    console.log(`[DEBUG-PHONE] Too short: ${cleanPhone.length} digits`);
    return null;
  }
  let result;
  if (cleanPhone.length >= 11 && ["1", "7"].includes(cleanPhone[0])) {
    result = cleanPhone.substring(1, 5);
  } else if (
    cleanPhone.length >= 12 &&
    ["44", "49", "33", "34", "39", "41", "43", "45", "46", "47", "48"].includes(
      cleanPhone.substring(0, 2)
    )
  ) {
    result = cleanPhone.substring(2, 6);
  } else if (
    cleanPhone.length >= 13 &&
    ["359", "371", "372", "373", "374", "375", "376", "377", "378"].includes(
      cleanPhone.substring(0, 3)
    )
  ) {
    result = cleanPhone.substring(3, 7);
  } else {
    result = cleanPhone.substring(0, 4);
  }
  console.log(`[DEBUG-PHONE] Result: ${result}`);
  return result;
};

// Helper function to analyze digit patterns for filtering rules
const analyzeDigitPattern = (fourDigits) => {
  if (!fourDigits || fourDigits.length !== 4) {
    return {
      isValid: false,
      shouldFilter: false,
      reason: "Invalid pattern",
    };
  }

  const digits = fourDigits.split("");
  const [first, second, third, fourth] = digits;

  // Check if 3rd and 4th digits are the same - if so, filter out
  if (third === fourth) {
    return {
      isValid: true,
      shouldFilter: true,
      reason: "Third and fourth digits are the same",
    };
  }

  // Check if first and second digits are different - if so, don't filter
  if (first !== second) {
    return {
      isValid: true,
      shouldFilter: false,
      reason: "First and second digits are different",
    };
  }

  // Check if all digits are different - if so, don't filter
  const uniqueDigits = new Set(digits);
  if (uniqueDigits.size === 4) {
    return {
      isValid: true,
      shouldFilter: false,
      reason: "All four digits are different",
    };
  }

  // Default case - don't filter
  return {
    isValid: true,
    shouldFilter: false,
    reason: "Pattern does not meet filtering criteria",
  };
};
const applyFillerPhoneRepetitionRules = (fillerLeads, requestedCount) => {
  if (!fillerLeads || fillerLeads.length === 0) {
    console.log(`[FILLER-DEBUG] No leads provided`);
    return fillerLeads;
  }
  console.log(
    `[FILLER-DEBUG] ===== STARTING FILLER PROCESSING WITH NEW DIGIT RULES =====`
  );
  console.log(
    `[FILLER-DEBUG] Input: ${fillerLeads.length} filler leads available, ${requestedCount} requested`
  );

  // Apply same digit filtering logic as FTD
  const filteredLeads = [];
  const rejectedLeads = [];
  const leadsWithoutValidPhone = [];

  fillerLeads.forEach((lead, index) => {
    const firstFour = getFirstFourDigitsAfterPrefix(lead.newPhone);
    console.log(
      `[FILLER-DEBUG] Lead ${index}: Phone=${lead.newPhone}, FirstFour=${firstFour}, ID=${lead._id}`
    );

    if (firstFour) {
      const analysis = analyzeDigitPattern(firstFour);
      console.log(
        `[FILLER-DEBUG] Lead ${index} pattern analysis: shouldFilter=${analysis.shouldFilter}, reason="${analysis.reason}"`
      );

      if (analysis.shouldFilter) {
        rejectedLeads.push({ lead, reason: analysis.reason });
        console.log(
          `[FILLER-DEBUG] Lead ${index} REJECTED: ${analysis.reason}`
        );
      } else {
        filteredLeads.push(lead);
        console.log(
          `[FILLER-DEBUG] Lead ${index} ACCEPTED: ${analysis.reason}`
        );
      }
    } else {
      console.log(
        `[FILLER-DEBUG] Lead ${index} has no valid phone pattern, adding to backup`
      );
      leadsWithoutValidPhone.push(lead);
    }
  });

  console.log(
    `[FILLER-DEBUG] After digit filtering: ${filteredLeads.length} accepted, ${rejectedLeads.length} rejected, ${leadsWithoutValidPhone.length} without valid phone`
  );

  // Group filtered leads by 4-digit patterns
  const phoneGroups = {};
  filteredLeads.forEach((lead) => {
    const firstFour = getFirstFourDigitsAfterPrefix(lead.newPhone);
    if (!phoneGroups[firstFour]) {
      phoneGroups[firstFour] = [];
    }
    phoneGroups[firstFour].push(lead);
  });
  const uniquePatterns = Object.keys(phoneGroups);
  console.log(
    `[FILLER-DEBUG] Phone groups created:`,
    uniquePatterns.map((key) => `${key}:${phoneGroups[key].length}`).join(", ")
  );
  console.log(
    `[FILLER-DEBUG] Leads without valid phone: ${leadsWithoutValidPhone.length}`
  );
  const selectedLeads = [];
  if (requestedCount <= 10) {
    console.log(`[FILLER-DEBUG] ===== SMALL ORDER RULE (≤10 leads) =====`);
    console.log(
      `[FILLER-DEBUG] PRIORITY 1: Unique 4-digit patterns (no duplicates)`
    );

    // Priority 1: Take only ONE lead per unique pattern (no duplicates)
    for (const pattern of uniquePatterns) {
      if (selectedLeads.length >= requestedCount) break;
      selectedLeads.push(phoneGroups[pattern][0]);
      console.log(
        `[FILLER-DEBUG] Selected unique lead with pattern ${pattern}, total leads: ${selectedLeads.length}`
      );
    }

    // Priority 2: If still need more leads, use rejected leads where 3rd and 4th digits are different
    if (selectedLeads.length < requestedCount) {
      console.log(
        `[FILLER-DEBUG] PRIORITY 2: Need ${
          requestedCount - selectedLeads.length
        } more leads, checking rejected leads for acceptable patterns`
      );

      const acceptableRejectedLeads = rejectedLeads.filter(
        ({ lead, reason }) => {
          // Only use leads that were NOT rejected for "3rd and 4th digits are the same"
          return reason !== "Third and fourth digits are the same";
        }
      );

      console.log(
        `[FILLER-DEBUG] Found ${acceptableRejectedLeads.length} rejected leads with acceptable patterns (not rejected for 3rd=4th digits)`
      );

      for (const { lead, reason } of acceptableRejectedLeads) {
        if (selectedLeads.length >= requestedCount) break;
        selectedLeads.push(lead);
        console.log(
          `[FILLER-DEBUG] Added fallback lead (rejected for: "${reason}"), total leads: ${selectedLeads.length}`
        );
      }
    }

    // Priority 3: If still not enough, fill with leads without valid phone patterns
    if (selectedLeads.length < requestedCount) {
      console.log(
        `[FILLER-DEBUG] PRIORITY 3: Still need ${
          requestedCount - selectedLeads.length
        } more leads, using leads without valid phone patterns`
      );

      let backupIndex = 0;
      while (
        selectedLeads.length < requestedCount &&
        backupIndex < leadsWithoutValidPhone.length
      ) {
        selectedLeads.push(leadsWithoutValidPhone[backupIndex]);
        console.log(
          `[FILLER-DEBUG] Added lead without valid phone pattern: ${
            backupIndex + 1
          }, total leads: ${selectedLeads.length}`
        );
        backupIndex++;
      }
    }

    // Final warning if still couldn't fulfill the request
    if (selectedLeads.length < requestedCount) {
      console.log(
        `[FILLER-DEBUG] WARNING: Could only provide ${selectedLeads.length}/${requestedCount} leads for small order after trying all fallback options.`
      );
    } else {
      console.log(
        `[FILLER-DEBUG] SUCCESS: Fulfilled small order with ${selectedLeads.length} leads using priority-based selection`
      );
    }
  } else if (requestedCount <= 20) {
    console.log(`[FILLER-DEBUG] ===== RULE 2 (11-20 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads, max 10 pairs total across all patterns`
    );
    const patternCount = {};
    let totalPairs = 0;
    const maxPairs = 10;
    while (selectedLeads.length < requestedCount) {
      let addedThisRound = 0;
      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;
        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;
        if (currentCount < availableInGroup) {
          const wouldCreatePair = (currentCount + 1) % 2 === 0;
          if (wouldCreatePair && totalPairs >= maxPairs) {
            console.log(
              `[FILLER-DEBUG] Skipping pattern ${pattern} - would exceed total pair limit (${totalPairs}/${maxPairs})`
            );
            continue;
          }
          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;
          if (wouldCreatePair) {
            totalPairs++;
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (creates pair #${totalPairs}), total pairs: ${totalPairs}/${maxPairs} (total leads: ${
                selectedLeads.length
              })`
            );
          } else {
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (no pair), total leads: ${
                selectedLeads.length
              }`
            );
          }
        }
      }
      if (addedThisRound === 0) {
        console.log(
          `[FILLER-DEBUG] No more leads can be added due to constraints or availability, stopping at ${selectedLeads.length} leads`
        );
        break;
      }
    }
    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[FILLER-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }
  } else if (requestedCount <= 40) {
    console.log(`[FILLER-DEBUG] ===== RULE 3 (21-40 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads, max 20 pairs total across all patterns`
    );
    const patternCount = {};
    let totalPairs = 0;
    const maxPairs = 20;
    while (selectedLeads.length < requestedCount) {
      let addedThisRound = 0;
      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;
        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;
        if (currentCount < availableInGroup) {
          const wouldCreatePair = (currentCount + 1) % 2 === 0;
          if (wouldCreatePair && totalPairs >= maxPairs) {
            console.log(
              `[FILLER-DEBUG] Skipping pattern ${pattern} - would exceed total pair limit (${totalPairs}/${maxPairs})`
            );
            continue;
          }
          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;
          if (wouldCreatePair) {
            totalPairs++;
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (creates pair #${totalPairs}), total pairs: ${totalPairs}/${maxPairs} (total leads: ${
                selectedLeads.length
              })`
            );
          } else {
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (no pair), total leads: ${
                selectedLeads.length
              }`
            );
          }
        }
      }
      if (addedThisRound === 0) {
        console.log(
          `[FILLER-DEBUG] No more leads can be added due to constraints or availability, stopping at ${selectedLeads.length} leads`
        );
        break;
      }
    }
    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[FILLER-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }
  } else {
    console.log(`[FILLER-DEBUG] ===== RULE 4 (>40 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Large order - applying intelligent phone distribution`
    );

    // For large orders, distribute leads across phone patterns more intelligently
    const selectedLeads = [];
    const patternCount = {};
    const maxPerPattern = Math.max(
      4,
      Math.ceil(requestedCount / uniquePatterns.length)
    );

    console.log(
      `[FILLER-DEBUG] Max leads per pattern: ${maxPerPattern}, Total patterns: ${uniquePatterns.length}`
    );

    // First pass - take up to maxPerPattern from each pattern
    let round = 0;
    while (selectedLeads.length < requestedCount && round < maxPerPattern) {
      let addedThisRound = 0;
      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;

        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;

        if (currentCount < availableInGroup && currentCount <= round) {
          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;

          console.log(
            `[FILLER-DEBUG] Round ${
              round + 1
            }: Added lead from pattern ${pattern} (${
              currentCount + 1
            }/${availableInGroup}), total: ${selectedLeads.length}`
          );
        }
      }

      if (addedThisRound === 0) {
        console.log(
          `[FILLER-DEBUG] No more leads available in round ${
            round + 1
          }, stopping`
        );
        break;
      }
      round++;
    }

    // If still need more leads, fill from leads without valid phone patterns
    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[FILLER-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }

    return selectedLeads.slice(0, requestedCount);
  }
  console.log(`[FILLER-DEBUG] ===== FINAL RESULT =====`);
  console.log(
    `[FILLER-DEBUG] Selected ${selectedLeads.length} leads out of ${requestedCount} requested`
  );
  const finalPatternCount = {};
  selectedLeads.forEach((lead) => {
    const pattern = getFirstFourDigitsAfterPrefix(lead.newPhone);
    finalPatternCount[pattern] = (finalPatternCount[pattern] || 0) + 1;
  });
  console.log(
    `[FILLER-DEBUG] Final pattern distribution:`,
    Object.entries(finalPatternCount)
      .map(([pattern, count]) => `${pattern || "NO_PATTERN"}:${count}`)
      .join(", ")
  );
  if (selectedLeads.length < requestedCount) {
    console.log(
      `[FILLER-DEBUG] WARNING: Could not fulfill complete request. Got ${selectedLeads.length}/${requestedCount} leads`
    );
  }
  return selectedLeads;
};

const applyFTDPhoneRepetitionRules = (ftdLeads, requestedCount) => {
  if (!ftdLeads || ftdLeads.length === 0) {
    console.log(`[FTD-DEBUG] No leads provided`);
    return ftdLeads;
  }
  console.log(
    `[FTD-DEBUG] ===== FTD LEAD PROCESSING (NO PHONE FILTERING) =====`
  );
  console.log(
    `[FTD-DEBUG] Input: ${ftdLeads.length} FTD leads available, ${requestedCount} requested`
  );

  // FTD leads should NOT be filtered by phone number patterns
  // Simply return the leads as-is, up to the requested count
  console.log(
    `[FTD-DEBUG] FTD leads are NOT filtered by phone digit patterns - returning all leads`
  );

  // Just return all the FTD leads we have, no filtering
  const selectedLeads = ftdLeads.slice(0, requestedCount);

  console.log(
    `[FTD-DEBUG] Returning ${selectedLeads.length} FTD leads (no phone pattern filtering applied)`
  );

  return selectedLeads;
};

const applyColdPhoneRepetitionRules = (coldLeads, requestedCount) => {
  if (!coldLeads || coldLeads.length === 0) {
    console.log(`[COLD-DEBUG] No leads provided`);
    return coldLeads;
  }
  console.log(
    `[COLD-DEBUG] ===== STARTING COLD PROCESSING WITH NEW DIGIT RULES =====`
  );
  console.log(
    `[COLD-DEBUG] Input: ${coldLeads.length} cold leads available, ${requestedCount} requested`
  );

  // Apply same digit filtering logic as FTD
  const filteredLeads = [];
  const rejectedLeads = [];
  const leadsWithoutValidPhone = [];

  coldLeads.forEach((lead, index) => {
    const firstFour = getFirstFourDigitsAfterPrefix(lead.newPhone);
    console.log(
      `[COLD-DEBUG] Lead ${index}: Phone=${lead.newPhone}, FirstFour=${firstFour}, ID=${lead._id}`
    );

    if (firstFour) {
      const analysis = analyzeDigitPattern(firstFour);
      console.log(
        `[COLD-DEBUG] Lead ${index} pattern analysis: shouldFilter=${analysis.shouldFilter}, reason="${analysis.reason}"`
      );

      if (analysis.shouldFilter) {
        rejectedLeads.push({ lead, reason: analysis.reason });
        console.log(`[COLD-DEBUG] Lead ${index} REJECTED: ${analysis.reason}`);
      } else {
        filteredLeads.push(lead);
        console.log(`[COLD-DEBUG] Lead ${index} ACCEPTED: ${analysis.reason}`);
      }
    } else {
      console.log(
        `[COLD-DEBUG] Lead ${index} has no valid phone pattern, adding to backup`
      );
      leadsWithoutValidPhone.push(lead);
    }
  });

  console.log(
    `[COLD-DEBUG] After digit filtering: ${filteredLeads.length} accepted, ${rejectedLeads.length} rejected, ${leadsWithoutValidPhone.length} without valid phone`
  );

  // Group filtered leads by 4-digit patterns
  const phoneGroups = {};
  filteredLeads.forEach((lead) => {
    const firstFour = getFirstFourDigitsAfterPrefix(lead.newPhone);
    if (!phoneGroups[firstFour]) {
      phoneGroups[firstFour] = [];
    }
    phoneGroups[firstFour].push(lead);
  });

  const uniquePatterns = Object.keys(phoneGroups);
  console.log(
    `[COLD-DEBUG] Phone groups created:`,
    uniquePatterns.map((key) => `${key}:${phoneGroups[key].length}`).join(", ")
  );
  console.log(
    `[COLD-DEBUG] Leads without valid phone: ${leadsWithoutValidPhone.length}`
  );

  const selectedLeads = [];

  if (requestedCount <= 10) {
    console.log(`[COLD-DEBUG] ===== SMALL ORDER RULE (≤10 leads) =====`);
    console.log(
      `[COLD-DEBUG] PRIORITY 1: Unique 4-digit patterns (no duplicates)`
    );

    // Priority 1: Take only ONE lead per unique pattern (no duplicates)
    for (const pattern of uniquePatterns) {
      if (selectedLeads.length >= requestedCount) break;
      selectedLeads.push(phoneGroups[pattern][0]);
      console.log(
        `[COLD-DEBUG] Selected unique lead with pattern ${pattern}, total leads: ${selectedLeads.length}`
      );
    }

    // Priority 2: If still need more leads, use rejected leads where 3rd and 4th digits are different
    if (selectedLeads.length < requestedCount) {
      console.log(
        `[COLD-DEBUG] PRIORITY 2: Need ${
          requestedCount - selectedLeads.length
        } more leads, checking rejected leads for acceptable patterns`
      );

      const acceptableRejectedLeads = rejectedLeads.filter(
        ({ lead, reason }) => {
          // Only use leads that were NOT rejected for "3rd and 4th digits are the same"
          return reason !== "Third and fourth digits are the same";
        }
      );

      console.log(
        `[COLD-DEBUG] Found ${acceptableRejectedLeads.length} rejected leads with acceptable patterns (not rejected for 3rd=4th digits)`
      );

      for (const { lead, reason } of acceptableRejectedLeads) {
        if (selectedLeads.length >= requestedCount) break;
        selectedLeads.push(lead);
        console.log(
          `[COLD-DEBUG] Added fallback lead (rejected for: "${reason}"), total leads: ${selectedLeads.length}`
        );
      }
    }

    // Priority 3: If still not enough, fill with leads without valid phone patterns
    if (selectedLeads.length < requestedCount) {
      console.log(
        `[COLD-DEBUG] PRIORITY 3: Still need ${
          requestedCount - selectedLeads.length
        } more leads, using leads without valid phone patterns`
      );

      let backupIndex = 0;
      while (
        selectedLeads.length < requestedCount &&
        backupIndex < leadsWithoutValidPhone.length
      ) {
        selectedLeads.push(leadsWithoutValidPhone[backupIndex]);
        console.log(
          `[COLD-DEBUG] Added lead without valid phone pattern: ${
            backupIndex + 1
          }, total leads: ${selectedLeads.length}`
        );
        backupIndex++;
      }
    }

    // Final warning if still couldn't fulfill the request
    if (selectedLeads.length < requestedCount) {
      console.log(
        `[COLD-DEBUG] WARNING: Could only provide ${selectedLeads.length}/${requestedCount} leads for small order after trying all fallback options.`
      );
    } else {
      console.log(
        `[COLD-DEBUG] SUCCESS: Fulfilled small order with ${selectedLeads.length} leads using priority-based selection`
      );
    }
  } else if (requestedCount <= 20) {
    console.log(`[COLD-DEBUG] ===== RULE 2 (11-20 leads) =====`);
    console.log(
      `[COLD-DEBUG] Need ${requestedCount} leads, max 10 pairs total across all patterns`
    );

    const patternCount = {};
    let totalPairs = 0;
    const maxPairs = 10;

    while (selectedLeads.length < requestedCount) {
      let addedThisRound = 0;
      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;

        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;

        if (currentCount < availableInGroup) {
          const wouldCreatePair = (currentCount + 1) % 2 === 0;

          if (wouldCreatePair && totalPairs >= maxPairs) {
            console.log(
              `[COLD-DEBUG] Skipping pattern ${pattern} - would exceed total pair limit (${totalPairs}/${maxPairs})`
            );
            continue;
          }

          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;

          if (wouldCreatePair) {
            totalPairs++;
            console.log(
              `[COLD-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (creates pair #${totalPairs}), total pairs: ${totalPairs}/${maxPairs} (total leads: ${
                selectedLeads.length
              })`
            );
          } else {
            console.log(
              `[COLD-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (no pair), total leads: ${
                selectedLeads.length
              }`
            );
          }
        }
      }

      if (addedThisRound === 0) {
        console.log(
          `[COLD-DEBUG] No more leads can be added due to constraints or availability, stopping at ${selectedLeads.length} leads`
        );
        break;
      }
    }

    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[COLD-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }
  } else if (requestedCount <= 40) {
    console.log(`[COLD-DEBUG] ===== RULE 3 (21-40 leads) =====`);
    console.log(
      `[COLD-DEBUG] Need ${requestedCount} leads, max 20 pairs total across all patterns`
    );

    const patternCount = {};
    let totalPairs = 0;
    const maxPairs = 20;

    while (selectedLeads.length < requestedCount) {
      let addedThisRound = 0;
      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;

        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;

        if (currentCount < availableInGroup) {
          const wouldCreatePair = (currentCount + 1) % 2 === 0;

          if (wouldCreatePair && totalPairs >= maxPairs) {
            console.log(
              `[COLD-DEBUG] Skipping pattern ${pattern} - would exceed total pair limit (${totalPairs}/${maxPairs})`
            );
            continue;
          }

          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;

          if (wouldCreatePair) {
            totalPairs++;
            console.log(
              `[COLD-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (creates pair #${totalPairs}), total pairs: ${totalPairs}/${maxPairs} (total leads: ${
                selectedLeads.length
              })`
            );
          } else {
            console.log(
              `[COLD-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (no pair), total leads: ${
                selectedLeads.length
              }`
            );
          }
        }
      }

      if (addedThisRound === 0) {
        console.log(
          `[COLD-DEBUG] No more leads can be added due to constraints or availability, stopping at ${selectedLeads.length} leads`
        );
        break;
      }
    }

    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[COLD-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }
  } else {
    console.log(`[COLD-DEBUG] ===== RULE 4 (>40 leads) =====`);
    console.log(
      `[COLD-DEBUG] Large order - applying intelligent phone distribution`
    );

    // For large orders, distribute leads across phone patterns more intelligently
    const selectedLeads = [];
    const patternCount = {};
    const maxPerPattern = Math.max(
      4,
      Math.ceil(requestedCount / uniquePatterns.length)
    );

    console.log(
      `[COLD-DEBUG] Max leads per pattern: ${maxPerPattern}, Total patterns: ${uniquePatterns.length}`
    );

    // First pass - take up to maxPerPattern from each pattern
    let round = 0;
    while (selectedLeads.length < requestedCount && round < maxPerPattern) {
      let addedThisRound = 0;
      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;

        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;

        if (currentCount < availableInGroup && currentCount <= round) {
          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;

          console.log(
            `[COLD-DEBUG] Round ${
              round + 1
            }: Added lead from pattern ${pattern} (${
              currentCount + 1
            }/${availableInGroup}), total: ${selectedLeads.length}`
          );
        }
      }

      if (addedThisRound === 0) {
        console.log(
          `[COLD-DEBUG] No more leads available in round ${round + 1}, stopping`
        );
        break;
      }
      round++;
    }

    // If still need more leads, fill from leads without valid phone patterns
    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[COLD-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }

    return selectedLeads.slice(0, requestedCount);
  }

  console.log(`[COLD-DEBUG] ===== FINAL RESULT =====`);
  console.log(
    `[COLD-DEBUG] Selected ${selectedLeads.length} leads out of ${requestedCount} requested`
  );

  const finalPatternCount = {};
  selectedLeads.forEach((lead) => {
    const pattern = getFirstFourDigitsAfterPrefix(lead.newPhone);
    finalPatternCount[pattern] = (finalPatternCount[pattern] || 0) + 1;
  });
  console.log(
    `[COLD-DEBUG] Final pattern distribution:`,
    Object.entries(finalPatternCount)
      .map(([pattern, count]) => `${pattern || "NO_PATTERN"}:${count}`)
      .join(", ")
  );

  if (selectedLeads.length < requestedCount) {
    console.log(
      `[COLD-DEBUG] WARNING: Could not fulfill complete request. Got ${selectedLeads.length}/${requestedCount} leads`
    );
  }

  return selectedLeads;
};

const getMaxRepetitionsForFillerCount = (count) => {
  if (count <= 10) return 1;
  if (count <= 20) return 2;
  if (count <= 40) return 4;
  return Infinity;
};

/**
 * Generate detailed reason for why a lead type couldn't be fulfilled
 */
const generateDetailedReasonForLeadType = async (
  leadType,
  requested,
  fulfilled,
  filters
) => {
  const {
    country,
    gender,
    selectedClientNetwork,
    selectedOurNetwork,
    selectedCampaign,
    selectedClientBrokers,
  } = filters;

  // Build detailed reason
  let reason = `${leadType.toUpperCase()}: ${fulfilled}/${requested} fulfilled`;
  if (fulfilled < requested) {
    reason += ` (${requested - fulfilled} short)`;
  }

  // If fully fulfilled, no need for detailed analysis
  if (fulfilled >= requested) {
    return reason;
  }

  const limitingFactors = [];

  // Step 1: Check total availability in database (excluding archived and inactive)
  const totalInDB = await Lead.countDocuments({ leadType, isArchived: { $ne: true }, status: { $ne: "inactive" } });
  if (totalInDB < requested) {
    limitingFactors.push(
      `Only ${totalInDB} total ${leadType} leads in database (excluding archived and inactive)`
    );
    reason += ` - ${limitingFactors.join(", ")}`;
    return reason;
  }

  let baseQuery = {
    leadType,
    isArchived: { $ne: true }, // Never count archived leads
    status: { $ne: "inactive" }, // Never count inactive leads
  };

  // Step 2: Add country filter
  if (country) {
    baseQuery.country = country;
  }
  const afterCountryFilter = await Lead.countDocuments(baseQuery);
  if (
    country &&
    afterCountryFilter < totalInDB &&
    afterCountryFilter < requested
  ) {
    limitingFactors.push(
      `Country "${country}" filter reduces leads from ${totalInDB} to ${afterCountryFilter}`
    );
  }

  // Step 3: Add gender filter
  if (gender) {
    baseQuery.gender = gender;
  }
  const afterGenderFilter = await Lead.countDocuments(baseQuery);
  if (
    gender &&
    afterGenderFilter < (country ? afterCountryFilter : totalInDB) &&
    afterGenderFilter < requested
  ) {
    const prevCount = country ? afterCountryFilter : totalInDB;
    limitingFactors.push(
      `Gender "${gender}" filter reduces leads from ${prevCount} to ${afterGenderFilter}`
    );
  }

  // Get actual available leads sample for network/campaign analysis
  const finalBaseCount = afterGenderFilter;
  if (finalBaseCount >= requested) {
    // If we have enough leads after basic filters, the issue must be network/campaign conflicts
    const sampleSize = Math.max(requested * 3, 100);
    const availableLeads = await Lead.find(baseQuery).limit(sampleSize);

    let filteredLeads = availableLeads;
    let currentCount = filteredLeads.length;

    // Apply network/campaign filters in sequence
    if (selectedClientNetwork && currentCount >= requested) {
      const beforeFilter = currentCount;
      filteredLeads = filteredLeads.filter(
        (lead) => !lead.isAssignedToClientNetwork(selectedClientNetwork)
      );
      currentCount = filteredLeads.length;
      if (currentCount < requested && currentCount < beforeFilter) {
        limitingFactors.push(
          `Client network conflict: ${
            beforeFilter - currentCount
          } leads already assigned`
        );
      }
    }

    // Our network filtering removed - leads can be reused for same our network
    // Campaign filtering removed - leads can be reused for same campaign from different networks

    if (
      selectedClientBrokers &&
      selectedClientBrokers.length > 0 &&
      currentCount >= Math.min(requested, filteredLeads.length)
    ) {
      const beforeFilter = currentCount;
      filteredLeads = filteredLeads.filter(
        (lead) =>
          !selectedClientBrokers.some((brokerId) =>
            lead.isAssignedToClientBroker(brokerId)
          )
      );
      currentCount = filteredLeads.length;
      if (currentCount < requested && currentCount < beforeFilter) {
        limitingFactors.push(
          `Client brokers conflict: ${
            beforeFilter - currentCount
          } leads already assigned to selected brokers`
        );
      }
    }
  }

  // If we still don't have enough and no specific factors identified
  if (limitingFactors.length === 0 && fulfilled < requested) {
    limitingFactors.push(
      `Available leads exhausted after applying all filters (${finalBaseCount} available vs ${requested} requested)`
    );
  }

  if (limitingFactors.length > 0) {
    reason += ` - Issues: ${limitingFactors.join(", ")}`;
  }

  return reason;
};

// Handle manual selection order creation
const handleManualSelectionOrder = async (req, res, next) => {
  try {
    const {
      manualLeads,
      priority,
      notes,
      plannedDate,
      selectedClientNetwork,
      selectedOurNetwork,
      selectedCampaign,
      selectedClientBrokers,
    } = req.body;

    // Validate required fields
    if (!selectedOurNetwork) {
      return res.status(400).json({
        success: false,
        message: "Our Network selection is required",
      });
    }

    if (!selectedCampaign) {
      return res.status(400).json({
        success: false,
        message: "Campaign selection is required",
      });
    }

    // Validate all manual leads
    const leadIds = manualLeads.map((ml) => ml.leadId);
    const foundLeads = await Lead.find({ _id: { $in: leadIds } });

    if (foundLeads.length !== leadIds.length) {
      const foundIds = foundLeads.map((l) => l._id.toString());
      const missingIds = leadIds.filter((id) => !foundIds.includes(id));
      return res.status(400).json({
        success: false,
        message: `Some leads not found: ${missingIds.join(", ")}`,
      });
    }

    // Check for archived leads - they cannot be used in orders
    const archivedLeads = foundLeads.filter((lead) => lead.isArchived === true);
    if (archivedLeads.length > 0) {
      const archivedIds = archivedLeads.map((l) => l._id.toString());
      return res.status(400).json({
        success: false,
        message: `Cannot include archived leads in order: ${archivedIds.join(", ")}`,
      });
    }

    // Check client network conflicts - prevent reusing leads already assigned to the same client network
    if (selectedClientNetwork) {
      const conflictingLeads = foundLeads.filter((lead) =>
        lead.isAssignedToClientNetwork(selectedClientNetwork)
      );
      if (conflictingLeads.length > 0) {
        const conflictNames = conflictingLeads.map(
          (l) => `${l.firstName} ${l.lastName} (${l.newEmail})`
        );
        return res.status(400).json({
          success: false,
          message: `Some leads were already used for the selected client network: ${conflictNames.join(", ")}`,
        });
      }
    }

    // Check client broker conflicts - prevent reusing leads already assigned to the same client brokers
    if (selectedClientBrokers && selectedClientBrokers.length > 0) {
      const brokerConflictLeads = foundLeads.filter((lead) =>
        selectedClientBrokers.some((brokerId) =>
          lead.isAssignedToClientBroker(brokerId)
        )
      );
      if (brokerConflictLeads.length > 0) {
        const conflictNames = brokerConflictLeads.map(
          (l) => `${l.firstName} ${l.lastName} (${l.newEmail})`
        );
        return res.status(400).json({
          success: false,
          message: `Some leads were already assigned to the selected client brokers: ${conflictNames.join(", ")}`,
        });
      }
    }

    // Validate agents exist (only for non-cold leads, cold leads don't need agents)
    const User = require("../models/User");
    const agentIds = [...new Set(
      manualLeads
        .filter((ml) => ml.agentId && ml.leadType !== "cold")
        .map((ml) => ml.agentId)
    )];
    if (agentIds.length > 0) {
      const foundAgents = await User.find({
        _id: { $in: agentIds },
        role: "agent",
      });

      if (foundAgents.length !== agentIds.length) {
        const foundAgentIds = foundAgents.map((a) => a._id.toString());
        const missingAgentIds = agentIds.filter(
          (id) => !foundAgentIds.includes(id)
        );
        return res.status(400).json({
          success: false,
          message: `Some agents not found: ${missingAgentIds.join(", ")}`,
        });
      }
    }

    // Create a map of leadId -> lead for easy lookup
    const leadMap = new Map(foundLeads.map((l) => [l._id.toString(), l]));

    // Calculate requests counts based on manual lead types
    const requestsCounts = { ftd: 0, filler: 0, cold: 0 };
    manualLeads.forEach((ml) => {
      if (requestsCounts[ml.leadType] !== undefined) {
        requestsCounts[ml.leadType]++;
      }
    });

    // Get the first lead's country (for display purposes - manual orders may have mixed countries)
    const firstLead = leadMap.get(manualLeads[0].leadId);
    const orderCountry = firstLead?.country || "Mixed";

    // Create leadsMetadata to track how each lead was ordered
    const leadsMetadata = manualLeads.map((ml) => ({
      leadId: ml.leadId,
      orderedAs: ml.leadType,
    }));

    // Create the order
    const Order = require("../models/Order");
    const order = new Order({
      requester: req.user._id,
      requests: requestsCounts,
      fulfilled: requestsCounts, // Manual selection - all leads are fulfilled
      status: "fulfilled",
      priority: priority || "medium",
      notes: notes ? `[Manual Selection] ${notes}` : "[Manual Selection]",
      plannedDate: plannedDate ? new Date(plannedDate) : new Date(),
      countryFilter: orderCountry,
      selectedClientNetwork: selectedClientNetwork || null,
      selectedOurNetwork: selectedOurNetwork,
      selectedCampaign: selectedCampaign,
      selectedClientBrokers: selectedClientBrokers || [],
      leads: leadIds,
      leadsMetadata,
    });

    await order.save();

    // Update each lead with order assignment and agent assignment
    const updatePromises = manualLeads.map(async (ml) => {
      const lead = leadMap.get(ml.leadId);

      // Update assigned agent (cold leads don't get agent assignment)
      if (ml.agentId && ml.leadType !== "cold") {
        lead.assignedAgent = ml.agentId;
        lead.assignedAgentAt = new Date();
      }

      // Update lastUsedInOrder for cooldown tracking
      lead.lastUsedInOrder = new Date();

      // Add client network to history if provided
      if (selectedClientNetwork) {
        if (!lead.clientNetworkHistory) {
          lead.clientNetworkHistory = [];
        }
        lead.clientNetworkHistory.push({
          clientNetwork: selectedClientNetwork,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          orderId: order._id,
        });
      }

      // Add our network to history
      if (selectedOurNetwork) {
        if (!lead.ourNetworkHistory) {
          lead.ourNetworkHistory = [];
        }
        lead.ourNetworkHistory.push({
          ourNetwork: selectedOurNetwork,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          orderId: order._id,
        });
      }

      // Add client brokers to history if provided
      if (selectedClientBrokers && selectedClientBrokers.length > 0) {
        selectedClientBrokers.forEach((brokerId) => {
          if (!lead.assignedClientBrokers) {
            lead.assignedClientBrokers = [];
          }
          if (!lead.assignedClientBrokers.includes(brokerId)) {
            lead.assignedClientBrokers.push(brokerId);
          }
          if (!lead.clientBrokerHistory) {
            lead.clientBrokerHistory = [];
          }
          lead.clientBrokerHistory.push({
            clientBroker: brokerId,
            assignedAt: new Date(),
            assignedBy: req.user._id,
            orderId: order._id,
          });
        });
      }

      // Add campaign to history
      if (selectedCampaign) {
        if (!lead.campaignHistory) {
          lead.campaignHistory = [];
        }
        lead.campaignHistory.push({
          campaign: selectedCampaign,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          orderId: order._id,
        });
      }

      return lead.save();
    });

    await Promise.all(updatePromises);

    // Populate the order for response
    const populatedOrder = await Order.findById(order._id)
      .populate(
        "leads",
        "firstName lastName newEmail newPhone country leadType orderedAs"
      )
      .populate("requester", "fullName email")
      .populate("selectedClientNetwork", "name")
      .populate("selectedOurNetwork", "name")
      .populate("selectedCampaign", "name");

    console.log(
      `[MANUAL-ORDER] Created order ${order._id} with ${manualLeads.length} manually selected leads`
    );

    return res.status(201).json({
      success: true,
      message: `Order created successfully with ${manualLeads.length} manually selected leads`,
      data: mergeLeadsWithMetadata(populatedOrder),
    });
  } catch (error) {
    console.error("Error creating manual selection order:", error);
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    console.log("[ORDER-CREATE] Received order request:", {
      manualSelection: req.body.manualSelection,
      manualLeadsCount: req.body.manualLeads?.length,
      country: req.body.country,
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("[ORDER-CREATE] Validation errors:", errors.array());
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const {
      requests,
      priority,
      notes,
      country,
      gender,
      plannedDate,
      selectedClientNetwork,
      selectedOurNetwork,
      selectedCampaign,
      selectedClientBrokers,
      agentFilter,
      agentAssignments = [], // Array of {leadType, agentId, index, gender (optional)}
      perAssignmentGenders = false, // Flag to indicate if using per-assignment genders
      // Manual selection mode fields
      manualSelection = false,
      manualLeads = [], // Array of {leadId, agentId, leadType}
    } = req.body;

    // Handle manual selection mode
    if (manualSelection && manualLeads.length > 0) {
      return await handleManualSelectionOrder(req, res, next);
    }

    const { ftd = 0, filler = 0, cold = 0 } = requests || {};
    if (ftd + filler + cold === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one lead type must be requested",
      });
    }
    // Client networks are now assignable to affiliate managers
    // Both admins and affiliate managers can use client networks in orders

    // Validate our network access for affiliate managers
    if (req.user.role === "affiliate_manager" && selectedOurNetwork) {
      const OurNetwork = require("../models/OurNetwork");
      const ourNetwork = await OurNetwork.findOne({
        _id: selectedOurNetwork,
        assignedAffiliateManager: req.user._id,
        isActive: true,
      });
      if (!ourNetwork) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied - our network not assigned to you or inactive",
        });
      }
    }
    if (!selectedCampaign) {
      return res.status(400).json({
        success: false,
        message: "Campaign selection is mandatory for all orders",
      });
    }

    // Validate client brokers selection if provided
    if (selectedClientBrokers && selectedClientBrokers.length > 0) {
      const ClientBroker = require("../models/ClientBroker");

      // Validate each client broker
      for (const brokerId of selectedClientBrokers) {
        const clientBroker = await ClientBroker.findOne({
          _id: brokerId,
          isActive: true,
        });
        if (!clientBroker) {
          return res.status(400).json({
            success: false,
            message: `Client broker ${brokerId} not found or inactive`,
          });
        }
      }
    }
    const Campaign = require("../models/Campaign");
    const campaign = await Campaign.findById(selectedCampaign);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Selected campaign not found",
      });
    }
    if (!campaign.isActive || campaign.status !== "active") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot use inactive campaign - only active campaigns are allowed",
      });
    }
    if (req.user.role === "affiliate_manager") {
      const isAssigned = campaign.assignedAffiliateManagers.some(
        (managerId) => managerId.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied - campaign not assigned to you",
        });
      }
    }
    const pulledLeads = [];
    const fulfilled = { ftd: 0, filler: 0, cold: 0 };
    const leadsMetadata = []; // Track how each lead was ordered for this order
    const agentLeadsInsufficient = { ftd: false, filler: false }; // Track if agent-assigned leads were insufficient
    const agentAssignmentInsufficient = []; // Track specific assignment failures: {leadType, index, agentId}

    const countryFilter = country ? { country: new RegExp(country, "i") } : {};
    const genderFilter = gender ? { gender } : {};

    // Helper function to get leads for a specific agent or unassigned leads
    const getLeadsForAgent = async (
      leadType,
      count,
      agentId = null,
      allowUnassignedFallback = false,
      specificGender = null,
      excludeLeadIds = []
    ) => {
      // Use specific gender if provided, otherwise use global gender filter
      const genderFilterToUse = specificGender
        ? { gender: specificGender }
        : genderFilter;

      let query = {
        leadType,
        isArchived: { $ne: true }, // Never return archived leads
        status: { $ne: "inactive" }, // Never return inactive leads
        ...countryFilter,
        ...genderFilterToUse,
      };

      // Exclude already-pulled leads
      if (excludeLeadIds.length > 0) {
        query._id = { $nin: excludeLeadIds };
      }

      // Get total count first (for logging purposes)
      const totalAvailableCount = await Lead.countDocuments(query);

      let availableLeads;

      if (agentId) {
        // When agent is specified, prioritize AGENT-ASSIGNED leads first
        // Only include unassigned leads as fallback if allowUnassignedFallback is true
        const agentQuery = { ...query, assignedAgent: agentId };

        // Debug: Log the queries being used
        console.log(
          `[${leadType.toUpperCase()}-QUERY-DEBUG] Agent query:`,
          JSON.stringify(agentQuery)
        );
        console.log(
          `[${leadType.toUpperCase()}-QUERY-DEBUG] Total matching base criteria: ${totalAvailableCount} (no fetch limit)`
        );
        console.log(
          `[${leadType.toUpperCase()}-QUERY-DEBUG] allowUnassignedFallback: ${allowUnassignedFallback}`
        );

        const agentLeads = await Lead.find(agentQuery);

        if (allowUnassignedFallback) {
          const unassignedQuery = { ...query, assignedAgent: null };
          console.log(
            `[${leadType.toUpperCase()}-QUERY-DEBUG] Unassigned query:`,
            JSON.stringify(unassignedQuery)
          );
          const unassignedLeads = await Lead.find(unassignedQuery);

          console.log(
            `[${leadType.toUpperCase()}-QUERY-DEBUG] Unassigned lead IDs fetched: ${unassignedLeads
              .map((l) => l._id)
              .join(", ")}`
          );

          // Agent-assigned leads FIRST (priority 1), then unassigned as fallback (priority 2)
          availableLeads = [...agentLeads, ...unassignedLeads];

          console.log(
            `[${leadType.toUpperCase()}] Fetched ${
              agentLeads.length
            } agent-assigned leads (priority 1) + ${
              unassignedLeads.length
            } unassigned leads as fallback (priority 2) for agent ${agentId}`
          );
        } else {
          // No fallback - only return leads assigned to this specific agent
          availableLeads = agentLeads;

          console.log(
            `[${leadType.toUpperCase()}] Fetched ${
              agentLeads.length
            } agent-assigned leads (no unassigned fallback) for agent ${agentId}`
          );
        }
      } else {
        // No agent specified, fetch all matching leads (no limit)
        availableLeads = await Lead.find(query);
      }

      // Apply cooldown filter for FTD and Filler leads (10-day cooldown)
      if (leadType === "ftd" || leadType === "filler") {
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const beforeCooldownFilter = availableLeads.length;

        // Extract phones from available leads to checking for duplicates
        const leadPhones = availableLeads
          .map((l) => l.newPhone)
          .filter(Boolean);

        // Find ALL leads (ftd or filler) with these phones that have been used recently
        // This prevents using an FTD lead if a Filler lead with same phone was used recently (and vice versa)
        const recentlyUsedLeads = await Lead.find({
          newPhone: { $in: leadPhones },
          leadType: { $in: ["ftd", "filler"] },
          lastUsedInOrder: { $gt: tenDaysAgo },
        }).select("newPhone");

        const recentlyUsedPhones = new Set(
          recentlyUsedLeads.map((l) => l.newPhone)
        );

        // Debug: Log all leads before cooldown filtering
        console.log(
          `[${leadType.toUpperCase()}-COOLDOWN-DEBUG] Checking ${
            availableLeads.length
          } leads for cooldown:`
        );
        availableLeads.forEach((lead, idx) => {
          const inCooldown =
            lead.lastUsedInOrder && lead.lastUsedInOrder > tenDaysAgo;
          const isDuplicateUsed = recentlyUsedPhones.has(lead.newPhone);
          console.log(
            `[${leadType.toUpperCase()}-COOLDOWN-DEBUG] Lead ${idx}: ID=${
              lead._id
            }, Phone=${lead.newPhone}, lastUsedInOrder=${
              lead.lastUsedInOrder || "NULL"
            }, inCooldown=${inCooldown}, isDuplicateUsed=${isDuplicateUsed}, assignedAgent=${
              lead.assignedAgent || "NULL"
            }`
          );
        });

        availableLeads = availableLeads.filter((lead) => {
          const inCooldown =
            lead.lastUsedInOrder && lead.lastUsedInOrder > tenDaysAgo;
          const isDuplicateUsed = recentlyUsedPhones.has(lead.newPhone);
          return !inCooldown && !isDuplicateUsed;
        });
        console.log(
          `[${leadType.toUpperCase()}] Cooldown filtering: ${
            beforeCooldownFilter - availableLeads.length
          } leads filtered out (in 10-day cooldown or duplicate used), ${
            availableLeads.length
          } leads remain`
        );
      }

      // Apply network and broker filters
      if (selectedClientNetwork) {
        availableLeads = availableLeads.filter(
          (lead) => !lead.isAssignedToClientNetwork(selectedClientNetwork)
        );
      }

      // Our network filtering removed - leads can be reused for same our network

      if (selectedClientBrokers && selectedClientBrokers.length > 0) {
        availableLeads = availableLeads.filter(
          (lead) =>
            !selectedClientBrokers.some((brokerId) =>
              lead.isAssignedToClientBroker(brokerId)
            )
        );
      }

      // Filter by agent assignment
      if (agentId) {
        // Get leads assigned to this specific agent (Priority 1)
        const agentAssignedLeads = availableLeads.filter(
          (lead) =>
            lead.assignedAgent &&
            lead.assignedAgent.toString() === agentId.toString()
        );

        if (allowUnassignedFallback) {
          // Get unassigned leads as fallback (Priority 2)
          const unassignedLeads = availableLeads.filter(
            (lead) => !lead.assignedAgent
          );

          console.log(
            `[${leadType.toUpperCase()}] Agent ${agentId}: ${
              agentAssignedLeads.length
            } agent-assigned leads (priority 1) + ${
              unassignedLeads.length
            } unassigned fallback leads (priority 2) found (need ${count}) - ${
              availableLeads.length
            } leads passed previous filters`
          );

          if (unassignedLeads.length === 0 && agentAssignedLeads.length === 0 && totalAvailableCount > 0) {
            console.log(
              `[${leadType.toUpperCase()}] WARNING: ${totalAvailableCount} leads in database but 0 after filtering. Possible reasons:`,
              {
                clientNetworkFiltered: selectedClientNetwork ? "YES" : "NO",
                clientBrokersFiltered:
                  selectedClientBrokers && selectedClientBrokers.length > 0
                    ? "YES"
                    : "NO",
                selectedClientNetwork: selectedClientNetwork || "none",
                selectedClientBrokers: selectedClientBrokers || [],
              }
            );
          }

          // Agent-assigned FIRST (priority 1), then unassigned fallback (priority 2)
          availableLeads = [...agentAssignedLeads, ...unassignedLeads];

          console.log(
            `[${leadType.toUpperCase()}] Agent ${agentId}: Using ${
              agentAssignedLeads.length
            } agent-assigned + ${unassignedLeads.length} unassigned fallback leads`
          );
        } else {
          // No fallback - only agent-assigned leads
          console.log(
            `[${leadType.toUpperCase()}] Agent ${agentId}: ${
              agentAssignedLeads.length
            } agent-assigned leads found (no unassigned fallback) (need ${count}) - ${
              availableLeads.length
            } leads passed previous filters`
          );

          if (agentAssignedLeads.length === 0 && totalAvailableCount > 0) {
            console.log(
              `[${leadType.toUpperCase()}] WARNING: ${totalAvailableCount} leads in database but 0 agent-assigned after filtering. Possible reasons:`,
              {
                clientNetworkFiltered: selectedClientNetwork ? "YES" : "NO",
                clientBrokersFiltered:
                  selectedClientBrokers && selectedClientBrokers.length > 0
                    ? "YES"
                    : "NO",
                selectedClientNetwork: selectedClientNetwork || "none",
                selectedClientBrokers: selectedClientBrokers || [],
              }
            );
          }

          availableLeads = agentAssignedLeads;

          console.log(
            `[${leadType.toUpperCase()}] Agent ${agentId}: Using ${
              agentAssignedLeads.length
            } agent-assigned leads only`
          );
        }
      } else {
        // No agent specified - Priority: UNASSIGNED first, then ANY assigned leads
        const unassignedLeads = availableLeads.filter((lead) => !lead.assignedAgent);
        const assignedLeads = availableLeads.filter((lead) => lead.assignedAgent);

        // Combine: UNASSIGNED first (priority 1), then assigned (priority 2)
        availableLeads = [...unassignedLeads, ...assignedLeads];

        console.log(
          `[${leadType.toUpperCase()}] No agent filter: ${
            unassignedLeads.length
          } unassigned (priority 1) + ${assignedLeads.length} assigned (priority 2) leads`
        );
      }

      return {
        leads: availableLeads.slice(0, count),
        agentLeadsInsufficient: false,
        agentAssignedCount: agentId
          ? availableLeads.filter((l) => l.assignedAgent).length
          : 0,
      };
    };
    const getAvailableLeadsWithNetworkCheck = async (
      leadType,
      requestedCount
    ) => {
      let query = {
        leadType,
        isArchived: { $ne: true }, // Never return archived leads
        status: { $ne: "inactive" }, // Never return inactive leads
        ...countryFilter,
        ...genderFilter,
      };

      // Get total count first to determine fetch strategy
      const totalAvailableCount = await Lead.countDocuments(query);
      console.log(
        `[${leadType.toUpperCase()}-DEBUG] Total ${leadType} leads matching base criteria: ${totalAvailableCount}`
      );

      // Determine fetch limit - similar to other lead types
      let fetchLimit;
      if (totalAvailableCount <= 5000) {
        fetchLimit = totalAvailableCount;
        console.log(
          `[${leadType.toUpperCase()}-DEBUG] Fetching all ${fetchLimit} available leads for comprehensive filtering`
        );
      } else {
        // Use a higher multiplier than the previous "requestedCount * 2"
        const multiplier = Math.max(
          20,
          Math.min(50, Math.ceil(totalAvailableCount / requestedCount))
        );
        fetchLimit = Math.min(totalAvailableCount, requestedCount * multiplier);
        console.log(
          `[${leadType.toUpperCase()}-DEBUG] Large dataset detected. Using multiplier ${multiplier}, fetching ${fetchLimit} leads`
        );
      }

      let availableLeads;

      // If agentFilter is specified, fetch both unassigned and agent-assigned leads
      // Priority: UNASSIGNED first, then agent-assigned
      if (agentFilter && (leadType === "ftd" || leadType === "filler")) {
        const agentQuery = { ...query, assignedAgent: agentFilter };
        const unassignedQuery = { ...query, assignedAgent: null };

        const agentLeads = await Lead.find(agentQuery).limit(fetchLimit);
        const unassignedLeads = await Lead.find(unassignedQuery).limit(
          fetchLimit
        );

        // UNASSIGNED first (priority 1), then agent-assigned (priority 2)
        availableLeads = [...unassignedLeads, ...agentLeads];

        console.log(
          `[${leadType.toUpperCase()}-DEBUG] Fetched ${
            unassignedLeads.length
          } unassigned (priority 1) + ${agentLeads.length} agent-assigned (priority 2) (total: ${
            availableLeads.length
          })`
        );
      } else {
        availableLeads = await Lead.find(query).limit(fetchLimit);
        console.log(
          `[${leadType.toUpperCase()}-DEBUG] Initially fetched ${
            availableLeads.length
          } leads for filtering`
        );
      }

      if (selectedClientNetwork) {
        const beforeCount = availableLeads.length;
        availableLeads = availableLeads.filter(
          (lead) => !lead.isAssignedToClientNetwork(selectedClientNetwork)
        );
        console.log(
          `[${leadType.toUpperCase()}-DEBUG] After client network filtering: ${
            availableLeads.length
          } leads remain (${beforeCount - availableLeads.length} filtered out)`
        );
      }

      // Our network filtering removed - leads can be reused for same our network
      // Campaign filtering removed - leads can be reused for same campaign from different networks
      console.log(
        `[${leadType.toUpperCase()}-DEBUG] Campaign filtering skipped - leads can be reused for same campaign from different networks`
      );

      if (selectedClientBrokers && selectedClientBrokers.length > 0) {
        const beforeCount = availableLeads.length;
        availableLeads = availableLeads.filter(
          (lead) =>
            !selectedClientBrokers.some((brokerId) =>
              lead.isAssignedToClientBroker(brokerId)
            )
        );
        console.log(
          `[${leadType.toUpperCase()}-DEBUG] After client brokers filtering: ${
            availableLeads.length
          } leads remain (${beforeCount - availableLeads.length} filtered out)`
        );
      }

      // Apply cooldown filter for FTD and Filler leads (10-day cooldown)
      // This prevents returning leads that were previously ordered as FTD or Filler
      if (leadType === "ftd" || leadType === "filler") {
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const beforeCooldownFilter = availableLeads.length;

        // Extract phones from available leads to check for duplicates
        const leadPhones = availableLeads
          .map((l) => l.newPhone)
          .filter(Boolean);

        // Find ALL leads (ftd or filler) with these phones that have been used recently
        // This prevents using an FTD lead if a Filler lead with same phone was used recently (and vice versa)
        const recentlyUsedLeads = await Lead.find({
          newPhone: { $in: leadPhones },
          leadType: { $in: ["ftd", "filler"] },
          lastUsedInOrder: { $gt: tenDaysAgo },
        }).select("newPhone");

        const recentlyUsedPhones = new Set(
          recentlyUsedLeads.map((l) => l.newPhone)
        );

        availableLeads = availableLeads.filter((lead) => {
          const inCooldown =
            lead.lastUsedInOrder && lead.lastUsedInOrder > tenDaysAgo;
          const isDuplicateUsed = recentlyUsedPhones.has(lead.newPhone);
          return !inCooldown && !isDuplicateUsed;
        });

        console.log(
          `[${leadType.toUpperCase()}-DEBUG] Cooldown filtering: ${
            beforeCooldownFilter - availableLeads.length
          } leads filtered out (in 10-day cooldown or duplicate used), ${
            availableLeads.length
          } leads remain`
        );
      }

      // Agent filtering for FTD and Filler leads
      if ((leadType === "ftd" || leadType === "filler") && agentFilter) {
        console.log(
          `[${leadType.toUpperCase()}-DEBUG] Agent filter specified: ${agentFilter}`
        );

        // Separate leads into agent-assigned and unassigned
        const agentAssignedLeads = availableLeads.filter(
          (lead) =>
            lead.assignedAgent &&
            lead.assignedAgent.toString() === agentFilter.toString()
        );
        const unassignedLeads = availableLeads.filter(
          (lead) => !lead.assignedAgent
        );

        console.log(
          `[${leadType.toUpperCase()}-DEBUG] Found ${
            agentAssignedLeads.length
          } leads assigned to this agent, ${
            unassignedLeads.length
          } unassigned leads`
        );

        // Check if agent-assigned leads are insufficient
        if (agentAssignedLeads.length < requestedCount) {
          console.log(
            `[${leadType.toUpperCase()}-DEBUG] WARNING: Only ${
              agentAssignedLeads.length
            } agent-assigned leads available, but ${requestedCount} requested`
          );
          agentLeadsInsufficient[leadType] = true;
        }

        // Priority: AGENT-ASSIGNED first (priority 1), then unassigned as fallback (priority 2)
        availableLeads = [...agentAssignedLeads, ...unassignedLeads];

        console.log(
          `[${leadType.toUpperCase()}-DEBUG] Agent filter - combined ${
            agentAssignedLeads.length
          } agent-assigned (priority 1) + ${
            unassignedLeads.length
          } unassigned fallback (priority 2)`
        );
      } else if (
        (leadType === "ftd" || leadType === "filler") &&
        !agentFilter
      ) {
        // No agent filter - Priority: UNASSIGNED first, then ANY assigned leads
        const unassignedLeads = availableLeads.filter((lead) => !lead.assignedAgent);
        const assignedLeads = availableLeads.filter((lead) => lead.assignedAgent);
        availableLeads = [...unassignedLeads, ...assignedLeads];
        console.log(
          `[${leadType.toUpperCase()}-DEBUG] No agent filter - ${
            unassignedLeads.length
          } unassigned (priority 1) + ${
            assignedLeads.length
          } assigned (priority 2)`
        );
      }

      const finalLeads = availableLeads.slice(0, requestedCount);
      console.log(
        `[${leadType.toUpperCase()}-DEBUG] Final result: ${
          finalLeads.length
        } ${leadType} leads selected for order (from ${
          availableLeads.length
        } available after filtering)`
      );
      return finalLeads;
    };
    // Process FTD leads with individual agent assignments if provided
    if (ftd > 0 && agentAssignments.length > 0) {
      console.log(
        `[FTD-DEBUG] ===== FETCHING FTD LEADS WITH INDIVIDUAL AGENT ASSIGNMENTS =====`
      );
      console.log(`[FTD-DEBUG] Requested FTD leads: ${ftd}`);

      const ftdAssignments = agentAssignments.filter(
        (a) => a.leadType === "ftd"
      );
      console.log(
        `[FTD-DEBUG] Individual assignments: ${ftdAssignments.length}`
      );

      // Group assignments by agentId to batch requests
      const assignmentsByAgent = {};
      const unassignedIndices = [];

      for (let i = 0; i < ftd; i++) {
        const assignment = ftdAssignments.find((a) => a.index === i);
        if (assignment && assignment.agentId) {
          if (!assignmentsByAgent[assignment.agentId]) {
            assignmentsByAgent[assignment.agentId] = [];
          }
          assignmentsByAgent[assignment.agentId].push(i);
        } else {
          unassignedIndices.push(i);
        }
      }

      console.log(
        `[FTD-DEBUG] Grouped by agent:`,
        Object.keys(assignmentsByAgent).map(
          (agentId) => `${agentId}: ${assignmentsByAgent[agentId].length} leads`
        )
      );
      console.log(
        `[FTD-DEBUG] Unassigned indices: ${unassignedIndices.length}`
      );

      const ftdLeadsArray = new Array(ftd).fill(null);
      const pulledFtdLeadIds = []; // Track already-pulled lead IDs to prevent duplicates

      // Pull leads for each agent
      for (const [agentId, indices] of Object.entries(assignmentsByAgent)) {
        console.log(
          `[FTD-DEBUG] ===== Processing agent ${agentId} with ${
            indices.length
          } assignments (indices: ${indices.join(", ")}) =====`
        );

        // If using per-assignment genders, process each index separately
        if (perAssignmentGenders) {
          console.log(
            `[FTD-DEBUG] Using perAssignmentGenders mode for agent ${agentId}`
          );

          for (const index of indices) {
            const assignment = ftdAssignments.find((a) => a.index === index);
            const assignmentGender = assignment?.gender;

            console.log(
              `[FTD-DEBUG] Processing index ${index} for agent ${agentId}:`,
              {
                hasAssignment: !!assignment,
                assignmentGender: assignmentGender || "NONE",
                fullAssignment: assignment,
              }
            );

            if (assignmentGender) {
              console.log(
                `[FTD-DEBUG] Index ${index}: HAS gender (${assignmentGender}) - will use fallback with gender filter`
              );
              // User selected a gender for this specific assignment - allow fallback
              const result = await getLeadsForAgent(
                "ftd",
                1,
                agentId,
                true,
                assignmentGender,
                pulledFtdLeadIds
              );
              console.log(
                `[FTD-DEBUG] Index ${index}: Got ${result.leads.length}/1 lead for agent ${agentId} with gender ${assignmentGender} (excluding ${pulledFtdLeadIds.length} already-pulled)`
              );

              if (result.leads.length > 0) {
                console.log(
                  `[FTD-DEBUG] Index ${index}: SUCCESS - Adding lead ${result.leads[0]._id} to ftdLeadsArray[${index}]`
                );
                ftdLeadsArray[index] = result.leads[0];
                pulledFtdLeadIds.push(result.leads[0]._id); // Track this lead to exclude it from future pulls
              } else {
                console.log(
                  `[FTD-DEBUG] Index ${index}: FAILED - No lead found, marking as insufficient`
                );
                agentAssignmentInsufficient.push({
                  leadType: "ftd",
                  index: index,
                  agentId: agentId,
                });
              }
            } else {
              console.log(
                `[FTD-DEBUG] Index ${index}: NO gender - this was successful before, fetching agent's assigned leads`
              );
              // No gender selected - this assignment was successful originally
              // Process normally for this agent (assigned leads only, no fallback, no gender filter)
              const result = await getLeadsForAgent(
                "ftd",
                1,
                agentId,
                false, // Don't allow unassigned fallback - agent should have leads
                null, // No gender filter
                pulledFtdLeadIds
              );
              console.log(
                `[FTD-DEBUG] Index ${index}: Got ${result.leads.length}/1 lead for agent ${agentId} without gender filter (excluding ${pulledFtdLeadIds.length} already-pulled)`
              );

              if (result.leads.length > 0) {
                console.log(
                  `[FTD-DEBUG] Index ${index}: SUCCESS - Adding agent-assigned lead ${result.leads[0]._id} (assignedAgent: ${result.leads[0].assignedAgent}) to ftdLeadsArray[${index}]`
                );
                ftdLeadsArray[index] = result.leads[0];
                pulledFtdLeadIds.push(result.leads[0]._id); // Track this lead to exclude it from future pulls
              } else {
                // This shouldn't happen since it was successful before
                console.warn(
                  `[FTD-DEBUG] Index ${index}: WARNING - Agent ${agentId} had assigned leads before but none found now!`
                );
                agentAssignmentInsufficient.push({
                  leadType: "ftd",
                  index: index,
                  agentId: agentId,
                });
              }
            }
          }
        } else {
          // Original behavior: process all indices for this agent at once
          // Allow unassigned fallback only if gender is specified (meaning user selected it from modal)
          const allowUnassignedFallback = !!gender;
          const result = await getLeadsForAgent(
            "ftd",
            indices.length,
            agentId,
            allowUnassignedFallback,
            null,
            pulledFtdLeadIds
          );
          console.log(
            `[FTD-DEBUG] Got ${result.leads.length}/${indices.length} leads for agent ${agentId} (excluding ${pulledFtdLeadIds.length} already-pulled)`
          );

          // Assign pulled leads to their slots
          for (let i = 0; i < result.leads.length; i++) {
            ftdLeadsArray[indices[i]] = result.leads[i];
            pulledFtdLeadIds.push(result.leads[i]._id); // Track to prevent duplicates
          }

          // Track insufficient assignments if agent-assigned leads were not enough
          if (
            result.agentLeadsInsufficient ||
            result.leads.length < indices.length
          ) {
            for (let i = result.leads.length; i < indices.length; i++) {
              agentAssignmentInsufficient.push({
                leadType: "ftd",
                index: indices[i],
                agentId: agentId,
              });
            }
          }
        }
      }

      // Pull unassigned leads for remaining slots
      if (unassignedIndices.length > 0) {
        const unassignedResult = await getLeadsForAgent(
          "ftd",
          unassignedIndices.length,
          null,
          false,
          null,
          pulledFtdLeadIds
        );
        console.log(
          `[FTD-DEBUG] Got ${unassignedResult.leads.length}/${unassignedIndices.length} unassigned leads (excluding ${pulledFtdLeadIds.length} already-pulled)`
        );

        for (let i = 0; i < unassignedResult.leads.length; i++) {
          ftdLeadsArray[unassignedIndices[i]] = unassignedResult.leads[i];
          pulledFtdLeadIds.push(unassignedResult.leads[i]._id); // Track to prevent duplicates
        }
      }

      // Collect successfully pulled leads
      console.log(`[FTD-DEBUG] ===== FINAL FTD ARRAY SUMMARY =====`);
      console.log(`[FTD-DEBUG] ftdLeadsArray length: ${ftdLeadsArray.length}`);
      ftdLeadsArray.forEach((lead, index) => {
        if (lead) {
          console.log(
            `[FTD-DEBUG] ftdLeadsArray[${index}]: Lead ${
              lead._id
            }, assignedAgent: ${lead.assignedAgent || "UNASSIGNED"}, gender: ${
              lead.gender
            }`
          );
        } else {
          console.log(`[FTD-DEBUG] ftdLeadsArray[${index}]: NULL (no lead)`);
        }
      });

      const ftdLeads = ftdLeadsArray.filter((lead) => lead !== null);
      console.log(
        `[FTD-DEBUG] After filtering nulls: ${ftdLeads.length} FTD leads to process`
      );

      if (ftdLeads.length > 0) {
        const appliedFTDLeads = applyFTDPhoneRepetitionRules(ftdLeads, ftd);
        console.log(
          `[FTD-DEBUG] After phone repetition rules: ${appliedFTDLeads.length} FTD leads`
        );
        pulledLeads.push(...appliedFTDLeads);
        fulfilled.ftd = appliedFTDLeads.length;
        appliedFTDLeads.forEach((lead) => {
          leadsMetadata.push({ leadId: lead._id, orderedAs: "ftd" });
        });
        console.log(
          `[FTD-DEBUG] Final result: ${appliedFTDLeads.length} FTD leads added to order`
        );
      }
    } else if (ftd > 0) {
      console.log(`[FTD-DEBUG] ===== FETCHING FTD LEADS =====`);
      console.log(`[FTD-DEBUG] Requested FTD leads: ${ftd}`);

      // Build base query for FTD leads
      let ftdQuery = {
        leadType: "ftd",
        isArchived: { $ne: true }, // Never return archived leads
        status: { $ne: "inactive" }, // Never return inactive leads
        ...countryFilter,
        ...genderFilter,
      };

      // First, get the total count of available leads matching base criteria
      const totalAvailableCount = await Lead.countDocuments(ftdQuery);
      console.log(
        `[FTD-DEBUG] Total FTD leads matching base criteria: ${totalAvailableCount}`
      );

      // Determine fetch strategy based on available leads and requested count
      let fetchLimit;
      if (totalAvailableCount <= 10000) {
        // If dataset is reasonable size, fetch all to ensure proper filtering
        fetchLimit = totalAvailableCount;
        console.log(
          `[FTD-DEBUG] Fetching all ${fetchLimit} available leads for comprehensive filtering`
        );
      } else {
        // For very large datasets, use a high multiplier to ensure enough leads for filtering
        const multiplier = Math.max(
          50,
          Math.min(100, Math.ceil(totalAvailableCount / ftd))
        );
        fetchLimit = Math.min(totalAvailableCount, ftd * multiplier);
        console.log(
          `[FTD-DEBUG] Large dataset detected. Using multiplier ${multiplier}, fetching ${fetchLimit} leads`
        );
      }

      let ftdLeads = await Lead.aggregate([
        {
          $match: ftdQuery,
        },
        {
          $sample: { size: fetchLimit },
        },
      ]);

      console.log(
        `[FTD-DEBUG] Found ${ftdLeads.length} FTD leads for filtering (from ${totalAvailableCount} available)`
      );

      if (ftdLeads.length > 0) {
        const ftdLeadIds = ftdLeads.map((lead) => lead._id);
        const ftdLeadDocs = await Lead.find({ _id: { $in: ftdLeadIds } });
        let filteredFTDLeads = ftdLeadDocs;

        // Filter out FTDs in cooldown period (10 days since last use)
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const beforeCooldownFilter = filteredFTDLeads.length;
        filteredFTDLeads = filteredFTDLeads.filter(
          (lead) => !lead.lastUsedInOrder || lead.lastUsedInOrder <= tenDaysAgo
        );
        console.log(
          `[FTD-DEBUG] Cooldown filtering: ${
            beforeCooldownFilter - filteredFTDLeads.length
          } leads filtered out (in 10-day cooldown), ${
            filteredFTDLeads.length
          } leads remain`
        );

        if (selectedClientNetwork) {
          console.log(
            `[FTD-DEBUG] Filtering out leads already assigned to client network: ${selectedClientNetwork}`
          );
          filteredFTDLeads = filteredFTDLeads.filter(
            (lead) => !lead.isAssignedToClientNetwork(selectedClientNetwork)
          );
          console.log(
            `[FTD-DEBUG] After client network filtering: ${filteredFTDLeads.length} leads remain`
          );
        }

        // Our network filtering removed - leads can be reused for same our network
        // Campaign filtering removed - leads can be reused for same campaign from different networks
        console.log(
          `[FTD-DEBUG] Campaign filtering skipped - leads can be reused for same campaign from different networks`
        );

        if (selectedClientBrokers && selectedClientBrokers.length > 0) {
          console.log(
            `[FTD-DEBUG] Filtering out leads already assigned to client brokers: ${selectedClientBrokers.join(
              ", "
            )}`
          );
          filteredFTDLeads = filteredFTDLeads.filter(
            (lead) =>
              !selectedClientBrokers.some((brokerId) =>
                lead.isAssignedToClientBroker(brokerId)
              )
          );
          console.log(
            `[FTD-DEBUG] After client brokers filtering: ${filteredFTDLeads.length} leads remain`
          );
        }

        // Agent filtering for FTD leads
        if (agentFilter) {
          console.log(`[FTD-DEBUG] Agent filter specified: ${agentFilter}`);

          // Separate leads into agent-assigned and unassigned
          const agentAssignedLeads = filteredFTDLeads.filter(
            (lead) =>
              lead.assignedAgent &&
              lead.assignedAgent.toString() === agentFilter.toString()
          );
          const unassignedLeads = filteredFTDLeads.filter(
            (lead) => !lead.assignedAgent
          );

          console.log(
            `[FTD-DEBUG] Found ${agentAssignedLeads.length} leads assigned to this agent, ${unassignedLeads.length} unassigned leads`
          );

          // Check if agent-assigned leads are insufficient
          if (agentAssignedLeads.length < ftd) {
            console.log(
              `[FTD-DEBUG] WARNING: Only ${agentAssignedLeads.length} agent-assigned leads available, but ${ftd} requested`
            );
            agentLeadsInsufficient.ftd = true;
          }

          // Prioritize agent-assigned leads, then fill with unassigned
          filteredFTDLeads = [...agentAssignedLeads, ...unassignedLeads];
        } else {
          // If no agent filter, only use unassigned FTD leads
          const beforeCount = filteredFTDLeads.length;
          filteredFTDLeads = filteredFTDLeads.filter(
            (lead) => !lead.assignedAgent
          );
          console.log(
            `[FTD-DEBUG] No agent filter - only unassigned leads: ${
              filteredFTDLeads.length
            } leads remain (${
              beforeCount - filteredFTDLeads.length
            } filtered out)`
          );
        }

        ftdLeads = filteredFTDLeads;
      }

      if (ftdLeads.length > 0) {
        const appliedFTDLeads = applyFTDPhoneRepetitionRules(ftdLeads, ftd);
        pulledLeads.push(...appliedFTDLeads);
        fulfilled.ftd = appliedFTDLeads.length;
        // Track metadata for each FTD lead
        appliedFTDLeads.forEach((lead) => {
          leadsMetadata.push({ leadId: lead._id, orderedAs: "ftd" });
        });
        console.log(
          `[FTD-DEBUG] Final result: ${appliedFTDLeads.length} FTD leads added to order`
        );
      } else {
        console.log(`[FTD-DEBUG] No FTD leads found matching criteria`);
      }
    }
    // Process Filler leads with individual agent assignments if provided
    if (filler > 0 && agentAssignments.length > 0) {
      console.log(
        `[FILLER-DEBUG] ===== FETCHING FILLER LEADS WITH INDIVIDUAL AGENT ASSIGNMENTS =====`
      );
      console.log(`[FILLER-DEBUG] Requested filler leads: ${filler}`);
      console.log(
        `[FILLER-DEBUG] NOTE: Pulling from FTD leadType, marking as orderedAs='filler'`
      );

      const fillerAssignments = agentAssignments.filter(
        (a) => a.leadType === "filler"
      );
      console.log(
        `[FILLER-DEBUG] Individual assignments: ${fillerAssignments.length}`
      );

      // Group assignments by agentId to batch requests
      const assignmentsByAgent = {};
      const unassignedIndices = [];

      for (let i = 0; i < filler; i++) {
        const assignment = fillerAssignments.find((a) => a.index === i);
        if (assignment && assignment.agentId) {
          if (!assignmentsByAgent[assignment.agentId]) {
            assignmentsByAgent[assignment.agentId] = [];
          }
          assignmentsByAgent[assignment.agentId].push(i);
        } else {
          unassignedIndices.push(i);
        }
      }

      console.log(
        `[FILLER-DEBUG] Grouped by agent:`,
        Object.keys(assignmentsByAgent).map(
          (agentId) => `${agentId}: ${assignmentsByAgent[agentId].length} leads`
        )
      );
      console.log(
        `[FILLER-DEBUG] Unassigned indices: ${unassignedIndices.length}`
      );

      const fillerLeadsArray = new Array(filler).fill(null);
      // Initialize with FTD lead IDs to prevent pulling same leads for filler
      const pulledFillerLeadIds = [...pulledLeads.map((lead) => lead._id)];
      console.log(
        `[FILLER-DEBUG] Starting with ${pulledFillerLeadIds.length} leads to exclude (from FTD/other types)`
      );

      // Pull leads for each agent
      for (const [agentId, indices] of Object.entries(assignmentsByAgent)) {
        console.log(
          `[FILLER-DEBUG] ===== Processing agent ${agentId} with ${
            indices.length
          } assignments (indices: ${indices.join(", ")}) =====`
        );

        // If using per-assignment genders, process each index separately
        if (perAssignmentGenders) {
          console.log(
            `[FILLER-DEBUG] Using perAssignmentGenders mode for agent ${agentId}`
          );

          for (const index of indices) {
            const assignment = fillerAssignments.find((a) => a.index === index);
            const assignmentGender = assignment?.gender;

            console.log(
              `[FILLER-DEBUG] Processing index ${index} for agent ${agentId}:`,
              {
                hasAssignment: !!assignment,
                assignmentGender: assignmentGender || "NONE",
                fullAssignment: assignment,
              }
            );

            if (assignmentGender) {
              console.log(
                `[FILLER-DEBUG] Index ${index}: HAS gender (${assignmentGender}) - will use fallback with gender filter`
              );
              // User selected a gender for this specific assignment - allow fallback
              // NOTE: Using "ftd" as leadType since fillers are pulled from FTD leads
              const result = await getLeadsForAgent(
                "ftd",
                1,
                agentId,
                true,
                assignmentGender,
                pulledFillerLeadIds
              );
              console.log(
                `[FILLER-DEBUG] Index ${index}: Got ${result.leads.length}/1 FTD lead for agent ${agentId} with gender ${assignmentGender} (excluding ${pulledFillerLeadIds.length} already-pulled)`
              );

              if (result.leads.length > 0) {
                console.log(
                  `[FILLER-DEBUG] Index ${index}: SUCCESS - Adding lead ${result.leads[0]._id} to fillerLeadsArray[${index}]`
                );
                fillerLeadsArray[index] = result.leads[0];
                pulledFillerLeadIds.push(result.leads[0]._id); // Track this lead to exclude it from future pulls
              } else {
                console.log(
                  `[FILLER-DEBUG] Index ${index}: FAILED - No lead found, marking as insufficient`
                );
                agentAssignmentInsufficient.push({
                  leadType: "filler",
                  index: index,
                  agentId: agentId,
                });
              }
            } else {
              console.log(
                `[FILLER-DEBUG] Index ${index}: NO gender - this was successful before, fetching agent's assigned leads`
              );
              // No gender selected - this assignment was successful originally
              // Process normally for this agent (assigned leads only, no fallback, no gender filter)
              // NOTE: Using "ftd" as leadType since fillers are pulled from FTD leads
              const result = await getLeadsForAgent(
                "ftd",
                1,
                agentId,
                false, // Don't allow unassigned fallback - agent should have leads
                null, // No gender filter
                pulledFillerLeadIds
              );
              console.log(
                `[FILLER-DEBUG] Index ${index}: Got ${result.leads.length}/1 FTD lead for agent ${agentId} without gender filter (excluding ${pulledFillerLeadIds.length} already-pulled)`
              );

              if (result.leads.length > 0) {
                console.log(
                  `[FILLER-DEBUG] Index ${index}: SUCCESS - Adding agent-assigned lead ${result.leads[0]._id} (assignedAgent: ${result.leads[0].assignedAgent}) to fillerLeadsArray[${index}]`
                );
                fillerLeadsArray[index] = result.leads[0];
                pulledFillerLeadIds.push(result.leads[0]._id); // Track this lead to exclude it from future pulls
              } else {
                // This shouldn't happen since it was successful before
                console.warn(
                  `[FILLER-DEBUG] Index ${index}: WARNING - Agent ${agentId} had assigned leads before but none found now!`
                );
                agentAssignmentInsufficient.push({
                  leadType: "filler",
                  index: index,
                  agentId: agentId,
                });
              }
            }
          }
        } else {
          // Original behavior: process all indices for this agent at once
          // Allow unassigned fallback only if gender is specified (meaning user selected it from modal)
          const allowUnassignedFallback = !!gender;
          // NOTE: Using "ftd" as leadType since fillers are pulled from FTD leads
          const result = await getLeadsForAgent(
            "ftd",
            indices.length,
            agentId,
            allowUnassignedFallback,
            null,
            pulledFillerLeadIds
          );
          console.log(
            `[FILLER-DEBUG] Got ${result.leads.length}/${indices.length} FTD leads for agent ${agentId} (excluding ${pulledFillerLeadIds.length} already-pulled)`
          );

          // Assign pulled leads to their slots
          for (let i = 0; i < result.leads.length; i++) {
            fillerLeadsArray[indices[i]] = result.leads[i];
            pulledFillerLeadIds.push(result.leads[i]._id); // Track to prevent duplicates
          }

          // Track insufficient assignments if agent-assigned leads were not enough
          if (
            result.agentLeadsInsufficient ||
            result.leads.length < indices.length
          ) {
            for (let i = result.leads.length; i < indices.length; i++) {
              agentAssignmentInsufficient.push({
                leadType: "filler",
                index: indices[i],
                agentId: agentId,
              });
            }
          }
        }
      }

      // Pull unassigned leads for remaining slots
      if (unassignedIndices.length > 0) {
        // NOTE: Using "ftd" as leadType since fillers are pulled from FTD leads
        const unassignedResult = await getLeadsForAgent(
          "ftd",
          unassignedIndices.length,
          null,
          false,
          null,
          pulledFillerLeadIds
        );
        console.log(
          `[FILLER-DEBUG] Got ${unassignedResult.leads.length}/${unassignedIndices.length} unassigned FTD leads (excluding ${pulledFillerLeadIds.length} already-pulled)`
        );

        for (let i = 0; i < unassignedResult.leads.length; i++) {
          fillerLeadsArray[unassignedIndices[i]] = unassignedResult.leads[i];
          pulledFillerLeadIds.push(unassignedResult.leads[i]._id); // Track to prevent duplicates
        }
      }

      // Collect successfully pulled leads
      console.log(`[FILLER-DEBUG] ===== FINAL FILLER ARRAY SUMMARY =====`);
      console.log(
        `[FILLER-DEBUG] fillerLeadsArray length: ${fillerLeadsArray.length}`
      );
      fillerLeadsArray.forEach((lead, index) => {
        if (lead) {
          console.log(
            `[FILLER-DEBUG] fillerLeadsArray[${index}]: Lead ${
              lead._id
            }, assignedAgent: ${lead.assignedAgent || "UNASSIGNED"}, gender: ${
              lead.gender
            }`
          );
        } else {
          console.log(
            `[FILLER-DEBUG] fillerLeadsArray[${index}]: NULL (no lead)`
          );
        }
      });

      const fillerLeads = fillerLeadsArray.filter((lead) => lead !== null);
      console.log(
        `[FILLER-DEBUG] After filtering nulls: ${fillerLeads.length} filler leads to process`
      );

      if (fillerLeads.length > 0) {
        // No phone validation for fillers - just use FTD leads as-is
        pulledLeads.push(...fillerLeads);
        fulfilled.filler = fillerLeads.length;
        fillerLeads.forEach((lead) => {
          leadsMetadata.push({ leadId: lead._id, orderedAs: "filler" });
        });
        console.log(
          `[FILLER-DEBUG] Final result: ${fillerLeads.length} filler leads added to order`
        );
      }
    } else if (filler > 0) {
      console.log(
        `[FILLER-DEBUG] ===== FETCHING FILLER LEADS (FROM FTDs) =====`
      );
      console.log(`[FILLER-DEBUG] Requested filler leads: ${filler}`);
      console.log(
        `[FILLER-DEBUG] NOTE: Filler leads are now pulled from FTD leadType with orderedAs='filler'`
      );

      // Build base query for FTD leads (fillers now come from FTDs)
      let fillerQuery = {
        leadType: "ftd",
        isArchived: { $ne: true }, // Never return archived leads
        status: { $ne: "inactive" }, // Never return inactive leads
        ...countryFilter,
        ...genderFilter,
      };

      // First, get the total count of available leads matching base criteria
      const totalAvailableCount = await Lead.countDocuments(fillerQuery);
      console.log(
        `[FILLER-DEBUG] Total FTD leads matching base criteria: ${totalAvailableCount}`
      );

      // Determine fetch strategy based on available leads and requested count
      let fetchLimit;
      if (totalAvailableCount <= 10000) {
        // If dataset is reasonable size, fetch all to ensure proper filtering
        fetchLimit = totalAvailableCount;
        console.log(
          `[FILLER-DEBUG] Fetching all ${fetchLimit} available leads for comprehensive filtering`
        );
      } else {
        // For very large datasets, use a high multiplier to ensure enough leads for filtering
        const multiplier = Math.max(
          50,
          Math.min(100, Math.ceil(totalAvailableCount / filler))
        );
        fetchLimit = Math.min(totalAvailableCount, filler * multiplier);
        console.log(
          `[FILLER-DEBUG] Large dataset detected. Using multiplier ${multiplier}, fetching ${fetchLimit} leads`
        );
      }

      let fillerLeads = await Lead.aggregate([
        {
          $match: fillerQuery,
        },
        {
          $sample: { size: fetchLimit },
        },
      ]);
      console.log(
        `[FILLER-DEBUG] Found ${fillerLeads.length} FTD leads for filtering (from ${totalAvailableCount} available)`
      );
      if (fillerLeads.length > 0) {
        const fillerLeadIds = fillerLeads.map((lead) => lead._id);
        const fillerLeadDocs = await Lead.find({ _id: { $in: fillerLeadIds } });
        let filteredFillerLeads = fillerLeadDocs;

        // Filter out FTDs/Fillers in cooldown period (10 days since last use)
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const beforeCooldownFilter = filteredFillerLeads.length;
        filteredFillerLeads = filteredFillerLeads.filter(
          (lead) => !lead.lastUsedInOrder || lead.lastUsedInOrder <= tenDaysAgo
        );
        console.log(
          `[FILLER-DEBUG] Cooldown filtering: ${
            beforeCooldownFilter - filteredFillerLeads.length
          } leads filtered out (in 10-day cooldown), ${
            filteredFillerLeads.length
          } leads remain`
        );

        // Exclude FTD leads already selected for this order (both regular FTDs and fillers)
        // Filter by both ID and phone number to prevent duplicate leads
        if (fulfilled.ftd > 0 || pulledLeads.length > 0) {
          const alreadyPulledIds = pulledLeads.map((lead) =>
            lead._id.toString()
          );
          const alreadyPulledPhones = pulledLeads.map((lead) => lead.newPhone);
          console.log(
            `[FILLER-DEBUG] Filtering out ${alreadyPulledIds.length} leads already in this order (by ID and phone number)`
          );
          filteredFillerLeads = filteredFillerLeads.filter(
            (lead) =>
              !alreadyPulledIds.includes(lead._id.toString()) &&
              !alreadyPulledPhones.includes(lead.newPhone)
          );
          console.log(
            `[FILLER-DEBUG] After exclusion filtering: ${filteredFillerLeads.length} leads remain`
          );
        }

        if (selectedClientNetwork) {
          console.log(
            `[FILLER-DEBUG] Filtering out leads already assigned to client network: ${selectedClientNetwork}`
          );
          filteredFillerLeads = filteredFillerLeads.filter(
            (lead) => !lead.isAssignedToClientNetwork(selectedClientNetwork)
          );
          console.log(
            `[FILLER-DEBUG] After client network filtering: ${filteredFillerLeads.length} leads remain`
          );
        }
        // Our network filtering removed - leads can be reused for same our network
        // Campaign filtering removed - leads can be reused for same campaign from different networks
        console.log(
          `[FILLER-DEBUG] Campaign filtering skipped - leads can be reused for same campaign from different networks`
        );
        if (selectedClientBrokers && selectedClientBrokers.length > 0) {
          console.log(
            `[FILLER-DEBUG] Filtering out leads already assigned to client brokers: ${selectedClientBrokers.join(
              ", "
            )}`
          );
          filteredFillerLeads = filteredFillerLeads.filter(
            (lead) =>
              !selectedClientBrokers.some((brokerId) =>
                lead.isAssignedToClientBroker(brokerId)
              )
          );
          console.log(
            `[FILLER-DEBUG] After client brokers filtering: ${filteredFillerLeads.length} leads remain`
          );
        }
        fillerLeads = filteredFillerLeads;
      }
      if (fillerLeads.length > 0) {
        // No phone validation for fillers - just use FTD leads as-is
        // Take only the requested number of leads
        const selectedFillerLeads = fillerLeads.slice(0, filler);

        pulledLeads.push(...selectedFillerLeads);
        fulfilled.filler = selectedFillerLeads.length;
        // Track metadata - these FTD leads should display as "filler" in this order
        selectedFillerLeads.forEach((lead) => {
          leadsMetadata.push({ leadId: lead._id, orderedAs: "filler" });
        });
        console.log(
          `[FILLER-DEBUG] Final result: ${selectedFillerLeads.length} FTD leads tracked as fillers added to order`
        );
      } else {
        console.log(
          `[FILLER-DEBUG] No FTD leads found matching criteria for filler use`
        );
      }
    }
    if (cold > 0) {
      // Build base query for cold leads
      let coldQuery = {
        leadType: "cold",
        isArchived: { $ne: true }, // Never return archived leads
        status: { $ne: "inactive" }, // Never return inactive leads
        ...countryFilter,
        ...genderFilter,
      };

      // First, get the total count of available leads matching base criteria
      const totalAvailableCount = await Lead.countDocuments(coldQuery);

      // Determine fetch strategy based on available leads and requested count
      let fetchLimit;
      if (totalAvailableCount <= 10000) {
        // If dataset is reasonable size, fetch all to ensure proper filtering
        fetchLimit = totalAvailableCount;
      } else {
        // For very large datasets, use a high multiplier to ensure enough leads for filtering
        const multiplier = Math.max(
          50,
          Math.min(100, Math.ceil(totalAvailableCount / cold))
        );
        fetchLimit = Math.min(totalAvailableCount, cold * multiplier);
      }

      // PERFORMANCE OPTIMIZATION: Build comprehensive query with all filters upfront
      // Exclude phone numbers already used in this order
      if (pulledLeads.length > 0) {
        const alreadyPulledPhoneNumbers = pulledLeads.map(
          (lead) => lead.newPhone
        );
        coldQuery.newPhone = { $nin: alreadyPulledPhoneNumbers };
      }

      // Add client network filter to query (database level, not in-memory)
      if (selectedClientNetwork) {
        // Exclude leads that are already assigned to this client network
        // Use $not + $elemMatch to check if NO history entry has this clientNetwork
        // IMPORTANT: Convert string ID to ObjectId for aggregate() - unlike find(), aggregate doesn't auto-cast
        const networkObjectId = new mongoose.Types.ObjectId(
          selectedClientNetwork
        );
        coldQuery.$or = [
          { clientNetworkHistory: { $exists: false } },
          { clientNetworkHistory: { $size: 0 } },
          {
            clientNetworkHistory: {
              $not: {
                $elemMatch: {
                  clientNetwork: networkObjectId,
                },
              },
            },
          },
        ];
      }

      // Add client broker filter to query (database level, not in-memory)
      if (selectedClientBrokers && selectedClientBrokers.length > 0) {
        // Exclude leads that have ANY of the selected brokers in assignedClientBrokers array
        // IMPORTANT: Convert string IDs to ObjectIds for aggregate() - unlike find(), aggregate doesn't auto-cast
        const brokerObjectIds = selectedClientBrokers.map(
          (id) => new mongoose.Types.ObjectId(id)
        );
        coldQuery.assignedClientBrokers = { $nin: brokerObjectIds };
      }

      // Use aggregate with $sample for random selection, but now with ALL filters applied
      // Sample more than needed to account for phone pattern filtering
      let coldLeads = await Lead.aggregate([
        {
          $match: coldQuery,
        },
        {
          $sample: { size: Math.min(fetchLimit, cold * 2) }, // Sample 2x to provide buffer for phone filtering
        },
        // Don't limit here - let applyColdPhoneRepetitionRules handle the final selection
      ]);

      // Convert to mongoose documents if needed (only fetch what we need)
      if (coldLeads.length > 0) {
        const coldLeadIds = coldLeads.map((lead) => lead._id);
        coldLeads = await Lead.find({ _id: { $in: coldLeadIds } });
      }

      if (coldLeads.length > 0) {
        const appliedColdLeads = applyColdPhoneRepetitionRules(coldLeads, cold);
        pulledLeads.push(...appliedColdLeads);
        fulfilled.cold = appliedColdLeads.length;
        // Track metadata for each cold lead
        appliedColdLeads.forEach((lead) => {
          leadsMetadata.push({ leadId: lead._id, orderedAs: "cold" });
        });
      }
    }
    const totalRequested = ftd + filler + cold;
    const totalFulfilled = fulfilled.ftd + fulfilled.filler + fulfilled.cold;

    let orderStatus;
    let cancellationReason = null;
    let partialFulfillmentReason = null;

    if (totalFulfilled === 0) {
      orderStatus = "cancelled";
      // Generate detailed cancellation reason
      const reasons = [];
      if (ftd > 0)
        reasons.push(
          await generateDetailedReasonForLeadType("ftd", ftd, 0, {
            country,
            gender,
            selectedClientNetwork,
            selectedOurNetwork,
            selectedCampaign,
            selectedClientBrokers,
          })
        );
      if (filler > 0)
        reasons.push(
          await generateDetailedReasonForLeadType("filler", filler, 0, {
            country,
            gender,
            selectedClientNetwork,
            selectedOurNetwork,
            selectedCampaign,
            selectedClientBrokers,
          })
        );
      if (cold > 0)
        reasons.push(
          await generateDetailedReasonForLeadType("cold", cold, 0, {
            country,
            gender,
            selectedClientNetwork,
            selectedOurNetwork,
            selectedCampaign,
            selectedClientBrokers,
          })
        );
      cancellationReason = reasons.join(" | ");
    } else if (
      totalFulfilled === totalRequested &&
      fulfilled.ftd === ftd &&
      fulfilled.filler === filler &&
      fulfilled.cold === cold
    ) {
      orderStatus = "fulfilled";
    } else {
      orderStatus = "partial";
      // Generate detailed partial fulfillment reason
      const reasons = [];
      if (fulfilled.ftd < ftd) {
        reasons.push(
          await generateDetailedReasonForLeadType("ftd", ftd, fulfilled.ftd, {
            country,
            gender,
            selectedClientNetwork,
            selectedOurNetwork,
            selectedCampaign,
            selectedClientBrokers,
          })
        );
      }
      if (fulfilled.filler < filler) {
        reasons.push(
          await generateDetailedReasonForLeadType(
            "filler",
            filler,
            fulfilled.filler,
            {
              country,
              gender,
              selectedClientNetwork,
              selectedOurNetwork,
              selectedCampaign,
              selectedClientBrokers,
            }
          )
        );
      }
      if (fulfilled.cold < cold) {
        reasons.push(
          await generateDetailedReasonForLeadType(
            "cold",
            cold,
            fulfilled.cold,
            {
              country,
              gender,
              selectedClientNetwork,
              selectedOurNetwork,
              selectedCampaign,
              selectedClientBrokers,
            }
          )
        );
      }
      partialFulfillmentReason = reasons.join(" | ");
    }

    let ftdHandling = {
      status: fulfilled.ftd > 0 ? "manual_fill_required" : "completed",
    };

    // Check if there are insufficient agent assignments without gender selection
    // If so, return error to prompt user to select genders BEFORE creating the order
    if (
      agentAssignmentInsufficient.length > 0 &&
      !gender &&
      !perAssignmentGenders
    ) {
      console.log(
        `[ORDER-DEBUG] Insufficient agent assignments detected without gender selection. Requesting gender before order creation.`
      );
      return res.status(400).json({
        success: false,
        message:
          "Agent has insufficient assigned leads - please select a gender to allow fallback to unassigned leads",
        requiresGenderSelection: true,
        agentAssignmentInsufficient: agentAssignmentInsufficient,
      });
    }

    const order = new Order({
      requester: req.user._id,
      requests: { ftd, filler, cold },
      fulfilled,
      leads: pulledLeads.map((l) => l._id),
      leadsMetadata: leadsMetadata, // Store how each lead was ordered in this order
      priority: priority || "medium",
      notes,
      status: orderStatus,
      countryFilter: country || null,
      cancellationReason,
      partialFulfillmentReason,
      genderFilter: gender || null,
      plannedDate: new Date(plannedDate),
      selectedClientNetwork: selectedClientNetwork || null,
      selectedOurNetwork: selectedOurNetwork || null,
      selectedCampaign: selectedCampaign || null,
      selectedClientBrokers: selectedClientBrokers || [],
      agentFilter: agentFilter || null,
      agentAssignments: agentAssignments || [],
      ftdHandling,
      ...(orderStatus === "cancelled" && {
        cancelledAt: new Date(),
        cancellationReason:
          "No leads available matching the requested criteria",
      }),
    });
    await order.save();
    const leadIds = [];

    // Prepare bulk write operations for all leads (PERFORMANCE OPTIMIZATION)
    // This reduces 15+ sequential database saves to 1 bulk operation
    const bulkOps = [];

    for (const lead of pulledLeads) {
      // Determine lead type from leadsMetadata
      const leadMetadata = leadsMetadata.find(
        (m) => m.leadId.toString() === lead._id.toString()
      );
      const leadType = leadMetadata ? leadMetadata.orderedAs : lead.leadType;

      // Cold leads should never be assigned to agents
      // FTD and Filler leads remain unassigned until manually assigned to an agent
      // (assignedAgent will be null by default)

      lead.orderId = order._id;
      lead.createdBy = req.user._id;

      // Build update object for this lead
      const updateObj = {
        orderId: order._id,
        createdBy: req.user._id,
      };

      // Update lastUsedInOrder timestamp for FTD and Filler leads (10-day cooldown)
      if (leadType === "ftd" || leadType === "filler") {
        updateObj.lastUsedInOrder = new Date();
        lead.lastUsedInOrder = new Date();
      }

      // Build $push operations for history arrays (atomic, prevents race condition data loss)
      const pushObj = {};

      if (selectedClientNetwork) {
        pushObj.clientNetworkHistory = {
          clientNetwork: selectedClientNetwork,
          assignedBy: req.user._id,
          orderId: order._id,
          assignedAt: new Date(),
        };
      }
      if (selectedOurNetwork) {
        pushObj.ourNetworkHistory = {
          ourNetwork: selectedOurNetwork,
          assignedBy: req.user._id,
          orderId: order._id,
          assignedAt: new Date(),
        };
      }
      if (selectedCampaign) {
        pushObj.campaignHistory = {
          campaign: selectedCampaign,
          assignedBy: req.user._id,
          orderId: order._id,
          assignedAt: new Date(),
        };
      }

      // Build bulk operation: $set for scalar fields, $push for history arrays
      const bulkUpdate = { $set: updateObj };
      if (Object.keys(pushObj).length > 0) {
        bulkUpdate.$push = pushObj;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: lead._id },
          update: bulkUpdate,
        },
      });

      leadIds.push(lead._id);
    }

    // Execute all lead updates in a single bulk operation
    if (bulkOps.length > 0) {
      console.log(
        `[ORDER-PERF] Executing bulk update for ${bulkOps.length} leads`
      );
      const bulkStart = Date.now();
      await Lead.bulkWrite(bulkOps);
      console.log(
        `[ORDER-PERF] Bulk update completed in ${Date.now() - bulkStart}ms`
      );
    }

    order.leads = leadIds;
    order.leadsMetadata = leadsMetadata; // Make sure metadata is on the document
    await order.save();

    // Populate the order with lead details
    const populatedOrder = await Order.findById(order._id)
      .populate("requester", "fullName email role")
      .populate({
        path: "leads",
        select:
          "leadType firstName lastName country newEmail newPhone orderId assignedAgent assignedAgentAt",
        populate: {
          path: "assignedAgent",
          select: "fullName email fourDigitCode",
        },
      });

    // Merge leadsMetadata with leads for response
    const orderWithMetadata = mergeLeadsWithMetadata(populatedOrder);

    res.status(201).json({
      success: true,
      message: (() => {
        let msg = `Order created with ${pulledLeads.length} leads`;
        if (orderStatus === "fulfilled") {
          msg += " - fully fulfilled";
        } else if (orderStatus === "partial") {
          msg += ` - partially fulfilled (${totalFulfilled}/${totalRequested} leads)`;
        } else {
          msg += " - cancelled (no leads available)";
        }
        if (country) msg += ` from ${country}`;
        if (gender) msg += ` with gender: ${gender}`;
        return msg;
      })(),
      data: orderWithMetadata,
      agentLeadsInsufficient:
        agentLeadsInsufficient.ftd || agentLeadsInsufficient.filler
          ? agentLeadsInsufficient
          : null,
      agentAssignmentInsufficient:
        agentAssignmentInsufficient.length > 0
          ? agentAssignmentInsufficient
          : null,
    });
  } catch (error) {
    next(error);
  }
};
exports.getOrders = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { page = 1, limit = 10, startDate, endDate, search, emailSearch, createdMonth, createdYear } = req.query;
    let query = {};
    // Admin and lead_manager can see all orders; others see only their own
    if (req.user.role !== "admin" && req.user.role !== "lead_manager") {
      query.requester = req.user._id;
    }
    if (startDate || endDate) {
      query.plannedDate = {};
      if (startDate) query.plannedDate.$gte = new Date(startDate);
      if (endDate)
        query.plannedDate.$lte = new Date(endDate + "T23:59:59.999Z");
    }
    if (createdMonth || createdYear) {
      const year = createdYear ? parseInt(createdYear) : new Date().getFullYear();
      if (createdMonth) {
        const month = parseInt(createdMonth) - 1;
        const from = new Date(year, month, 1);
        const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
        query.createdAt = { $gte: from, $lte: to };
      } else {
        const from = new Date(year, 0, 1);
        const to = new Date(year, 11, 31, 23, 59, 59, 999);
        query.createdAt = { $gte: from, $lte: to };
      }
    }

    // Handle search - we'll need to do a more complex query if search is present
    let orders;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fast email-only search: only matches leads by newEmail/oldEmail
    if (emailSearch && emailSearch.trim()) {
      const emailKeywords = emailSearch
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter((k) => k.length > 0);

      const emailConditions = await Promise.all(
        emailKeywords.map(async (keyword) => {
          const matchingLeadIds = await leadSearchCache.searchLeadsByEmail(keyword);
          return matchingLeadIds.length > 0
            ? { leads: { $in: matchingLeadIds } }
            : { _id: null };
        })
      );

      if (emailConditions.length > 0) {
        query.$and = [...(query.$and || []), ...emailConditions];
      }
    }

    if (search && search.trim()) {
      const searchKeywords = search
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter((k) => k.length > 0);

      // For each keyword, search cached reference collections in-memory,
      // then query only Lead from DB. All keywords are combined with $and.
      const keywordConditions = await Promise.all(
        searchKeywords.map(async (keyword) => {
          const regex = new RegExp(keyword, "i");

          // Phase 1: Search cached collections in-memory (no DB queries)
          const [
            matchingUserIds,
            matchingCampaignIds,
            matchingOurNetworkIds,
            matchingClientNetworkIds,
            matchingClientBrokerIds,
          ] = await Promise.all([
            referenceCache.searchCollection("User", keyword),
            referenceCache.searchCollection("Campaign", keyword),
            referenceCache.searchCollection("OurNetwork", keyword),
            referenceCache.searchCollection("ClientNetwork", keyword),
            referenceCache.searchCollection("ClientBroker", keyword),
          ]);

          // Phase 2: Query leads with caching (expensive regex query is cached for 30s)
          const matchingLeadIds = await leadSearchCache.searchLeads(keyword, matchingUserIds);

          // Build $or conditions for this keyword on Order fields
          const orConditions = [
            { status: regex },
            { priority: regex },
            { countryFilter: regex },
            { notes: regex },
          ];

          // Search by partial Order ID (hex string match)
          if (/^[a-f0-9]+$/i.test(keyword)) {
            const matchingOrders = await Order.find(
              { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: keyword, options: "i" } } },
              { _id: 1 }
            ).lean();
            if (matchingOrders.length > 0) {
              orConditions.push({ _id: { $in: matchingOrders.map(o => o._id) } });
            }
          }

          if (matchingUserIds.length > 0) {
            orConditions.push({
              requester: { $in: matchingUserIds },
            });
          }
          if (matchingCampaignIds.length > 0) {
            orConditions.push({
              selectedCampaign: { $in: matchingCampaignIds },
            });
          }
          if (matchingOurNetworkIds.length > 0) {
            orConditions.push({
              selectedOurNetwork: { $in: matchingOurNetworkIds },
            });
          }
          if (matchingClientNetworkIds.length > 0) {
            orConditions.push({
              selectedClientNetwork: { $in: matchingClientNetworkIds },
            });
          }
          if (matchingClientBrokerIds.length > 0) {
            orConditions.push({
              selectedClientBrokers: { $in: matchingClientBrokerIds },
            });
          }
          if (matchingLeadIds.length > 0) {
            orConditions.push({
              leads: { $in: matchingLeadIds },
            });
          }

          return { $or: orConditions };
        })
      );

      // Combine base query with all keyword conditions (AND logic)
      if (keywordConditions.length > 0) {
        query.$and = [...(query.$and || []), ...keywordConditions];
      }

      const [orders, total] = await Promise.all([
        Order.find(query)
          .populate("requester", "fullName email role")
          .populate("requesterHistory.previousRequester", "fullName email")
          .populate("requesterHistory.newRequester", "fullName email")
          .populate("requesterHistory.changedBy", "fullName email")
          .populate("selectedCampaign", "name description")
          .populate("selectedOurNetwork", "name description")
          .populate("selectedClientNetwork", "name description")
          .populate("selectedClientBrokers", "name domain description")
          .populate({
            path: "leads",
            select:
              "leadType firstName lastName country newEmail oldEmail newPhone oldPhone assignedAgent assignedClientBrokers depositConfirmed shaved",
            populate: [
              {
                path: "assignedAgent",
                select: "fullName email fourDigitCode",
              },
              {
                path: "assignedClientBrokers",
                select: "name domain",
              },
            ],
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Order.countDocuments(query),
      ]);

      // Merge leadsMetadata with each order's leads
      const ordersWithMetadata = orders.map((order) =>
        mergeLeadsWithMetadata(order)
      );

      return res.status(200).json({
        success: true,
        data: ordersWithMetadata,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    // No search - run data query and count in parallel
    const [foundOrders, total] = await Promise.all([
      Order.find(query)
        .populate("requester", "fullName email role")
        .populate("requesterHistory.previousRequester", "fullName email")
        .populate("requesterHistory.newRequester", "fullName email")
        .populate("requesterHistory.changedBy", "fullName email")
        .populate("selectedCampaign", "name description")
        .populate("selectedOurNetwork", "name description")
        .populate("selectedClientNetwork", "name description")
        .populate("selectedClientBrokers", "name domain description")
        .populate({
          path: "leads",
          select:
            "leadType firstName lastName country newEmail oldEmail newPhone oldPhone orderId assignedClientBrokers clientBrokerHistory assignedAgent assignedAgentAt depositConfirmed depositConfirmedBy depositConfirmedAt shaved shavedBy shavedAt shavedRefundsManager shavedManagerAssignedBy shavedManagerAssignedAt",
          populate: [
            {
              path: "assignedAgent",
              select: "fullName email fourDigitCode",
            },
            {
              path: "comments.author",
              select: "fullName",
            },
            {
              path: "assignedClientBrokers",
              select: "name domain description",
            },
            {
              path: "clientBrokerHistory.clientBroker",
              select: "name domain description",
            },
            {
              path: "depositConfirmedBy",
              select: "fullName email",
            },
            {
              path: "depositPSP",
              select: "name website",
            },
            {
              path: "shavedBy",
              select: "fullName email",
            },
            {
              path: "shavedRefundsManager",
              select: "fullName email",
            },
            {
              path: "shavedManagerAssignedBy",
              select: "fullName email",
            },
          ],
        })
        .populate("removedLeads.removedBy", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(query),
    ]);

    // Merge leadsMetadata with each order's leads
    const ordersWithMetadata = foundOrders.map((order) =>
      mergeLeadsWithMetadata(order)
    );

    res.status(200).json({
      success: true,
      data: ordersWithMetadata,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.getOrderById = async (req, res, next) => {
  try {
    // Check if lightweight mode is requested (for fast expansion)
    const lightweight = req.query.lightweight === "true";

    let query = Order.findById(req.params.id)
      .populate("requester", "fullName email role")
      .populate("requesterHistory.previousRequester", "fullName email")
      .populate("requesterHistory.newRequester", "fullName email")
      .populate("requesterHistory.changedBy", "fullName email")
      .populate("selectedCampaign", "name description")
      .populate("selectedOurNetwork", "name description")
      .populate("selectedClientNetwork", "name description")
      .populate("selectedClientBrokers", "name domain description")
      .populate("auditLog.performedBy", "fullName email")
      .populate("removedLeads.removedBy", "fullName email");

    // Only populate full lead details if not in lightweight mode
    const panel = req.query.panel === "true";
    if (!lightweight && panel) {
      // Panel mode: optimized for split view - only fields needed for display
      query = query.populate({
        path: "leads",
        select:
          "_id firstName lastName leadType orderedAs newEmail newPhone country gender dob address depositConfirmed shaved documents clientBroker clientNetwork ourNetwork campaign assignedAgent assignedClientBrokers depositPSP depositConfirmedBy shavedRefundsManager ipqsValidation",
        populate: [
          { path: "assignedAgent", select: "fullName" },
          { path: "assignedClientBrokers", select: "name" },
          { path: "depositConfirmedBy", select: "fullName" },
          { path: "depositPSP", select: "name" },
          { path: "shavedRefundsManager", select: "fullName" },
        ],
      });
    } else if (!lightweight) {
      query = query.populate({
        path: "leads",
        select: "-comments",
        populate: [
          {
            path: "assignedAgent",
            select: "fullName email fourDigitCode",
          },
          {
            path: "assignedClientBrokers",
            select: "name domain description",
          },
          {
            path: "clientBrokerHistory.clientBroker",
            select: "name domain description",
          },
          {
            path: "clientNetworkHistory.clientNetwork",
            select: "name description",
          },
          {
            path: "ourNetworkHistory.ourNetwork",
            select: "name description",
          },
          {
            path: "campaignHistory.campaign",
            select: "name description",
          },
          {
            path: "depositConfirmedBy",
            select: "fullName email",
          },
          {
            path: "depositPSP",
            select: "name website",
          },
          {
            path: "shavedBy",
            select: "fullName email",
          },
          {
            path: "shavedRefundsManager",
            select: "fullName email",
          },
          {
            path: "shavedManagerAssignedBy",
            select: "fullName email",
          },
          {
            path: "adminActions.performedBy",
            select: "fullName email",
          },
        ],
      });
    } else {
      // In lightweight mode, only get lead IDs and count
      query = query.populate({
        path: "leads",
        select: "_id",
      });
    }

    let order = await query;

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Only merge metadata if we have full lead data
    if (!lightweight) {
      order = mergeLeadsWithMetadata(order);
    }

    // Admin and lead_manager can view any order; others can only view their own
    if (
      req.user.role !== "admin" &&
      req.user.role !== "lead_manager" &&
      order.requester._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    // In lightweight mode, add lead count for convenience
    const responseData = lightweight
      ? {
          ...order.toObject(),
          leadsCount: order.leads?.length || 0,
        }
      : order;

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};
exports.updateOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id)
        .populate("selectedCampaign", "name")
        .populate("selectedOurNetwork", "name")
        .populate("selectedClientNetwork", "name")
        .session(session);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
      if (
        req.user.role !== "admin" &&
        order.requester.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this order",
        });
      }
      const {
        priority,
        notes,
        selectedClientBrokers,
        plannedDate,
        selectedCampaign,
        selectedOurNetwork,
        selectedClientNetwork,
      } = req.body;
      if (priority) order.priority = priority;
      if (notes !== undefined) order.notes = notes;
      if (plannedDate !== undefined) {
        const newPlannedDate = new Date(plannedDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        newPlannedDate.setHours(0, 0, 0, 0);
        if (newPlannedDate < today) {
          return res.status(400).json({
            success: false,
            message: "Planned date cannot be in the past",
          });
        }
        order.plannedDate = plannedDate;
      }

      // Handle client brokers update
      if (selectedClientBrokers !== undefined) {
        if (selectedClientBrokers && selectedClientBrokers.length > 0) {
          // Validate each client broker exists and is active
          for (const brokerId of selectedClientBrokers) {
            const clientBroker = await ClientBroker.findOne({
              _id: brokerId,
              isActive: true,
            }).session(session);
            if (!clientBroker) {
              return res.status(400).json({
                success: false,
                message: `Client broker ${brokerId} not found or inactive`,
              });
            }
          }
          order.selectedClientBrokers = selectedClientBrokers;
        } else {
          // Allow clearing the client brokers (set to empty array)
          order.selectedClientBrokers = [];
        }
      }

      // Handle campaign update (admin only)
      if (selectedCampaign !== undefined && req.user.role === "admin") {
        const oldCampaignId = order.selectedCampaign?._id?.toString();
        const newCampaignId = selectedCampaign;

        if (oldCampaignId !== newCampaignId) {
          // Validate the new campaign exists and is active
          const newCampaign = await Campaign.findOne({
            _id: newCampaignId,
            isActive: true,
          }).session(session);
          if (!newCampaign) {
            return res.status(400).json({
              success: false,
              message: "Campaign not found or inactive",
            });
          }

          // First, remove existing campaignHistory entries for this order
          await Lead.updateMany(
            { _id: { $in: order.leads } },
            {
              $pull: {
                campaignHistory: { orderId: order._id },
              },
            },
            { session }
          );

          // Then, add new campaignHistory entry for all leads
          await Lead.updateMany(
            { _id: { $in: order.leads } },
            {
              $push: {
                campaignHistory: {
                  campaign: newCampaignId,
                  assignedBy: req.user._id,
                  orderId: order._id,
                  assignedAt: new Date(),
                },
              },
            },
            { session }
          );

          // Add audit log entry
          order.auditLog.push({
            action: "campaign_changed",
            performedBy: req.user._id,
            performedAt: new Date(),
            ipAddress:
              req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            details: `Campaign changed from "${order.selectedCampaign?.name || "N/A"}" to "${newCampaign.name}"`,
            previousValue: oldCampaignId,
            newValue: newCampaignId,
          });

          order.selectedCampaign = newCampaignId;

          console.log(
            `[UPDATE-ORDER] Campaign changed from ${oldCampaignId} to ${newCampaignId} for order ${order._id}. Updated ${order.leads.length} leads.`
          );
        }
      }

      // Handle our network update (admin only)
      if (selectedOurNetwork !== undefined && req.user.role === "admin") {
        const OurNetwork = require("../models/OurNetwork");
        const oldOurNetworkId = order.selectedOurNetwork?._id?.toString();
        const newOurNetworkId = selectedOurNetwork || null;

        if (oldOurNetworkId !== newOurNetworkId) {
          let newOurNetworkName = "N/A";

          // First, remove existing ourNetworkHistory entries for this order
          await Lead.updateMany(
            { _id: { $in: order.leads } },
            {
              $pull: {
                ourNetworkHistory: { orderId: order._id },
              },
            },
            { session }
          );

          if (newOurNetworkId) {
            // Validate the new our network exists and is active
            const newOurNetwork = await OurNetwork.findOne({
              _id: newOurNetworkId,
              isActive: true,
            }).session(session);
            if (!newOurNetwork) {
              return res.status(400).json({
                success: false,
                message: "Our Network not found or inactive",
              });
            }
            newOurNetworkName = newOurNetwork.name;

            // Add new ourNetworkHistory entry for all leads
            await Lead.updateMany(
              { _id: { $in: order.leads } },
              {
                $push: {
                  ourNetworkHistory: {
                    ourNetwork: newOurNetworkId,
                    assignedBy: req.user._id,
                    orderId: order._id,
                    assignedAt: new Date(),
                  },
                },
              },
              { session }
            );
          }

          // Add audit log entry
          order.auditLog.push({
            action: "our_network_changed",
            performedBy: req.user._id,
            performedAt: new Date(),
            ipAddress:
              req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            details: `Our Network changed from "${order.selectedOurNetwork?.name || "N/A"}" to "${newOurNetworkName}"`,
            previousValue: oldOurNetworkId,
            newValue: newOurNetworkId,
          });

          order.selectedOurNetwork = newOurNetworkId;

          console.log(
            `[UPDATE-ORDER] Our Network changed from ${oldOurNetworkId} to ${newOurNetworkId} for order ${order._id}. Updated ${order.leads.length} leads.`
          );
        }
      }

      // Handle client network update (admin only)
      if (selectedClientNetwork !== undefined && req.user.role === "admin") {
        const oldClientNetworkId = order.selectedClientNetwork?._id?.toString();
        const newClientNetworkId = selectedClientNetwork || null;

        if (oldClientNetworkId !== newClientNetworkId) {
          let newClientNetworkName = "N/A";

          // First, remove existing clientNetworkHistory entries for this order
          await Lead.updateMany(
            { _id: { $in: order.leads } },
            {
              $pull: {
                clientNetworkHistory: { orderId: order._id },
              },
            },
            { session }
          );

          if (newClientNetworkId) {
            // Validate the new client network exists and is active
            const newClientNetwork = await ClientNetwork.findOne({
              _id: newClientNetworkId,
              isActive: true,
            }).session(session);
            if (!newClientNetwork) {
              return res.status(400).json({
                success: false,
                message: "Client Network not found or inactive",
              });
            }
            newClientNetworkName = newClientNetwork.name;

            // Add new clientNetworkHistory entry for all leads
            await Lead.updateMany(
              { _id: { $in: order.leads } },
              {
                $push: {
                  clientNetworkHistory: {
                    clientNetwork: newClientNetworkId,
                    assignedBy: req.user._id,
                    orderId: order._id,
                    assignedAt: new Date(),
                  },
                },
              },
              { session }
            );
          }

          // Add audit log entry
          order.auditLog.push({
            action: "client_network_changed",
            performedBy: req.user._id,
            performedAt: new Date(),
            ipAddress:
              req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            details: `Client Network changed from "${order.selectedClientNetwork?.name || "N/A"}" to "${newClientNetworkName}"`,
            previousValue: oldClientNetworkId,
            newValue: newClientNetworkId,
          });

          order.selectedClientNetwork = newClientNetworkId;

          console.log(
            `[UPDATE-ORDER] Client Network changed from ${oldClientNetworkId} to ${newClientNetworkId} for order ${order._id}. Updated ${order.leads.length} leads.`
          );
        }
      }

      await order.save({ session });

      // Fetch updated order with populated fields
      const updatedOrder = await Order.findById(order._id)
        .populate("selectedCampaign", "name")
        .populate("selectedOurNetwork", "name")
        .populate("selectedClientNetwork", "name")
        .session(session);

      res.status(200).json({
        success: true,
        message: "Order updated successfully",
        data: updatedOrder,
      });
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};
exports.cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { reason } = req.body;
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
      if (
        req.user.role !== "admin" &&
        order.requester.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to cancel this order",
        });
      }
      if (order.status === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Order is already cancelled",
        });
      }

      // Remove network and campaign history entries for this order
      // Keep agent assignments and client broker assignments intact
      await Lead.updateMany(
        { _id: { $in: order.leads } },
        {
          $pull: {
            clientNetworkHistory: { orderId: order._id },
            ourNetworkHistory: { orderId: order._id },
            campaignHistory: { orderId: order._id },
          },
          $unset: {
            lastUsedInOrder: "", // Reset cooldown for all leads in cancelled order
          },
        },
        { session }
      );

      console.log(
        `[CANCEL-ORDER-DEBUG] Cleared cooldown for ${order.leads.length} leads in cancelled order`
      );

      // Cancel/reject all pending call change requests for this order
      const pendingCallChangeRequests = await CallChangeRequest.countDocuments({
        orderId: order._id,
        status: "pending",
      });

      if (pendingCallChangeRequests > 0) {
        await CallChangeRequest.updateMany(
          {
            orderId: order._id,
            status: "pending",
          },
          {
            $set: {
              status: "rejected",
              reviewedAt: new Date(),
              // Note: reviewedBy will be null to indicate system-automatic rejection due to order cancellation
            },
          },
          { session }
        );
        console.log(
          `[CANCEL-ORDER-DEBUG] Auto-rejected ${pendingCallChangeRequests} pending call change requests for cancelled order`
        );
      }

      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancellationReason = reason;
      // Skip validation when cancelling - we're just updating status, not creating a new order
      await order.save({ session, validateBeforeSave: false });
      res.status(200).json({
        success: true,
        message: "Order cancelled successfully",
        data: order,
      });
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};
exports.getOrderStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let matchStage = {};
    if (req.user.role !== "admin") {
      matchStage.requester = new mongoose.Types.ObjectId(req.user._id);
    }
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    const stats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRequested: {
            $sum: {
              $add: ["$requests.ftd", "$requests.filler", "$requests.cold"],
            },
          },
          totalFulfilled: {
            $sum: {
              $add: ["$fulfilled.ftd", "$fulfilled.filler", "$fulfilled.cold"],
            },
          },
        },
      },
    ]);
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
exports.exportOrderLeads = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }
    const order = await Order.findById(orderId).populate({
      path: "leads",
      populate: [
        {
          path: "assignedAgent",
          select: "fullName",
        },
        {
          path: "createdBy",
          select: "fullName",
        },
      ],
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (
      req.user.role !== "admin" &&
      order.requester.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }
    const leads = order.leads || [];
    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found for this order",
      });
    }
    const csvHeaders = [
      "Lead Type",
      "First Name",
      "Last Name",
      "Email",
      "Prefix",
      "Phone",
      "Country",
      "Gender",
      "Status",
      "DOB",
      "Address",
      "Old Email",
      "Old Phone",
      "Campaign",
      "Client Broker",
      "Client Network",
      "Our Network",
      "Facebook",
      "Twitter",
      "LinkedIn",
      "Instagram",
      "Telegram",
      "WhatsApp",
      "ID front",
      "ID back",
      "Selfie front",
      "Selfie back",
      "Assigned To",
      "Created By",
      "Created At",
      "Assigned At",
    ];
    const formatDateForExcel = (date) => {
      if (!date) return "";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };
    const getDocumentUrl = (documents, description) => {
      if (!documents || !Array.isArray(documents)) return "";
      const doc = documents.find(
        (d) =>
          d.description &&
          d.description.toLowerCase().includes(description.toLowerCase())
      );
      return doc ? doc.url || "" : "";
    };
    const csvRows = leads.map((lead) => [
      lead.leadType || "",
      lead.firstName || "",
      lead.lastName || "",
      lead.newEmail || "",
      lead.prefix || "",
      lead.newPhone || "",
      lead.country || "",
      lead.gender || "",
      lead.status || "",
      formatDateForExcel(lead.dob),
      lead.address || "",
      lead.oldEmail || "",
      lead.oldPhone || "",
      lead.campaign || "",
      lead.assignedClientBrokers && lead.assignedClientBrokers.length > 0
        ? lead.assignedClientBrokers.map((b) => `${b.name} (${b.domain || "N/A"})`).join(", ")
        : lead.clientBroker || "",
      lead.clientNetwork || "",
      lead.ourNetwork || "",
      lead.socialMedia?.facebook || "",
      lead.socialMedia?.twitter || "",
      lead.socialMedia?.linkedin || "",
      lead.socialMedia?.instagram || "",
      lead.socialMedia?.telegram || "",
      lead.socialMedia?.whatsapp || "",
      getDocumentUrl(lead.documents, "ID Front"),
      getDocumentUrl(lead.documents, "ID Back"),
      getDocumentUrl(lead.documents, "Selfie with ID Front"),
      getDocumentUrl(lead.documents, "Selfie with ID Back"),
      lead.assignedAgent?.fullName || "",
      lead.createdBy?.fullName || "",
      formatDateForExcel(lead.createdAt),
      formatDateForExcel(lead.assignedAgentAt),
    ]);
    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };
    const csvContent = [
      csvHeaders.map(escapeCsvValue).join(","),
      ...csvRows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");
    const filename = `order_${orderId}_leads_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export error:", error);
    next(error);
  }
};
exports.assignClientInfoToOrderLeads = async (req, res, next) => {
  return res.status(410).json({
    success: false,
    message:
      "This functionality has been disabled. Please use individual lead assignment instead.",
    details:
      "Use PUT /api/leads/:id/assign-client-network to assign client networks to individual leads.",
  });
};

exports.skipOrderFTDs = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (order.ftdHandling.status !== "manual_fill_required") {
      return res.status(400).json({
        success: false,
        message: "No FTDs requiring manual filling found",
      });
    }
    order.ftdHandling.status = "skipped";
    order.ftdHandling.skippedAt = new Date();
    order.ftdHandling.notes =
      "FTDs skipped for manual filling later by affiliate manager/admin";
    await order.save();
    res.status(200).json({
      success: true,
      message: "FTDs marked for manual filling later",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a lead from an order - marks it as removed but keeps it visible in the order
 * The lead is freed up to be used in other orders
 */
exports.cancelLeadFromOrder = async (req, res, next) => {
  try {
    const { orderId, leadId } = req.params;
    const { reason } = req.body;

    // Validate reason is provided
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason for removal is required",
      });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Find the lead
    const Lead = require("../models/Lead");
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if the lead is in the order's leads array (primary validation)
    if (!order.leads.includes(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Lead is not found in this order",
      });
    }

    // Check if the lead is already removed
    const alreadyRemoved = order.removedLeads?.some(
      (rl) => rl.leadId.toString() === leadId
    );
    if (alreadyRemoved) {
      return res.status(400).json({
        success: false,
        message: "Lead has already been removed from this order",
      });
    }

    // Get the lead type from metadata or lead itself
    const leadMetadata = order.leadsMetadata?.find(
      (m) => m.leadId.toString() === leadId
    );
    const leadType = leadMetadata?.orderedAs || lead.leadType;

    // Add to removedLeads array (soft delete - keep lead visible but marked as removed)
    if (!order.removedLeads) {
      order.removedLeads = [];
    }
    order.removedLeads.push({
      leadId: lead._id,
      reason: reason.trim(),
      removedBy: req.user._id,
      removedAt: new Date(),
      leadType: leadType,
    });

    // Reset the lead to unused state so it can be used in other orders
    // Note: assignedAgent is preserved - once assigned to an agent, it stays assigned
    lead.orderId = undefined;
    lead.createdBy = undefined;

    // Reset cooldown timer since the lead is no longer active in the order
    // This allows the lead to be used again immediately after cancellation
    lead.lastUsedInOrder = undefined;
    console.log(
      `[CANCEL-LEAD-DEBUG] Cleared cooldown for cancelled lead (now available for reuse)`
    );

    // Remove assignment histories that were inherited from this specific order
    // This undoes the assignments that were made when the lead was added to the order
    const orderIdStr = orderId.toString();

    // Remove client network history entries for this order
    if (lead.clientNetworkHistory && lead.clientNetworkHistory.length > 0) {
      lead.clientNetworkHistory = lead.clientNetworkHistory.filter(
        (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
      );
    }

    // Remove our network history entries for this order
    if (lead.ourNetworkHistory && lead.ourNetworkHistory.length > 0) {
      lead.ourNetworkHistory = lead.ourNetworkHistory.filter(
        (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
      );
    }

    // Remove campaign history entries for this order
    if (lead.campaignHistory && lead.campaignHistory.length > 0) {
      lead.campaignHistory = lead.campaignHistory.filter(
        (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
      );
    }

    // Remove client broker history entries for this order and update assignedClientBrokers
    if (lead.clientBrokerHistory && lead.clientBrokerHistory.length > 0) {
      // Get broker IDs that were assigned via this order (before filtering)
      const brokerIdsFromThisOrder = lead.clientBrokerHistory
        .filter((entry) => entry.orderId && entry.orderId.toString() === orderIdStr)
        .map((entry) => entry.clientBroker.toString());

      // Filter out history entries for this order
      lead.clientBrokerHistory = lead.clientBrokerHistory.filter(
        (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
      );

      // Remove broker IDs from assignedClientBrokers if they were only assigned via this order
      // (i.e., they no longer appear in any remaining history entry)
      if (lead.assignedClientBrokers && brokerIdsFromThisOrder.length > 0) {
        const remainingBrokerIds = new Set(
          lead.clientBrokerHistory.map((entry) => entry.clientBroker.toString())
        );
        lead.assignedClientBrokers = lead.assignedClientBrokers.filter(
          (brokerId) => remainingBrokerIds.has(brokerId.toString())
        );
      }
    }

    console.log(
      `[CANCEL-LEAD-DEBUG] Removed order-specific assignment histories for order ${orderId}`
    );

    // Update client brokers to remove this lead from their active lists
    if (lead.assignedClientBrokers && lead.assignedClientBrokers.length > 0) {
      const ClientBroker = require("../models/ClientBroker");
      for (const brokerId of lead.assignedClientBrokers) {
        try {
          const broker = await ClientBroker.findById(brokerId);
          if (broker) {
            broker.unassignLead(leadId);
            await broker.save();
          }
        } catch (error) {
          console.warn(
            `Failed to update client broker ${brokerId}:`,
            error.message
          );
        }
      }
    }

    // Clear proxy assignments for this order
    if (lead.proxyAssignments) {
      lead.proxyAssignments = lead.proxyAssignments.filter(
        (assignment) => assignment.orderId.toString() !== orderId
      );
    }

    // NOTE: We do NOT remove the lead from order.leads array anymore
    // The lead stays in the array but is marked as removed via removedLeads

    // Update the order's fulfilled counts
    if (order.fulfilled && order.fulfilled[leadType] > 0) {
      order.fulfilled[leadType] -= 1;
    }

    // Update order status if needed
    const totalFulfilled =
      (order.fulfilled?.ftd || 0) +
      (order.fulfilled?.filler || 0) +
      (order.fulfilled?.cold || 0);

    if (totalFulfilled === 0) {
      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancellationReason = "All leads cancelled";
    } else {
      const totalRequested =
        (order.requests?.ftd || 0) +
        (order.requests?.filler || 0) +
        (order.requests?.cold || 0);

      if (totalFulfilled < totalRequested) {
        order.status = "partial";
        // Generate detailed partial fulfillment reason
        const reasons = [];
        if ((order.fulfilled?.ftd || 0) < (order.requests?.ftd || 0)) {
          reasons.push(
            await generateDetailedReasonForLeadType(
              "ftd",
              order.requests?.ftd || 0,
              order.fulfilled?.ftd || 0,
              {
                country: order.countryFilter,
                gender: order.genderFilter,
                selectedClientNetwork: order.selectedClientNetwork,
                selectedOurNetwork: order.selectedOurNetwork,
                selectedCampaign: order.selectedCampaign,
                selectedClientBrokers: order.selectedClientBrokers,
              }
            )
          );
        }
        if ((order.fulfilled?.filler || 0) < (order.requests?.filler || 0)) {
          reasons.push(
            await generateDetailedReasonForLeadType(
              "filler",
              order.requests?.filler || 0,
              order.fulfilled?.filler || 0,
              {
                country: order.countryFilter,
                gender: order.genderFilter,
                selectedClientNetwork: order.selectedClientNetwork,
                selectedOurNetwork: order.selectedOurNetwork,
                selectedCampaign: order.selectedCampaign,
                selectedClientBrokers: order.selectedClientBrokers,
              }
            )
          );
        }
        if ((order.fulfilled?.cold || 0) < (order.requests?.cold || 0)) {
          reasons.push(
            await generateDetailedReasonForLeadType(
              "cold",
              order.requests?.cold || 0,
              order.fulfilled?.cold || 0,
              {
                country: order.countryFilter,
                gender: order.genderFilter,
                selectedClientNetwork: order.selectedClientNetwork,
                selectedOurNetwork: order.selectedOurNetwork,
                selectedCampaign: order.selectedCampaign,
                selectedClientBrokers: order.selectedClientBrokers,
              }
            )
          );
        }
        order.partialFulfillmentReason = reasons.join(" | ");
      }
    }

    // Add audit log entry to order
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';

    if (!order.auditLog) {
      order.auditLog = [];
    }
    order.auditLog.push({
      action: "lead_removed",
      leadId: lead._id,
      leadEmail: lead.email,
      performedBy: req.user._id,
      performedAt: new Date(),
      ipAddress: clientIp,
      details: `Lead ${lead.firstName} ${lead.lastName} (${lead.email}) removed from order by ${req.user.fullName || req.user.email}. Reason: ${reason}`,
      previousValue: {
        leadType,
        leadName: `${lead.firstName} ${lead.lastName}`,
        removalReason: reason,
      },
    });

    // Save both documents
    await Promise.all([lead.save(), order.save()]);

    // Populate the updated order for response
    await order.populate([
      { path: "requester", select: "fullName email role" },
      {
        path: "leads",
        select:
          "leadType orderedAs firstName lastName country email phone orderId assignedAgent assignedAgentAt newPhone newEmail depositConfirmed isShaved",
        populate: {
          path: "assignedAgent",
          select: "fullName email fourDigitCode",
        },
      },
      { path: "removedLeads.removedBy", select: "fullName email" },
    ]);

    res.status(200).json({
      success: true,
      message: `Lead ${lead.firstName} ${lead.lastName} has been removed from the order`,
      data: {
        order,
        removedLead: {
          _id: lead._id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          leadType: leadType,
          reason: reason,
        },
        // Return updated fulfilled counts for real-time UI update
        fulfilled: order.fulfilled,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getFTDLeadsForOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate({
      path: "leads",
      populate: {
        path: "assignedAgent",
        select: "fullName email fourDigitCode",
      },
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    if (
      !["admin", "affiliate_manager", "lead_manager"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins, affiliate managers, and lead managers can access FTD leads.",
      });
    }
    const ftdLeads = (order.leads || [])
      .filter((lead) => lead && lead.leadType === "ftd")
      .filter((lead) => {
        const networkHistory = lead.clientNetworkHistory?.find(
          (history) => history.orderId?.toString() === order._id.toString()
        );
        return !!networkHistory;
      });
    res.status(200).json({
      success: true,
      data: ftdLeads,
      message: `Found ${ftdLeads.length} FTD lead(s) for manual assignment`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change a specific FTD or Filler lead in an order with network filtration
 * Supports agent assignment for the replacement lead
 */
exports.changeFTDInOrder = async (req, res, next) => {
  try {
    const { orderId, leadId } = req.params;
    const {
      selectedClientNetwork,
      selectedOurNetwork,
      selectedCampaign,
      selectedClientBrokers,
      countryFilter: requestCountryFilter,
      preferredAgent,
      fallbackGender,
      isFillerOrder,
    } = req.body;

    console.log(`[CHANGE-FTD-DEBUG] ===== STARTING FTD REPLACEMENT =====`);
    console.log(
      `[CHANGE-FTD-DEBUG] preferredAgent received: ${preferredAgent} (type: ${typeof preferredAgent})`
    );

    // Check user permissions
    if (
      !["admin", "affiliate_manager", "lead_manager"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins, affiliate managers, and lead managers can change FTD/Filler leads.",
      });
    }

    // Find the order
    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // For affiliate managers, ensure they can only change leads from their orders
    if (req.user.role === "affiliate_manager") {
      if (order.requester.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You can only change leads from your own orders.",
        });
      }
    }

    // Find the lead to be replaced
    const Lead = require("../models/Lead");
    const oldLead = await Lead.findById(leadId);
    if (!oldLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if the lead is actually assigned to this order and is an FTD
    console.log(
      `[CHANGE-FTD-DEBUG] Validation - orderId: ${orderId}, leadId: ${leadId}`
    );
    console.log(
      `[CHANGE-FTD-DEBUG] oldLead.orderId: ${oldLead.orderId}, oldLead.leadType: ${oldLead.leadType}`
    );
    console.log(`[CHANGE-FTD-DEBUG] order.leads length: ${order.leads.length}`);

    // First check if lead type is valid
    if (oldLead.leadType !== "ftd") {
      return res.status(400).json({
        success: false,
        message:
          "Only FTD leads can be changed using this endpoint (fillers are also FTD type)",
      });
    }

    // Check if the lead is in the order's leads array (primary validation)
    const leadInOrder = order.leads.some((id) => id.toString() === leadId);
    console.log(
      `[CHANGE-FTD-DEBUG] Lead in order check - leadInOrder: ${leadInOrder}`
    );
    console.log(
      `[CHANGE-FTD-DEBUG] Order leads: ${order.leads
        .map((id) => id.toString())
        .join(", ")}`
    );

    if (!leadInOrder) {
      console.log(
        `[CHANGE-FTD-DEBUG] Failed order.leads validation - lead not in order's leads array`
      );
      return res.status(400).json({
        success: false,
        message: "Lead is not found in this order",
      });
    }

    // Check lead's orderId field and auto-repair if inconsistent
    if (!oldLead.orderId || oldLead.orderId.toString() !== orderId) {
      console.log(
        `[CHANGE-FTD-DEBUG] WARNING: Lead's orderId field is out of sync!`
      );
      console.log(
        `[CHANGE-FTD-DEBUG] - Lead.orderId: ${oldLead.orderId || "null"}`
      );
      console.log(`[CHANGE-FTD-DEBUG] - Expected orderId: ${orderId}`);
      console.log(
        `[CHANGE-FTD-DEBUG] - Lead IS in order.leads array, auto-repairing...`
      );

      // Auto-repair: Since the lead is confirmed to be in the order's leads array,
      // sync the lead's orderId field to match
      oldLead.orderId = orderId;
      await oldLead.save();

      console.log(`[CHANGE-FTD-DEBUG] ✓ Auto-repaired lead's orderId field`);
    } else {
      console.log(`[CHANGE-FTD-DEBUG] ✓ Lead orderId validation passed`);
    }

    // Get replacement history for this lead position to prevent reusing previously swapped leads
    const leadMetadataIndex = order.leadsMetadata?.findIndex(
      (meta) => meta.leadId.toString() === leadId
    );
    const replacementHistory =
      leadMetadataIndex !== -1 &&
      order.leadsMetadata[leadMetadataIndex].replacementHistory
        ? order.leadsMetadata[leadMetadataIndex].replacementHistory
        : [];

    console.log(
      `[CHANGE-FTD-DEBUG] Replacement history for this position: ${replacementHistory.length} lead(s) will be excluded`
    );

    // Build filters for finding replacement FTD
    // Use country from request if provided, otherwise fall back to order's country
    const countryToUse = requestCountryFilter || order.countryFilter;
    const countryFilter = countryToUse ? { country: countryToUse } : {};
    const genderFilter =
      order.genderFilter && order.genderFilter !== "not_defined"
        ? { gender: order.genderFilter }
        : {};

    console.log(
      `[CHANGE-FTD-DEBUG] Using country filter: ${
        countryToUse || "none"
      } (from ${requestCountryFilter ? "request" : "order"})`
    );

    // Build array of lead IDs to exclude (current lead + all previously used leads at this position)
    const leadsToExclude = [leadId, ...replacementHistory];
    console.log(
      `[CHANGE-FTD-DEBUG] Total leads to exclude: ${leadsToExclude.length} (1 current + ${replacementHistory.length} from history)`
    );

    // Build base query for replacement leads (all FTD type)
    let ftdQuery = {
      leadType: "ftd",
      isArchived: { $ne: true }, // Never return archived leads
      status: { $ne: "inactive" }, // Never return inactive leads
      _id: { $nin: leadsToExclude }, // Exclude current lead and all previously used leads
      ...countryFilter,
    };

    // Apply agent/gender filters based on what's provided
    // Priority: fallbackGender > preferredAgent > default unassigned
    if (fallbackGender) {
      // If fallbackGender provided, look for unassigned leads with that gender
      // This takes priority even if preferredAgent was originally specified
      ftdQuery.assignedAgent = null;
      if (fallbackGender !== "not_defined") {
        ftdQuery.gender = fallbackGender;
      }
    } else if (preferredAgent) {
      // If only preferredAgent provided (no fallbackGender), look for leads assigned to that agent
      ftdQuery.assignedAgent = preferredAgent;
      // Don't apply order gender filter when looking for agent-assigned leads
      // They might have leads of any gender already assigned
    } else {
      // No agent preference and no gender fallback - look for unassigned leads with order gender
      ftdQuery.assignedAgent = null;
      ftdQuery = { ...ftdQuery, ...genderFilter };
    }

    const leadTypeLabel = isFillerOrder ? "FILLER" : "FTD";

    // First, get the total count of available leads matching base criteria
    const totalAvailableCount = await Lead.countDocuments(ftdQuery);

    if (totalAvailableCount === 0) {
      // If preferredAgent was specified and no leads found, ask for gender fallback
      if (preferredAgent && !fallbackGender) {
        return res.status(400).json({
          success: false,
          needsGenderFallback: true,
          message: `No leads found assigned to the selected agent. Please select a gender to find an unassigned lead.`,
          details: {
            searchCriteria: {
              country: order.countryFilter,
              preferredAgent: preferredAgent,
              excludedLead: leadId,
            },
          },
        });
      }

      return res.status(400).json({
        success: false,
        message: `No suitable replacement ${leadTypeLabel} leads found matching the criteria`,
        details: {
          searchCriteria: {
            country: order.countryFilter,
            gender: fallbackGender || order.genderFilter,
            hasDocuments: true,
            excludedLead: leadId,
            preferredAgent: preferredAgent || null,
          },
        },
      });
    }

    // Determine fetch strategy based on available leads
    let fetchLimit;
    if (totalAvailableCount <= 1000) {
      fetchLimit = totalAvailableCount;
      console.log(
        `[CHANGE-FTD-DEBUG] Fetching all ${fetchLimit} available leads for comprehensive filtering`
      );
    } else {
      fetchLimit = Math.min(totalAvailableCount, 1000);
      console.log(
        `[CHANGE-FTD-DEBUG] Large dataset detected. Fetching ${fetchLimit} leads`
      );
    }

    // Fetch potential replacement FTDs
    let candidateLeads;

    // If preferredAgent is specified, ONLY fetch their leads (don't include unassigned)
    if (preferredAgent && !fallbackGender) {
      // Fetch ONLY agent-assigned leads directly (no sampling, no unassigned fallback)
      candidateLeads = await Lead.find(ftdQuery).limit(fetchLimit);

      console.log(
        `[CHANGE-FTD-DEBUG] Fetched ${candidateLeads.length} agent-assigned leads for agent ${preferredAgent}`
      );
    } else {
      // No agent preference or using gender fallback - use random sampling for unassigned leads
      candidateLeads = await Lead.aggregate([
        {
          $match: ftdQuery,
        },
        {
          $sample: { size: fetchLimit },
        },
      ]);

      console.log(
        `[CHANGE-FTD-DEBUG] Found ${
          candidateLeads.length
        } candidate FTD leads for filtering (${
          fallbackGender ? "gender fallback" : "random sample"
        })`
      );
    }

    // Define network variables outside the conditional to ensure they're available throughout the function
    const networkToCheck = selectedClientNetwork || order.selectedClientNetwork;
    const ourNetworkToCheck = selectedOurNetwork || order.selectedOurNetwork;

    // Determine which brokers to use for filtering (can be multiple)
    // Priority: user's dropdown selection > order's default brokers
    let clientBrokersToCheck = [];
    if (selectedClientBrokers && selectedClientBrokers.length > 0) {
      // User explicitly selected broker(s) in the dropdown
      clientBrokersToCheck = selectedClientBrokers;
      console.log(
        `[CHANGE-FTD-DEBUG] Using ${
          clientBrokersToCheck.length
        } broker(s) from dropdown selection: ${clientBrokersToCheck.join(", ")}`
      );
    } else if (
      order.selectedClientBrokers &&
      order.selectedClientBrokers.length > 0
    ) {
      // Fall back to order's original brokers
      clientBrokersToCheck = order.selectedClientBrokers;
      console.log(
        `[CHANGE-FTD-DEBUG] Using ${
          clientBrokersToCheck.length
        } broker(s) from order default: ${clientBrokersToCheck.join(", ")}`
      );
    } else {
      console.log(`[CHANGE-FTD-DEBUG] No brokers specified for filtering`);
    }

    const campaignToUse = selectedCampaign || order.selectedCampaign;

    if (candidateLeads.length > 0) {
      const candidateLeadIds = candidateLeads.map((lead) => lead._id);
      const candidateLeadDocs = await Lead.find({
        _id: { $in: candidateLeadIds },
      });
      let filteredFTDLeads = candidateLeadDocs;

      // Filter out FTDs in cooldown period (10 days since last use)
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const beforeCooldownFilter = filteredFTDLeads.length;
      filteredFTDLeads = filteredFTDLeads.filter(
        (lead) => !lead.lastUsedInOrder || lead.lastUsedInOrder <= tenDaysAgo
      );
      console.log(
        `[CHANGE-FTD-DEBUG] Cooldown filtering: ${
          beforeCooldownFilter - filteredFTDLeads.length
        } leads filtered out (in 10-day cooldown), ${
          filteredFTDLeads.length
        } leads remain`
      );

      // Exclude leads with phone numbers already in this order (prevents selecting duplicates)
      const orderLeads = await Lead.find({ _id: { $in: order.leads } });
      const existingLeadIds = orderLeads.map((lead) => lead._id.toString());
      const existingPhoneNumbers = orderLeads.map((lead) => lead.newPhone);

      if (existingLeadIds.length > 0) {
        const beforeCount = filteredFTDLeads.length;
        console.log(
          `[CHANGE-FTD-DEBUG] Filtering out ${existingLeadIds.length} leads already in this order (by ID and phone number)`
        );
        filteredFTDLeads = filteredFTDLeads.filter(
          (lead) =>
            !existingLeadIds.includes(lead._id.toString()) &&
            !existingPhoneNumbers.includes(lead.newPhone)
        );
        console.log(
          `[CHANGE-FTD-DEBUG] After duplicate exclusion filtering: ${
            filteredFTDLeads.length
          } leads remain (filtered out ${
            beforeCount - filteredFTDLeads.length
          })`
        );
      }

      // Apply network filtrations to ALL leads (including agent-assigned)
      if (networkToCheck) {
        const beforeCount = filteredFTDLeads.length;
        console.log(
          `[CHANGE-FTD-DEBUG] Filtering out leads already assigned to client network: ${networkToCheck}`
        );
        filteredFTDLeads = filteredFTDLeads.filter(
          (lead) => !lead.isAssignedToClientNetwork(networkToCheck)
        );
        console.log(
          `[CHANGE-FTD-DEBUG] After client network filtering: ${
            filteredFTDLeads.length
          } leads remain (${
            beforeCount - filteredFTDLeads.length
          } filtered out)`
        );
      }

      // Our network filtering removed - leads can be reused for same our network

      if (clientBrokersToCheck && clientBrokersToCheck.length > 0) {
        const beforeCount = filteredFTDLeads.length;
        console.log(
          `[CHANGE-FTD-DEBUG] Filtering out leads already assigned to ${
            clientBrokersToCheck.length
          } client broker(s): ${clientBrokersToCheck.join(", ")}`
        );
        filteredFTDLeads = filteredFTDLeads.filter(
          (lead) =>
            !clientBrokersToCheck.some((brokerId) =>
              lead.isAssignedToClientBroker(brokerId)
            )
        );
        console.log(
          `[CHANGE-FTD-DEBUG] After client brokers filtering: ${
            filteredFTDLeads.length
          } leads remain (filtered out ${
            beforeCount - filteredFTDLeads.length
          })`
        );
      }

      candidateLeads = filteredFTDLeads;
    }

    // Check if we have any candidates after filtering
    // If preferredAgent was specified and no leads found, ask for gender fallback
    if (candidateLeads.length === 0 && preferredAgent && !fallbackGender) {
      console.log(
        `[CHANGE-FTD-DEBUG] No agent-assigned leads available after filtering. Requesting gender fallback.`
      );
      return res.status(400).json({
        success: false,
        needsGenderFallback: true,
        message: `No suitable replacement leads found for the selected agent. Please select a gender to find an unassigned lead.`,
        details: {
          searchCriteria: {
            country: order.countryFilter,
            preferredAgent: preferredAgent,
            excludedLead: leadId,
            filtersApplied: {
              clientNetwork: networkToCheck ? true : false,
              clientBroker:
                clientBrokersToCheck && clientBrokersToCheck.length > 0
                  ? true
                  : false,
              cooldown: true,
              duplicates: true,
            },
          },
        },
      });
    }

    // Apply FTD phone repetition rules to get the best replacement (skip for fillers)
    if (candidateLeads.length > 0) {
      let selectedReplacements;

      if (isFillerOrder) {
        // For filler orders, skip phone validation - just use FTD leads as-is
        console.log(
          `[CHANGE-FTD-DEBUG] Filler replacement - skipping phone validation`
        );
        selectedReplacements = [candidateLeads[0]];
      } else {
        // For regular FTD orders, apply phone validation rules
        selectedReplacements = applyFTDPhoneRepetitionRules(candidateLeads, 1);
      }

      if (selectedReplacements.length === 0) {
        // If preferredAgent was specified and phone rules filtered out all leads, ask for gender fallback
        if (preferredAgent && !fallbackGender) {
          console.log(
            `[CHANGE-FTD-DEBUG] Agent leads found but filtered out by phone rules. Requesting gender fallback.`
          );
          return res.status(400).json({
            success: false,
            needsGenderFallback: true,
            message: `Agent's leads do not meet phone repetition rules. Please select a gender to find an unassigned lead.`,
            details: {
              candidatesFound: candidateLeads.length,
              afterPhoneRules: 0,
              preferredAgent: preferredAgent,
            },
          });
        }

        return res.status(400).json({
          success: false,
          message: `No suitable replacement ${leadTypeLabel} leads found after applying filtration rules`,
          details: {
            candidatesFound: candidateLeads.length,
            afterPhoneRules: 0,
            appliedFilters: {
              clientNetwork: networkToCheck ? true : false,
              ourNetwork: ourNetworkToCheck ? true : false,
              clientBroker:
                clientBrokersToCheck && clientBrokersToCheck.length > 0
                  ? true
                  : false,
              phoneRepetitionRules: !isFillerOrder, // Only applied for FTD, not filler
              preferredAgent: preferredAgent || null,
              fallbackGender: fallbackGender || null,
            },
          },
        });
      }

      const newLead = selectedReplacements[0];
      console.log(
        `[CHANGE-FTD-DEBUG] Selected replacement lead: ${newLead._id}`
      );

      // Start transaction to replace the lead
      const session = await Lead.startSession();
      await session.withTransaction(async () => {
        // Reset the old lead to unused state
        // Note: Agent assignment is preserved - manually assigned agents should stay assigned
        oldLead.orderId = undefined;
        oldLead.createdBy = undefined;

        // Reset cooldown timer since the lead is no longer in the order
        // This allows the lead to be used again immediately after replacement
        oldLead.lastUsedInOrder = undefined;
        console.log(
          `[CHANGE-FTD-DEBUG] Cleared cooldown for replaced lead (now available for reuse)`
        );

        // Clear assignment histories related to this order for old lead
        // Note: We keep all assignment histories as permanent records (not cleared on FTD replacement)
        // This includes clientNetworkHistory, ourNetworkHistory, campaignHistory, and clientBrokerHistory
        // These histories are used for filtering and preventing duplicate assignments in future orders
        // assignedClientBrokers is also preserved as a permanent record

        // Assign new lead to order
        newLead.orderId = orderId;
        newLead.createdBy = req.user._id;

        // Note: Agent assignment is preserved as-is from the replacement lead
        // If the replacement lead was already assigned to an agent, it keeps that assignment
        // If it was unassigned, it remains unassigned
        console.log(
          `[CHANGE-FTD-DEBUG] New lead agent status: ${
            newLead.assignedAgent
              ? "Assigned to " + newLead.assignedAgent
              : "Unassigned"
          }`
        );

        // Add network and campaign assignments for new lead (consistent with order creation)
        if (campaignToUse) {
          newLead.addCampaignAssignment(campaignToUse, req.user._id, orderId);
        }

        if (networkToCheck) {
          newLead.addClientNetworkAssignment(
            networkToCheck,
            req.user._id,
            orderId
          );
        }

        if (ourNetworkToCheck) {
          newLead.addOurNetworkAssignment(
            ourNetworkToCheck,
            req.user._id,
            orderId
          );
        }

        // No automatic client broker assignment - brokers are used for filtering purposes only
        // Client brokers should be assigned manually later from the orders tab

        // Update lastUsedInOrder timestamp for FTD/Filler leads (10-day cooldown)
        newLead.lastUsedInOrder = new Date();
        console.log(
          `[CHANGE-FTD-DEBUG] Updated lastUsedInOrder timestamp for replacement lead (10-day cooldown starts now)`
        );

        // Add audit log entry to order for FTD swap
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                         req.headers['x-real-ip'] ||
                         req.connection?.remoteAddress ||
                         req.socket?.remoteAddress ||
                         'unknown';

        if (!order.auditLog) {
          order.auditLog = [];
        }
        order.auditLog.push({
          action: "ftd_swapped",
          leadId: newLead._id,
          leadEmail: newLead.email,
          performedBy: req.user._id,
          performedAt: new Date(),
          ipAddress: clientIp,
          details: `FTD swapped: ${oldLead.firstName} ${oldLead.lastName} (${oldLead.email}) replaced with ${newLead.firstName} ${newLead.lastName} (${newLead.email}) by ${req.user.fullName || req.user.email}`,
          previousValue: {
            leadId: oldLead._id,
            leadEmail: oldLead.email,
            leadName: `${oldLead.firstName} ${oldLead.lastName}`,
          },
          newValue: {
            leadId: newLead._id,
            leadEmail: newLead.email,
            leadName: `${newLead.firstName} ${newLead.lastName}`,
            leadType: isFillerOrder ? "filler" : "ftd",
          },
        });

        await oldLead.save({ session });
        await newLead.save({ session });

        // Update order to replace the lead
        const leadIndex = order.leads.findIndex(
          (id) => id.toString() === leadId
        );
        if (leadIndex !== -1) {
          order.leads[leadIndex] = newLead._id;

          // Update leadsMetadata to preserve the orderedAs designation for the new lead
          // and add the old lead to replacement history
          if (order.leadsMetadata && Array.isArray(order.leadsMetadata)) {
            const metadataIndex = order.leadsMetadata.findIndex(
              (meta) => meta.leadId.toString() === leadId
            );
            if (metadataIndex !== -1) {
              // Add the old lead to the replacement history to prevent it from being used again
              if (!order.leadsMetadata[metadataIndex].replacementHistory) {
                order.leadsMetadata[metadataIndex].replacementHistory = [];
              }
              order.leadsMetadata[metadataIndex].replacementHistory.push(
                oldLead._id
              );
              console.log(
                `[CHANGE-FTD-DEBUG] Added old lead ${oldLead._id} to replacement history (total: ${order.leadsMetadata[metadataIndex].replacementHistory.length})`
              );

              // Preserve the orderedAs value (e.g., 'filler' or 'ftd') for the replacement lead
              order.leadsMetadata[metadataIndex].leadId = newLead._id;
              console.log(
                `[CHANGE-FTD-DEBUG] Updated leadsMetadata: preserved orderedAs='${order.leadsMetadata[metadataIndex].orderedAs}' for new lead`
              );
            }
          }

          await order.save({ session });
        }
      });

      await session.endSession();

      console.log(
        `[CHANGE-FTD-DEBUG] Successfully replaced lead ${leadId} with ${newLead._id} in order ${orderId}`
      );

      res.status(200).json({
        success: true,
        message: `${leadTypeLabel} lead successfully changed`,
        data: {
          orderId: orderId,
          oldLead: {
            id: oldLead._id,
            firstName: oldLead.firstName,
            lastName: oldLead.lastName,
            email: oldLead.newEmail,
            phone: oldLead.newPhone,
            assignedAgent: oldLead.assignedAgent,
          },
          newLead: {
            id: newLead._id,
            firstName: newLead.firstName,
            lastName: newLead.lastName,
            email: newLead.newEmail,
            phone: newLead.newPhone,
            assignedAgent: newLead.assignedAgent,
          },
          appliedFilters: {
            clientNetwork: networkToCheck ? true : false,
            ourNetwork: ourNetworkToCheck ? true : false,
            clientBroker:
              clientBrokersToCheck && clientBrokersToCheck.length > 0
                ? true
                : false,
            campaign: campaignToUse ? true : false,
            preferredAgent: preferredAgent ? true : false,
            fallbackGender: fallbackGender || null,
          },
        },
      });
    } else {
      // If preferredAgent was specified and no leads found after network filtering, ask for gender fallback
      if (preferredAgent && !fallbackGender) {
        return res.status(400).json({
          success: false,
          needsGenderFallback: true,
          message: `No leads assigned to the selected agent meet the network requirements. Please select a gender to find an unassigned lead.`,
          details: {
            totalCandidates: totalAvailableCount,
            afterNetworkFiltering: 0,
            preferredAgent: preferredAgent,
          },
        });
      }

      return res.status(400).json({
        success: false,
        message: `No suitable replacement ${leadTypeLabel} leads found after applying network filtrations`,
        details: {
          totalCandidates: totalAvailableCount,
          afterNetworkFiltering: 0,
          appliedFilters: {
            clientNetwork: networkToCheck ? true : false,
            ourNetwork: ourNetworkToCheck ? true : false,
            clientBroker:
              clientBrokersToCheck && clientBrokersToCheck.length > 0
                ? true
                : false,
            preferredAgent: preferredAgent || null,
            fallbackGender: fallbackGender || null,
          },
        },
      });
    }
  } catch (error) {
    console.error("Error changing FTD in order:", error);
    next(error);
  }
};

/**
 * Permanently delete an order from the database
 * By default, only allows deletion of cancelled orders
 * Admins can force delete any order with the force parameter
 *
 * Note: This only deletes the order record. All cleanup (removing assignments, etc.)
 * should have already been done during the cancellation step.
 */
exports.deleteOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { force } = req.query; // ?force=true to delete non-cancelled orders

    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Only admins and affiliate managers can delete orders
      if (!["admin", "affiliate_manager"].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message:
            "Only administrators and affiliate managers can permanently delete orders",
        });
      }

      // Check if order is cancelled or if force delete is requested (force only for admins)
      if (order.status !== "cancelled") {
        // Only admins can force delete non-cancelled orders
        if (force !== "true" || req.user.role !== "admin") {
          return res.status(400).json({
            success: false,
            message:
              req.user.role === "admin"
                ? "Only cancelled orders can be deleted. Use force=true query parameter to delete non-cancelled orders."
                : "Only cancelled orders can be deleted.",
          });
        }
      }

      // Simply delete the order from the database
      // All cleanup (removing assignments, history, etc.) was already done during cancellation
      await Order.findByIdAndDelete(order._id, { session });

      res.status(200).json({
        success: true,
        message: `Order permanently deleted successfully${
          force === "true" ? " (forced)" : ""
        }`,
        data: {
          orderId: order._id,
          status: order.status,
        },
      });
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Convert lead type between FTD and Filler within an order
 * This toggles the orderedAs field in leadsMetadata and updates fulfilled counts
 */
exports.convertLeadTypeInOrder = async (req, res, next) => {
  try {
    const { orderId, leadId } = req.params;
    const { targetType } = req.body;

    console.log(`[CONVERT-LEAD-TYPE] ===== STARTING CONVERSION =====`);
    console.log(`[CONVERT-LEAD-TYPE] orderId: ${orderId}, leadId: ${leadId}`);
    console.log(
      `[CONVERT-LEAD-TYPE] targetType requested: ${targetType || "auto-toggle"}`
    );

    // Check user permissions
    if (
      !["admin", "affiliate_manager", "lead_manager"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins, affiliate managers, and lead managers can convert lead types.",
      });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // For affiliate managers, ensure they can only modify leads from their orders
    if (req.user.role === "affiliate_manager") {
      if (order.requester.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You can only modify leads from your own orders.",
        });
      }
    }

    // Check if the lead is in the order's leads array
    const leadInOrder = order.leads.some((id) => id.toString() === leadId);
    if (!leadInOrder) {
      return res.status(400).json({
        success: false,
        message: "Lead is not found in this order",
      });
    }

    // Find the lead to verify it's an FTD type
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Only FTD leads can be converted (both FTDs and Fillers have leadType: 'ftd')
    if (lead.leadType !== "ftd") {
      return res.status(400).json({
        success: false,
        message:
          "Only FTD/Filler leads can be converted (they share the same leadType)",
      });
    }

    // Find the leadsMetadata entry for this lead
    const metadataIndex = order.leadsMetadata.findIndex(
      (m) => m.leadId.toString() === leadId
    );

    if (metadataIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Lead metadata not found in order",
      });
    }

    const currentOrderedAs = order.leadsMetadata[metadataIndex].orderedAs;
    console.log(`[CONVERT-LEAD-TYPE] Current orderedAs: ${currentOrderedAs}`);

    // Determine the new type (toggle or use specified targetType)
    let newOrderedAs;
    if (targetType) {
      newOrderedAs = targetType;
    } else {
      // Auto-toggle: ftd -> filler, filler -> ftd
      newOrderedAs = currentOrderedAs === "ftd" ? "filler" : "ftd";
    }

    console.log(`[CONVERT-LEAD-TYPE] New orderedAs: ${newOrderedAs}`);

    // If no change needed
    if (currentOrderedAs === newOrderedAs) {
      return res.status(400).json({
        success: false,
        message: `Lead is already ordered as ${newOrderedAs}`,
      });
    }

    // Update the orderedAs field
    order.leadsMetadata[metadataIndex].orderedAs = newOrderedAs;

    // Update the fulfilled counts
    if (currentOrderedAs === "ftd" && newOrderedAs === "filler") {
      // Converting FTD to Filler
      order.fulfilled.ftd = Math.max(0, (order.fulfilled.ftd || 0) - 1);
      order.fulfilled.filler = (order.fulfilled.filler || 0) + 1;
    } else if (currentOrderedAs === "filler" && newOrderedAs === "ftd") {
      // Converting Filler to FTD
      order.fulfilled.filler = Math.max(0, (order.fulfilled.filler || 0) - 1);
      order.fulfilled.ftd = (order.fulfilled.ftd || 0) + 1;
    }

    console.log(
      `[CONVERT-LEAD-TYPE] Updated fulfilled counts - ftd: ${order.fulfilled.ftd}, filler: ${order.fulfilled.filler}`
    );

    // Add audit log entry to order for lead type conversion
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';

    if (!order.auditLog) {
      order.auditLog = [];
    }
    order.auditLog.push({
      action: "lead_type_changed",
      leadId: lead._id,
      leadEmail: lead.email,
      performedBy: req.user._id,
      performedAt: new Date(),
      ipAddress: clientIp,
      details: `Lead ${lead.firstName} ${lead.lastName} (${lead.email}) type changed from ${currentOrderedAs} to ${newOrderedAs} by ${req.user.fullName || req.user.email}`,
      previousValue: {
        orderedAs: currentOrderedAs,
      },
      newValue: {
        orderedAs: newOrderedAs,
      },
    });

    // Save the order and lead
    await Promise.all([order.save(), lead.save()]);

    console.log(`[CONVERT-LEAD-TYPE] ===== CONVERSION COMPLETE =====`);

    res.status(200).json({
      success: true,
      message: `Lead successfully converted from ${currentOrderedAs} to ${newOrderedAs}`,
      data: {
        orderId: order._id,
        leadId: leadId,
        previousType: currentOrderedAs,
        newType: newOrderedAs,
        fulfilled: order.fulfilled,
      },
    });
  } catch (error) {
    console.error(`[CONVERT-LEAD-TYPE] Error:`, error);
    next(error);
  }
};

exports.checkOrderFulfillment = async (req, res, next) => {
  try {
    const {
      requests,
      country,
      gender,
      selectedClientNetwork,
      selectedOurNetwork,
      selectedCampaign,
      selectedClientBrokers,
      agentFilter,
      agentAssignments = [], // Array of {leadType, agentId, index}
      manualSelection = false,
      manualLeads = [],
    } = req.body;

    if (manualSelection && manualLeads.length > 0) {
      return res.status(200).json({
        success: true,
        summary: {
          status: "fulfilled",
          message: "Manual selection - specific leads will be used",
          details: [],
          breakdown: {},
        },
      });
    }

    const { ftd = 0, filler = 0, cold = 0 } = requests || {};

    if (ftd + filler + cold === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          status: "not_fulfilled",
          message: "No leads requested",
          details: ["No leads requested"],
          breakdown: {},
        },
      });
    }

    const countryFilter = country ? { country: new RegExp(country, "i") } : {};
    const genderFilter = gender ? { gender } : {};

    // Helper to check availability
    const checkAvailability = async (leadType, count) => {
      if (count <= 0)
        return { insufficient: false, available: 0, requested: 0, details: [] };

      let baseQuery = {
        leadType,
        isArchived: { $ne: true }, // Never return archived leads
        status: { $ne: "inactive" }, // Never return inactive leads
        ...countryFilter,
        ...genderFilter,
      };

      // Cooldown check for FTD and Filler
      if (leadType === "ftd" || leadType === "filler") {
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        baseQuery.$or = [
          { lastUsedInOrder: null },
          { lastUsedInOrder: { $lte: tenDaysAgo } },
        ];
      }

      // Client Network Exclusion
      if (selectedClientNetwork) {
        baseQuery["clientNetworkHistory.clientNetwork"] = {
          $ne: selectedClientNetwork,
        };
      }

      // Client Broker Exclusion
      if (selectedClientBrokers && selectedClientBrokers.length > 0) {
        baseQuery["clientBrokerHistory.clientBroker"] = {
          $nin: selectedClientBrokers,
        };
      }

      let insufficient = false;
      let details = [];
      let totalAvailable = 0;

      // Check specific agent assignments
      const specificAssignments = agentAssignments.filter(
        (a) => a.leadType === leadType
      );

      // Group assignments by agent
      const assignmentsByAgent = {};
      let unassignedCount = 0; // Number of leads requested without specific agent assignment

      // Initialize with unassigned count based on total requested - specific assignments
      if (specificAssignments.length > 0) {
        specificAssignments.forEach((a) => {
          if (a.agentId) {
            assignmentsByAgent[a.agentId] =
              (assignmentsByAgent[a.agentId] || 0) + 1;
          } else {
            unassignedCount++;
          }
        });

        // Also add any leads not covered by assignments array (e.g. if array length < count)
        if (specificAssignments.length < count) {
          unassignedCount += count - specificAssignments.length;
        }
      } else {
        // No individual assignments used
        if (agentFilter) {
          // Global agent filter applied to all
          assignmentsByAgent[agentFilter] = count;
        } else {
          unassignedCount = count;
        }
      }

      // Check availability for each agent
      for (const [agentId, requestedForAgent] of Object.entries(
        assignmentsByAgent
      )) {
        // Check agent assigned leads
        const agentQuery = { ...baseQuery, assignedAgent: agentId };
        const agentAvailable = await Lead.countDocuments(agentQuery);

        if (agentAvailable < requestedForAgent) {
          insufficient = true;
          details.push(
            `Agent ${agentId} has only ${agentAvailable} assigned ${leadType} leads (requested ${requestedForAgent}). Fallback to unassigned may be required.`
          );
          totalAvailable += agentAvailable;
        } else {
          totalAvailable += requestedForAgent;
        }
      }

      // Check availability for unassigned requests
      if (unassignedCount > 0) {
        const unassignedQuery = { ...baseQuery, assignedAgent: null };
        const unassignedAvailable = await Lead.countDocuments(unassignedQuery);

        if (unassignedAvailable < unassignedCount) {
          insufficient = true;
          details.push(
            `Insufficient unassigned ${leadType} leads (Available: ${unassignedAvailable}, Requested: ${unassignedCount})`
          );
          totalAvailable += unassignedAvailable;
        } else {
          totalAvailable += unassignedCount;
        }
      }

      // Simplified Aggregate Check
      let guaranteedLeads = 0;
      let unassignedNeeded = 0;

      // 1. Check specific agents
      for (const [agentId, requestedForAgent] of Object.entries(
        assignmentsByAgent
      )) {
        const agentQuery = { ...baseQuery, assignedAgent: agentId };
        const agentAvailable = await Lead.countDocuments(agentQuery);
        const takenFromAgent = Math.min(agentAvailable, requestedForAgent);
        guaranteedLeads += takenFromAgent;
        unassignedNeeded += requestedForAgent - takenFromAgent;
      }

      // 2. Check unassigned needs (direct unassigned requests + fallback from agents)
      unassignedNeeded += unassignedCount;

      if (unassignedNeeded > 0) {
        const unassignedQuery = { ...baseQuery, assignedAgent: null };
        const unassignedAvailable = await Lead.countDocuments(unassignedQuery);
        guaranteedLeads += Math.min(unassignedAvailable, unassignedNeeded);

        if (unassignedAvailable < unassignedNeeded) {
          insufficient = true;
        }
      }

      if (guaranteedLeads < count) {
        insufficient = true;
        // Only add general message if no specific ones added (to avoid clutter)
        if (details.length === 0) {
          details.push(
            `Total available ${leadType} leads (${guaranteedLeads}) is less than requested (${count})`
          );
        }
      }

      return {
        insufficient,
        details,
        available: guaranteedLeads,
        requested: count,
      };
    };

    const ftdCheck =
      ftd > 0 ? await checkAvailability("ftd", ftd) : { insufficient: false };
    const fillerCheck =
      filler > 0
        ? await checkAvailability("filler", filler)
        : { insufficient: false };
    const coldCheck =
      cold > 0
        ? await checkAvailability("cold", cold)
        : { insufficient: false };

    let status = "fulfilled";
    let message = "Order can be fulfilled";
    let allDetails = [
      ...(ftdCheck.details || []),
      ...(fillerCheck.details || []),
      ...(coldCheck.details || []),
    ];

    if (
      ftdCheck.insufficient ||
      fillerCheck.insufficient ||
      coldCheck.insufficient
    ) {
      status = "partial";
      message = "Order will be partially fulfilled";

      const totalRequested = ftd + filler + cold;
      const totalAvailable =
        (ftdCheck.available || 0) +
        (fillerCheck.available || 0) +
        (coldCheck.available || 0);

      if (totalAvailable === 0) {
        status = "not_fulfilled";
        message = "Order cannot be fulfilled";
      }
    }

    res.status(200).json({
      success: true,
      summary: {
        status,
        message,
        details: allDetails,
        breakdown: {
          ftd: ftdCheck,
          filler: fillerCheck,
          cold: coldCheck,
        },
      },
    });
  } catch (error) {
    console.error("Check fulfillment error:", error);
    next(error);
  }
};

// Change order requester (Admin only)
exports.changeRequester = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { newRequesterId } = req.body;

    if (!newRequesterId) {
      return res.status(400).json({
        success: false,
        message: "New requester ID is required",
      });
    }

    const order = await Order.findById(orderId).populate("requester");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const oldRequesterId = order.requester._id;

    // Update history
    if (!order.requesterHistory) {
      order.requesterHistory = [];
    }

    order.requesterHistory.push({
      previousRequester: oldRequesterId,
      newRequester: newRequesterId,
      changedBy: req.user._id,
      changedAt: new Date(),
    });

    // Update requester
    order.requester = newRequesterId;

    // Update agent assignments in order schema if they matched the old requester
    if (order.agentAssignments && order.agentAssignments.length > 0) {
      let assignmentsUpdated = false;
      order.agentAssignments.forEach((assignment) => {
        if (assignment.agentId.toString() === oldRequesterId.toString()) {
          assignment.agentId = newRequesterId;
          assignmentsUpdated = true;
        }
      });
      if (assignmentsUpdated) {
        order.markModified("agentAssignments");
      }
    }

    await order.save();

    // Update leads: "all the current connections connected to the current requester will be relinked to the new assigned requester"
    if (order.leads && order.leads.length > 0) {
      // Update assignedAgent for leads in this order that were assigned to the old requester
      const updateResult = await Lead.updateMany(
        {
          _id: { $in: order.leads },
          assignedAgent: oldRequesterId,
        },
        {
          $set: {
            assignedAgent: newRequesterId,
            assignedAgentAt: new Date(),
          },
        }
      );

      console.log(
        `[ORDER-REQUESTER-CHANGE] Updated ${updateResult.modifiedCount} leads from ${oldRequesterId} to ${newRequesterId}`
      );
    }

    res.json({
      success: true,
      message: "Requester changed successfully",
      order,
    });
  } catch (error) {
    console.error("Error changing requester:", error);
    next(error);
  }
};

// Add leads to an existing order (Admin only)
exports.addLeadsToOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { leads: leadsToAdd, reason } = req.body;
    // leadsToAdd is an array of { leadId, agentId, leadType }
    // reason is required - explains why leads are being added

    if (!leadsToAdd || !Array.isArray(leadsToAdd) || leadsToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one lead is required",
      });
    }

    // Reason is required
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason for adding leads is required",
      });
    }

    // Find the order
    const order = await Order.findById(orderId)
      .populate("selectedClientNetwork")
      .populate("selectedOurNetwork")
      .populate("selectedCampaign");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get existing lead IDs to check for duplicates
    const existingLeadIds = order.leads.map((id) => id.toString());

    // Validate all leads exist and are not archived
    const leadIds = leadsToAdd.map((l) => l.leadId);
    const foundLeads = await Lead.find({ _id: { $in: leadIds } });

    if (foundLeads.length !== leadIds.length) {
      const foundIds = foundLeads.map((l) => l._id.toString());
      const missingIds = leadIds.filter((id) => !foundIds.includes(id));
      return res.status(400).json({
        success: false,
        message: `Some leads not found: ${missingIds.join(", ")}`,
      });
    }

    // Check for archived leads
    const archivedLeads = foundLeads.filter((lead) => lead.isArchived === true);
    if (archivedLeads.length > 0) {
      const archivedNames = archivedLeads.map(
        (l) => `${l.firstName} ${l.lastName}`
      );
      return res.status(400).json({
        success: false,
        message: `Cannot add archived leads: ${archivedNames.join(", ")}`,
      });
    }

    // Check for duplicates (leads already in the order)
    const duplicateLeads = leadsToAdd.filter((l) =>
      existingLeadIds.includes(l.leadId)
    );
    if (duplicateLeads.length > 0) {
      const duplicateIds = duplicateLeads.map((l) => l.leadId);
      return res.status(400).json({
        success: false,
        message: `Some leads are already in this order: ${duplicateIds.join(", ")}`,
      });
    }

    // Check for cooldown on FTD/filler leads (10-day cooldown)
    // Admin users can bypass cooldown restriction
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin) {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const leadsOnCooldown = foundLeads.filter((lead) => {
        // Only FTD/filler leads have cooldown
        if (lead.leadType !== "ftd") return false;
        // Check if lead was used in order within the last 10 days
        return lead.lastUsedInOrder && lead.lastUsedInOrder > tenDaysAgo;
      });

      if (leadsOnCooldown.length > 0) {
        const cooldownDetails = leadsOnCooldown.map((lead) => {
          const daysRemaining = Math.ceil(
            (lead.lastUsedInOrder.getTime() + 10 * 24 * 60 * 60 * 1000 - Date.now()) /
              (24 * 60 * 60 * 1000)
          );
          return `${lead.firstName} ${lead.lastName} (${daysRemaining} days remaining)`;
        });
        return res.status(400).json({
          success: false,
          message: `Some FTD/filler leads are on cooldown: ${cooldownDetails.join(", ")}`,
          cooldownLeads: leadsOnCooldown.map((l) => l._id),
        });
      }
    }

    // Check client network conflicts - prevent reusing leads already assigned to the same client network
    if (order.selectedClientNetwork) {
      const networkId = order.selectedClientNetwork._id || order.selectedClientNetwork;
      const conflictingLeads = foundLeads.filter((lead) =>
        lead.isAssignedToClientNetwork(networkId)
      );
      if (conflictingLeads.length > 0) {
        const conflictNames = conflictingLeads.map(
          (l) => `${l.firstName} ${l.lastName} (${l.newEmail})`
        );
        return res.status(400).json({
          success: false,
          message: `Some leads were already used for this order's client network: ${conflictNames.join(", ")}`,
        });
      }
    }

    // Check client broker conflicts - prevent reusing leads already assigned to the same client brokers
    if (order.selectedClientBrokers && order.selectedClientBrokers.length > 0) {
      const brokerConflictLeads = foundLeads.filter((lead) =>
        order.selectedClientBrokers.some((brokerId) =>
          lead.isAssignedToClientBroker(brokerId._id || brokerId)
        )
      );
      if (brokerConflictLeads.length > 0) {
        const conflictNames = brokerConflictLeads.map(
          (l) => `${l.firstName} ${l.lastName} (${l.newEmail})`
        );
        return res.status(400).json({
          success: false,
          message: `Some leads were already assigned to this order's client brokers: ${conflictNames.join(", ")}`,
        });
      }
    }

    // Validate agents if provided
    const User = require("../models/User");
    const agentIds = [...new Set(leadsToAdd.filter((l) => l.agentId).map((l) => l.agentId))];
    if (agentIds.length > 0) {
      const foundAgents = await User.find({
        _id: { $in: agentIds },
        role: "agent",
      });

      if (foundAgents.length !== agentIds.length) {
        const foundAgentIds = foundAgents.map((a) => a._id.toString());
        const missingAgentIds = agentIds.filter(
          (id) => !foundAgentIds.includes(id)
        );
        return res.status(400).json({
          success: false,
          message: `Some agents not found: ${missingAgentIds.join(", ")}`,
        });
      }
    }

    // Create a map of leadId -> lead for easy lookup
    const leadMap = new Map(foundLeads.map((l) => [l._id.toString(), l]));

    // Track added counts by type
    const addedCounts = { ftd: 0, filler: 0, cold: 0 };

    // Get client IP address for audit logging
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';

    // Process each lead
    const updatePromises = leadsToAdd.map(async (leadData) => {
      const lead = leadMap.get(leadData.leadId);
      const leadType = leadData.leadType || lead.leadType;

      // Set the lead's orderId to link it to this order (for sorting/filtering on leads page)
      lead.orderId = order._id;

      // Update assigned agent if provided
      if (leadData.agentId) {
        lead.assignedAgent = leadData.agentId;
        lead.assignedAgentAt = new Date();
      }

      // Update lastUsedInOrder for cooldown tracking (FTD/filler leads have 10-day cooldown)
      if (leadType === "ftd" || leadType === "filler") {
        lead.lastUsedInOrder = new Date();
      }

      // Add client network to history if the order has one
      if (order.selectedClientNetwork) {
        if (!lead.clientNetworkHistory) {
          lead.clientNetworkHistory = [];
        }
        lead.clientNetworkHistory.push({
          clientNetwork: order.selectedClientNetwork._id,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          orderId: order._id,
        });
      }

      // Add our network to history if the order has one
      if (order.selectedOurNetwork) {
        if (!lead.ourNetworkHistory) {
          lead.ourNetworkHistory = [];
        }
        lead.ourNetworkHistory.push({
          ourNetwork: order.selectedOurNetwork._id,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          orderId: order._id,
        });
      }

      // Add client brokers to history if the order has any
      if (order.selectedClientBrokers && order.selectedClientBrokers.length > 0) {
        order.selectedClientBrokers.forEach((brokerId) => {
          if (!lead.assignedClientBrokers) {
            lead.assignedClientBrokers = [];
          }
          if (!lead.assignedClientBrokers.includes(brokerId)) {
            lead.assignedClientBrokers.push(brokerId);
          }
          if (!lead.clientBrokerHistory) {
            lead.clientBrokerHistory = [];
          }
          lead.clientBrokerHistory.push({
            clientBroker: brokerId,
            assignedAt: new Date(),
            assignedBy: req.user._id,
            orderId: order._id,
          });
        });
      }

      // Add campaign to history if the order has one
      if (order.selectedCampaign) {
        if (!lead.campaignHistory) {
          lead.campaignHistory = [];
        }
        lead.campaignHistory.push({
          campaign: order.selectedCampaign._id,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          orderId: order._id,
        });
      }

      // Track count by lead type
      if (addedCounts[leadType] !== undefined) {
        addedCounts[leadType]++;
      }

      return lead.save();
    });

    await Promise.all(updatePromises);

    // Update the order
    // Add leads to the order and create audit log entries
    if (!order.auditLog) {
      order.auditLog = [];
    }
    leadsToAdd.forEach((leadData) => {
      const lead = leadMap.get(leadData.leadId);
      const leadType = leadData.leadType || lead.leadType;
      order.leads.push(leadData.leadId);
      order.leadsMetadata.push({
        leadId: leadData.leadId,
        orderedAs: leadType,
      });

      // Add audit log entry for each lead added
      order.auditLog.push({
        action: "lead_added",
        leadId: lead._id,
        leadEmail: lead.email,
        performedBy: req.user._id,
        performedAt: new Date(),
        ipAddress: clientIp,
        details: `Lead ${lead.firstName} ${lead.lastName} (${lead.email}) added to order by ${req.user.fullName || req.user.email} as ${leadType}. Reason: ${reason}`,
        newValue: {
          leadType,
          agentId: leadData.agentId || null,
          leadName: `${lead.firstName} ${lead.lastName}`,
          reason: reason,
        },
      });
    });

    // Update requests and fulfilled counts
    order.requests.ftd = (order.requests.ftd || 0) + addedCounts.ftd;
    order.requests.filler = (order.requests.filler || 0) + addedCounts.filler;
    order.requests.cold = (order.requests.cold || 0) + addedCounts.cold;

    order.fulfilled.ftd = (order.fulfilled.ftd || 0) + addedCounts.ftd;
    order.fulfilled.filler = (order.fulfilled.filler || 0) + addedCounts.filler;
    order.fulfilled.cold = (order.fulfilled.cold || 0) + addedCounts.cold;

    // Update order status if it was partial or cancelled
    if (order.status === "partial" || order.status === "cancelled") {
      // Check if order is now fulfilled
      const totalRequested =
        (order.requests.ftd || 0) +
        (order.requests.filler || 0) +
        (order.requests.cold || 0);
      const totalFulfilled =
        (order.fulfilled.ftd || 0) +
        (order.fulfilled.filler || 0) +
        (order.fulfilled.cold || 0);

      if (totalFulfilled >= totalRequested) {
        order.status = "fulfilled";
        order.completedAt = new Date();
        order.partialFulfillmentReason = null;
      } else if (totalFulfilled > 0 && order.status === "cancelled") {
        order.status = "partial";
      }
    }

    await order.save();

    // Populate the order for response
    const populatedOrder = await Order.findById(order._id)
      .populate("leads", "firstName lastName newEmail newPhone country leadType")
      .populate("requester", "fullName email")
      .populate("selectedClientNetwork", "name")
      .populate("selectedOurNetwork", "name")
      .populate("selectedCampaign", "name");

    const resultOrder = mergeLeadsWithMetadata(populatedOrder);

    console.log(
      `[ORDER-ADD-LEADS] Added ${leadsToAdd.length} leads to order ${orderId}:`,
      addedCounts
    );

    res.json({
      success: true,
      message: `Successfully added ${leadsToAdd.length} lead(s) to order`,
      data: resultOrder,
      addedCounts,
    });
  } catch (error) {
    console.error("Error adding leads to order:", error);
    next(error);
  }
};

/**
 * Get available leads for replacement in an order
 * Returns leads filtered by: same country as order, same lead type, not in cooldown (for FTD/Filler), not archived/inactive
 * GET /:orderId/leads/:leadId/available-replacements
 */
exports.getAvailableLeadsForReplacement = async (req, res, next) => {
  try {
    const { orderId, leadId } = req.params;
    const { search, page = 1, limit = 20 } = req.query;

    // Check user permissions - only admin and affiliate_manager
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can replace leads.",
      });
    }

    // Find the order
    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // For affiliate managers, ensure they can only access their own orders
    if (req.user.role === "affiliate_manager") {
      if (order.requester.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only replace leads in your own orders.",
        });
      }
    }

    // Find the lead being replaced
    const Lead = require("../models/Lead");
    const leadToReplace = await Lead.findById(leadId);
    if (!leadToReplace) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if lead is in the order
    const leadInOrder = order.leads.some((id) => id.toString() === leadId);
    if (!leadInOrder) {
      return res.status(400).json({
        success: false,
        message: "Lead is not in this order",
      });
    }

    // Get the orderedAs type from leadsMetadata
    const leadMetadata = order.leadsMetadata?.find(
      (meta) => meta.leadId.toString() === leadId
    );
    const orderedAs = leadMetadata?.orderedAs || leadToReplace.leadType;

    // Get replacement history to exclude previously used leads
    const replacementHistory = leadMetadata?.replacementHistory || [];

    // Build list of leads to exclude: current order leads + replacement history
    const orderLeadIds = order.leads.map((id) => id.toString());
    const removedLeadIds = order.removedLeads?.map((rl) =>
      (rl.leadId?._id || rl.leadId).toString()
    ) || [];
    const leadsToExclude = [
      ...orderLeadIds,
      ...removedLeadIds,
      ...replacementHistory.map((id) => id.toString()),
    ];

    // Build base query
    const baseQuery = {
      country: order.countryFilter,
      isArchived: { $ne: true },
      status: { $ne: "inactive" },
      _id: { $nin: leadsToExclude.map((id) => new mongoose.Types.ObjectId(id)) },
    };

    // Determine leadType to search for based on orderedAs
    // Note: Filler leads are stored as leadType: "ftd" with orderedAs: "filler"
    if (orderedAs === "ftd" || orderedAs === "filler") {
      baseQuery.leadType = "ftd";
      // Apply 10-day cooldown for FTD/Filler leads
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      baseQuery.$or = [
        { lastUsedInOrder: null },
        { lastUsedInOrder: { $exists: false } },
        { lastUsedInOrder: { $lte: tenDaysAgo } },
      ];
    } else if (orderedAs === "cold") {
      baseQuery.leadType = "cold";
      // Cold leads have NO cooldown
    } else {
      // Fallback to original lead type
      baseQuery.leadType = leadToReplace.leadType;
    }

    // Client network exclusion - prevent leads already assigned to the same client network
    if (order.selectedClientNetwork) {
      const networkId = new mongoose.Types.ObjectId(
        order.selectedClientNetwork._id || order.selectedClientNetwork
      );
      baseQuery.$and = baseQuery.$and || [];
      baseQuery.$and.push({
        $or: [
          { clientNetworkHistory: { $exists: false } },
          { clientNetworkHistory: { $size: 0 } },
          {
            clientNetworkHistory: {
              $not: {
                $elemMatch: {
                  clientNetwork: networkId,
                },
              },
            },
          },
        ],
      });
    }

    // Client broker exclusion - prevent leads already assigned to the same client brokers
    if (order.selectedClientBrokers && order.selectedClientBrokers.length > 0) {
      const brokerObjectIds = order.selectedClientBrokers.map(
        (id) => new mongoose.Types.ObjectId(id._id || id)
      );
      baseQuery.assignedClientBrokers = { $nin: brokerObjectIds };
    }

    // Add search filter if provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      baseQuery.$and = baseQuery.$and || [];
      baseQuery.$and.push({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { newEmail: searchRegex },
          { newPhone: searchRegex },
        ],
      });
    }

    // Count total matching leads
    const total = await Lead.countDocuments(baseQuery);

    // Fetch paginated leads
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const leads = await Lead.find(baseQuery)
      .populate("assignedAgent", "fullName email fourDigitCode")
      .select("firstName lastName newEmail newPhone country leadType assignedAgent lastUsedInOrder")
      .sort({ firstName: 1, lastName: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add cooldown info to each lead
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const leadsWithCooldownInfo = leads.map((lead) => {
      const isOnCooldown = lead.lastUsedInOrder && lead.lastUsedInOrder > tenDaysAgo;
      let cooldownDaysRemaining = 0;
      if (isOnCooldown) {
        const cooldownEnd = new Date(lead.lastUsedInOrder.getTime() + 10 * 24 * 60 * 60 * 1000);
        cooldownDaysRemaining = Math.ceil((cooldownEnd - new Date()) / (24 * 60 * 60 * 1000));
      }
      return {
        ...lead,
        isOnCooldown,
        cooldownDaysRemaining,
      };
    });

    res.json({
      success: true,
      data: leadsWithCooldownInfo,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      context: {
        orderId,
        leadIdBeingReplaced: leadId,
        orderedAs,
        countryFilter: order.countryFilter,
      },
    });
  } catch (error) {
    console.error("Error getting available leads for replacement:", error);
    next(error);
  }
};

/**
 * Replace a lead in an order with a specific selected lead
 * POST /:orderId/leads/:leadId/replace
 */
exports.replaceLeadInOrder = async (req, res, next) => {
  try {
    const { orderId, leadId } = req.params;
    const { newLeadId, reason } = req.body;

    console.log(`[REPLACE-LEAD] Starting lead replacement: order=${orderId}, oldLead=${leadId}, newLead=${newLeadId}`);

    // Reason is required
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason for replacing lead is required",
      });
    }

    // Check user permissions - only admin and affiliate_manager
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can replace leads.",
      });
    }

    // Find the order
    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // For affiliate managers, ensure they can only modify their own orders
    if (req.user.role === "affiliate_manager") {
      if (order.requester.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only replace leads in your own orders.",
        });
      }
    }

    // Find the old lead
    const Lead = require("../models/Lead");
    const oldLead = await Lead.findById(leadId);
    if (!oldLead) {
      return res.status(404).json({
        success: false,
        message: "Lead to replace not found",
      });
    }

    // Check if old lead is in the order
    const leadInOrder = order.leads.some((id) => id.toString() === leadId);
    if (!leadInOrder) {
      return res.status(400).json({
        success: false,
        message: "Lead is not in this order",
      });
    }

    // Find the new lead
    const newLead = await Lead.findById(newLeadId);
    if (!newLead) {
      return res.status(404).json({
        success: false,
        message: "Replacement lead not found",
      });
    }

    // Validate new lead is not already in the order
    if (order.leads.some((id) => id.toString() === newLeadId)) {
      return res.status(400).json({
        success: false,
        message: "Replacement lead is already in this order",
      });
    }

    // Validate new lead is not archived or inactive
    if (newLead.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Cannot use an archived lead as replacement",
      });
    }
    if (newLead.status === "inactive") {
      return res.status(400).json({
        success: false,
        message: "Cannot use an inactive lead as replacement",
      });
    }

    // Get the orderedAs type from leadsMetadata
    const leadMetadataIndex = order.leadsMetadata?.findIndex(
      (meta) => meta.leadId.toString() === leadId
    );
    const leadMetadata = leadMetadataIndex !== -1 ? order.leadsMetadata[leadMetadataIndex] : null;
    const orderedAs = leadMetadata?.orderedAs || oldLead.leadType;

    // Validate new lead matches required criteria
    // Same country as order
    if (newLead.country !== order.countryFilter) {
      return res.status(400).json({
        success: false,
        message: `Replacement lead must be from the same country (${order.countryFilter})`,
      });
    }

    // Same lead type (ftd for ftd/filler, cold for cold)
    const expectedLeadType = (orderedAs === "ftd" || orderedAs === "filler") ? "ftd" : orderedAs;
    if (newLead.leadType !== expectedLeadType) {
      return res.status(400).json({
        success: false,
        message: `Replacement lead must be of type ${expectedLeadType}`,
      });
    }

    // Check cooldown for FTD/Filler leads
    if (orderedAs === "ftd" || orderedAs === "filler") {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      if (newLead.lastUsedInOrder && newLead.lastUsedInOrder > tenDaysAgo) {
        const cooldownEnd = new Date(newLead.lastUsedInOrder.getTime() + 10 * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.ceil((cooldownEnd - new Date()) / (24 * 60 * 60 * 1000));
        return res.status(400).json({
          success: false,
          message: `Replacement lead is on cooldown. ${daysRemaining} day(s) remaining.`,
        });
      }
    }

    // Check replacement history to prevent reusing previously swapped leads
    const replacementHistory = leadMetadata?.replacementHistory || [];
    if (replacementHistory.some((id) => id.toString() === newLeadId)) {
      return res.status(400).json({
        success: false,
        message: "This lead was previously used in this position and cannot be used again",
      });
    }

    // Check client network conflict - prevent reusing leads already assigned to the same client network
    if (order.selectedClientNetwork) {
      const networkId = order.selectedClientNetwork._id || order.selectedClientNetwork;
      if (newLead.isAssignedToClientNetwork(networkId)) {
        const ClientNetwork = require("../models/ClientNetwork");
        const network = await ClientNetwork.findById(networkId).select("name");
        return res.status(400).json({
          success: false,
          message: `Replacement lead "${newLead.firstName} ${newLead.lastName}" was already used for client network "${network?.name || 'Unknown'}". Cannot reuse the same lead for the same client network.`,
        });
      }
    }

    // Check client broker conflict - prevent reusing leads already assigned to the same client brokers
    if (order.selectedClientBrokers && order.selectedClientBrokers.length > 0) {
      const conflictingBroker = order.selectedClientBrokers.find((brokerId) =>
        newLead.isAssignedToClientBroker(brokerId._id || brokerId)
      );
      if (conflictingBroker) {
        return res.status(400).json({
          success: false,
          message: `Replacement lead "${newLead.firstName} ${newLead.lastName}" was already assigned to one of the order's client brokers. Cannot reuse the same lead for the same broker.`,
        });
      }
    }

    // Get client IP for audit log
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';

    // Start transaction to replace the lead
    const session = await Lead.startSession();
    await session.withTransaction(async () => {
      // Reset the old lead
      oldLead.orderId = undefined;
      oldLead.createdBy = undefined;
      // Clear cooldown for replaced lead (allows immediate reuse)
      oldLead.lastUsedInOrder = undefined;

      // Remove assignment histories from old lead that were inherited from this order
      const orderIdStr = orderId.toString();

      // Remove client network history entries for this order
      if (oldLead.clientNetworkHistory && oldLead.clientNetworkHistory.length > 0) {
        oldLead.clientNetworkHistory = oldLead.clientNetworkHistory.filter(
          (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
        );
      }

      // Remove our network history entries for this order
      if (oldLead.ourNetworkHistory && oldLead.ourNetworkHistory.length > 0) {
        oldLead.ourNetworkHistory = oldLead.ourNetworkHistory.filter(
          (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
        );
      }

      // Remove campaign history entries for this order
      if (oldLead.campaignHistory && oldLead.campaignHistory.length > 0) {
        oldLead.campaignHistory = oldLead.campaignHistory.filter(
          (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
        );
      }

      // Remove client broker history entries for this order and update assignedClientBrokers
      if (oldLead.clientBrokerHistory && oldLead.clientBrokerHistory.length > 0) {
        const brokerIdsFromThisOrder = oldLead.clientBrokerHistory
          .filter((entry) => entry.orderId && entry.orderId.toString() === orderIdStr)
          .map((entry) => entry.clientBroker.toString());

        oldLead.clientBrokerHistory = oldLead.clientBrokerHistory.filter(
          (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
        );

        if (oldLead.assignedClientBrokers && brokerIdsFromThisOrder.length > 0) {
          const remainingBrokerIds = new Set(
            oldLead.clientBrokerHistory.map((entry) => entry.clientBroker.toString())
          );
          oldLead.assignedClientBrokers = oldLead.assignedClientBrokers.filter(
            (brokerId) => remainingBrokerIds.has(brokerId.toString())
          );
        }
      }

      console.log(`[REPLACE-LEAD] Removed order-specific assignment histories from old lead ${leadId}`);

      // Assign new lead to order
      newLead.orderId = orderId;
      newLead.createdBy = req.user._id;

      // Update lastUsedInOrder for FTD/Filler leads (starts 10-day cooldown)
      if (orderedAs === "ftd" || orderedAs === "filler") {
        newLead.lastUsedInOrder = new Date();
      }

      // Add network/campaign assignments from order to new lead
      if (order.selectedCampaign) {
        newLead.addCampaignAssignment(order.selectedCampaign, req.user._id, orderId);
      }
      if (order.selectedClientNetwork) {
        newLead.addClientNetworkAssignment(order.selectedClientNetwork, req.user._id, orderId);
      }
      if (order.selectedOurNetwork) {
        newLead.addOurNetworkAssignment(order.selectedOurNetwork, req.user._id, orderId);
      }

      // Add audit log entry
      if (!order.auditLog) {
        order.auditLog = [];
      }
      order.auditLog.push({
        action: "lead_replaced",
        leadId: newLead._id,
        leadEmail: newLead.newEmail,
        performedBy: req.user._id,
        performedAt: new Date(),
        ipAddress: clientIp,
        details: `Lead manually replaced: ${oldLead.firstName} ${oldLead.lastName} (${oldLead.newEmail}) replaced with ${newLead.firstName} ${newLead.lastName} (${newLead.newEmail}) by ${req.user.fullName || req.user.email}. Reason: ${reason}`,
        previousValue: {
          leadId: oldLead._id,
          leadEmail: oldLead.newEmail,
          leadName: `${oldLead.firstName} ${oldLead.lastName}`,
          leadType: orderedAs,
        },
        newValue: {
          leadId: newLead._id,
          leadEmail: newLead.newEmail,
          leadName: `${newLead.firstName} ${newLead.lastName}`,
          leadType: orderedAs,
          reason: reason,
        },
      });

      // Save leads
      await oldLead.save({ session });
      await newLead.save({ session });

      // Update order.leads array
      const leadIndex = order.leads.findIndex((id) => id.toString() === leadId);
      if (leadIndex !== -1) {
        order.leads[leadIndex] = newLead._id;
      }

      // Update leadsMetadata
      if (leadMetadataIndex !== -1 && order.leadsMetadata) {
        // Add old lead to replacement history
        if (!order.leadsMetadata[leadMetadataIndex].replacementHistory) {
          order.leadsMetadata[leadMetadataIndex].replacementHistory = [];
        }
        order.leadsMetadata[leadMetadataIndex].replacementHistory.push(oldLead._id);

        // Update leadId to new lead (preserve orderedAs)
        order.leadsMetadata[leadMetadataIndex].leadId = newLead._id;
      }

      await order.save({ session });
    });

    await session.endSession();

    console.log(`[REPLACE-LEAD] Successfully replaced lead ${leadId} with ${newLeadId} in order ${orderId}`);

    // Populate the order for response
    const populatedOrder = await Order.findById(orderId)
      .populate("leads", "firstName lastName newEmail newPhone country leadType assignedAgent depositConfirmed shaved")
      .populate({
        path: "leads",
        populate: { path: "assignedAgent", select: "fullName email fourDigitCode" }
      })
      .populate("requester", "fullName email")
      .populate("selectedClientNetwork", "name")
      .populate("selectedOurNetwork", "name")
      .populate("selectedCampaign", "name")
      .lean();

    res.json({
      success: true,
      message: "Lead successfully replaced",
      data: {
        order: populatedOrder,
        oldLead: {
          _id: oldLead._id,
          firstName: oldLead.firstName,
          lastName: oldLead.lastName,
          newEmail: oldLead.newEmail,
          newPhone: oldLead.newPhone,
        },
        newLead: {
          _id: newLead._id,
          firstName: newLead.firstName,
          lastName: newLead.lastName,
          newEmail: newLead.newEmail,
          newPhone: newLead.newPhone,
          assignedAgent: newLead.assignedAgent,
        },
        orderedAs,
      },
    });
  } catch (error) {
    console.error("Error replacing lead in order:", error);
    next(error);
  }
};

/**
 * Restore a removed lead back to an order (undo removal)
 * POST /:orderId/leads/:leadId/restore
 */
exports.restoreLeadToOrder = async (req, res, next) => {
  try {
    const { orderId, leadId } = req.params;

    console.log(`[RESTORE-LEAD] Starting lead restoration: order=${orderId}, lead=${leadId}`);

    // Check user permissions - only admin and affiliate_manager
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can restore leads.",
      });
    }

    // Find the order with populated selections for re-adding assignments
    const Order = require("../models/Order");
    const order = await Order.findById(orderId)
      .populate("selectedClientNetwork")
      .populate("selectedOurNetwork")
      .populate("selectedCampaign");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // For affiliate managers, ensure they can only modify their own orders
    if (req.user.role === "affiliate_manager") {
      if (order.requester.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only restore leads in your own orders.",
        });
      }
    }

    // Find the removed lead entry
    const removedIndex = order.removedLeads?.findIndex(
      (rl) => rl.leadId.toString() === leadId
    );
    if (removedIndex === -1 || removedIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "Lead was not found in the removed leads list",
      });
    }

    const removedEntry = order.removedLeads[removedIndex];

    // Find the lead
    const Lead = require("../models/Lead");
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Get client IP for audit log
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';

    // Restore the lead
    lead.orderId = orderId;
    lead.createdBy = req.user._id;

    // Set lastUsedInOrder for FTD/Filler leads (restarts cooldown)
    const leadType = removedEntry.leadType || lead.leadType;
    if (leadType === "ftd" || leadType === "filler") {
      lead.lastUsedInOrder = new Date();
    }

    // Re-add assignment histories from the order (restore inherited assignments)
    // Add client network to history if the order has one
    if (order.selectedClientNetwork) {
      if (!lead.clientNetworkHistory) {
        lead.clientNetworkHistory = [];
      }
      lead.clientNetworkHistory.push({
        clientNetwork: order.selectedClientNetwork._id,
        assignedAt: new Date(),
        assignedBy: req.user._id,
        orderId: order._id,
      });
    }

    // Add our network to history if the order has one
    if (order.selectedOurNetwork) {
      if (!lead.ourNetworkHistory) {
        lead.ourNetworkHistory = [];
      }
      lead.ourNetworkHistory.push({
        ourNetwork: order.selectedOurNetwork._id,
        assignedAt: new Date(),
        assignedBy: req.user._id,
        orderId: order._id,
      });
    }

    // Add client brokers to history if the order has any
    if (order.selectedClientBrokers && order.selectedClientBrokers.length > 0) {
      order.selectedClientBrokers.forEach((brokerId) => {
        if (!lead.assignedClientBrokers) {
          lead.assignedClientBrokers = [];
        }
        if (!lead.assignedClientBrokers.some((id) => id.toString() === brokerId.toString())) {
          lead.assignedClientBrokers.push(brokerId);
        }
        if (!lead.clientBrokerHistory) {
          lead.clientBrokerHistory = [];
        }
        lead.clientBrokerHistory.push({
          clientBroker: brokerId,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          orderId: order._id,
        });
      });
    }

    // Add campaign to history if the order has one
    if (order.selectedCampaign) {
      if (!lead.campaignHistory) {
        lead.campaignHistory = [];
      }
      lead.campaignHistory.push({
        campaign: order.selectedCampaign._id,
        assignedAt: new Date(),
        assignedBy: req.user._id,
        orderId: order._id,
      });
    }

    console.log(`[RESTORE-LEAD] Re-added order assignment histories to lead ${leadId}`);

    // Remove from removedLeads array
    order.removedLeads.splice(removedIndex, 1);

    // Update fulfilled counts
    if (!order.fulfilled) {
      order.fulfilled = { ftd: 0, filler: 0, cold: 0 };
    }
    order.fulfilled[leadType] = (order.fulfilled[leadType] || 0) + 1;

    // Update order status
    const totalFulfilled =
      (order.fulfilled?.ftd || 0) +
      (order.fulfilled?.filler || 0) +
      (order.fulfilled?.cold || 0);
    const totalRequested =
      (order.requests?.ftd || 0) +
      (order.requests?.filler || 0) +
      (order.requests?.cold || 0);

    if (totalFulfilled >= totalRequested) {
      order.status = "fulfilled";
      order.cancelledAt = undefined;
      order.cancellationReason = undefined;
    } else if (totalFulfilled > 0) {
      order.status = "partial";
      order.cancelledAt = undefined;
      order.cancellationReason = undefined;
    }

    // Add audit log entry
    if (!order.auditLog) {
      order.auditLog = [];
    }
    order.auditLog.push({
      action: "lead_restored",
      leadId: lead._id,
      leadEmail: lead.newEmail,
      performedBy: req.user._id,
      performedAt: new Date(),
      ipAddress: clientIp,
      details: `Lead ${lead.firstName} ${lead.lastName} (${lead.newEmail}) restored to order by ${req.user.fullName || req.user.email}`,
      previousValue: {
        removedReason: removedEntry.reason,
        removedAt: removedEntry.removedAt,
      },
    });

    // Save both documents
    await Promise.all([lead.save(), order.save()]);

    // Populate the updated order for response
    await order.populate([
      { path: "requester", select: "fullName email role" },
      {
        path: "leads",
        select:
          "leadType orderedAs firstName lastName country email phone orderId assignedAgent assignedAgentAt newPhone newEmail depositConfirmed isShaved ipqsValidation",
        populate: {
          path: "assignedAgent",
          select: "fullName email fourDigitCode",
        },
      },
      { path: "removedLeads.removedBy", select: "fullName email" },
    ]);

    console.log(`[RESTORE-LEAD] Successfully restored lead ${leadId} to order ${orderId}`);

    res.status(200).json({
      success: true,
      message: `Lead ${lead.firstName} ${lead.lastName} has been restored to the order`,
      data: {
        order,
        restoredLead: {
          _id: lead._id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          newEmail: lead.newEmail,
          leadType: leadType,
        },
      },
    });
  } catch (error) {
    console.error("Error restoring lead to order:", error);
    next(error);
  }
};

/**
 * Undo a lead replacement (swap back to the previous lead)
 * POST /:orderId/leads/:newLeadId/undo-replace
 */
exports.undoLeadReplacement = async (req, res, next) => {
  try {
    const { orderId, newLeadId } = req.params;
    const { oldLeadId } = req.body;

    console.log(`[UNDO-REPLACE] Starting undo replacement: order=${orderId}, newLead=${newLeadId}, oldLead=${oldLeadId}`);

    if (!oldLeadId) {
      return res.status(400).json({
        success: false,
        message: "oldLeadId is required to undo the replacement",
      });
    }

    // Check user permissions - only admin and affiliate_manager
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can undo replacements.",
      });
    }

    // Find the order with populated selections for re-adding assignments
    const Order = require("../models/Order");
    const order = await Order.findById(orderId)
      .populate("selectedClientNetwork")
      .populate("selectedOurNetwork")
      .populate("selectedCampaign");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // For affiliate managers, ensure they can only modify their own orders
    if (req.user.role === "affiliate_manager") {
      if (order.requester.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only undo replacements in your own orders.",
        });
      }
    }

    // Check if new lead is in the order
    const leadInOrder = order.leads.some((id) => id.toString() === newLeadId);
    if (!leadInOrder) {
      return res.status(400).json({
        success: false,
        message: "The replacement lead is not in this order (may have already been undone)",
      });
    }

    // Find both leads
    const Lead = require("../models/Lead");
    const [newLead, oldLead] = await Promise.all([
      Lead.findById(newLeadId),
      Lead.findById(oldLeadId),
    ]);

    if (!newLead) {
      return res.status(404).json({
        success: false,
        message: "Current lead not found",
      });
    }
    if (!oldLead) {
      return res.status(404).json({
        success: false,
        message: "Original lead not found",
      });
    }

    // Check if old lead is already assigned to another order
    if (oldLead.orderId && oldLead.orderId.toString() !== orderId) {
      return res.status(400).json({
        success: false,
        message: "Original lead has already been assigned to another order and cannot be restored",
      });
    }

    // Get the metadata for the lead position
    const leadMetadataIndex = order.leadsMetadata?.findIndex(
      (meta) => meta.leadId.toString() === newLeadId
    );
    const leadMetadata = leadMetadataIndex !== -1 ? order.leadsMetadata[leadMetadataIndex] : null;
    const orderedAs = leadMetadata?.orderedAs || newLead.leadType;

    // Verify old lead is in replacement history
    const replacementHistory = leadMetadata?.replacementHistory || [];
    if (!replacementHistory.some((id) => id.toString() === oldLeadId)) {
      return res.status(400).json({
        success: false,
        message: "Original lead is not found in the replacement history for this position",
      });
    }

    // Get client IP for audit log
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';

    // Start transaction
    const session = await Lead.startSession();
    await session.withTransaction(async () => {
      const orderIdStr = orderId.toString();

      // Reset the new lead (current one)
      newLead.orderId = undefined;
      newLead.createdBy = undefined;
      newLead.lastUsedInOrder = undefined;

      // Remove assignment histories from new lead that were inherited from this order
      if (newLead.clientNetworkHistory && newLead.clientNetworkHistory.length > 0) {
        newLead.clientNetworkHistory = newLead.clientNetworkHistory.filter(
          (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
        );
      }
      if (newLead.ourNetworkHistory && newLead.ourNetworkHistory.length > 0) {
        newLead.ourNetworkHistory = newLead.ourNetworkHistory.filter(
          (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
        );
      }
      if (newLead.campaignHistory && newLead.campaignHistory.length > 0) {
        newLead.campaignHistory = newLead.campaignHistory.filter(
          (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
        );
      }
      if (newLead.clientBrokerHistory && newLead.clientBrokerHistory.length > 0) {
        const brokerIdsFromThisOrder = newLead.clientBrokerHistory
          .filter((entry) => entry.orderId && entry.orderId.toString() === orderIdStr)
          .map((entry) => entry.clientBroker.toString());

        newLead.clientBrokerHistory = newLead.clientBrokerHistory.filter(
          (entry) => !entry.orderId || entry.orderId.toString() !== orderIdStr
        );

        if (newLead.assignedClientBrokers && brokerIdsFromThisOrder.length > 0) {
          const remainingBrokerIds = new Set(
            newLead.clientBrokerHistory.map((entry) => entry.clientBroker.toString())
          );
          newLead.assignedClientBrokers = newLead.assignedClientBrokers.filter(
            (brokerId) => remainingBrokerIds.has(brokerId.toString())
          );
        }
      }

      // Restore the old lead
      oldLead.orderId = orderId;
      oldLead.createdBy = req.user._id;
      if (orderedAs === "ftd" || orderedAs === "filler") {
        oldLead.lastUsedInOrder = new Date();
      }

      // Re-add assignment histories to old lead from the order
      if (order.selectedClientNetwork) {
        if (!oldLead.clientNetworkHistory) {
          oldLead.clientNetworkHistory = [];
        }
        oldLead.clientNetworkHistory.push({
          clientNetwork: order.selectedClientNetwork._id,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          orderId: order._id,
        });
      }
      if (order.selectedOurNetwork) {
        if (!oldLead.ourNetworkHistory) {
          oldLead.ourNetworkHistory = [];
        }
        oldLead.ourNetworkHistory.push({
          ourNetwork: order.selectedOurNetwork._id,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          orderId: order._id,
        });
      }
      if (order.selectedClientBrokers && order.selectedClientBrokers.length > 0) {
        order.selectedClientBrokers.forEach((brokerId) => {
          if (!oldLead.assignedClientBrokers) {
            oldLead.assignedClientBrokers = [];
          }
          if (!oldLead.assignedClientBrokers.some((id) => id.toString() === brokerId.toString())) {
            oldLead.assignedClientBrokers.push(brokerId);
          }
          if (!oldLead.clientBrokerHistory) {
            oldLead.clientBrokerHistory = [];
          }
          oldLead.clientBrokerHistory.push({
            clientBroker: brokerId,
            assignedAt: new Date(),
            assignedBy: req.user._id,
            orderId: order._id,
          });
        });
      }
      if (order.selectedCampaign) {
        if (!oldLead.campaignHistory) {
          oldLead.campaignHistory = [];
        }
        oldLead.campaignHistory.push({
          campaign: order.selectedCampaign._id,
          assignedAt: new Date(),
          assignedBy: req.user._id,
          orderId: order._id,
        });
      }

      console.log(`[UNDO-REPLACE] Transferred assignment histories from new lead ${newLeadId} to old lead ${oldLeadId}`);

      // Add audit log entry
      if (!order.auditLog) {
        order.auditLog = [];
      }
      order.auditLog.push({
        action: "lead_replacement_undone",
        leadId: oldLead._id,
        leadEmail: oldLead.newEmail,
        performedBy: req.user._id,
        performedAt: new Date(),
        ipAddress: clientIp,
        details: `Lead replacement undone: ${newLead.firstName} ${newLead.lastName} (${newLead.newEmail}) replaced back with ${oldLead.firstName} ${oldLead.lastName} (${oldLead.newEmail}) by ${req.user.fullName || req.user.email}`,
        previousValue: {
          leadId: newLead._id,
          leadEmail: newLead.newEmail,
          leadName: `${newLead.firstName} ${newLead.lastName}`,
        },
        newValue: {
          leadId: oldLead._id,
          leadEmail: oldLead.newEmail,
          leadName: `${oldLead.firstName} ${oldLead.lastName}`,
        },
      });

      // Save leads
      await newLead.save({ session });
      await oldLead.save({ session });

      // Update order.leads array
      const leadIndex = order.leads.findIndex((id) => id.toString() === newLeadId);
      if (leadIndex !== -1) {
        order.leads[leadIndex] = oldLead._id;
      }

      // Update leadsMetadata - remove old lead from replacement history and update leadId
      if (leadMetadataIndex !== -1 && order.leadsMetadata) {
        // Remove old lead from replacement history
        order.leadsMetadata[leadMetadataIndex].replacementHistory =
          order.leadsMetadata[leadMetadataIndex].replacementHistory.filter(
            (id) => id.toString() !== oldLeadId
          );
        // Add new lead to history (the one we're removing)
        order.leadsMetadata[leadMetadataIndex].replacementHistory.push(newLead._id);
        // Update leadId back to old lead
        order.leadsMetadata[leadMetadataIndex].leadId = oldLead._id;
      }

      await order.save({ session });
    });

    await session.endSession();

    console.log(`[UNDO-REPLACE] Successfully undid replacement in order ${orderId}`);

    // Populate the order for response
    const populatedOrder = await Order.findById(orderId)
      .populate("leads", "firstName lastName newEmail newPhone country leadType assignedAgent depositConfirmed shaved ipqsValidation")
      .populate({
        path: "leads",
        populate: { path: "assignedAgent", select: "fullName email fourDigitCode" }
      })
      .populate("requester", "fullName email")
      .populate("selectedClientNetwork", "name")
      .populate("selectedOurNetwork", "name")
      .populate("selectedCampaign", "name")
      .lean();

    res.json({
      success: true,
      message: "Lead replacement has been undone",
      data: {
        order: populatedOrder,
        restoredLead: {
          _id: oldLead._id,
          firstName: oldLead.firstName,
          lastName: oldLead.lastName,
          newEmail: oldLead.newEmail,
          newPhone: oldLead.newPhone,
        },
        removedLead: {
          _id: newLead._id,
          firstName: newLead.firstName,
          lastName: newLead.lastName,
          newEmail: newLead.newEmail,
          newPhone: newLead.newPhone,
        },
        orderedAs,
      },
    });
  } catch (error) {
    console.error("Error undoing lead replacement:", error);
    next(error);
  }
};

/**
 * Validate leads in an order using IPQS (IP Quality Score)
 * Only validates leads that haven't been validated yet (one-time validation)
 * @route POST /api/orders/:orderId/validate-leads
 * @access Protected (Manager)
 */
exports.validateOrderLeadsIPQS = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const ipqsService = require("../services/ipqsService");

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    // Find the order with populated leads
    const order = await Order.findById(orderId)
      .populate("leads", "firstName lastName newEmail newPhone country leadType ipqsValidation")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!order.leads || order.leads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order has no leads to validate",
      });
    }

    // Filter leads that need validation (only unvalidated leads)
    const leadsToValidate = ipqsService.getUnvalidatedLeads(order.leads);
    const alreadyValidatedLeads = order.leads.filter(lead => ipqsService.isLeadValidated(lead));

    if (leadsToValidate.length === 0) {
      // All leads already validated - return existing results
      const results = order.leads.map((lead) => ({
        leadId: lead._id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        newEmail: lead.newEmail,
        newPhone: lead.newPhone,
        country: lead.country,
        leadType: lead.leadType,
        email: lead.ipqsValidation?.email,
        phone: lead.ipqsValidation?.phone,
        summary: lead.ipqsValidation?.summary,
        validatedAt: lead.ipqsValidation?.validatedAt,
        alreadyValidated: true,
      }));

      // Calculate statistics from existing data
      const stats = calculateIPQSStats(results);

      return res.json({
        success: true,
        message: "All leads already validated",
        data: {
          orderId: orderId,
          results: results,
          stats: stats,
          validatedAt: order.leads[0]?.ipqsValidation?.validatedAt,
          allAlreadyValidated: true,
        },
      });
    }

    console.log(`[IPQS] Starting validation for order ${orderId}: ${leadsToValidate.length} new leads (${alreadyValidatedLeads.length} already validated)`);

    // Validate only the unvalidated leads
    const validationResults = await ipqsService.validateOrderLeads(leadsToValidate);

    // Process results and add summaries
    const newResultsWithSummary = validationResults.map((result) => {
      const summary = ipqsService.getValidationSummary(result.email, result.phone);
      return {
        ...result,
        summary,
      };
    });

    // Update newly validated leads in database
    const bulkOps = newResultsWithSummary.map((result) => ({
      updateOne: {
        filter: { _id: result.leadId },
        update: {
          $set: {
            ipqsValidation: {
              email: result.email,
              phone: result.phone,
              summary: result.summary,
              validatedAt: result.validatedAt,
            },
          },
        },
      },
    }));

    if (bulkOps.length > 0) {
      await Lead.bulkWrite(bulkOps);
    }

    // Combine new results with already validated leads for complete response
    const allResults = [
      ...alreadyValidatedLeads.map((lead) => ({
        leadId: lead._id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        newEmail: lead.newEmail,
        newPhone: lead.newPhone,
        country: lead.country,
        leadType: lead.leadType,
        email: lead.ipqsValidation?.email,
        phone: lead.ipqsValidation?.phone,
        summary: lead.ipqsValidation?.summary,
        validatedAt: lead.ipqsValidation?.validatedAt,
        alreadyValidated: true,
      })),
      ...newResultsWithSummary.map((result) => ({
        ...result,
        alreadyValidated: false,
      })),
    ];

    // Calculate statistics
    const stats = calculateIPQSStats(allResults);

    console.log(`[IPQS] Validation completed for order ${orderId}: ${newResultsWithSummary.length} newly validated`);

    res.json({
      success: true,
      message: `Validated ${newResultsWithSummary.length} new leads (${alreadyValidatedLeads.length} already validated)`,
      data: {
        orderId: orderId,
        results: allResults,
        stats: stats,
        validatedAt: new Date(),
        newlyValidated: newResultsWithSummary.length,
        alreadyValidated: alreadyValidatedLeads.length,
      },
    });
  } catch (error) {
    console.error("Error validating order leads with IPQS:", error);
    next(error);
  }
};

/**
 * Validate a single lead using IPQS
 * Used when a lead is added or replaced in an order
 * @route POST /api/orders/:orderId/leads/:leadId/validate-ipqs
 * @query force - If true, revalidate even if already validated (for manual recheck)
 * @access Protected (Manager)
 */
exports.validateSingleLeadIPQS = async (req, res, next) => {
  try {
    const { orderId, leadId } = req.params;
    const { force } = req.query;
    const ipqsService = require("../services/ipqsService");

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID or lead ID format",
      });
    }

    // Find the order
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify lead is in the order
    const isLeadInOrder = order.leads.some(lid => lid.toString() === leadId);
    if (!isLeadInOrder) {
      return res.status(400).json({
        success: false,
        message: "Lead is not in this order",
      });
    }

    // Find the lead
    const lead = await Lead.findById(leadId).lean();
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if already validated (skip if force=true for manual recheck)
    if (!force && ipqsService.isLeadValidated(lead)) {
      return res.json({
        success: true,
        message: "Lead already validated",
        data: {
          leadId: lead._id,
          ipqsValidation: lead.ipqsValidation,
          alreadyValidated: true,
        },
      });
    }

    console.log(`[IPQS] Validating single lead ${leadId} in order ${orderId}`);

    // Validate the lead
    const result = await ipqsService.validateLead(lead);
    const summary = ipqsService.getValidationSummary(result.email, result.phone);

    // Update lead in database
    await Lead.findByIdAndUpdate(leadId, {
      $set: {
        ipqsValidation: {
          email: result.email,
          phone: result.phone,
          summary: summary,
          validatedAt: result.validatedAt,
        },
      },
    });

    console.log(`[IPQS] Single lead validation completed for ${leadId}`);

    res.json({
      success: true,
      message: "Lead validated successfully",
      data: {
        leadId: leadId,
        email: result.email,
        phone: result.phone,
        summary: summary,
        validatedAt: result.validatedAt,
      },
    });
  } catch (error) {
    console.error("Error validating single lead with IPQS:", error);
    next(error);
  }
};

// Helper function to calculate IPQS statistics
function calculateIPQSStats(results) {
  const stats = {
    total: results.length,
    validated: 0,
    notValidated: 0,
    emailStats: {
      clean: 0,
      low_risk: 0,
      medium_risk: 0,
      high_risk: 0,
      invalid: 0,
      unknown: 0,
    },
    phoneStats: {
      clean: 0,
      low_risk: 0,
      medium_risk: 0,
      high_risk: 0,
      invalid: 0,
      unknown: 0,
    },
    overallStats: {
      clean: 0,
      low_risk: 0,
      medium_risk: 0,
      high_risk: 0,
      invalid: 0,
      unknown: 0,
    },
  };

  results.forEach((result) => {
    const summary = result.summary || result.ipqsValidation?.summary;
    if (summary) {
      stats.validated++;
      if (summary.emailStatus) stats.emailStats[summary.emailStatus]++;
      if (summary.phoneStatus) stats.phoneStats[summary.phoneStatus]++;
      if (summary.overallRisk) stats.overallStats[summary.overallRisk]++;
    } else {
      stats.notValidated++;
    }
  });

  return stats;
}

/**
 * Get cached IPQS validation results for an order
 * Returns previously validated results without calling the API again
 * @route GET /api/orders/:orderId/validation-results
 * @access Protected (Manager)
 */
exports.getOrderValidationResults = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    // Find the order with populated leads including IPQS data
    const order = await Order.findById(orderId)
      .populate("leads", "firstName lastName newEmail newPhone country leadType ipqsValidation")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!order.leads || order.leads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order has no leads",
      });
    }

    // Extract validation results from leads
    const results = order.leads.map((lead) => ({
      leadId: lead._id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      newEmail: lead.newEmail,
      newPhone: lead.newPhone,
      country: lead.country,
      leadType: lead.leadType,
      ipqsValidation: lead.ipqsValidation || null,
    }));

    // Calculate statistics (check for validatedAt to match isLeadValidated logic)
    const stats = {
      total: results.length,
      validated: results.filter((r) => r.ipqsValidation?.validatedAt).length,
      notValidated: results.filter((r) => !r.ipqsValidation?.validatedAt).length,
      emailStats: {
        clean: 0,
        low_risk: 0,
        medium_risk: 0,
        high_risk: 0,
        invalid: 0,
        unknown: 0,
      },
      phoneStats: {
        clean: 0,
        low_risk: 0,
        medium_risk: 0,
        high_risk: 0,
        invalid: 0,
        unknown: 0,
      },
      overallStats: {
        clean: 0,
        low_risk: 0,
        medium_risk: 0,
        high_risk: 0,
        invalid: 0,
        unknown: 0,
      },
    };

    results.forEach((result) => {
      if (result.ipqsValidation && result.ipqsValidation.summary) {
        const summary = result.ipqsValidation.summary;
        stats.emailStats[summary.emailStatus]++;
        stats.phoneStats[summary.phoneStatus]++;
        stats.overallStats[summary.overallRisk]++;
      }
    });

    res.json({
      success: true,
      data: {
        orderId: orderId,
        results: results,
        stats: stats,
      },
    });
  } catch (error) {
    console.error("Error getting order validation results:", error);
    next(error);
  }
};
