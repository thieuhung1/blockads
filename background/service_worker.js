// NetShield Background Service Worker (Manifest V3) - Ad, Anti-Scam & Anti-Tracking Shield

const DYNAMIC_RULE_START_ID = 10000;
const WHITELIST_RULE_START_ID = 50000;
const BYPASS_SCAM_START_ID = 80000;
const IP_SHIELD_RULE_START_ID = 95000;

// In-memory runtime state
let isEnabled = true;
let isAntiScamEnabled = true;
let isAntiTrackingEnabled = true;
let isIpAdShieldEnabled = true;
let tabBlockStats = {}; // { tabId: count }
let liveNetworkRequests = []; // Circular buffer of recent requests
const MAX_LIVE_REQUESTS = 150;
const MAX_RECENT_BLOCKED = 50;

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[NetShield] Installed/Updated:', details.reason);
  await initializeStorage();
  await syncRulesWithStorage();
  const { webrtcProtectionEnabled } = await chrome.storage.local.get(['webrtcProtectionEnabled']);
  await applyWebRTCProtection(webrtcProtectionEnabled !== false);
  updateBadgeForAllTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[NetShield] Startup');
  await initializeStorage();
  await syncRulesWithStorage();
  const { webrtcProtectionEnabled } = await chrome.storage.local.get(['webrtcProtectionEnabled']);
  await applyWebRTCProtection(webrtcProtectionEnabled !== false);
});

// Protect IP from WebRTC leak (chống rò rỉ IP ngầm)
async function applyWebRTCProtection(enabled) {
  if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
    try {
      if (enabled) {
        await chrome.privacy.network.webRTCIPHandlingPolicy.set({
          value: 'disable_non_proxied_udp'
        });
        console.log('[NetShield] WebRTC IP leak protection ACTIVE (disable_non_proxied_udp)');
      } else {
        await chrome.privacy.network.webRTCIPHandlingPolicy.clear({});
        console.log('[NetShield] WebRTC IP leak protection CLEARED');
      }
    } catch (err) {
      console.warn('[NetShield] WebRTC policy error:', err);
    }
  }
}

