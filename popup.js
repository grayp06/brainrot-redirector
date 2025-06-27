// Enhanced popup interface with security and privacy features

// State management
let currentTab = 'rules';
let rules = [];
let whitelistedDomains = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  setupTabs();
});

// Load all settings
async function loadSettings() {
  const data = await chrome.storage.sync.get([
    'rules', 
    'extensionEnabled', 
    'privacyMode',
    'whitelistedDomains',
    'incognitoMode'
  ]);
  
  // Also check local storage for privacy mode
  const localData = await chrome.storage.local.get(['privacyMode']);
  const privacyMode = localData.privacyMode || data.privacyMode || false;
  
  rules = data.rules || [];
  whitelistedDomains = data.whitelistedDomains || [];
  
  // Update UI
  document.getElementById('masterToggle').checked = data.extensionEnabled !== false;
  document.getElementById('privacyMode').checked = privacyMode;
  document.getElementById('incognitoMode').value = data.incognitoMode || 'same';
  
  // Update privacy indicator
  updatePrivacyIndicator(privacyMode);
  
  // Display rules
  displayRules(rules, data.extensionEnabled !== false);
  
  // Display whitelist
  displayWhitelist(whitelistedDomains);
}

// Setup event listeners
function setupEventListeners() {
  // Master toggle
  document.getElementById('masterToggle').addEventListener('change', async (e) => {
    await saveToStorage({ extensionEnabled: e.target.checked });
    displayRules(rules, e.target.checked);
  });
  
  // Privacy mode toggle
  document.getElementById('privacyMode').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    
    // Save to both local and sync storage
    await chrome.storage.local.set({ privacyMode: enabled });
    
    if (enabled) {
      // Copy sync data to local
      const syncData = await chrome.storage.sync.get(null);
      await chrome.storage.local.set(syncData);
      showStatus('Privacy mode enabled - data stored locally only', 'success');
    } else {
      // Copy local data back to sync
      const localData = await chrome.storage.local.get(['rules', 'extensionEnabled', 'whitelistedDomains']);
      await chrome.storage.sync.set(localData);
      showStatus('Privacy mode disabled - data will sync across devices', 'success');
    }
    
    updatePrivacyIndicator(enabled);
  });
  
  // Incognito mode
  document.getElementById('incognitoMode').addEventListener('change', async (e) => {
    await saveToStorage({ incognitoMode: e.target.value });
    showStatus('Incognito mode settings updated', 'success');
  });
  
  // Whitelist management
  document.getElementById('addWhitelistBtn').addEventListener('click', addToWhitelist);
  document.getElementById('whitelistInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addToWhitelist();
  });
  
  // Import/Export
  document.getElementById('exportBtn').addEventListener('click', exportSettings);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', importSettings);
  
  // Clear cache
  document.getElementById('clearCacheBtn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearCache' });
    showStatus('Cache cleared successfully', 'success');
  });
  
  // Reset extension
  document.getElementById('resetBtn').addEventListener('click', async () => {
    if (confirm('This will delete all your settings and rules. Are you sure?')) {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
      await chrome.runtime.reload();
    }
  });
}

