import { useCallback, useEffect } from "react";
import api from "../../services/api";
import chatService from "../../services/chatService";

const useLeadActions = ({
  fetchOrders,
  setNotification,
  setExpandedRowData,
  setLeadsPreviewModal,
  setAssignedLeadsModal,
  setOrders,
  expandedRowData,
  leadsPreviewModal,
  pspDepositDialog,
  markShavedDialog,
  hoveredOrderId,
  changeFTDDialog,
  setPspDepositDialog,
  setMarkShavedDialog,
  setUndoAction,
  setUndoing,
  setRestoringLead,
  setUndoingReplacement,
  setIpqsValidationSuccess,
  setProcessingLeads,
  setLeadRemovalMode,
  setSelectedLeadsForRemoval,
  user,
  removalReasonDialog,
  selectedLeadsForRemoval,
  undoAction,
  setRemovingLeads,
  setRemovalReasonDialog,
}) => {
  // Helper to refresh expanded order data
  const refreshExpandedOrderData = useCallback(
    async (orderId) => {
      if (!orderId || !expandedRowData[orderId]) return;
      try {
        const fullResponse = await api.get(`/orders/${orderId}`);
        const fullOrderData = fullResponse.data.data;
        setExpandedRowData((prev) => ({
          ...prev,
          [orderId]: { ...fullOrderData, leadsLoading: false },
        }));
      } catch (err) {
        // Silently fail - the stale data will remain
      }
    },
    [expandedRowData]
  );

  // Listen for real-time lead updates to sync across pages
  useEffect(() => {
    const handleLeadUpdate = (data) => {
      const updatedLead = data.lead;
      if (!updatedLead?._id) return;

      // Update leads in all orders that contain this lead
      setOrders((prevOrders) =>
        prevOrders.map((order) => {
          // Check if this order contains the updated lead
          const leadIndex = order.leads?.findIndex(
            (lead) => lead._id === updatedLead._id
          );

          if (leadIndex === -1 || leadIndex === undefined) {
            return order;
          }

          // Create a new leads array with the updated lead
          const updatedLeads = [...order.leads];
          // Preserve orderedAs from leadsMetadata if it exists
          const metadata = order.leadsMetadata?.find(
            (m) => m.leadId === updatedLead._id || m.leadId?._id === updatedLead._id
          );
          updatedLeads[leadIndex] = {
            ...updatedLead,
            orderedAs: metadata?.orderedAs || updatedLeads[leadIndex].orderedAs,
          };

          return {
            ...order,
            leads: updatedLeads,
          };
        })
      );

      // Also update expanded row data if the lead is there
      setExpandedRowData((prev) => {
        const newData = { ...prev };
        Object.keys(newData).forEach((orderId) => {
          const orderData = newData[orderId];
          if (orderData?.leads) {
            const leadIndex = orderData.leads.findIndex(
              (lead) => lead._id === updatedLead._id
            );
            if (leadIndex !== -1) {
              const updatedLeads = [...orderData.leads];
              const metadata = orderData.leadsMetadata?.find(
                (m) => m.leadId === updatedLead._id || m.leadId?._id === updatedLead._id
              );
              updatedLeads[leadIndex] = {
                ...updatedLead,
                orderedAs: metadata?.orderedAs || updatedLeads[leadIndex].orderedAs,
              };
              newData[orderId] = {
                ...orderData,
                leads: updatedLeads,
              };
            }
          }
        });
        return newData;
      });
    };

    chatService.on("leads:updated", handleLeadUpdate);

    return () => {
      chatService.off("leads:updated", handleLeadUpdate);
    };
  }, []);

  // Remove selected leads from order
  const handleRemoveSelectedLeads = useCallback(async (reason) => {
    if (!leadsPreviewModal.orderId || selectedLeadsForRemoval.length === 0 || !reason) return;

    setRemovingLeads(true);
    const orderId = leadsPreviewModal.orderId;
    const successfulRemovals = [];
    const failedRemovals = [];
    const removedLeadDetails = [];

    // Get lead details before removing for undo functionality
    const leadsToRemove = leadsPreviewModal.leads.filter(
      (lead) => selectedLeadsForRemoval.includes(lead._id)
    );

    for (const leadId of selectedLeadsForRemoval) {
      try {
        await api.delete(`/orders/${orderId}/leads/${leadId}`, {
          data: { reason }
        });
        successfulRemovals.push(leadId);
        const leadInfo = leadsToRemove.find((l) => l._id === leadId);
        if (leadInfo) {
          removedLeadDetails.push({
            leadId,
            leadName: `${leadInfo.firstName} ${leadInfo.lastName}`,
          });
        }
      } catch (error) {
        console.error(`Failed to remove lead ${leadId}:`, error);
        failedRemovals.push(leadId);
      }
    }

    // Update UI
    if (successfulRemovals.length > 0) {
      // Refresh the order to get updated removedLeads list
      try {
        const response = await api.get(`/orders/${orderId}`);
        if (response.data.success) {
          // Update leadsPreviewModal with fresh data including removedLeads
          setLeadsPreviewModal((prev) => ({
            ...prev,
            leads: response.data.data.leads || prev.leads,
            order: response.data.data,
          }));

          // Update expandedRowData if the order is expanded
          if (expandedRowData[orderId]) {
            setExpandedRowData((prev) => ({
              ...prev,
              [orderId]: {
                ...prev[orderId],
                leads: response.data.data.leads || prev[orderId].leads,
                removedLeads: response.data.data.removedLeads,
              },
            }));
          }
        }
      } catch (err) {
        console.error("Failed to refresh order data:", err);
      }

      // Refresh orders list
      fetchOrders();

      // Set undo action for the removed leads
      setUndoAction({
        type: "removal",
        orderId,
        removedLeads: removedLeadDetails,
        timestamp: Date.now(),
      });

      setNotification({
        message: `Removed ${successfulRemovals.length} lead(s) from order`,
        severity: "success",
      });
    }

    if (failedRemovals.length > 0) {
      setNotification({
        message: `Failed to remove ${failedRemovals.length} lead(s)`,
        severity: "error",
      });
    }

    // Reset selection state
    setSelectedLeadsForRemoval([]);
    setLeadRemovalMode(false);
    setRemovingLeads(false);
    setRemovalReasonDialog({ open: false, reason: "", customReason: "" });
  }, [leadsPreviewModal.orderId, leadsPreviewModal.leads, selectedLeadsForRemoval, expandedRowData, fetchOrders]);

  // Handle undo action (restore removed leads or undo replacement)
  const handleUndoAction = useCallback(async () => {
    if (!undoAction) return;

    setUndoing(true);
    try {
      if (undoAction.type === "removal") {
        // Restore removed leads
        const successfulRestores = [];
        const failedRestores = [];

        for (const removedLead of undoAction.removedLeads) {
          try {
            await api.post(`/orders/${undoAction.orderId}/leads/${removedLead.leadId}/restore`);
            successfulRestores.push(removedLead);
          } catch (error) {
            console.error(`Failed to restore lead ${removedLead.leadId}:`, error);
            failedRestores.push(removedLead);
          }
        }

        if (successfulRestores.length > 0) {
          // Refresh orders list
          fetchOrders();

          // Refresh leads preview modal if open
          if (leadsPreviewModal.open && leadsPreviewModal.orderId === undoAction.orderId) {
            try {
              const response = await api.get(`/orders/${undoAction.orderId}`);
              if (response.data.success) {
                setLeadsPreviewModal((prev) => ({
                  ...prev,
                  leads: response.data.data.leads || [],
                  order: response.data.data,
                }));
              }
            } catch (err) {
              console.error("Failed to refresh leads preview:", err);
            }
          }

          setNotification({
            message: `Restored ${successfulRestores.length} lead(s) to order`,
            severity: "success",
          });
        }

        if (failedRestores.length > 0) {
          setNotification({
            message: `Failed to restore ${failedRestores.length} lead(s) - they may have been assigned to another order`,
            severity: "error",
          });
        }
      } else if (undoAction.type === "replacement") {
        // Undo lead replacement
        try {
          const response = await api.post(
            `/orders/${undoAction.orderId}/leads/${undoAction.newLeadId}/undo-replace`,
            { oldLeadId: undoAction.oldLeadId }
          );

          if (response.data.success) {
            // Refresh orders list
            fetchOrders();

            // Update leads preview modal if open
            if (leadsPreviewModal.open && leadsPreviewModal.orderId === undoAction.orderId) {
              setLeadsPreviewModal((prev) => ({
                ...prev,
                leads: response.data.data.order?.leads || prev.leads,
                order: response.data.data.order || prev.order,
              }));
            }

            // Update expandedRowData if the order is expanded
            if (expandedRowData[undoAction.orderId]) {
              setExpandedRowData((prev) => ({
                ...prev,
                [undoAction.orderId]: {
                  ...prev[undoAction.orderId],
                  leads: response.data.data.order?.leads || prev[undoAction.orderId].leads,
                },
              }));
            }

            setNotification({
              message: `Replacement undone: restored ${undoAction.oldLeadName}`,
              severity: "success",
            });
          }
        } catch (error) {
          console.error("Failed to undo replacement:", error);
          setNotification({
            message: error.response?.data?.message || "Failed to undo replacement - the original lead may have been assigned to another order",
            severity: "error",
          });
        }
      }
    } finally {
      setUndoing(false);
      setUndoAction(null);
    }
  }, [undoAction, fetchOrders, leadsPreviewModal.open, leadsPreviewModal.orderId, expandedRowData]);

  // Restore a single removed lead
  const handleRestoreLead = useCallback(async (orderId, lead) => {
    if (!orderId || !lead?._id) return;

    setRestoringLead(lead._id);
    try {
      const response = await api.post(`/orders/${orderId}/leads/${lead._id}/restore`);

      if (response.data.success) {
        // Refresh orders list
        fetchOrders();

        // Update leads preview modal
        if (leadsPreviewModal.open && leadsPreviewModal.orderId === orderId) {
          setLeadsPreviewModal((prev) => ({
            ...prev,
            leads: response.data.data.order?.leads || prev.leads,
            order: response.data.data.order || prev.order,
          }));
        }

        // Update expandedRowData if the order is expanded
        if (expandedRowData[orderId]) {
          setExpandedRowData((prev) => ({
            ...prev,
            [orderId]: {
              ...prev[orderId],
              leads: response.data.data.order?.leads || prev[orderId].leads,
            },
          }));
        }

        setNotification({
          message: `Lead ${lead.firstName} ${lead.lastName} has been restored to the order`,
          severity: "success",
        });
      }
    } catch (error) {
      console.error("Failed to restore lead:", error);
      setNotification({
        message: error.response?.data?.message || "Failed to restore lead - it may have been assigned to another order",
        severity: "error",
      });
    } finally {
      setRestoringLead(null);
    }
  }, [fetchOrders, leadsPreviewModal.open, leadsPreviewModal.orderId, expandedRowData]);

  // Undo replacement from actions menu
  const handleUndoReplacementFromMenu = useCallback(async (orderId, newLeadId, oldLeadId) => {
    if (!orderId || !newLeadId || !oldLeadId) return;

    setUndoingReplacement(newLeadId);
    try {
      const response = await api.post(
        `/orders/${orderId}/leads/${newLeadId}/undo-replace`,
        { oldLeadId }
      );

      if (response.data.success) {
        // Refresh orders list
        fetchOrders();

        // Update leads preview modal
        if (leadsPreviewModal.open && leadsPreviewModal.orderId === orderId) {
          setLeadsPreviewModal((prev) => ({
            ...prev,
            leads: response.data.data.order?.leads || prev.leads,
            order: response.data.data.order || prev.order,
          }));
        }

        // Update expandedRowData if the order is expanded
        if (expandedRowData[orderId]) {
          setExpandedRowData((prev) => ({
            ...prev,
            [orderId]: {
              ...prev[orderId],
              leads: response.data.data.order?.leads || prev[orderId].leads,
              leadsMetadata: response.data.data.order?.leadsMetadata || prev[orderId].leadsMetadata,
            },
          }));
        }

        setNotification({
          message: `Replacement undone: restored ${response.data.data.restoredLead?.firstName} ${response.data.data.restoredLead?.lastName}`,
          severity: "success",
        });
      }
    } catch (error) {
      console.error("Failed to undo replacement:", error);
      setNotification({
        message: error.response?.data?.message || "Failed to undo replacement - the original lead may have been assigned to another order",
        severity: "error",
      });
    } finally {
      setUndoingReplacement(null);
    }
  }, [fetchOrders, leadsPreviewModal.open, leadsPreviewModal.orderId, expandedRowData]);

  // Change FTD success handler
  const handleChangeFTDSuccess = useCallback(
    async (changeData) => {
      // Determine if it was a filler based on order metadata
      const leadMetadata = changeFTDDialog.order?.leadsMetadata?.find(
        (m) => m.leadId?.toString() === changeData.oldLead.id?.toString()
      );
      const isFillerOrder = leadMetadata?.orderedAs === "filler";
      const leadLabel = isFillerOrder ? "Filler" : "FTD";

      setNotification({
        message: `${leadLabel} lead successfully changed from ${changeData.oldLead.firstName} ${changeData.oldLead.lastName} to ${changeData.newLead.firstName} ${changeData.newLead.lastName}`,
        severity: "success",
      });

      // Refresh the orders and expanded order data
      await fetchOrders();
      if (changeFTDDialog.order && expandedRowData[changeFTDDialog.order._id]) {
        refreshExpandedOrderData(changeFTDDialog.order._id);
      }
    },
    [changeFTDDialog.order, expandedRowData, fetchOrders, refreshExpandedOrderData]
  );

  // Replace lead success handler with IPQS auto-validation
  const handleReplaceLeadSuccess = useCallback(
    async (replaceData) => {
      const orderId = replaceData.order?._id;

      setNotification({
        message: `Lead successfully replaced: ${replaceData.oldLead.firstName} ${replaceData.oldLead.lastName} replaced with ${replaceData.newLead.firstName} ${replaceData.newLead.lastName}`,
        severity: "success",
      });

      // Set undo action for the replacement
      setUndoAction({
        type: "replacement",
        orderId,
        newLeadId: replaceData.newLead._id,
        oldLeadId: replaceData.oldLead._id,
        newLeadName: `${replaceData.newLead.firstName} ${replaceData.newLead.lastName}`,
        oldLeadName: `${replaceData.oldLead.firstName} ${replaceData.oldLead.lastName}`,
        timestamp: Date.now(),
      });

      // Update orders list immediately with new data
      if (replaceData.order) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId ? { ...order, ...replaceData.order } : order
          )
        );
      }

      // Update the leads preview modal if open
      if (leadsPreviewModal.open && leadsPreviewModal.orderId === orderId) {
        setLeadsPreviewModal((prev) => ({
          ...prev,
          leads: replaceData.order?.leads || prev.leads,
          order: replaceData.order || prev.order,
        }));
      }

      // Update expandedRowData if the order is expanded
      if (orderId && expandedRowData[orderId]) {
        setExpandedRowData((prev) => ({
          ...prev,
          [orderId]: {
            ...prev[orderId],
            leads: replaceData.order?.leads || prev[orderId].leads,
            leadsMetadata: replaceData.order?.leadsMetadata || prev[orderId].leadsMetadata,
          },
        }));
      }

      // Auto-validate the new lead with IPQS only if it's not already validated
      const newLeadId = replaceData.newLead?._id;
      const newLeadAlreadyValidated = replaceData.newLead?.ipqsValidation?.validatedAt;

      if (orderId && newLeadId && !newLeadAlreadyValidated) {
        try {
          const validateResponse = await api.post(
            `/orders/${orderId}/leads/${newLeadId}/validate-ipqs`
          );
          if (validateResponse.data.success && !validateResponse.data.data.alreadyValidated) {
            // Update the lead in the preview modal with validation results
            const validation = validateResponse.data.data;
            const ipqsData = {
              email: validation.email,
              phone: validation.phone,
              summary: validation.summary,
              validatedAt: validation.validatedAt,
            };
            setLeadsPreviewModal((prev) => ({
              ...prev,
              leads: prev.leads.map((lead) => {
                if (lead._id === newLeadId) {
                  return {
                    ...lead,
                    ipqsValidation: ipqsData,
                  };
                }
                return lead;
              }),
            }));
            // Also update expandedRowData if the order is expanded
            if (expandedRowData[orderId]) {
              setExpandedRowData((prev) => ({
                ...prev,
                [orderId]: {
                  ...prev[orderId],
                  leads: prev[orderId].leads?.map((lead) =>
                    lead._id === newLeadId
                      ? { ...lead, ipqsValidation: ipqsData }
                      : lead
                  ),
                },
              }));
            }
            // Show success indicator on the new lead
            setIpqsValidationSuccess([newLeadId]);
            setTimeout(() => {
              setIpqsValidationSuccess([]);
            }, 2000);
          }
        } catch (err) {
          console.error("Auto IPQS validation failed for replaced lead:", err);
          // Don't show error notification - auto-validation is optional
        }
      }
    },
    [leadsPreviewModal.open, leadsPreviewModal.orderId, expandedRowData]
  );

  // Convert lead type between FTD and Filler
  const handleConvertLeadType = useCallback(
    async (order, lead) => {
      if (lead.leadType !== "ftd") {
        setNotification({
          message: "Only FTD/Filler leads can be converted",
          severity: "warning",
        });
        return;
      }

      const leadMetadata = order.leadsMetadata?.find(
        (m) => m.leadId?.toString() === lead._id?.toString()
      );
      const currentType = leadMetadata?.orderedAs || "ftd";
      const newType = currentType === "ftd" ? "filler" : "ftd";

      try {
        const response = await api.post(
          `/orders/${order._id}/leads/${lead._id}/convert-lead-type`
        );

        if (response.data.success) {
          setNotification({
            message: `Lead ${lead.firstName} ${
              lead.lastName
            } converted from ${currentType.toUpperCase()} to ${newType.toUpperCase()}`,
            severity: "success",
          });

          // Refresh the orders and expanded order data
          await fetchOrders();
          if (expandedRowData[order._id]) {
            refreshExpandedOrderData(order._id);
          }
        }
      } catch (err) {
        setNotification({
          message: err.response?.data?.message || "Failed to convert lead type",
          severity: "error",
        });
      }
    },
    [fetchOrders, expandedRowData, refreshExpandedOrderData]
  );

  // Assign lead success handler
  const handleAssignLeadSuccess = useCallback(
    async (assignmentData) => {
      // Update local state instantly
      const updatedLeadData = {
        assignedAgent: {
          _id: assignmentData.agentId,
          fullName: assignmentData.agentName,
          email: assignmentData.agentEmail,
        },
        assignedAgentAt: new Date().toISOString(),
      };

      setAssignedLeadsModal((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l._id === assignmentData.leadId ? { ...l, ...updatedLeadData } : l
        ),
      }));

      // Also update preview modal if open
      setLeadsPreviewModal((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l._id === assignmentData.leadId ? { ...l, ...updatedLeadData } : l
        ),
      }));

      setNotification({
        message: `Lead ${assignmentData.leadId.slice(
          -8
        )} successfully assigned to ${assignmentData.agentName}`,
        severity: "success",
      });

      // Refresh the orders in background
      fetchOrders();
    },
    [fetchOrders]
  );

  // Open PSP selection dialog for confirm deposit (Step 1: Card Issuer)
  const handleConfirmDeposit = useCallback(
    async (lead, orderId) => {
      // Use passed orderId or fall back to hoveredOrderId
      const targetOrderId = orderId || hoveredOrderId;

      // Fetch active Card Issuers first
      try {
        setPspDepositDialog({
          open: true,
          lead: lead,
          orderId: targetOrderId,
          step: 1,
          cardIssuers: [],
          selectedCardIssuer: null,
          newCardIssuerName: "",
          creatingIssuer: false,
          psps: [],
          loading: true,
          selectedPsp: null,
          newPspWebsite: "",
          creatingPsp: false,
        });

        const response = await api.get("/card-issuers", {
          params: { limit: 10000, isActive: true },
        });

        setPspDepositDialog((prev) => ({
          ...prev,
          cardIssuers: response.data.data || [],
          loading: false,
        }));
      } catch (err) {
        console.error("Error fetching Card Issuers:", err);
        setNotification({
          message: "Failed to load Card Issuers",
          severity: "error",
        });
        setPspDepositDialog({
          open: false,
          lead: null,
          orderId: null,
          step: 1,
          cardIssuers: [],
          selectedCardIssuer: null,
          newCardIssuerName: "",
          creatingIssuer: false,
          psps: [],
          loading: false,
          selectedPsp: null,
          newPspWebsite: "",
          creatingPsp: false,
        });
      }
    },
    [hoveredOrderId]
  );

  // Handle Card Issuer selection (move to Step 2: PSP selection)
  const handleCardIssuerSelect = useCallback(async () => {
    const { selectedCardIssuer, newCardIssuerName } = pspDepositDialog;

    // If creating new issuer
    if (newCardIssuerName && !selectedCardIssuer) {
      try {
        setPspDepositDialog((prev) => ({ ...prev, creatingIssuer: true }));
        const response = await api.post("/card-issuers", { name: newCardIssuerName.trim() });
        const newIssuer = response.data.data;

        // Proceed to step 2 with new issuer
        setPspDepositDialog((prev) => ({
          ...prev,
          selectedCardIssuer: newIssuer,
          step: 2,
          loading: true,
          creatingIssuer: false,
        }));

        // Fetch all active PSPs (not filtered by issuer since PSPs may not have issuer set)
        const pspsResponse = await api.get("/psps", {
          params: { isActive: true, limit: 10000 },
        });

        setPspDepositDialog((prev) => ({
          ...prev,
          psps: pspsResponse.data.data || [],
          loading: false,
        }));
      } catch (err) {
        console.error("Error creating Card Issuer:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to create Card Issuer",
          severity: "error",
        });
        setPspDepositDialog((prev) => ({ ...prev, creatingIssuer: false }));
      }
      return;
    }

    // Using existing issuer
    if (!selectedCardIssuer) {
      setNotification({
        message: "Please select a Card Issuer or enter a new name",
        severity: "error",
      });
      return;
    }

    try {
      setPspDepositDialog((prev) => ({ ...prev, step: 2, loading: true }));

      // Fetch all active PSPs
      const response = await api.get("/psps", {
        params: { isActive: true, limit: 10000 },
      });

      setPspDepositDialog((prev) => ({
        ...prev,
        psps: response.data.data || [],
        loading: false,
      }));
    } catch (err) {
      console.error("Error fetching PSPs:", err);
      setNotification({
        message: "Failed to load PSPs",
        severity: "error",
      });
      setPspDepositDialog((prev) => ({ ...prev, loading: false }));
    }
  }, [pspDepositDialog, setNotification]);

  // Handle PSP selection - move to step 3 (select deposit call)
  const handlePspSelect = useCallback(
    async () => {
      const { lead, selectedPsp, selectedCardIssuer, orderId, newPspWebsite } = pspDepositDialog;

      if (!orderId) {
        setNotification({
          message: "Order context is required to confirm deposit",
          severity: "error",
        });
        return;
      }

      // Determine which PSP to use
      let pspToUse = selectedPsp;

      // If creating a new PSP
      if (newPspWebsite.trim() && !selectedPsp) {
        try {
          setPspDepositDialog((prev) => ({ ...prev, creatingPsp: true }));
          const pspResponse = await api.post("/psps", {
            website: newPspWebsite.trim(),
            cardIssuer: selectedCardIssuer?._id || null,
          });
          pspToUse = pspResponse.data.data;
          setPspDepositDialog((prev) => ({
            ...prev,
            selectedPsp: pspToUse,
            newPspWebsite: "",
            creatingPsp: false,
          }));
        } catch (err) {
          // If PSP already exists (409), use the existing one
          if (err.response?.status === 409 && err.response?.data?.existingPsp) {
            pspToUse = err.response.data.existingPsp;
            setPspDepositDialog((prev) => ({
              ...prev,
              selectedPsp: pspToUse,
              newPspWebsite: "",
              creatingPsp: false,
            }));
            setNotification({
              message: "PSP already exists - using existing one",
              severity: "info",
            });
          } else {
            console.error("Error creating PSP:", err);
            setNotification({
              message: err.response?.data?.message || "Failed to create PSP",
              severity: "error",
            });
            setPspDepositDialog((prev) => ({ ...prev, creatingPsp: false }));
            return;
          }
        }
      }

      if (!pspToUse) {
        setNotification({
          message: "Please select a PSP or enter a website to create one",
          severity: "error",
        });
        return;
      }

      // Move to step 3: select deposit call
      const agentId = lead.assignedAgent?._id || lead.assignedAgent;
      if (!agentId) {
        setNotification({
          message: "Lead has no assigned agent. Cannot fetch CDR calls.",
          severity: "error",
        });
        return;
      }

      setPspDepositDialog((prev) => ({
        ...prev,
        step: 3,
        selectedPsp: pspToUse,
        agentCallsLoading: true,
      }));

      try {
        const { fetchAgentCDRCalls } = await import("../../services/callDeclarations");
        const data = await fetchAgentCDRCalls(agentId, 3, lead.newPhone, lead.newEmail, true);
        setPspDepositDialog((prev) => ({
          ...prev,
          agentCalls: data.calls || [],
          agentCallsLoading: false,
        }));
      } catch (err) {
        console.error("Error fetching agent CDR calls:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to load agent's calls",
          severity: "error",
        });
        setPspDepositDialog((prev) => ({ ...prev, agentCallsLoading: false }));
      }
    },
    [pspDepositDialog, setNotification]
  );

  // Handle final deposit confirmation with selected call (step 3)
  const handleDepositCallConfirm = useCallback(
    async () => {
      const { lead, selectedPsp, selectedCardIssuer, orderId, selectedCall } = pspDepositDialog;

      if (!selectedCall) {
        setNotification({
          message: "Please select a call as the deposit call",
          severity: "error",
        });
        return;
      }

      try {
        setPspDepositDialog((prev) => ({ ...prev, loading: true }));

        const response = await api.put(`/leads/${lead._id}/confirm-deposit`, {
          pspId: selectedPsp._id,
          orderId: orderId,
          cardIssuerId: selectedCardIssuer?._id || null,
          selectedCall: {
            cdrCallId: selectedCall.cdrCallId,
            callDate: selectedCall.callDate,
            callDuration: selectedCall.callDuration,
            sourceNumber: selectedCall.sourceNumber,
            destinationNumber: selectedCall.destinationNumber,
            recordFile: selectedCall.recordFile || "",
          },
        });

        // Get the order metadata from response
        const orderMetadata = response.data.data?.orderMetadata || {};

        // Update local state with order metadata
        const updatedLeadData = {
          depositConfirmed: orderMetadata.depositConfirmed || true,
          depositConfirmedBy: orderMetadata.depositConfirmedBy || user,
          depositConfirmedAt: orderMetadata.depositConfirmedAt || new Date().toISOString(),
          depositPSP: orderMetadata.depositPSP || selectedPsp,
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        // Also update preview modal if open
        setLeadsPreviewModal((prev) => {
          let updatedOrder = prev.order;
          if (updatedOrder && updatedOrder.leadsMetadata) {
            updatedOrder = {
              ...updatedOrder,
              leadsMetadata: updatedOrder.leadsMetadata.map((meta) =>
                meta.leadId === lead._id || meta.leadId?._id === lead._id
                  ? { ...meta, ...orderMetadata }
                  : meta
              ),
            };
          }
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l._id === lead._id ? { ...l, ...updatedLeadData } : l
            ),
            order: updatedOrder,
          };
        });

        // Update expandedRowData if order is expanded
        if (orderId && expandedRowData[orderId]) {
          setExpandedRowData((prev) => {
            const orderData = prev[orderId];
            if (!orderData) return prev;
            return {
              ...prev,
              [orderId]: {
                ...orderData,
                leads: orderData.leads?.map((l) =>
                  l._id === lead._id ? { ...l, ...updatedLeadData } : l
                ),
                leadsMetadata: orderData.leadsMetadata?.map((meta) =>
                  meta.leadId === lead._id || meta.leadId?._id === lead._id
                    ? { ...meta, ...orderMetadata }
                    : meta
                ),
              },
            };
          });
        }

        setNotification({
          message: "Deposit confirmed successfully",
          severity: "success",
        });

        // Close the dialog
        if (pspDepositDialog.playingRecording?.blobUrl) {
          URL.revokeObjectURL(pspDepositDialog.playingRecording.blobUrl);
        }
        setPspDepositDialog({
          open: false,
          lead: null,
          orderId: null,
          step: 1,
          cardIssuers: [],
          selectedCardIssuer: null,
          newCardIssuerName: "",
          creatingIssuer: false,
          psps: [],
          loading: false,
          selectedPsp: null,
          newPspWebsite: "",
          creatingPsp: false,
          agentCalls: [],
          agentCallsLoading: false,
          selectedCall: null,
          playingRecording: null,
          callSearchQuery: "",
        });

        // Refresh the orders in background
        fetchOrders();
      } catch (err) {
        console.error("Error confirming deposit:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to confirm deposit",
          severity: "error",
        });
        setPspDepositDialog((prev) => ({ ...prev, loading: false }));
      }
    },
    [pspDepositDialog, fetchOrders, user, expandedRowData]
  );

  // Close PSP deposit dialog
  const handleClosePspDepositDialog = useCallback(() => {
    // Revoke any blob URL before closing
    if (pspDepositDialog.playingRecording?.blobUrl) {
      URL.revokeObjectURL(pspDepositDialog.playingRecording.blobUrl);
    }
    setPspDepositDialog({
      open: false,
      lead: null,
      orderId: null,
      step: 1,
      cardIssuers: [],
      selectedCardIssuer: null,
      newCardIssuerName: "",
      creatingIssuer: false,
      psps: [],
      loading: false,
      selectedPsp: null,
      newPspWebsite: "",
      creatingPsp: false,
      agentCalls: [],
      agentCallsLoading: false,
      selectedCall: null,
      playingRecording: null,
      callSearchQuery: "",
    });
  }, [pspDepositDialog.playingRecording]);

  // Unconfirm Deposit Handler (admin only)
  const handleUnconfirmDeposit = useCallback(
    async (lead, orderId) => {
      // Use passed orderId or fall back to hoveredOrderId
      const targetOrderId = orderId || hoveredOrderId;

      if (!targetOrderId) {
        setNotification({
          message: "Order context is required to unconfirm deposit",
          severity: "error",
        });
        return;
      }

      // Ask for confirmation
      if (!window.confirm(`Are you sure you want to unconfirm deposit for ${lead.firstName} ${lead.lastName}?`)) {
        return;
      }

      try {
        await api.put(`/leads/${lead._id}/unconfirm-deposit`, {
          orderId: targetOrderId,
        });

        // Update local state instantly
        const updatedLeadData = {
          depositConfirmed: false,
          depositConfirmedBy: null,
          depositConfirmedAt: null,
          depositPSP: null,
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        // Also update preview modal if open
        setLeadsPreviewModal((prev) => {
          let updatedOrder = prev.order;
          if (updatedOrder && updatedOrder.leadsMetadata) {
            updatedOrder = {
              ...updatedOrder,
              leadsMetadata: updatedOrder.leadsMetadata.map((meta) =>
                meta.leadId === lead._id || meta.leadId?._id === lead._id
                  ? { ...meta, ...updatedLeadData }
                  : meta
              ),
            };
          }
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l._id === lead._id ? { ...l, ...updatedLeadData } : l
            ),
            order: updatedOrder,
          };
        });

        // Update expandedRowData if order is expanded
        if (targetOrderId && expandedRowData[targetOrderId]) {
          setExpandedRowData((prev) => {
            const orderData = prev[targetOrderId];
            if (!orderData) return prev;
            return {
              ...prev,
              [targetOrderId]: {
                ...orderData,
                leads: orderData.leads?.map((l) =>
                  l._id === lead._id ? { ...l, ...updatedLeadData } : l
                ),
                leadsMetadata: orderData.leadsMetadata?.map((meta) =>
                  meta.leadId === lead._id || meta.leadId?._id === lead._id
                    ? { ...meta, ...updatedLeadData }
                    : meta
                ),
              },
            };
          });
        }

        setNotification({
          message: "Deposit unconfirmed successfully",
          severity: "success",
        });

        // Refresh the orders in background
        fetchOrders();
      } catch (err) {
        console.error("Error unconfirming deposit:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to unconfirm deposit",
          severity: "error",
        });
      }
    },
    [fetchOrders, hoveredOrderId, expandedRowData]
  );

  // Mark as Shaved Handler - opens the dialog
  const handleMarkAsShaved = useCallback((lead, orderId) => {
    // Use passed orderId or fall back to hoveredOrderId
    const targetOrderId = orderId || hoveredOrderId;
    setMarkShavedDialog({
      open: true,
      lead: lead,
      orderId: targetOrderId,
      loading: false,
    });
  }, [hoveredOrderId]);

  // Confirm Mark as Shaved Handler - called when dialog is confirmed
  const handleConfirmMarkAsShaved = useCallback(
    async (refundsManagerId) => {
      const { lead, orderId } = markShavedDialog;
      if (!lead) return;

      if (!orderId) {
        setNotification({
          message: "Order context is required to mark as shaved",
          severity: "error",
        });
        return;
      }

      setMarkShavedDialog((prev) => ({ ...prev, loading: true }));

      try {
        const response = await api.put(`/leads/${lead._id}/mark-shaved`, {
          refundsManagerId,
          orderId: orderId,
        });

        // Get the order metadata from response
        const orderMetadata = response.data.data?.orderMetadata || {};

        // Update local state with order metadata
        const updatedLeadData = {
          shaved: orderMetadata.shaved || true,
          shavedBy: orderMetadata.shavedBy || user,
          shavedAt: orderMetadata.shavedAt || new Date().toISOString(),
          shavedRefundsManager: orderMetadata.shavedRefundsManager,
          shavedManagerAssignedBy: orderMetadata.shavedManagerAssignedBy || user,
          shavedManagerAssignedAt: orderMetadata.shavedManagerAssignedAt || new Date().toISOString(),
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        setLeadsPreviewModal((prev) => {
          let updatedOrder = prev.order;
          if (updatedOrder && updatedOrder.leadsMetadata) {
            updatedOrder = {
              ...updatedOrder,
              leadsMetadata: updatedOrder.leadsMetadata.map((meta) =>
                meta.leadId === lead._id || meta.leadId?._id === lead._id
                  ? { ...meta, ...orderMetadata }
                  : meta
              ),
            };
          }
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l._id === lead._id ? { ...l, ...updatedLeadData } : l
            ),
            order: updatedOrder,
          };
        });

        // Update expandedRowData if order is expanded
        if (orderId && expandedRowData[orderId]) {
          setExpandedRowData((prev) => {
            const orderData = prev[orderId];
            if (!orderData) return prev;
            return {
              ...prev,
              [orderId]: {
                ...orderData,
                leads: orderData.leads?.map((l) =>
                  l._id === lead._id ? { ...l, ...updatedLeadData } : l
                ),
                leadsMetadata: orderData.leadsMetadata?.map((meta) =>
                  meta.leadId === lead._id || meta.leadId?._id === lead._id
                    ? { ...meta, ...orderMetadata }
                    : meta
                ),
              },
            };
          });
        }

        setNotification({
          message: "Lead marked as shaved successfully",
          severity: "success",
        });

        // Close dialog
        setMarkShavedDialog({ open: false, lead: null, orderId: null, loading: false });

        // Refresh orders in background
        fetchOrders();
      } catch (err) {
        console.error("Error marking lead as shaved:", err);
        setMarkShavedDialog((prev) => ({ ...prev, loading: false }));
        setNotification({
          message: err.response?.data?.message || "Failed to mark lead as shaved",
          severity: "error",
        });
      }
    },
    [markShavedDialog, fetchOrders, user, expandedRowData]
  );

  // Unmark as Shaved Handler (admin only)
  const handleUnmarkAsShaved = useCallback(
    async (lead, orderId) => {
      // Use passed orderId or fall back to hoveredOrderId
      const targetOrderId = orderId || hoveredOrderId;

      if (!targetOrderId) {
        setNotification({
          message: "Order context is required to unmark as shaved",
          severity: "error",
        });
        return;
      }

      if (!window.confirm(`Are you sure you want to unmark ${lead.firstName} ${lead.lastName} as shaved?`)) {
        return;
      }

      try {
        await api.put(`/leads/${lead._id}/unmark-shaved`, {
          orderId: targetOrderId,
        });

        // Update local state instantly
        const updatedLeadData = {
          shaved: false,
          shavedBy: null,
          shavedAt: null,
          shavedRefundsManager: null,
          shavedManagerAssignedBy: null,
          shavedManagerAssignedAt: null,
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        setLeadsPreviewModal((prev) => {
          let updatedOrder = prev.order;
          if (updatedOrder && updatedOrder.leadsMetadata) {
            updatedOrder = {
              ...updatedOrder,
              leadsMetadata: updatedOrder.leadsMetadata.map((meta) =>
                meta.leadId === lead._id || meta.leadId?._id === lead._id
                  ? { ...meta, ...updatedLeadData }
                  : meta
              ),
            };
          }
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l._id === lead._id ? { ...l, ...updatedLeadData } : l
            ),
            order: updatedOrder,
          };
        });

        // Update expandedRowData if order is expanded
        if (targetOrderId && expandedRowData[targetOrderId]) {
          setExpandedRowData((prev) => {
            const orderData = prev[targetOrderId];
            if (!orderData) return prev;
            return {
              ...prev,
              [targetOrderId]: {
                ...orderData,
                leads: orderData.leads?.map((l) =>
                  l._id === lead._id ? { ...l, ...updatedLeadData } : l
                ),
                leadsMetadata: orderData.leadsMetadata?.map((meta) =>
                  meta.leadId === lead._id || meta.leadId?._id === lead._id
                    ? { ...meta, ...updatedLeadData }
                    : meta
                ),
              },
            };
          });
        }

        setNotification({
          message: "Lead unmarked as shaved successfully",
          severity: "success",
        });

        // Refresh orders in background
        fetchOrders();
      } catch (err) {
        console.error("Error unmarking lead as shaved:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to unmark lead as shaved",
          severity: "error",
        });
      }
    },
    [fetchOrders, hoveredOrderId, expandedRowData]
  );

  // Mark as Closed Network Handler
  const handleMarkAsClosedNetwork = useCallback(
    async (lead, orderId) => {
      const targetOrderId = orderId || hoveredOrderId;

      if (!targetOrderId) {
        setNotification({
          message: "Order context is required to mark as closed network",
          severity: "error",
        });
        return;
      }

      if (!window.confirm(`Are you sure you want to mark ${lead.firstName} ${lead.lastName} as closed network?`)) {
        return;
      }

      try {
        const response = await api.put(`/leads/${lead._id}/mark-closed-network`, {
          orderId: targetOrderId,
        });

        const orderMetadata = response.data.data?.orderMetadata || {};

        const updatedLeadData = {
          closedNetwork: orderMetadata.closedNetwork || true,
          closedNetworkBy: orderMetadata.closedNetworkBy || user,
          closedNetworkAt: orderMetadata.closedNetworkAt || new Date().toISOString(),
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        setLeadsPreviewModal((prev) => {
          let updatedOrder = prev.order;
          if (updatedOrder && updatedOrder.leadsMetadata) {
            updatedOrder = {
              ...updatedOrder,
              leadsMetadata: updatedOrder.leadsMetadata.map((meta) =>
                meta.leadId === lead._id || meta.leadId?._id === lead._id
                  ? { ...meta, ...orderMetadata }
                  : meta
              ),
            };
          }
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l._id === lead._id ? { ...l, ...updatedLeadData } : l
            ),
            order: updatedOrder,
          };
        });

        if (targetOrderId && expandedRowData[targetOrderId]) {
          setExpandedRowData((prev) => {
            const orderData = prev[targetOrderId];
            if (!orderData) return prev;
            return {
              ...prev,
              [targetOrderId]: {
                ...orderData,
                leads: orderData.leads?.map((l) =>
                  l._id === lead._id ? { ...l, ...updatedLeadData } : l
                ),
                leadsMetadata: orderData.leadsMetadata?.map((meta) =>
                  meta.leadId === lead._id || meta.leadId?._id === lead._id
                    ? { ...meta, ...orderMetadata }
                    : meta
                ),
              },
            };
          });
        }

        setNotification({
          message: "Lead marked as closed network successfully",
          severity: "success",
        });

        fetchOrders();
      } catch (err) {
        console.error("Error marking lead as closed network:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to mark lead as closed network",
          severity: "error",
        });
      }
    },
    [fetchOrders, hoveredOrderId, expandedRowData, user]
  );

  // Unmark as Closed Network Handler (admin only)
  const handleUnmarkAsClosedNetwork = useCallback(
    async (lead, orderId) => {
      const targetOrderId = orderId || hoveredOrderId;

      if (!targetOrderId) {
        setNotification({
          message: "Order context is required to unmark as closed network",
          severity: "error",
        });
        return;
      }

      if (!window.confirm(`Are you sure you want to unmark ${lead.firstName} ${lead.lastName} as closed network?`)) {
        return;
      }

      try {
        await api.put(`/leads/${lead._id}/unmark-closed-network`, {
          orderId: targetOrderId,
        });

        const updatedLeadData = {
          closedNetwork: false,
          closedNetworkBy: null,
          closedNetworkAt: null,
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        setLeadsPreviewModal((prev) => {
          let updatedOrder = prev.order;
          if (updatedOrder && updatedOrder.leadsMetadata) {
            updatedOrder = {
              ...updatedOrder,
              leadsMetadata: updatedOrder.leadsMetadata.map((meta) =>
                meta.leadId === lead._id || meta.leadId?._id === lead._id
                  ? { ...meta, ...updatedLeadData }
                  : meta
              ),
            };
          }
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l._id === lead._id ? { ...l, ...updatedLeadData } : l
            ),
            order: updatedOrder,
          };
        });

        if (targetOrderId && expandedRowData[targetOrderId]) {
          setExpandedRowData((prev) => {
            const orderData = prev[targetOrderId];
            if (!orderData) return prev;
            return {
              ...prev,
              [targetOrderId]: {
                ...orderData,
                leads: orderData.leads?.map((l) =>
                  l._id === lead._id ? { ...l, ...updatedLeadData } : l
                ),
                leadsMetadata: orderData.leadsMetadata?.map((meta) =>
                  meta.leadId === lead._id || meta.leadId?._id === lead._id
                    ? { ...meta, ...updatedLeadData }
                    : meta
                ),
              },
            };
          });
        }

        setNotification({
          message: "Lead unmarked as closed network successfully",
          severity: "success",
        });

        fetchOrders();
      } catch (err) {
        console.error("Error unmarking lead as closed network:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to unmark lead as closed network",
          severity: "error",
        });
      }
    },
    [fetchOrders, hoveredOrderId, expandedRowData]
  );

  return {
    handleConfirmDeposit,
    handleCardIssuerSelect,
    handlePspSelect,
    handleDepositCallConfirm,
    handleClosePspDepositDialog,
    handleUnconfirmDeposit,
    handleMarkAsShaved,
    handleConfirmMarkAsShaved,
    handleUnmarkAsShaved,
    handleMarkAsClosedNetwork,
    handleUnmarkAsClosedNetwork,
    handleUndoAction,
    handleRestoreLead,
    handleUndoReplacementFromMenu,
    handleRemoveSelectedLeads,
    handleConvertLeadType,
    handleReplaceLeadSuccess,
    handleChangeFTDSuccess,
    handleAssignLeadSuccess,
  };
};

export default useLeadActions;