// Setup default storage if not present
async function initializeStorage() {
  const data = await chrome.storage.local.get([
    'enabled',
    'antiScamEnabled',
    'antiTrackingEnabled',
    'ipAdShieldEnabled',
    'webrtcProtectionEnabled',
    'cosmeticFiltering',
    'totalBlocked',
    'totalScamBlocked',
    'totalTrackingBlocked',
    'totalIpBlocked',
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
    antiTrackingEnabled: data.antiTrackingEnabled !== undefined ? data.antiTrackingEnabled : true,
    ipAdShieldEnabled: data.ipAdShieldEnabled !== undefined ? data.ipAdShieldEnabled : true,
    webrtcProtectionEnabled: data.webrtcProtectionEnabled !== undefined ? data.webrtcProtectionEnabled : true,
    cosmeticFiltering: data.cosmeticFiltering !== undefined ? data.cosmeticFiltering : true,
    totalBlocked: data.totalBlocked || 0,
    totalScamBlocked: data.totalScamBlocked || 0,
    totalTrackingBlocked: data.totalTrackingBlocked || 0,
    totalIpBlocked: data.totalIpBlocked || 0,
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
        type: 'tracker',
        target: 'hotjar.com',
        note: 'Session Replay ghi lén thao tác màn hình',
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
  isAntiTrackingEnabled = defaults.antiTrackingEnabled;
  isIpAdShieldEnabled = defaults.ipAdShieldEnabled;
}

// Synchronize storage configuration with DeclarativeNetRequest dynamic rules
async function syncRulesWithStorage() {
  const {
    enabled,
    antiScamEnabled,
    antiTrackingEnabled,
    ipAdShieldEnabled,
    customRules,
    whitelist,
    temporaryBypassDomains
  } = await chrome.storage.local.get([
    'enabled',
    'antiScamEnabled',
    'antiTrackingEnabled',
    'ipAdShieldEnabled',
    'customRules',
    'whitelist',
    'temporaryBypassDomains'
  ]);

  isEnabled = enabled !== false;
  isAntiScamEnabled = antiScamEnabled !== false;
  isAntiTrackingEnabled = antiTrackingEnabled !== false;
  isIpAdShieldEnabled = ipAdShieldEnabled !== false;

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

  // Add custom block/scam/tracker rules
  if (Array.isArray(customRules)) {
    for (const rule of customRules) {
      if (!rule.enabled) continue;

      let filter = rule.target.trim();
      if (!filter.startsWith('*') && !filter.startsWith('||') && !filter.startsWith('http')) {
        filter = `||${filter}^`;
      }

      if (rule.type === 'scam' && isAntiScamEnabled) {
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
      } else if (rule.type === 'tracker') {
        if (!isAntiTrackingEnabled) continue;
        addRules.push({
          id: rule.id,
          priority: 15,
          action: { type: 'block' },
          condition: {
            urlFilter: filter,
            resourceTypes: ['script', 'xmlhttprequest', 'ping', 'sub_frame', 'image', 'other']
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
        priority: 500,
        action: { type: 'allow' },
        condition: {
          urlFilter: `||${clean}^`
        }
      });
    }
  }

  // Tầng Đáy Mạng: Chặn quảng cáo, socket, popunder từ direct IP
  if (isIpAdShieldEnabled) {
    const ipShieldRules = [
      {
        id: 95001,
        priority: 30,
        action: { type: 'block' },
        condition: {
          regexFilter: '^(https?|wss?)://\\d+\\.\\d+\\.\\d+\\.\\d+.*(ad|banner|popup|popunder)',
          resourceTypes: ['sub_frame', 'script', 'websocket', 'xmlhttprequest', 'ping', 'image', 'other']
        }
      },
      {
        id: 95002,
        priority: 30,
        action: { type: 'block' },
        condition: {
          regexFilter: '^(https?|wss?)://\\d+\\.\\d+\\.\\d+\\.\\d+.*(track|pixel|stat|counter)',
          resourceTypes: ['sub_frame', 'script', 'websocket', 'xmlhttprequest', 'ping', 'image', 'other']
        }
      },
      {
        id: 95003,
        priority: 30,
        action: { type: 'block' },
        condition: {
          regexFilter: '^(https?|wss?)://\\d+\\.\\d+\\.\\d+\\.\\d+.*(click|affiliate|bid|jump|promo)',
          resourceTypes: ['sub_frame', 'script', 'websocket', 'xmlhttprequest', 'ping', 'image', 'other']
        }
      },
      {
        id: 95004,
        priority: 30,
        action: { type: 'block' },
        condition: {
          regexFilter: '^(https?|wss?)://\\d+\\.\\d+\\.\\d+\\.\\d+.*(direct|ws|sock)',
          resourceTypes: ['sub_frame', 'script', 'websocket', 'xmlhttprequest', 'ping', 'image', 'other']
        }
      },
      {
        id: 95005,
        priority: 25,
        action: { type: 'block' },
        condition: {
          regexFilter: '^(https?|wss?)://\\d+\\.\\d+\\.\\d+\\.\\d+',
          resourceTypes: ['sub_frame', 'websocket'],
          excludedInitiatorDomains: ['localhost', '127.0.0.1']
        }
      }
    ];

    for (const r of ipShieldRules) {
      if (typeof chrome.declarativeNetRequest.isRegexSupported === 'function') {
        try {
          const check = await chrome.declarativeNetRequest.isRegexSupported({
            regex: r.condition.regexFilter
          });
          if (check && !check.isSupported) {
            console.warn(`[NetShield] Bỏ qua quy tắc IP ${r.id} do Chrome báo không hỗ trợ (${check.reason})`);
            continue;
          }
        } catch {
          // Bỏ qua nếu môi trường không hỗ trợ isRegexSupported
        }
      }
      addRules.push(r);
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

// Network Request Inspector
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

function isTrackerThreat(url, hostname) {
  const trackerKeywords = ['analytics', 'hotjar', 'clarity', 'fullstory', 'fingerprint', 'telemetry', 'track', 'pixel', 'mouseflow', 'smartlook'];
  return trackerKeywords.some(k => hostname.includes(k) || url.includes(k));
}

// Record blocked or redirected requests
async function recordBlockedRequest(url, type, tabId, ruleId, isScam) {
  if (tabId && tabId > 0) {
    tabBlockStats[tabId] = (tabBlockStats[tabId] || 0) + 1;
    updateBadge(tabId, tabBlockStats[tabId]);
  }

  const {
    totalBlocked,
    totalScamBlocked,
    totalTrackingBlocked,
    totalIpBlocked,
    recentBlocked
  } = await chrome.storage.local.get([
    'totalBlocked',
    'totalScamBlocked',
    'totalTrackingBlocked',
    'totalIpBlocked',
    'recentBlocked'
  ]);

  let hostname = '';
  let isIp = false;
  try {
    const u = new URL(url);
    hostname = u.hostname;
    isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');
  } catch {
    hostname = url.substring(0, 40);
  }

  const isTracker = isTrackerThreat(url, hostname);
  const isDirectIpBlock = isIp || (ruleId >= 95001 && ruleId <= 95010) || (ruleId >= 304 && ruleId <= 308);

  const newTotal = (totalBlocked || 0) + 1;
  const newScamTotal = isScam ? (totalScamBlocked || 0) + 1 : (totalScamBlocked || 0);
  const newTrackingTotal = isTracker ? (totalTrackingBlocked || 0) + 1 : (totalTrackingBlocked || 0);
  const newIpTotal = isDirectIpBlock ? (totalIpBlocked || 0) + 1 : (totalIpBlocked || 0);

  const blockRecord = {
    id: Date.now() + Math.random().toString(36).substr(2, 4),
    url: url,
    hostname: hostname,
    isIp: isIp,
    isIpBlocked: isDirectIpBlock,
    isScam: isScam || false,
    isTracker: isTracker,
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
    totalTrackingBlocked: newTrackingTotal,
    totalIpBlocked: newIpTotal,
    recentBlocked: list
  };

  if (isScam) {
    toUpdate.lastBlockedScamUrl = url;
  }

  await chrome.storage.local.set(toUpdate);

  const liveMatch = liveNetworkRequests.find(r => r.url === url);
  if (liveMatch) {
    liveMatch.status = isScam ? 'scam_blocked' : (isTracker ? 'tracker_blocked' : (isDirectIpBlock ? 'ip_blocked' : 'blocked'));
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
        'antiTrackingEnabled',
        'ipAdShieldEnabled',
        'webrtcProtectionEnabled',
        'cosmeticFiltering',
        'totalBlocked',
        'totalScamBlocked',
        'totalTrackingBlocked',
        'totalIpBlocked',
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
        antiTrackingEnabled: data.antiTrackingEnabled !== false,
        ipAdShieldEnabled: data.ipAdShieldEnabled !== false,
        webrtcProtectionEnabled: data.webrtcProtectionEnabled !== false,
        cosmeticFiltering: data.cosmeticFiltering !== false,
        totalBlocked: data.totalBlocked || 0,
        totalScamBlocked: data.totalScamBlocked || 0,
        totalTrackingBlocked: data.totalTrackingBlocked || 0,
        totalIpBlocked: data.totalIpBlocked || 0,
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

    case 'TOGGLE_IP_SHIELD': {
      isIpAdShieldEnabled = message.enabled;
      await chrome.storage.local.set({ ipAdShieldEnabled: isIpAdShieldEnabled });
      await syncRulesWithStorage();
      return { success: true, ipAdShieldEnabled: isIpAdShieldEnabled };
    }

    case 'TOGGLE_ANTI_SCAM': {
      isAntiScamEnabled = message.enabled;
      await chrome.storage.local.set({ antiScamEnabled: isAntiScamEnabled });
      await syncRulesWithStorage();
      return { success: true, antiScamEnabled: isAntiScamEnabled };
    }

    case 'TOGGLE_ANTI_TRACKING': {
      isAntiTrackingEnabled = message.enabled;
      await chrome.storage.local.set({ antiTrackingEnabled: isAntiTrackingEnabled });
      await syncRulesWithStorage();
      return { success: true, antiTrackingEnabled: isAntiTrackingEnabled };
    }

    case 'TOGGLE_WEBRTC_PROTECTION': {
      const val = message.enabled;
      await chrome.storage.local.set({ webrtcProtectionEnabled: val });
      await applyWebRTCProtection(val);
      return { success: true, webrtcProtectionEnabled: val };
    }

    case 'GET_CURRENT_IP': {
      try {
        const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        const json = await res.json();
        return { success: true, ip: json.ip };
      } catch {
        return { success: false, error: 'Không thể kết nối máy chủ IP' };
      }
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
      if (!target || typeof target !== 'string') return { success: false, error: 'Thiếu mục tiêu chặn hoặc dữ liệu không hợp lệ' };

      const cleanTarget = target.trim()
        .replace(/^(https?:\/\/)/i, '')
        .replace(/\/.*$/, '')
        .replace(/[\r\n\t]/g, '')
        .slice(0, 255);

      if (!cleanTarget) return { success: false, error: 'Mục tiêu không hợp lệ' };

      const validTypes = ['ip', 'domain', 'scam', 'tracker', 'pattern'];
      const resolvedType = validTypes.includes(type) ? type : (isTargetIp(cleanTarget) ? 'ip' : 'domain');

      const { customRules, ruleIdCounter } = await chrome.storage.local.get(['customRules', 'ruleIdCounter']);
      const counter = (ruleIdCounter || DYNAMIC_RULE_START_ID) + 1;

      const newRule = {
        id: counter,
        target: cleanTarget,
        type: resolvedType,
        note: (typeof note === 'string' ? note.slice(0, 255) : ''),
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
      await chrome.storage.local.set({
        totalBlocked: 0,
        totalScamBlocked: 0,
        totalTrackingBlocked: 0,
        totalIpBlocked: 0,
        recentBlocked: []
      });
      tabBlockStats = {};
      await updateBadgeForAllTabs();
      return { success: true };
    }

    case 'EXPORT_CONFIG': {
      const data = await chrome.storage.local.get([
        'customRules',
        'whitelist',
        'antiScamEnabled',
        'antiTrackingEnabled',
        'ipAdShieldEnabled',
        'cosmeticFiltering'
      ]);
      return { success: true, config: data };
    }

    case 'IMPORT_CONFIG': {
      const { config } = message;
      if (!config || typeof config !== 'object') return { success: false, error: 'Dữ liệu không hợp lệ' };

      const toSet = {};
      if (Array.isArray(config.customRules)) {
        const validTypes = ['ip', 'domain', 'scam', 'tracker', 'pattern'];
        toSet.customRules = config.customRules
          .filter(r => r && typeof r === 'object' && typeof r.target === 'string')
          .map((r, idx) => ({
            id: typeof r.id === 'number' ? r.id : (DYNAMIC_RULE_START_ID + idx + 1),
            target: r.target.trim().replace(/[\r\n\t]/g, '').slice(0, 255),
            type: validTypes.includes(r.type) ? r.type : 'domain',
            note: typeof r.note === 'string' ? r.note.slice(0, 255) : '',
            enabled: r.enabled !== false,
            createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString()
          }));
      }

      if (Array.isArray(config.whitelist)) {
        toSet.whitelist = config.whitelist
          .filter(w => typeof w === 'string')
          .map(w => w.toLowerCase().trim().replace(/[\r\n\t]/g, '').slice(0, 255))
          .filter(w => w.length > 0);
      }

      if (typeof config.antiScamEnabled === 'boolean') toSet.antiScamEnabled = config.antiScamEnabled;
      if (typeof config.antiTrackingEnabled === 'boolean') toSet.antiTrackingEnabled = config.antiTrackingEnabled;
      if (typeof config.ipAdShieldEnabled === 'boolean') toSet.ipAdShieldEnabled = config.ipAdShieldEnabled;
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
