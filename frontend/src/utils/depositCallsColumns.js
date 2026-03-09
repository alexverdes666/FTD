import api from "../services/api";

const STORAGE_KEY = "depositCalls_visibleColumns";

export const loadColumnsFromCache = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    // Silent fail
  }
  return null;
};

const saveColumnsToCache = (columns) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch (err) {
    // Silent fail
  }
};

export const loadColumns = async () => {
  try {
    const response = await api.get("/users/preferences/deposit-calls-columns");
    if (response.data.success && response.data.data) {
      const columns = response.data.data.columns;
      if (Array.isArray(columns) && columns.length > 0) {
        saveColumnsToCache(columns);
        return columns;
      }
    }
  } catch (err) {
    // Silent fail, use cache
  }
  return loadColumnsFromCache();
};

export const saveColumns = async (columns) => {
  saveColumnsToCache(columns);
  try {
    await api.put("/users/preferences/deposit-calls-columns", { columns });
  } catch (err) {
    // Silent fail - localStorage already updated
  }
};
