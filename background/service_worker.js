// NetShield Background Service Worker (Manifest V3) - Ad & Anti-Scam Shield

const DYNAMIC_RULE_START_ID = 10000;
const WHITELIST_RULE_START_ID = 50000;
const BYPASS_SCAM_START_ID = 80000;

// In-memory runtime state
let isEnabled = true;
let isAntiScamEnabled = true;
let tabBlockStats = {}; // { tabId: count }
let liveNetworkRequests = []; // Circular buffer of recent requests
const MAX_LIVE_REQUESTS = 150;
const MAX_RECENT_BLOCKED = 50;

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[NetShield] Installed/Updated:', details.reason);
  await initializeStorage();
  await syncRulesWithStorage();
  updateBadgeForAllTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[NetShield] Startup');
  await initializeStorage();
  await syncRulesWithStorage();
});

// Setup default storage if not present
async function initializeStorage() {
  const data = await chrome.storage.local.get([
    'enabled',
    'antiScamEnabled',
    'cosmeticFiltering',
    'totalBlocked',
    'totalScamBlocked',
    'lastBlockedScamUrl',
    'customRules',
    'whitelist',
    'temporaryBypassDomains',
    'recentBlocked',
    'ruleIdCounter'
  ]);

  const defaults = {
    enabled: data.enabled !== undefined ? data.enabled : true,
    antiScamEnabled: data.antiScamEnabled !== undefined ? data.antiScamEnabled : true,
    cosmeticFiltering: data.cosmeticFiltering !== undefined ? data.cosmeticFiltering : true,
    totalBlocked: data.totalBlocked || 0,
    totalScamBlocked: data.totalScamBlocked || 0,
    lastBlockedScamUrl: data.lastBlockedScamUrl || '',
    customRules: data.customRules || [
      {
        id: 10001,
        type: 'ip',
        target: '185.220.101.5',
        note: 'Known Adware/Spam C&C IP',
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 10002,
        type: 'ip',
        target: '45.33.32.156',
        note: 'Aggressive Ad Injection Server',
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 10003,
        type: 'domain',
        target: 'popads.net',
        note: 'Mạng quảng cáo popunder phiền toái',
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 10004,
        type: 'scam',
        target: 'vietcombank-online-banking.top',
        note: 'Mạo danh ngân hàng lừa đảo thông tin (Phishing)',
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 10005,
        type: 'scam',
        target: 'vneid-dinhdanh-gov.top',
        note: 'Giả mạo cổng dịch vụ công VNeID đánh cắp tài khoản',
        enabled: true,
        createdAt: new Date().toISOString()
      }
    ],
    whitelist: data.whitelist || [],
    temporaryBypassDomains: data.temporaryBypassDomains || [],
    recentBlocked: data.recentBlocked || [],
    ruleIdCounter: data.ruleIdCounter || 10006
  };

  await chrome.storage.local.set(defaults);
  isEnabled = defaults.enabled;
  isAntiScamEnabled = defaults.antiScamEnabled;
}

