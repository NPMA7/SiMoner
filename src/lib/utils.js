/**
 * Parse last update time from string format
 * Format: "Sat Feb 14 17:07:16 2026"
 */
export function parseLastUpdate(lastUpdateString) {
  try {
    // Try to parse the date string
    // Format: "Sat Feb 14 17:07:16 2026"
    const date = new Date(lastUpdateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('Error parsing last update:', error);
    return null;
  }
}

/**
 * Check if interface is online based on last update
 * Online if last update is within threshold (seconds)
 */
export function isInterfaceOnline(lastUpdateString, thresholdSeconds = 3600) {
  const lastUpdate = parseLastUpdate(lastUpdateString);
  
  if (!lastUpdate) {
    return false;
  }
  
  const now = new Date();
  const diffInSeconds = Math.floor((now - lastUpdate) / 1000);
  
  const threshold = Number.isFinite(thresholdSeconds) ? thresholdSeconds : 3600;
  return diffInSeconds <= threshold;
}

/**
 * Normalize/limit threshold from env to avoid extreme values.
 */
function parseThresholdSeconds(value, fallbackSeconds) {
  const parsed = parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallbackSeconds;
  // clamp 60s .. 7d
  return Math.max(60, Math.min(7 * 24 * 3600, parsed));
}

/**
 * Determine interface category based on naming conventions.
 * - opd: starts with "PPPoE" (or contains "PPPoE -")
 * - system: VLAN/BRIDGE/ETHER/LO/SFP, POSPAM, numeric prefixes, etc.
 * - desa: everything else
 */
export function getInterfaceCategory(interfaceName) {
  if (!interfaceName || typeof interfaceName !== 'string') return 'desa';
  const name = interfaceName;
  const upper = name.toUpperCase();

  const isOPD = name.startsWith('PPPoE') || name.includes('PPPoE -');
  if (isOPD) return 'opd';

  // Remove PPPoE prefix for display-like checks (kept small, matches Home page logic)
  const displayUpper = name.replace(/^PPPoE\s*-\s*/i, '').replace(/^PPPoE\s+/i, '').trim().toUpperCase();

  const isSystem =
    upper.startsWith('VLAN') ||
    upper.startsWith('BRIDGE') ||
    upper.startsWith('ETHER') ||
    upper === 'LO' ||
    upper.startsWith('SFP') ||
    displayUpper.startsWith('POSPAM') ||
    /^\d+[_-]/.test(name) ||
    /^[A-Z0-9]+_[A-Z0-9]+$/.test(upper);

  return isSystem ? 'system' : 'desa';
}

/**
 * Display name helper (used for UI).
 * Removes PPPoE prefix so OPD names look consistent with DESA.
 */
export function getInterfaceDisplayName(interfaceName) {
  if (!interfaceName || typeof interfaceName !== 'string') return interfaceName;
  const cleaned = interfaceName
    .replace(/^PPPoE\s*-\s*/i, '')
    .replace(/^PPPoE\s+/i, '')
    .trim();
  
  // Allow wrapping on "_" without changing the visible text.
  // This prevents long OPD names from overflowing on mobile.
  return cleaned.replace(/_/g, '_\u200b');
}

/**
 * Get offline/online threshold (seconds) per category.
 * Semua kategori (DESA, OPD, SYSTEM) menggunakan threshold dari env.
 * Default: 3600 detik (1 jam) jika tidak di-set.
 */
export function getOfflineThresholdSeconds(category) {
  const defaultSeconds = parseThresholdSeconds(
    process.env.NEXT_PUBLIC_OFFLINE_THRESHOLD_SECONDS,
    3600
  );

  if (category === 'desa') {
    return parseThresholdSeconds(
      process.env.NEXT_PUBLIC_OFFLINE_THRESHOLD_DESA_SECONDS,
      defaultSeconds
    );
  }

  if (category === 'opd') {
    return parseThresholdSeconds(
      process.env.NEXT_PUBLIC_OFFLINE_THRESHOLD_OPD_SECONDS,
      defaultSeconds
    );
  }

  if (category === 'system') {
    return parseThresholdSeconds(
      process.env.NEXT_PUBLIC_OFFLINE_THRESHOLD_SYSTEM_SECONDS,
      defaultSeconds
    );
  }

  return defaultSeconds;
}

/**
 * Get time difference in human readable format with minutes detail
 */
export function getTimeDifference(lastUpdateString) {
  const lastUpdate = parseLastUpdate(lastUpdateString);
  
  if (!lastUpdate) {
    return 'Unknown';
  }
  
  const now = new Date();
  const diffInSeconds = Math.floor((now - lastUpdate) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    // For hours, also show minutes
    const hours = Math.floor(diffInSeconds / 3600);
    const remainingSeconds = diffInSeconds % 3600;
    const minutes = Math.floor(remainingSeconds / 60);
    
    if (minutes > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
  } else {
    // For days, also show hours and minutes
    const days = Math.floor(diffInSeconds / 86400);
    const remainingSeconds = diffInSeconds % 86400;
    const hours = Math.floor(remainingSeconds / 3600);
    const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
    
    const parts = [`${days} day${days !== 1 ? 's' : ''}`];
    if (hours > 0) {
      parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    }
    if (remainingMinutes > 0) {
      parts.push(`${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`);
    }
    
    return `${parts.join(' ')} ago`;
  }
}