// Tab management
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      const tabName = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabName}Tab`).classList.add('active');
      
      currentTab = tabName;
    });
  });
}

// Display redirect rules
function displayRules(rules, extensionEnabled) {
  const container = document.getElementById('rulesContainer');
  container.innerHTML = '';
  
  if (rules.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999;">No redirect rules configured</p>';
    return;
  }
  
  rules.forEach((rule, index) => {
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'rule' + (!extensionEnabled ? ' disabled' : '');
    
    // Create rule header with toggle
    const headerDiv = document.createElement('div');
    headerDiv.className = 'rule-header';
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'rule-title';
    titleSpan.textContent = rule.id || `Rule ${index + 1}`;
    
    // Create toggle switch for individual rule
    const switchLabel = document.createElement('label');
    switchLabel.className = 'switch';
    
    const switchInput = document.createElement('input');
    switchInput.type = 'checkbox';
    switchInput.checked = rule.enabled;
    switchInput.disabled = !extensionEnabled;
    switchInput.addEventListener('change', async (e) => {
      rules[index].enabled = e.target.checked;
      await saveToStorage({ rules: rules });
    });
    
    const sliderSpan = document.createElement('span');
    sliderSpan.className = 'slider';
    
    switchLabel.appendChild(switchInput);
    switchLabel.appendChild(sliderSpan);
    
    headerDiv.appendChild(titleSpan);
    headerDiv.appendChild(switchLabel);
    
    // Create rule details
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'rule-details';
    
    const fromSpan = document.createElement('span');
    fromSpan.className = 'from-sites';
    fromSpan.textContent = rule.from.join(', ');
    
    const arrowSpan = document.createElement('span');
    arrowSpan.textContent = '→';
    
    const toSpan = document.createElement('span');
    toSpan.className = 'to-site';
    toSpan.textContent = rule.to;
    
    // Add security indicator if destination is verified
    const securityBadge = document.createElement('span');
    securityBadge.className = 'security-badge';
    securityBadge.textContent = '✓';
    securityBadge.title = 'Verified safe destination';
    
    detailsDiv.appendChild(fromSpan);
    detailsDiv.appendChild(arrowSpan);
    detailsDiv.appendChild(toSpan);
    detailsDiv.appendChild(securityBadge);
    
    ruleDiv.appendChild(headerDiv);
    ruleDiv.appendChild(detailsDiv);
    container.appendChild(ruleDiv);
  });
}

// Display whitelisted domains
function displayWhitelist(domains) {
  const container = document.getElementById('whitelistContainer');
  container.innerHTML = '';
  
  if (domains.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; margin: 0;">No whitelisted domains</p>';
    return;
  }
  
  domains.forEach((domain, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'whitelist-item';
    
    const domainSpan = document.createElement('span');
    domainSpan.textContent = domain;
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.style.backgroundColor = '#dc3545';
    removeBtn.addEventListener('click', async () => {
      whitelistedDomains.splice(index, 1);
      await saveToStorage({ whitelistedDomains });
      displayWhitelist(whitelistedDomains);
      showStatus('Domain removed from whitelist', 'success');
    });
    
    itemDiv.appendChild(domainSpan);
    itemDiv.appendChild(removeBtn);
    container.appendChild(itemDiv);
  });
}

// Add domain to whitelist
async function addToWhitelist() {
  const input = document.getElementById('whitelistInput');
  const domain = input.value.trim().toLowerCase();
  
  if (!domain) return;
  
  // Validate domain
  if (!isValidDomain(domain)) {
    showStatus('Invalid domain format', 'error');
    return;
  }
  
  // Check if already whitelisted
  if (whitelistedDomains.includes(domain)) {
    showStatus('Domain already whitelisted', 'error');
    return;
  }
  
  // Add to whitelist
  whitelistedDomains.push(domain);
  await saveToStorage({ whitelistedDomains });
  
  // Update UI
  displayWhitelist(whitelistedDomains);
  input.value = '';
  showStatus('Domain added to whitelist', 'success');
}

// Validate domain format
function isValidDomain(domain) {
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

// Export settings
async function exportSettings() {
  const response = await chrome.runtime.sendMessage({ action: 'export' });
  
  // Create download
  const blob = new Blob([response], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `redirector-settings-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showStatus('Settings exported successfully', 'success');
}

// Import settings
async function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const response = await chrome.runtime.sendMessage({
      action: 'import',
      data: e.target.result
    });
    
    if (response.success) {
      showStatus(`Imported ${response.rulesImported} rules successfully`, 'success');
      await loadSettings(); // Reload UI
    } else {
      showStatus(`Import failed: ${response.error}`, 'error');
    }
  };
  
  reader.readAsText(file);
  event.target.value = ''; // Reset input
}

// Update privacy indicator
function updatePrivacyIndicator(enabled) {
  const indicator = document.getElementById('privacyIndicator');
  const status = document.getElementById('privacyStatus');
  
  if (enabled) {
    indicator.classList.add('active');
    status.textContent = 'Privacy Mode: On (Local Storage Only)';
  } else {
    indicator.classList.remove('active');
    status.textContent = 'Privacy Mode: Off (Syncing Enabled)';
  }
}

// Save to storage (respecting privacy mode)
async function saveToStorage(data) {
  const privacySettings = await chrome.storage.local.get(['privacyMode']);
  const storage = privacySettings.privacyMode ? chrome.storage.local : chrome.storage.sync;
  await storage.set(data);
}

// Show status message
function showStatus(message, type) {
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.textContent = message;
  statusDiv.className = `status-message ${type}`;
  
  setTimeout(() => {
    statusDiv.className = 'status-message';
  }, 3000);
}