// Synchronize storage configuration with DeclarativeNetRequest dynamic rules
async function syncRulesWithStorage() {
  const {
    enabled,
    antiScamEnabled,
    customRules,
    whitelist,
    temporaryBypassDomains
  } = await chrome.storage.local.get([
    'enabled',
    'antiScamEnabled',
    'customRules',
    'whitelist',
    'temporaryBypassDomains'
  ]);

  isEnabled = enabled !== false;
  isAntiScamEnabled = antiScamEnabled !== false;

  // 1. Enable/Disable static ruleset
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: isEnabled ? ['ruleset_default'] : [],
      disableRulesetIds: isEnabled ? [] : ['ruleset_default']
    });
  } catch (err) {
    console.warn('[NetShield] updateEnabledRulesets error:', err);
  }

  // 2. Fetch existing dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map(r => r.id);

  if (!isEnabled) {
    // If disabled globally, override all
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeRuleIds,
      addRules: [
        {
          id: 99999,
          priority: 999999,
          action: { type: 'allow' },
          condition: {
            urlFilter: '*',
            resourceTypes: [
              'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
              'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
            ]
          }
        }
      ]
    });
    return;
  }

  // 3. Build dynamic rules
  const addRules = [];

  // Add custom block/scam rules
  if (Array.isArray(customRules)) {
    for (const rule of customRules) {
      if (!rule.enabled) continue;

      let filter = rule.target.trim();
      if (!filter.startsWith('*') && !filter.startsWith('||') && !filter.startsWith('http')) {
        filter = `||${filter}^`;
      }

      if (rule.type === 'scam' && isAntiScamEnabled) {
        // Scam rule: Redirect main_frame to warning page, block subresources
        addRules.push({
          id: rule.id,
          priority: 40,
          action: {
            type: 'redirect',
            redirect: { extensionPath: '/warning/warning.html' }
          },
          condition: {
            urlFilter: filter,
            resourceTypes: ['main_frame']
          }
        });

        addRules.push({
          id: rule.id + 100000,
          priority: 40,
          action: { type: 'block' },
          condition: {
            urlFilter: filter,
            resourceTypes: [
              'sub_frame', 'stylesheet', 'script', 'image', 'font',
              'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
            ]
          }
        });
      } else {
        // Standard IP or Domain block
        addRules.push({
          id: rule.id,
          priority: rule.type === 'ip' ? 5 : 4,
          action: { type: 'block' },
          condition: {
            urlFilter: filter,
            resourceTypes: [
              'sub_frame', 'stylesheet', 'script', 'image', 'font',
              'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
            ]
          }
        });
      }
    }
  }

  // Whitelist rules (High priority allow)
  if (Array.isArray(whitelist)) {
    let wId = WHITELIST_RULE_START_ID;
    for (const domain of whitelist) {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
      if (!cleanDomain) continue;
      addRules.push({
        id: wId++,
        priority: 100,
        action: { type: 'allow' },
        condition: {
          initiatorDomains: [cleanDomain],
          resourceTypes: [
            'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
            'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
          ]
        }
      });
    }
  }

  // Temporary Scam Bypass Domains
  if (Array.isArray(temporaryBypassDomains)) {
    let bId = BYPASS_SCAM_START_ID;
    for (const bDomain of temporaryBypassDomains) {
      const clean = bDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
      if (!clean) continue;
      addRules.push({
        id: bId++,
        priority: 500, // Highest priority overrides scam warning redirect
        action: { type: 'allow' },
        condition: {
          urlFilter: `||${clean}^`
        }
      });
    }
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeRuleIds,
      addRules: addRules
    });
    console.log(`[NetShield] Dynamic rules synced (${addRules.length} rules active)`);
  } catch (err) {
    console.error('[NetShield] Error updating dynamic rules:', err);
  }
}

// Observe DNR debug rule matches
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    if (!isEnabled) return;
    const tabId = info.request.tabId;
    const isRedirect = info.rule.action && info.rule.action.type === 'redirect';
    recordBlockedRequest(info.request.url, info.request.type, tabId, info.rule.ruleId, isRedirect);
  });
}

// Network Request Inspector & Scam URL Tracker
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const { url, tabId, type, timeStamp } = details;
    if (tabId < 0) return;

    let hostname = '';
    let isIp = false;
    try {
      const parsed = new URL(url);
      hostname = parsed.hostname;
      isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');
    } catch {
      hostname = url;
    }

    // Check if this looks like a scam destination on main frame
    if (type === 'main_frame' && isAntiScamEnabled) {
      const isKnownScam = isScamThreat(url, hostname);
      if (isKnownScam) {
        await chrome.storage.local.set({ lastBlockedScamUrl: url });
      }
    }

    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      url: url,
      hostname: hostname,
      isIp: isIp,
      type: type,
      tabId: tabId,
      timestamp: timeStamp || Date.now(),
      status: 'pending'
    };

    liveNetworkRequests.unshift(entry);
    if (liveNetworkRequests.length > MAX_LIVE_REQUESTS) {
      liveNetworkRequests.pop();
    }
  },
  { urls: ['<all_urls>'] }
);

function isScamThreat(url, hostname) {
  const scamKeywords = ['vietcombank-online', 'vneid-dinhdanh', 'urgent-security', 'airdrop-claim', 'trungthuong', 'phishing'];
  return scamKeywords.some(k => hostname.includes(k) || url.includes(k));
}

