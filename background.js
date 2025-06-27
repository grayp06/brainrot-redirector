// background.js
// Enhanced service worker with security, performance, and privacy features

// Constants for security and performance
const CACHE_DURATION = 300000; // 5 minutes in milliseconds
const MAX_REDIRECT_DEPTH = 3; // Prevent redirect loops
const RULE_PRIORITY = {
  WHITELIST: 1,
  SPECIFIC: 2,
  GENERAL: 3
};

// Secure whitelist of allowed destination domains
const ALLOWED_DESTINATIONS = new Set([
  'nebula.tv',
  'codecademy.com',
  'khanacademy.org',
  'coursera.org',
  'edx.org',
  'udemy.com',
  'skillshare.com',
  'brilliant.org',
  'leetcode.com',
  'hackerrank.com'
]);

// Default rules with enhanced security
const DEFAULT_RULES = [
  {
    id: 'youtube-to-nebula',
    from: ['youtube.com', 'www.youtube.com', 'm.youtube.com'],
    to: 'nebula.tv',
    enabled: true,
    priority: RULE_PRIORITY.GENERAL
  },
  {
    id: 'reddit-to-codecademy',
    from: ['reddit.com', 'www.reddit.com', 'old.reddit.com'],
    to: 'codecademy.com',
    enabled: true,
    priority: RULE_PRIORITY.GENERAL
  }
];

// Cache for performance optimization
class RuleCache {
  constructor() {
    this.cache = new Map();
    this.redirectCount = new Map();
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check if cache is expired
    if (Date.now() - item.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  clear() {
    this.cache.clear();
  }

  // Track redirects to prevent loops
  trackRedirect(url) {
    const count = (this.redirectCount.get(url) || 0) + 1;
    this.redirectCount.set(url, count);
    
    // Clear count after a delay
    setTimeout(() => {
      this.redirectCount.delete(url);
    }, 5000);
    
    return count;
  }

  isLooping(url) {
    return (this.redirectCount.get(url) || 0) >= MAX_REDIRECT_DEPTH;
  }
}

const ruleCache = new RuleCache();

// Privacy-focused storage wrapper
class SecureStorage {
  constructor() {
    this.localOnly = false;
  }

  async get(keys) {
    const settings = await chrome.storage.local.get(['privacyMode']);
    const storage = settings.privacyMode ? chrome.storage.local : chrome.storage.sync;
    return storage.get(keys);
  }

  async set(items) {
    const settings = await chrome.storage.local.get(['privacyMode']);
    const storage = settings.privacyMode ? chrome.storage.local : chrome.storage.sync;
    return storage.set(items);
  }

  async remove(keys) {
    // Remove from both storages to ensure cleanup
    await chrome.storage.local.remove(keys);
    await chrome.storage.sync.remove(keys);
  }
}

const secureStorage = new SecureStorage();

// URL validation and sanitization
function isValidUrl(url) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    // Only allow http(s) protocols
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeUrl(url) {
  if (!url) return null;
  
  // Remove any potential XSS attempts
  url = url.replace(/[<>'"]/g, '');
  
  // Ensure proper protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try {
    const parsed = new URL(url);
    // Only return hostname for safety
    return parsed.hostname;
  } catch {
    return null;
  }
}

// Validate redirect destination
function isAllowedDestination(domain) {
  const sanitized = sanitizeUrl(domain);
  if (!sanitized) return false;
  
  // Check against whitelist
  return Array.from(ALLOWED_DESTINATIONS).some(allowed => 
    sanitized === allowed || sanitized.endsWith('.' + allowed)
  );
}

// Initialize extension with security checks
chrome.runtime.onInstalled.addListener(async () => {
  const data = await secureStorage.get(['rules', 'extensionEnabled', 'privacyMode', 'whitelistedDomains']);
  
  // Validate and sanitize existing rules
  let rules = data.rules || DEFAULT_RULES;
  rules = rules.filter(rule => {
    // Validate rule structure
    if (!rule.to || !rule.from || !Array.isArray(rule.from)) return false;
    
    // Check if destination is allowed
    if (!isAllowedDestination(rule.to)) {
      console.warn(`Removed rule with unsafe destination: ${rule.to}`);
      return false;
    }
    
    return true;
  });
  
  // Set default values
  const updates = {};
  if (!data.rules || data.rules.length !== rules.length) {
    updates.rules = rules;
  }
  if (data.extensionEnabled === undefined) {
    updates.extensionEnabled = true;
  }
  if (data.privacyMode === undefined) {
    updates.privacyMode = false;
  }
  if (!data.whitelistedDomains) {
    updates.whitelistedDomains = [];
  }
  
  if (Object.keys(updates).length > 0) {
    await secureStorage.set(updates);
  }
  
  await updateRedirectRules();
});

// Performance-optimized rule update function
async function updateRedirectRules() {
  // Check cache first
  const cacheKey = 'rules-update';
  const cached = ruleCache.get(cacheKey);
  if (cached) return;
  
  const data = await secureStorage.get(['rules', 'extensionEnabled', 'whitelistedDomains', 'incognitoMode']);
  const rules = data.rules || DEFAULT_RULES;
  const enabled = data.extensionEnabled !== false;
  const whitelistedDomains = data.whitelistedDomains || [];
  
  // Batch rule operations for performance
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map(rule => rule.id);
  
  if (!enabled) {
    // Single operation to remove all rules
    if (removeRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds
      });
    }
    ruleCache.set(cacheKey, true);
    return;
  }
  
  // Build new rules with security checks
  const newRules = [];
  let ruleId = 1;
  
  // Add whitelist rules first (highest priority)
  whitelistedDomains.forEach(domain => {
    if (!isValidUrl(domain)) return;
    
    newRules.push({
      id: ruleId++,
      priority: RULE_PRIORITY.WHITELIST,
      action: {
        type: "allow"
      },
      condition: {
        urlFilter: `*://${domain}/*`,
        resourceTypes: ["main_frame"]
      }
    });
  });
  
  // Add redirect rules with validation
  rules.forEach(rule => {
    if (!rule.enabled) return;
    
    // Validate destination
    if (!isAllowedDestination(rule.to)) return;
    
    rule.from.forEach(fromDomain => {
      const sanitizedFrom = sanitizeUrl(fromDomain);
      if (!sanitizedFrom) return;
      
      newRules.push({
        id: ruleId++,
        priority: rule.priority || RULE_PRIORITY.GENERAL,
        action: {
          type: "redirect",
          redirect: {
            url: `https://${rule.to}`
          }
        },
        condition: {
          urlFilter: `*://${sanitizedFrom}/*`,
          resourceTypes: ["main_frame"]
        }
      });
    });
  });
  
  // Batch update for performance
  const updates = {};
  if (removeRuleIds.length > 0) {
    updates.removeRuleIds = removeRuleIds;
  }
  if (newRules.length > 0) {
    updates.addRules = newRules;
  }
  
  if (Object.keys(updates).length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules(updates);
  }
  
  // Cache the operation
  ruleCache.set(cacheKey, true);
}

// Listen for storage changes with debouncing
let updateTimeout;
chrome.storage.onChanged.addListener((changes, namespace) => {
  // Clear cache on any change
  ruleCache.clear();
  
  // Debounce updates for performance
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    updateRedirectRules();
  }, 100);
});

