import { useState, useEffect, useCallback } from "react";
import {
  getSearchHistory,
  deleteSearchHistoryEntry,
  clearSearchHistory,
} from "../services/searchService";

/**
 * Hook for managing search history
 * @returns {Object} Search history state and methods
 */
const useSearchHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch search history from server
   */
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getSearchHistory();
      if (response.success) {
        setHistory(response.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch search history:", err);
      setError(err.message || "Failed to load search history");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete a specific history entry
   * @param {string} entryId - History entry ID
   */
  const deleteEntry = useCallback(async (entryId) => {
    try {
      await deleteSearchHistoryEntry(entryId);
      setHistory((prev) => prev.filter((item) => item._id !== entryId));
    } catch (err) {
      console.error("Failed to delete search history entry:", err);
      throw err;
    }
  }, []);

  /**
   * Clear all history
   */
  const clearAll = useCallback(async () => {
    try {
      await clearSearchHistory();
      setHistory([]);
    } catch (err) {
      console.error("Failed to clear search history:", err);
      throw err;
    }
  }, []);

  /**
   * Add a new entry to local history (optimistic update)
   * Server saves automatically during search
   * @param {Object} entry - History entry
   */
  const addLocalEntry = useCallback((entry) => {
    setHistory((prev) => {
      // Check for duplicate
      const exists = prev.find((item) => item.query === entry.query);
      if (exists) {
        // Move to top
        return [
          { ...exists, searchedAt: new Date().toISOString() },
          ...prev.filter((item) => item._id !== exists._id),
        ];
      }
      // Add new entry at top, limit to 20
      return [entry, ...prev].slice(0, 20);
    });
  }, []);

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    loading,
    error,
    fetchHistory,
    deleteEntry,
    clearAll,
    addLocalEntry,
  };
};

export default useSearchHistory;
