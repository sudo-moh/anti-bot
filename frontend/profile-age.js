
// Detect Profile Age based on some conditions
async function detectProfileAge() {
  const profileData = {};
  const reasons = [];
  let riskScore = 0;

  // ===== 1. COOKIE COUNT =====
  const cookies = document.cookie.split(';').filter(c => c.trim().length > 0);
  profileData.cookieCount = cookies.length;
  
  if (profileData.cookieCount === 0) {
    riskScore += 40;
    reasons.push("No cookies found - indicates fresh profile");
  } else if (profileData.cookieCount < 3) {
    riskScore += 20;
    reasons.push(`Very few cookies (${profileData.cookieCount}) - possibly new profile`);
  } else {
    reasons.push(`Has ${profileData.cookieCount} cookies - profile has been used`);
  }

  // ===== 2. LOCALSTORAGE SIZE =====
  try {
    profileData.localStorageKeys = localStorage.length;
    
    if (profileData.localStorageKeys === 0) {
      riskScore += 40;
      reasons.push("LocalStorage is empty - indicates fresh profile");
    } else if (profileData.localStorageKeys < 3) {
      riskScore += 15;
      reasons.push(`LocalStorage has minimal data (${profileData.localStorageKeys} keys)`);
    } else {
      reasons.push(`Has ${profileData.localStorageKeys} localStorage entries - profile has been used`);
    }
  } catch (e) {
    profileData.localStorageKeys = 'blocked';
    profileData.localStorageError = e.message;
  }

  // ===== 3. SESSIONSTORAGE SIZE =====
  // Note: sessionStorage clears when tab closes, so NOT a good age indicator
  try {
    profileData.sessionStorageKeys = sessionStorage.length;
    // Don't score this - it's per-session and clears regularly
  } catch (e) {
    profileData.sessionStorageKeys = 'blocked';
    profileData.sessionStorageError = e.message;
  }

  // ===== 4. PERMISSIONS =====
  // Note: Most normal users never grant permissions, so this is NOT a good indicator
  const permissionsToCheck = ['geolocation', 'notifications', 'camera', 'microphone'];
  profileData.permissions = {};

  for (const permission of permissionsToCheck) {
    try {
      const result = await navigator.permissions.query({ name: permission });
      profileData.permissions[permission] = result.state;
    } catch (e) {
      profileData.permissions[permission] = 'unsupported';
    }
  }
  // Don't score permissions - they're rarely changed by normal users

  // ===== 5. STORAGE ESTIMATE =====
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      profileData.storageQuota = estimate.quota;
      profileData.storageUsage = estimate.usage;
      profileData.storageUsageMB = (estimate.usage / (1024 * 1024)).toFixed(2);
      profileData.storageQuotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
      
      // Only score if usage is truly zero AND we have no cookies/localStorage
      const usageMB = estimate.usage / (1024 * 1024);
      if (usageMB === 0 && profileData.cookieCount === 0 && profileData.localStorageKeys === 0) {
        riskScore += 20;
        reasons.push("Zero storage usage combined with no data - fresh profile");
      }
    } else {
      profileData.storageEstimate = 'unsupported';
    }
  } catch (e) {
    profileData.storageEstimateError = e.message;
  }

  // ===== 6. SERVICE WORKERS =====
  // Note: Most sites don't use service workers, so this is NOT a good indicator
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      profileData.serviceWorkerCount = registrations.length;
      // Don't score this - it's site-specific, not profile age
    } else {
      profileData.serviceWorkerCount = 'unsupported';
    }
  } catch (e) {
    profileData.serviceWorkerError = e.message;
  }

  // ===== 7. BROWSING HISTORY LENGTH =====
  profileData.historyLength = window.history.length;
  // This is per-tab/session, not a good profile age indicator

  // ===== 8. PLUGINS =====
  profileData.pluginCount = navigator.plugins ? navigator.plugins.length : 0;
  // Modern browsers have 0 plugins, so don't score this

  // ===== 9. TIMEZONE =====
  profileData.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  profileData.timezoneOffset = new Date().getTimezoneOffset();
  // Timezone doesn't indicate profile age

  // ===== 10. LANGUAGE HEADERS =====
  profileData.languages = navigator.languages || [navigator.language];
  profileData.languageCount = profileData.languages.length;
  // Language count doesn't indicate profile age

  // ===== 11. WEBDRIVER FLAG =====
  profileData.webdriver = navigator.webdriver || false;
  // This detects automation, not profile age

  // ===== 12. INDEXEDDB DATABASES =====
  try {
    if (window.indexedDB && indexedDB.databases) {
      const databases = await indexedDB.databases();
      profileData.indexedDBCount = databases.length;
      // Most sites don't use IndexedDB, so don't score this
    } else {
      profileData.indexedDBCount = 'unsupported';
    }
  } catch (e) {
    profileData.indexedDBError = e.message;
  }

  // ===== FINAL SCORING =====
  // Cap the risk score at 100
  riskScore = Math.min(riskScore, 100);

  // Determine status based on risk score
  let status;
  if (riskScore >= 70) {
    status = "Fresh profile (newly created or unused)";
  } else if (riskScore >= 30) {
    status = "Partially aged profile (limited usage)";
  } else {
    status = "Aged profile (normal usage history)";
  }

  // If no red flags were found, add positive note
  if (riskScore < 30 && (profileData.cookieCount > 0 || profileData.localStorageKeys > 0)) {
    reasons.push("Profile shows normal usage history");
  }

  // ===== RETURN RESULT =====
  return {
    profileData: profileData,
    riskScore: riskScore,
    status: status,
    reasons: reasons,
    timestamp: new Date().toISOString()
  };
}
