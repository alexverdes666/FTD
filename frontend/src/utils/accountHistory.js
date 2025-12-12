// Account switching history utility
const RECENT_ACCOUNTS_KEY = 'recentAccountSwitches';
const MAX_RECENT_ACCOUNTS = 5;

export const getRecentAccounts = () => {
  try {
    const stored = localStorage.getItem(RECENT_ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const addRecentAccount = (account) => {
  try {
    const recent = getRecentAccounts();
    
    // Remove if already exists
    const filtered = recent.filter(acc => acc.id !== account.id);
    
    // Add to front
    const updated = [
      {
        id: account.id,
        fullName: account.fullName,
        email: account.email,
        role: account.role,
        switchedAt: new Date().toISOString()
      },
      ...filtered
    ].slice(0, MAX_RECENT_ACCOUNTS);

    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to save recent account:', error);
    return [];
  }
};

export const clearRecentAccounts = () => {
  try {
    localStorage.removeItem(RECENT_ACCOUNTS_KEY);
  } catch (error) {
    console.error('Failed to clear recent accounts:', error);
  }
};

export const getAccountSwitchCount = (accountId) => {
  const recent = getRecentAccounts();
  return recent.filter(acc => acc.id === accountId).length;
};
