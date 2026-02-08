import api from "../services/api";

const STORAGE_KEY = "sidebarNavOrder";

export const loadNavOrderFromCache = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    // Silent fail
  }
  return [];
};

const saveNavOrderToCache = (navOrder) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(navOrder));
  } catch (err) {
    // Silent fail
  }
};

export const clearNavOrderCache = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    // Silent fail
  }
};

export const loadNavOrder = async () => {
  try {
    const response = await api.get("/users/preferences/sidebar-order");
    if (response.data.success && response.data.data) {
      const navOrder = response.data.data.navOrder || [];
      saveNavOrderToCache(navOrder);
      return navOrder;
    }
  } catch (err) {
    // Silent fail, use cache
  }
  return loadNavOrderFromCache();
};

export const saveNavOrder = async (navOrder) => {
  saveNavOrderToCache(navOrder);
  try {
    await api.put("/users/preferences/sidebar-order", { navOrder });
  } catch (err) {
    // Silent fail - localStorage already updated
  }
};

export const applyNavOrder = (flatItems, savedOrder) => {
  if (!savedOrder || savedOrder.length === 0) return flatItems;

  const itemsByPath = new Map();
  flatItems.forEach((item) => itemsByPath.set(item.path, item));

  const ordered = [];
  const placed = new Set();

  savedOrder.forEach((path) => {
    if (itemsByPath.has(path)) {
      ordered.push(itemsByPath.get(path));
      placed.add(path);
    }
  });

  flatItems.forEach((item) => {
    if (!placed.has(item.path)) {
      ordered.push(item);
    }
  });

  return ordered;
};
