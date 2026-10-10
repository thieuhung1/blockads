// NetShield Background Service Worker (Manifest V3) - Main Entry Point

import { MAX_LIVE_REQUESTS } from './constants.js';
import { S, tabBlockStats, liveNetworkRequests, ensureInitialized, mutate, scheduleSaveSessionState } from './state.js';
import { doSyncDynamicRules } from './rules.js';
import { applyWebRTCProtection } from './webrtc.js';
import { updateBadgeState, recordBlockedRequest, clearTabBlockRate } from './telemetry.js';
import { handleMessage } from './message_handler.js';
import { logger } from './logger.js';

// Lifecycle Event Listeners
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.debug('Installed or updated:', details.reason);
  await ensureInitialized();
  await mutate(async () => {
    await chrome.storage.local.set(S);
    await doSyncDynamicRules(S);
    await applyWebRTCProtection(S.webrtcProtectionEnabled);
    await updateBadgeState();
  });
});

chrome.runtime.onStartup.addListener(async () => {
  logger.debug('Service worker started.');
  await ensureInitialized();
  // Dynamic rules and static rulesets are already persisted across browser restarts
  await applyWebRTCProtection(S.webrtcProtectionEnabled);
  await updateBadgeState();
});

// Observe DNR debug rule matches (in unpacked/dev mode)
if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    await ensureInitialized();
    if (!S.enabled) return;
    const actionType = info.rule.action?.type;
    // Only count block or redirect actions (ignore allow rules: whitelist, LAN, bypass)
    if (actionType !== 'block' && actionType !== 'redirect') return;

    const tabId = info.request.tabId;
    const isRedirect = actionType === 'redirect';
    recordBlockedRequest(info.request.url, info.request.type, tabId, isRedirect);
  });
}

// Live network request tracking in RAM
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    await ensureInitialized();
    const { url, tabId, type, timeStamp } = details;
    if (tabId < 0) return;

    let h = '';
    let isIp = false;
    try {
      const parsed = new URL(url);
      h = parsed.hostname;
      isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':');
    } catch {
      h = url;
    }

    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      url,
      hostname: h,
      isIp,
      type,
      tabId,
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

// Update status to 'allowed' when request finishes
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    await ensureInitialized();
    const { url, tabId } = details;
    if (tabId < 0) return;

    const match = liveNetworkRequests.find(r => r.url === url && r.tabId === tabId && r.status === 'pending');
    if (match) {
      match.status = 'allowed';
    }
  },
  { urls: ['<all_urls>'] }
);

// Production telemetry fallback when DNR blocks requests (error: 'net::ERR_BLOCKED_BY_CLIENT')
chrome.webRequest.onErrorOccurred.addListener(
  async (details) => {
    await ensureInitialized();
    if (!S.enabled) return;
    const { url, tabId, type, error } = details;
    if (tabId < 0) return;

    if (error === 'net::ERR_BLOCKED_BY_CLIENT') {
      recordBlockedRequest(url, type, tabId, false);
      const match = liveNetworkRequests.find(r => r.url === url && r.tabId === tabId);
      if (match) {
        match.status = 'blocked';
      }
    }
  },
  { urls: ['<all_urls>'] }
);

// Tab lifecycle handlers with ensureInitialized()
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  await ensureInitialized();
  if (changeInfo.status === 'loading' && changeInfo.url) {
    // Preserve tab block count if navigation is to extension warning interstitial
    if (changeInfo.url.startsWith(chrome.runtime.getURL('warning/'))) return;
    tabBlockStats[tabId] = 0;
    scheduleSaveSessionState();
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await ensureInitialized();
  delete tabBlockStats[tabId];
  clearTabBlockRate(tabId);
  scheduleSaveSessionState();
});

// Primary Message Handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await ensureInitialized();
    return await handleMessage(message, sender);
  })()
    .then(sendResponse)
    .catch((err) => {
      logger.error('Message handler failed.', err);
      sendResponse({ success: false, error: err?.message || String(err) });
    });
  return true;
});
