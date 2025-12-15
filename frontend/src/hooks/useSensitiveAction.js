import { useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";

/**
 * useSensitiveAction - Hook for executing API calls that require 2FA verification
 *
 * This hook handles the flow of:
 * 1. Attempting the sensitive action
 * 2. Detecting if 2FA is required
 * 3. Prompting user for 2FA code
 * 4. Retrying the action with the 2FA code
 *
 * Usage:
 * ```jsx
 * const {
 *   executeSensitiveAction,
 *   sensitiveActionState,
 *   resetSensitiveAction
 * } = useSensitiveAction();
 *
 * // Execute a sensitive action
 * const result = await executeSensitiveAction({
 *   actionName: 'Update Network Wallets',
 *   actionDescription: 'This will change the wallet addresses for Network ABC',
 *   apiCall: async (headers) => {
 *     return await api.put('/our-networks/123', data, { headers });
 *   },
 * });
 *
 * // In your JSX, render the SensitiveActionModal
 * <SensitiveActionModal
 *   open={sensitiveActionState.showModal}
 *   onClose={resetSensitiveAction}
 *   onVerify={(code, useBackup) => sensitiveActionState.handleVerify(code, useBackup)}
 *   actionName={sensitiveActionState.actionName}
 *   actionDescription={sensitiveActionState.actionDescription}
 *   loading={sensitiveActionState.verifying}
 *   error={sensitiveActionState.error}
 *   requires2FASetup={sensitiveActionState.requires2FASetup}
 * />
 * ```
 */
const useSensitiveAction = () => {
  const { user } = useSelector((state) => state.auth);

  const [state, setState] = useState({
    showModal: false,
    actionName: "",
    actionDescription: "",
    verifying: false,
    error: "",
    requires2FASetup: false,
    pendingApiCall: null,
    pendingResolve: null,
    pendingReject: null,
  });

  /**
   * Reset the sensitive action state
   */
  const resetSensitiveAction = useCallback(() => {
    // Reject any pending promise
    if (state.pendingReject) {
      state.pendingReject(new Error("User cancelled sensitive action"));
    }

    setState({
      showModal: false,
      actionName: "",
      actionDescription: "",
      verifying: false,
      error: "",
      requires2FASetup: false,
      pendingApiCall: null,
      pendingResolve: null,
      pendingReject: null,
    });
  }, [state.pendingReject]);

  /**
   * Handle 2FA verification submission
   */
  const handleVerify = useCallback(
    async (code, useBackupCode) => {
      if (!state.pendingApiCall) {
        console.error("No pending API call to verify");
        return;
      }

      setState((prev) => ({ ...prev, verifying: true, error: "" }));

      try {
        // Build headers with 2FA code
        const headers = {};
        if (useBackupCode) {
          headers["X-2FA-Backup-Code"] = code;
        } else {
          headers["X-2FA-Code"] = code;
        }

        // Execute the API call with 2FA headers
        const result = await state.pendingApiCall(headers);

        // Success - close modal and resolve promise
        setState({
          showModal: false,
          actionName: "",
          actionDescription: "",
          verifying: false,
          error: "",
          requires2FASetup: false,
          pendingApiCall: null,
          pendingResolve: null,
          pendingReject: null,
        });

        if (state.pendingResolve) {
          state.pendingResolve(result);
        }

        toast.success("Action verified and completed successfully");
      } catch (error) {
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Verification failed. Please try again.";

        setState((prev) => ({
          ...prev,
          verifying: false,
          error: errorMessage,
        }));

        // Don't reject yet - let user try again
      }
    },
    [state.pendingApiCall, state.pendingResolve]
  );

  /**
   * Execute a sensitive action
   *
   * @param {Object} options
   * @param {string} options.actionName - Human-readable name of the action
   * @param {string} options.actionDescription - Optional description
   * @param {Function} options.apiCall - Function that takes headers and returns a promise
   * @returns {Promise} - Resolves with API result, rejects if cancelled or failed
   */
  const executeSensitiveAction = useCallback(async (options) => {
    const { actionName, actionDescription = "", apiCall } = options;

    // First, try the API call without 2FA headers
    // If 2FA is required, the backend will return a 403 with requiresSensitiveActionAuth: true
    try {
      const result = await apiCall({});

      // If we got here, 2FA was not required (user might not have 2FA enabled)
      return result;
    } catch (error) {
      const response = error.response?.data;

      // Check if 2FA is required
      if (
        error.response?.status === 403 &&
        response?.requiresSensitiveActionAuth
      ) {
        // Check if user needs to set up 2FA first
        if (response?.requires2FASetup) {
          // Show modal with setup message
          return new Promise((resolve, reject) => {
            setState({
              showModal: true,
              actionName,
              actionDescription,
              verifying: false,
              error: "",
              requires2FASetup: true,
              pendingApiCall: apiCall,
              pendingResolve: resolve,
              pendingReject: reject,
            });
          });
        }

        // Show 2FA verification modal
        return new Promise((resolve, reject) => {
          setState({
            showModal: true,
            actionName: response?.actionDescription || actionName,
            actionDescription,
            verifying: false,
            error: "",
            requires2FASetup: false,
            pendingApiCall: apiCall,
            pendingResolve: resolve,
            pendingReject: reject,
          });
        });
      }

      // Not a 2FA requirement - throw the original error
      throw error;
    }
  }, []);

  return {
    executeSensitiveAction,
    sensitiveActionState: {
      ...state,
      handleVerify,
    },
    resetSensitiveAction,
  };
};

export default useSensitiveAction;