// Record blocked or redirected requests
async function recordBlockedRequest(url, type, tabId, ruleId, isScam) {
  if (tabId && tabId > 0) {
    tabBlockStats[tabId] = (tabBlockStats[tabId] || 0) + 1;
    updateBadge(tabId, tabBlockStats[tabId]);
  }

  const { totalBlocked, totalScamBlocked, recentBlocked } = await chrome.storage.local.get([
    'totalBlocked',
    'totalScamBlocked',
    'recentBlocked'
  ]);

  const newTotal = (totalBlocked || 0) + 1;
  const newScamTotal = isScam ? (totalScamBlocked || 0) + 1 : (totalScamBlocked || 0);

  let hostname = '';
  let isIp = false;
  try {
    const u = new URL(url);
    hostname = u.hostname;
    isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  } catch {
    hostname = url.substring(0, 40);
  }

  const blockRecord = {
    id: Date.now() + Math.random().toString(36).substr(2, 4),
    url: url,
    hostname: hostname,
    isIp: isIp,
    isScam: isScam || false,
    type: type || 'other',
    ruleId: ruleId || null,
    timestamp: Date.now()
  };

  const list = recentBlocked || [];
  list.unshift(blockRecord);
  if (list.length > MAX_RECENT_BLOCKED) {
    list.pop();
  }

  const toUpdate = {
    totalBlocked: newTotal,
    totalScamBlocked: newScamTotal,
    recentBlocked: list
  };

  if (isScam) {
    toUpdate.lastBlockedScamUrl = url;
  }

  await chrome.storage.local.set(toUpdate);

  const liveMatch = liveNetworkRequests.find(r => r.url === url);
  if (liveMatch) {
    liveMatch.status = isScam ? 'scam_blocked' : 'blocked';
  }
}

// Reset tab stats on loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    tabBlockStats[tabId] = 0;
    updateBadge(tabId, 0);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabBlockStats[tabId];
});