// Handle incognito mode
chrome.runtime.onConnect.addListener(async (port) => {
  if (port.name === 'incognito-check') {
    const data = await secureStorage.get(['incognitoMode', 'incognitoRules']);
    
    if (data.incognitoMode === 'disabled' && port.sender.tab?.incognito) {
      // Disable redirects in incognito mode
      port.postMessage({ action: 'disable' });
    } else if (data.incognitoMode === 'separate' && data.incognitoRules) {
      // Use separate rules for incognito
      port.postMessage({ action: 'separate-rules', rules: data.incognitoRules });
    }
  }
});

// Periodic cleanup for performance
chrome.alarms.create('cleanup', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    ruleCache.clear();
  }
});

// Export settings securely
async function exportSettings() {
  const data = await secureStorage.get(['rules', 'whitelistedDomains']);
  
  // Sanitize data before export
  const sanitized = {
    version: '2.0',
    rules: data.rules.map(rule => ({
      from: rule.from,
      to: rule.to,
      enabled: rule.enabled
    })),
    whitelistedDomains: data.whitelistedDomains,
    exportDate: new Date().toISOString()
  };
  
  return JSON.stringify(sanitized, null, 2);
}

// Import settings with validation
async function importSettings(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    
    // Validate structure
    if (!imported.rules || !Array.isArray(imported.rules)) {
      throw new Error('Invalid settings format');
    }
    
    // Validate and sanitize each rule
    const validatedRules = imported.rules.filter(rule => {
      if (!rule.to || !rule.from || !Array.isArray(rule.from)) return false;
      return isAllowedDestination(rule.to);
    });
    
    if (validatedRules.length === 0) {
      throw new Error('No valid rules found');
    }
    
    // Save validated rules
    await secureStorage.set({
      rules: validatedRules,
      whitelistedDomains: imported.whitelistedDomains || []
    });
    
    return { success: true, rulesImported: validatedRules.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Message handler for popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'export') {
    exportSettings().then(sendResponse);
    return true;
  } else if (request.action === 'import') {
    importSettings(request.data).then(sendResponse);
    return true;
  } else if (request.action === 'clearCache') {
    ruleCache.clear();
    sendResponse({ success: true });
  }
});
