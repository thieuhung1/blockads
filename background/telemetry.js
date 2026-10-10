// NetShield Telemetry, Threat Heuristics, Rate-Limiting & Badge Management

import { S, tabBlockStats, liveNetworkRequests, scheduleSaveSessionState } from './state.js';
import { normalizeUrl, MAX_RECENT_BLOCKED, THREAT_RULES, TIMING } from './constants.js';
import { logger } from './logger.js';

// Rate-limiting and deduplication maps
const recentBlockedDedupeMap = new Map(); // key `${tabId}:${normalizedUrl}` -> timestamp
const tabBlockRateMap = new Map(); // key tabId -> { count, resetTime }

// Batched counters to prevent lost increments and storage thrashing
let pendingDelta = { totalBlocked: 0, totalScamBlocked: 0, totalTrackingBlocked: 0, totalIpBlocked: 0 };
let pendingRecentBlocked = [];
let flushTimer = null;
let flushChain = Promise.resolve();

export function clearTabBlockRate(tabId) {
  tabBlockRateMap.delete(tabId);
}

// Native Chrome DNR Action Badge management
export async function updateBadgeState() {
  if (chrome.declarativeNetRequest && typeof chrome.declarativeNetRequest.setExtensionActionOptions === 'function') {
    try {
      if (S.enabled) {
        await chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true });
        chrome.action.setBadgeText({ text: '' });
      } else {
        await chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: false });
        chrome.action.setBadgeText({ text: 'OFF' });
        chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
      }
    } catch (err) {
      logger.error('Could not update the extension badge.', err);
    }
  }
}

// Threat heuristics for telemetry categorization
export function isScamThreat(url, hostname) {
  const h = (hostname || '').toLowerCase();
  if (THREAT_RULES.scamHostKeywords.some(keyword => h.includes(keyword))) return true;

  try {
    const parsed = new URL(url);
    const pathAndQuery = (parsed.pathname + parsed.search).toLowerCase();
    return THREAT_RULES.scamPathPattern.test(pathAndQuery);
  } catch {
    return false;
  }
}

export function isTrackerThreat(url, hostname) {
  const h = (hostname || '').toLowerCase();
  if (THREAT_RULES.trackerHosts.some(host => h === host || h.endsWith('.' + host))) return true;

  try {
    const parsed = new URL(url);
    const pathAndQuery = (parsed.pathname + parsed.search).toLowerCase();
    return THREAT_RULES.trackerPathPattern.test(pathAndQuery);
  } catch {
    return false;
  }
}

// Normalized URL deduplication check
function isDuplicateBlock(url, tabId) {
  const norm = normalizeUrl(url);
  const key = `${tabId}:${norm}`;
  const now = Date.now();
  if (recentBlockedDedupeMap.has(key)) {
    if (now - recentBlockedDedupeMap.get(key) < TIMING.telemetryDedupeWindowMs) return true;
  }
  recentBlockedDedupeMap.set(key, now);
  if (recentBlockedDedupeMap.size > TIMING.telemetryMaxDedupeEntries) {
    const oldestKey = recentBlockedDedupeMap.keys().next().value;
    recentBlockedDedupeMap.delete(oldestKey);
  }
  return false;
}