// Update Badge display
function updateBadge(tabId, count) {
  if (!isEnabled) {
    chrome.action.setBadgeText({ text: 'OFF', tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#64748b', tabId: tabId });
    return;
  }

  if (count && count > 0) {
    chrome.action.setBadgeText({ text: count.toString(), tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#06b6d4', tabId: tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }
}

async function updateBadgeForAllTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const count = tabBlockStats[tab.id] || 0;
    updateBadge(tab.id, count);
  }
}

// Message handler for Popup, Options & Warning
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_STATE': {
      const data = await chrome.storage.local.get([
        'enabled',
        'antiScamEnabled',
        'cosmeticFiltering',
        'totalBlocked',
        'totalScamBlocked',
        'customRules',
        'whitelist',
        'recentBlocked'
      ]);

      const currentTab = message.tabId ? message.tabId : (sender.tab ? sender.tab.id : null);
      const tabBlocked = currentTab && tabBlockStats[currentTab] ? tabBlockStats[currentTab] : 0;

      return {
        success: true,
        enabled: data.enabled !== false,
        antiScamEnabled: data.antiScamEnabled !== false,
        cosmeticFiltering: data.cosmeticFiltering !== false,
        totalBlocked: data.totalBlocked || 0,
        totalScamBlocked: data.totalScamBlocked || 0,
        tabBlocked: tabBlocked,
        customRules: data.customRules || [],
        whitelist: data.whitelist || [],
        recentBlocked: data.recentBlocked || []
      };
    }

    case 'TOGGLE_MASTER': {
      const newEnabled = message.enabled;
      isEnabled = newEnabled;
      await chrome.storage.local.set({ enabled: isEnabled });
      await syncRulesWithStorage();
      await updateBadgeForAllTabs();
      return { success: true, enabled: isEnabled };
    }

    case 'TOGGLE_ANTI_SCAM': {
      isAntiScamEnabled = message.enabled;
      await chrome.storage.local.set({ antiScamEnabled: isAntiScamEnabled });
      await syncRulesWithStorage();
      return { success: true, antiScamEnabled: isAntiScamEnabled };
    }

    case 'TOGGLE_COSMETIC': {
      await chrome.storage.local.set({ cosmeticFiltering: message.enabled });
      return { success: true, cosmeticFiltering: message.enabled };
    }

    case 'TOGGLE_WHITELIST_SITE': {
      const site = message.domain.toLowerCase().trim();
      const { whitelist } = await chrome.storage.local.get(['whitelist']);
      let updated = whitelist || [];

      if (updated.includes(site)) {
        updated = updated.filter(s => s !== site);
      } else {
        updated.push(site);
      }

      await chrome.storage.local.set({ whitelist: updated });
      await syncRulesWithStorage();
      return { success: true, whitelist: updated, isWhitelisted: updated.includes(site) };
    }

    case 'BYPASS_SCAM_DOMAIN': {
      const domain = message.domain.toLowerCase().trim();
      const { temporaryBypassDomains } = await chrome.storage.local.get(['temporaryBypassDomains']);
      let updated = temporaryBypassDomains || [];

      if (!updated.includes(domain)) {
        updated.push(domain);
      }

      await chrome.storage.local.set({ temporaryBypassDomains: updated });
      await syncRulesWithStorage();
      return { success: true };
    }

    case 'ADD_CUSTOM_RULE': {
      const { target, type, note } = message;
      if (!target) return { success: false, error: 'Thiếu mục tiêu chặn' };

      const { customRules, ruleIdCounter } = await chrome.storage.local.get(['customRules', 'ruleIdCounter']);
      const counter = (ruleIdCounter || DYNAMIC_RULE_START_ID) + 1;

      const newRule = {
        id: counter,
        target: target.trim(),
        type: type || (isTargetIp(target) ? 'ip' : 'domain'),
        note: note || '',
        enabled: true,
        createdAt: new Date().toISOString()
      };

      const updatedRules = customRules || [];
      updatedRules.push(newRule);

      await chrome.storage.local.set({
        customRules: updatedRules,
        ruleIdCounter: counter
      });

      await syncRulesWithStorage();
      return { success: true, rule: newRule };
    }

    case 'DELETE_CUSTOM_RULE': {
      const { ruleId } = message;
      const { customRules } = await chrome.storage.local.get(['customRules']);
      const updatedRules = (customRules || []).filter(r => r.id !== ruleId);

      await chrome.storage.local.set({ customRules: updatedRules });
      await syncRulesWithStorage();
      return { success: true };
    }

    case 'TOGGLE_CUSTOM_RULE': {
      const { ruleId, enabled } = message;
      const { customRules } = await chrome.storage.local.get(['customRules']);
      const updatedRules = (customRules || []).map(r => {
        if (r.id === ruleId) return { ...r, enabled: enabled };
        return r;
      });

      await chrome.storage.local.set({ customRules: updatedRules });
      await syncRulesWithStorage();
      return { success: true };
    }

    case 'GET_LIVE_REQUESTS': {
      const tabId = message.tabId;
      const requests = tabId
        ? liveNetworkRequests.filter(r => r.tabId === tabId)
        : liveNetworkRequests;
      return { success: true, requests: requests.slice(0, 50) };
    }

    case 'RESET_STATS': {
      await chrome.storage.local.set({ totalBlocked: 0, totalScamBlocked: 0, recentBlocked: [] });
      tabBlockStats = {};
      await updateBadgeForAllTabs();
      return { success: true };
    }

    case 'EXPORT_CONFIG': {
      const data = await chrome.storage.local.get([
        'customRules',
        'whitelist',
        'antiScamEnabled',
        'cosmeticFiltering'
      ]);
      return { success: true, config: data };
    }

    case 'IMPORT_CONFIG': {
      const { config } = message;
      if (!config) return { success: false, error: 'Dữ liệu không hợp lệ' };

      const toSet = {};
      if (Array.isArray(config.customRules)) toSet.customRules = config.customRules;
      if (Array.isArray(config.whitelist)) toSet.whitelist = config.whitelist;
      if (typeof config.antiScamEnabled === 'boolean') toSet.antiScamEnabled = config.antiScamEnabled;
      if (typeof config.cosmeticFiltering === 'boolean') toSet.cosmeticFiltering = config.cosmeticFiltering;

      await chrome.storage.local.set(toSet);
      await syncRulesWithStorage();
      return { success: true };
    }

    default:
      return { success: false, error: 'Lệnh không xác định' };
  }
}

function isTargetIp(target) {
  const clean = target.replace(/^(https?:\/\/)?/, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(clean);
}
