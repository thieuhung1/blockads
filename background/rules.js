// NetShield DeclarativeNetRequest Dynamic Rules & Session Bypass Engine

import { ALL, SUB, host, isValidWhitelistDomain } from './constants.js';

// Synchronize all declarative dynamic rules with category batching and graceful fallback
export async function doSyncDynamicRules(S) {
  // 1. Enable / disable static ruleset
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: S.enabled ? ['ruleset_default'] : [],
      disableRulesetIds: S.enabled ? [] : ['ruleset_default']
    });
  } catch (err) {
    console.warn('[NetShield] updateEnabledRulesets error:', err);
  }

  // 2. Fetch existing dynamic rules to clear
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id);

  if (!S.enabled) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });
    return;
  }

  // Helper to extract valid ASCII hostnames
  const doms = t => (S.customRules || [])
    .filter(r => r.enabled && r.type === t)
    .map(r => host(r.target))
    .filter(h => /^[a-z0-9.-]+$/.test(h));

  const rules = [];

  // --- Whitelist ---
  const wl = (S.whitelist || []).map(w => host(w)).filter(h => isValidWhitelistDomain(h));
  if (wl.length) {
    rules.push(
      // Allow requests destined TO whitelisted domain (ALL types: main_frame, APIs, etc.)
      { priority: 100, action: { type: 'allow' }, condition: { requestDomains: wl, resourceTypes: ALL } },
      // Allow subresources INITIATED BY whitelisted domain (SUB only: excludes main_frame so phishing links are still caught)
      { priority: 39, action: { type: 'allow' }, condition: { initiatorDomains: wl, resourceTypes: SUB } }
    );
  }

  // --- LAN allow: regex cực nhẹ, không có quantifier lồng nhau ---
  rules.push({
    priority: 35,
    action: { type: 'allow' },
    condition: {
      regexFilter: '^(?:https?|wss?)://(?:127\\.|10\\.|192\\.168\\.|172\\.(?:1[6-9]|2[0-9]|3[01])\\.|localhost)',
      resourceTypes: ALL
    }
  });

  // --- Scam ---
  const scam = S.antiScamEnabled ? doms('scam') : [];
  if (scam.length) {
    rules.push(
      {
        priority: 40,
        action: {
          type: 'redirect',
          redirect: { regexSubstitution: chrome.runtime.getURL('warning/warning.html') + '?url=\\1' }
        },
        condition: {
          requestDomains: scam,
          regexFilter: '^(https?://.*)$',
          resourceTypes: ['main_frame']
        }
      },
      {
        priority: 40,
        action: { type: 'block' },
        condition: { requestDomains: scam, resourceTypes: SUB }
      }
    );
  }

  // --- Trackers ---
  const trackers = S.antiTrackingEnabled ? doms('tracker') : [];
  if (trackers.length) {
    rules.push({
      priority: 15,
      action: { type: 'block' },
      condition: {
        requestDomains: trackers,
        resourceTypes: ['script', 'xmlhttprequest', 'ping', 'sub_frame', 'image', 'other']
      }
    });
  }

  // --- Domain block ---
  const blockDoms = doms('domain');
  if (blockDoms.length) {
    rules.push({
      priority: 4,
      action: { type: 'block' },
      condition: { requestDomains: blockDoms, resourceTypes: SUB }
    });
  }

  // --- IP block ---
  const ipDoms = doms('ip');
  if (ipDoms.length) {
    rules.push({
      priority: 5,
      action: { type: 'block' },
      condition: { requestDomains: ipDoms, resourceTypes: SUB }
    });
  }

  // --- Pattern (urlFilter) ---
  for (const r of (S.customRules || [])) {
    if (r.enabled && r.type === 'pattern' && r.target) {
      rules.push({
        priority: 4,
        action: { type: 'block' },
        condition: { urlFilter: r.target, resourceTypes: SUB }
      });
    }
  }

  // --- YouTube playback shield (Priority 1000) ---
  // Edge + DNR dễ chặn kép → allow mạnh stream & endpoint kiểm tra ad
  // để player không bị xoay vòng / màn đen
  const YT_ALL = [
    'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font',
    'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
  ];
  rules.push(
    // 1) Stream video (quan trọng nhất)
    {
      priority: 1000,
      action: { type: 'allow' },
      condition: {
        requestDomains: ['googlevideo.com'],
        resourceTypes: YT_ALL
      }
    },
    // 2) Ảnh / thumbnail / player assets
    {
      priority: 1000,
      action: { type: 'allow' },
      condition: {
        requestDomains: ['ytimg.com', 'ggpht.com', 'yt3.ggpht.com'],
        resourceTypes: YT_ALL
      }
    },
    // 3) Mọi request do YouTube khởi tạo tới doubleclick/googleads (anti-adblock check)
    {
      priority: 1000,
      action: { type: 'allow' },
      condition: {
        initiatorDomains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
        requestDomains: [
          'doubleclick.net', 'googleads.g.doubleclick.net', 'static.doubleclick.net',
          'googleadservices.com', 'googlesyndication.com', 'pagead2.googlesyndication.com'
        ],
        resourceTypes: YT_ALL
      }
    },
    // 4) Fallback regex doubleclick (khi Edge resolve domain khác)
    {
      priority: 1000,
      action: { type: 'allow' },
      condition: {
        regexFilter: '^https?://([^/]+\\.)?(googleads\\.g\\.)?doubleclick\\.net/',
        resourceTypes: YT_ALL
      }
    },
    // 5) youtubei player API (không chặn nhầm)
    {
      priority: 1000,
      action: { type: 'allow' },
      condition: {
        regexFilter: '^https?://([^/]+\\.)?youtube\\.com/youtubei/v1/player',
        resourceTypes: ['xmlhttprequest', 'other']
      }
    }
  );

  // --- IP Ad Shield: 8 nhóm regex CỰC NHỎ (mỗi nhóm ~15 DFA state) ---
  // Loại trừ initiator YouTube/Google để không chặn stream googlevideo qua IP
  if (S.ipAdShieldEnabled) {
    const ytSafeInitiators = [
      'youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com',
      'ggpht.com', 'google.com', 'googleapis.com', 'gstatic.com'
    ];
    const adGroups = [
      'ads?|banner',
      'popup|popunder',
      'track|pixel',
      'stat|counter',
      'click|affiliate',
      'bid|jump',
      'promo|direct-ad',
      'ad-socket|ad-stream'
    ];
    for (const group of adGroups) {
      rules.push({
        priority: 30,
        action: { type: 'block' },
        condition: {
          regexFilter: '^https?://[0-9.]+[:/].*(?:' + group + ')',
          resourceTypes: ['sub_frame', 'script', 'websocket', 'xmlhttprequest', 'ping', 'image', 'other'],
          excludedInitiatorDomains: ytSafeInitiators
        }
      });
    }

    // Bare IPv4 — không chặn media, không chặn khi trang gốc là YouTube
    rules.push({
      priority: 25,
      action: { type: 'block' },
      condition: {
        regexFilter: '^https?://[0-9.]+(?:[/?#]|$)',
        resourceTypes: ['sub_frame', 'websocket'],
        excludedInitiatorDomains: ['localhost', '127.0.0.1', ...ytSafeInitiators]
      }
    });
  }

  // Number all rules sequentially from 1 to N
  rules.forEach((r, i) => { r.id = i + 1; });

  // --- Apply: batch atomic trước, nếu fail thì per-rule để cô lập rule lỗi ---
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: rules });
    console.log(`[NetShield] Dynamic rules synced (${rules.length} rules active)`);
  } catch (err) {
    console.warn('[NetShield] Batch rule update rejected:', err.message);
    console.warn('[NetShield] Fallback: applying rules one-by-one so one bad rule cannot disable the entire shield');

    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });
    } catch { }

    let applied = 0;
    let skipped = 0;
    for (const r of rules) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [r] });
        applied++;
      } catch (e) {
        skipped++;
        console.warn(`[NetShield] Skipped rule id=${r.id} priority=${r.priority} (${r.action.type}):`, e.message);
      }
    }
    console.log(`[NetShield] Applied ${applied}/${rules.length} rules, ${skipped} skipped`);
  }
}

// Add scoped session allow rule for scam bypass
export async function addSessionBypassRule(targetHost, tabId) {
  const sessionRules = await chrome.declarativeNetRequest.getSessionRules();
  const nextSessionId = sessionRules.reduce((max, r) => Math.max(max, r.id), 0) + 1;

  const condition = {
    requestDomains: [targetHost],
    resourceTypes: ['main_frame', 'sub_frame']
  };
  if (tabId && tabId > 0) {
    condition.tabIds = [tabId];
  }

  await chrome.declarativeNetRequest.updateSessionRules({
    addRules: [
      {
        id: nextSessionId,
        priority: 500,
        action: { type: 'allow' },
        condition
      }
    ]
  });
  console.log(`[NetShield] Session bypass added for ${targetHost} on tab ${tabId || 'all'}`);
}