// Record blocked or redirected requests with sanitization and rate-limiting
export function recordBlockedRequest(url, type, tabId, isScam) {
  if (isDuplicateBlock(url, tabId)) return;

  if (tabId && tabId > 0) {
    tabBlockStats[tabId] = (tabBlockStats[tabId] || 0) + 1;
    scheduleSaveSessionState();
  }

  let h = '';
  let isIp = false;
  try {
    const u = new URL(url);
    h = u.hostname;
    isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':');
  } catch {
    h = url.substring(0, 40);
  }

  const isScamCalculated = isScam || isScamThreat(url, h);
  const isTracker = isTrackerThreat(url, h);

  // Sanitize stored data: strip query and hash to prevent token leakage and quota overflow; cap lengths
  const sanitizedUrl = url.split('?')[0].split('#')[0].slice(0, 200);
  const sanitizedHost = h.slice(0, 100);

  const blockRecord = {
    id: Date.now() + Math.random().toString(36).substr(2, 4),
    url: sanitizedUrl,
    hostname: sanitizedHost,
    isIp,
    isScam: isScamCalculated,
    isTracker,
    type: type || 'other',
    timestamp: Date.now()
  };

  pendingDelta.totalBlocked++;
  if (isScamCalculated) pendingDelta.totalScamBlocked++;
  if (isTracker) pendingDelta.totalTrackingBlocked++;
  if (isIp) pendingDelta.totalIpBlocked++;

  // Rate-limit recent entries to max 10 records per second per tab
  const now = Date.now();
  let allowRecent = true;
  if (tabId && tabId > 0) {
    const rate = tabBlockRateMap.get(tabId) || { count: 0, resetTime: now + TIMING.telemetryRateWindowMs };
    if (now > rate.resetTime) {
      rate.count = 0;
      rate.resetTime = now + TIMING.telemetryRateWindowMs;
    }
    rate.count++;
    tabBlockRateMap.set(tabId, rate);
    if (rate.count > TIMING.telemetryMaxEventsPerTabWindow) allowRecent = false;
  }

  if (allowRecent) {
    pendingRecentBlocked.unshift(blockRecord);
    if (pendingRecentBlocked.length > MAX_RECENT_BLOCKED) {
      pendingRecentBlocked.pop();
    }
  }

  // Update live request entry in RAM
  const liveMatch = liveNetworkRequests.find(r => r.url === url && r.tabId === tabId);
  if (liveMatch) {
    liveMatch.status = isScamCalculated ? 'scam_blocked' : (isTracker ? 'tracker_blocked' : (isIp ? 'ip_blocked' : 'blocked'));
  }

  if (!flushTimer) {
    flushTimer = setTimeout(flushStorageCounters, TIMING.telemetryFlushDebounceMs);
  }
}

// Sequenced storage flushing to prevent race conditions
export function flushStorageCounters() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushChain = flushChain.then(doFlushStorageCounters);
  return flushChain;
}

async function doFlushStorageCounters() {
  if (pendingDelta.totalBlocked === 0 && pendingRecentBlocked.length === 0) return;

  const delta = { ...pendingDelta };
  pendingDelta = { totalBlocked: 0, totalScamBlocked: 0, totalTrackingBlocked: 0, totalIpBlocked: 0 };

  const newRecent = [...pendingRecentBlocked];
  pendingRecentBlocked = [];

  try {
    const data = await chrome.storage.local.get([
      'totalBlocked',
      'totalScamBlocked',
      'totalTrackingBlocked',
      'totalIpBlocked',
      'recentBlocked'
    ]);

    S.totalBlocked = (data.totalBlocked || 0) + delta.totalBlocked;
    S.totalScamBlocked = (data.totalScamBlocked || 0) + delta.totalScamBlocked;
    S.totalTrackingBlocked = (data.totalTrackingBlocked || 0) + delta.totalTrackingBlocked;
    S.totalIpBlocked = (data.totalIpBlocked || 0) + delta.totalIpBlocked;
    S.recentBlocked = [...newRecent, ...(Array.isArray(data.recentBlocked) ? data.recentBlocked : [])].slice(0, MAX_RECENT_BLOCKED);

    await chrome.storage.local.set({
      totalBlocked: S.totalBlocked,
      totalScamBlocked: S.totalScamBlocked,
      totalTrackingBlocked: S.totalTrackingBlocked,
      totalIpBlocked: S.totalIpBlocked,
      recentBlocked: S.recentBlocked
    });
  } catch (err) {
    logger.error('Could not flush storage counters.', err);
  }
}

// Atomically reset all telemetry counters and recent logs
export async function resetTelemetry() {
  return await flushStorageCounters().then(async () => {
    pendingDelta = { totalBlocked: 0, totalScamBlocked: 0, totalTrackingBlocked: 0, totalIpBlocked: 0 };
    pendingRecentBlocked = [];
    S.totalBlocked = 0;
    S.totalScamBlocked = 0;
    S.totalTrackingBlocked = 0;
    S.totalIpBlocked = 0;
    S.recentBlocked = [];
    tabBlockRateMap.clear();

    await chrome.storage.local.set({
      totalBlocked: 0,
      totalScamBlocked: 0,
      totalTrackingBlocked: 0,
      totalIpBlocked: 0,
      recentBlocked: []
    });
    scheduleSaveSessionState();
    return { success: true };
  });
}
