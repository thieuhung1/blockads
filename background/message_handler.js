// NetShield Runtime Message Dispatcher & Command Processor

import { S, tabBlockStats, liveNetworkRequests, commit, mutate } from './state.js';
import { flushStorageCounters, resetTelemetry, updateBadgeState, recordBlockedRequest, isScamThreat } from './telemetry.js';
import { applyWebRTCProtection } from './webrtc.js';
import { host, isValidWhitelistDomain } from './constants.js';
import { addSessionBypassRule } from './rules.js';
import { setDeveloperMode } from './logger.js';

export async function handleMessage(message, sender) {
  // Allow safe content script query for cosmetic filtering flag
  if (message.type === 'GET_COSMETIC_FLAG') {
    return { success: true, cosmeticFiltering: S.cosmeticFiltering && S.enabled };
  }

  // Security gate: all configuration and control commands require extension page origin
  if (!sender.url?.startsWith(chrome.runtime.getURL(''))) {
    return { success: false, error: 'Truy cập bị từ chối' };
  }

  switch (message.type) {
    case 'GET_STATE': {
      await flushStorageCounters();
      const currentTab = message.tabId || (sender.tab ? sender.tab.id : null);
      const tabBlocked = currentTab && tabBlockStats[currentTab] ? tabBlockStats[currentTab] : 0;
      return { success: true, ...S, tabBlocked };
    }

    // Consolidated flag toggles
    case 'TOGGLE_MASTER':
    case 'TOGGLE_IP_SHIELD':
    case 'TOGGLE_ANTI_SCAM':
    case 'TOGGLE_ANTI_TRACKING':
    case 'SET_FLAG': {
      const keyMap = {
        TOGGLE_MASTER: 'enabled',
        TOGGLE_IP_SHIELD: 'ipAdShieldEnabled',
        TOGGLE_ANTI_SCAM: 'antiScamEnabled',
        TOGGLE_ANTI_TRACKING: 'antiTrackingEnabled'
      };
      const flagKey = message.type === 'SET_FLAG' ? message.key : keyMap[message.type];
      const ALLOWED_SYNC_FLAGS = ['enabled', 'ipAdShieldEnabled', 'antiScamEnabled', 'antiTrackingEnabled'];
      if (!ALLOWED_SYNC_FLAGS.includes(flagKey)) {
        return { success: false, error: 'Khóa cờ không hợp lệ' };
      }

      const val = Boolean(message.enabled !== undefined ? message.enabled : message.value);
      await commit({ [flagKey]: val });
      if (flagKey === 'enabled') {
        await updateBadgeState();
      }
      return { success: true, [flagKey]: val };
    }

    case 'TOGGLE_COSMETIC': {
      const val = Boolean(message.enabled !== undefined ? message.enabled : message.value);
      await mutate(async () => {
        S.cosmeticFiltering = val;
        await chrome.storage.local.set({ cosmeticFiltering: val });
      });
      return { success: true, cosmeticFiltering: val };
    }

    case 'TOGGLE_DEVELOPER_MODE': {
      const val = Boolean(message.enabled);
      await mutate(async () => {
        S.developerMode = val;
        await chrome.storage.local.set({ developerMode: val });
        setDeveloperMode(val);
      });
      return { success: true, developerMode: val };
    }

    case 'TOGGLE_WEBRTC_PROTECTION': {
      const val = Boolean(message.enabled !== undefined ? message.enabled : message.value);
      return await mutate(async () => {
        S.webrtcProtectionEnabled = val;
        await chrome.storage.local.set({ webrtcProtectionEnabled: val });
        const res = await applyWebRTCProtection(val);
        return { success: res.success !== false, webrtcProtectionEnabled: val, warning: res.reason };
      });
    }

    case 'RECORD_SCAM_BLOCKED': {
      const isFromWarning = sender.url && sender.url.startsWith(chrome.runtime.getURL('warning/'));
      if (!isFromWarning) return { success: false, error: 'Chỉ chấp nhận từ trang cảnh báo' };

      const targetUrl = message.url || '';
      const tabId = sender.tab ? sender.tab.id : (message.tabId || 0);
      const targetHost = host(targetUrl);

      // Verify that the URL actually matches an active scam rule or known scam threat
      const isConfiguredScam = (S.customRules || []).some(r => r.enabled && r.type === 'scam' && host(r.target) === targetHost);
      if (targetUrl && (isConfiguredScam || isScamThreat(targetUrl, targetHost))) {
        recordBlockedRequest(targetUrl, 'main_frame', tabId, true);
      }
      return { success: true };
    }

    case 'BYPASS_SCAM_DOMAIN': {
      const isFromWarning = sender.url && sender.url.startsWith(chrome.runtime.getURL('warning/'));
      if (!isFromWarning) {
        return { success: false, error: 'Chỉ được phép từ trang cảnh báo' };
      }

      const targetHost = host(message.domain);
      if (!isValidWhitelistDomain(targetHost)) {
        return { success: false, error: 'Tên miền không hợp lệ hoặc thuộc public suffix' };
      }

      // Verify domain actually corresponds to an active scam rule or threat
      const isConfiguredScam = (S.customRules || []).some(r => r.enabled && r.type === 'scam' && host(r.target) === targetHost);
      if (!isConfiguredScam && !isScamThreat('', targetHost)) {
        return { success: false, error: 'Tên miền không nằm trong danh sách lừa đảo' };
      }

      try {
        const tabId = sender.tab ? sender.tab.id : null;
        await addSessionBypassRule(targetHost, tabId);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'TOGGLE_WHITELIST_SITE': {
      const site = host(message.domain);
      if (!site) return { success: false, error: 'Thiếu tên miền' };
      if (!isValidWhitelistDomain(site)) {
        return { success: false, error: 'Tên miền không hợp lệ hoặc thuộc public suffix (không thể whitelist TLD/nền tảng chung)' };
      }

      await commit(state => {
        let updated = Array.isArray(state.whitelist) ? [...state.whitelist] : [];
        if (updated.includes(site)) {
          updated = updated.filter(s => s !== site);
        } else {
          updated.push(site);
        }
        return { whitelist: updated };
      });
      return { success: true, whitelist: S.whitelist, isWhitelisted: S.whitelist.includes(site) };
    }

    case 'ADD_CUSTOM_RULE': {
      const { target, type, note } = message;
      if (!target || typeof target !== 'string') {
        return { success: false, error: 'Thiếu mục tiêu chặn' };
      }

      const clean = type === 'pattern'
        ? target.trim().slice(0, 255)
        : host(target);

      if (!clean) return { success: false, error: 'Mục tiêu không hợp lệ' };
      if (type !== 'pattern' && !/^[a-z0-9.-]+$/.test(clean)) {
        return { success: false, error: 'Tên miền hoặc IP chứa ký tự không hợp lệ' };
      }

      const validTypes = ['ip', 'domain', 'scam', 'tracker', 'pattern'];
      const resolvedType = validTypes.includes(type) ? type : (/^(\d{1,3}\.){3}\d{1,3}$/.test(clean) ? 'ip' : 'domain');

      let newRule = null;
      await commit(state => {
        const existing = Array.isArray(state.customRules) ? state.customRules : [];
        const maxId = existing.reduce((max, r) => Math.max(max, r.id || 0), 0);
        newRule = {
          id: maxId + 1,
          target: clean,
          type: resolvedType,
          note: typeof note === 'string' ? note.slice(0, 255) : '',
          enabled: true,
          createdAt: new Date().toISOString()
        };
        return { customRules: [...existing, newRule] };
      });
      return { success: true, rule: newRule };
    }

    case 'DELETE_CUSTOM_RULE': {
      const { ruleId } = message;
      await commit(state => ({
        customRules: (state.customRules || []).filter(r => r.id !== ruleId)
      }));
      return { success: true };
    }

    case 'TOGGLE_CUSTOM_RULE': {
      const { ruleId, enabled } = message;
      await commit(state => ({
        customRules: (state.customRules || []).map(r => r.id === ruleId ? { ...r, enabled: Boolean(enabled) } : r)
      }));
      return { success: true };
    }

    case 'RESET_STATS': {
      await resetTelemetry();
      return { success: true };
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

    case 'GET_LIVE_REQUESTS': {
      const tabId = message.tabId;
      const requests = tabId ? liveNetworkRequests.filter(r => r.tabId === tabId) : liveNetworkRequests;
      return { success: true, requests: requests.slice(0, 50) };
    }

    case 'EXPORT_CONFIG': {
      await flushStorageCounters();
      return {
        success: true,
        config: {
          customRules: S.customRules || [],
          whitelist: S.whitelist || [],
          antiScamEnabled: S.antiScamEnabled !== false,
          antiTrackingEnabled: S.antiTrackingEnabled !== false,
          ipAdShieldEnabled: S.ipAdShieldEnabled !== false,
          webrtcProtectionEnabled: S.webrtcProtectionEnabled !== false,
          cosmeticFiltering: S.cosmeticFiltering !== false
        }
      };
    }

    case 'IMPORT_CONFIG': {
      const { config } = message;
      if (!config || typeof config !== 'object') return { success: false, error: 'Dữ liệu không hợp lệ' };

      const validTypes = ['ip', 'domain', 'scam', 'tracker', 'pattern'];
      const patch = {};

      if (Array.isArray(config.customRules)) {
        patch.customRules = config.customRules
          .slice(0, 5000)
          .filter(r => r && typeof r === 'object' && typeof r.target === 'string')
          .map((r, idx) => {
            const clean = r.type === 'pattern' ? r.target.trim().slice(0, 255) : host(r.target);
            return {
              id: idx + 1,
              target: clean,
              type: validTypes.includes(r.type) ? r.type : 'domain',
              note: typeof r.note === 'string' ? r.note.slice(0, 255) : '',
              enabled: r.enabled !== false,
              createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString()
            };
          })
          .filter(r => r.type === 'pattern' || (r.target && /^[a-z0-9.-]+$/.test(r.target)));
      }

      // Filter whitelist strictly against public suffixes and invalid domains
      if (Array.isArray(config.whitelist)) {
        patch.whitelist = config.whitelist
          .map(w => host(w))
          .filter(w => isValidWhitelistDomain(w))
          .slice(0, 2000);
      }

      // Security hardening: reject social engineering attempts to silently disable core protections
      if (config.antiScamEnabled === true) patch.antiScamEnabled = true;
      if (config.antiTrackingEnabled === true) patch.antiTrackingEnabled = true;
      if (config.ipAdShieldEnabled === true) patch.ipAdShieldEnabled = true;
      if (typeof config.cosmeticFiltering === 'boolean') patch.cosmeticFiltering = config.cosmeticFiltering;
      if (typeof config.webrtcProtectionEnabled === 'boolean') patch.webrtcProtectionEnabled = config.webrtcProtectionEnabled;

      await commit(patch);

      // Apply WebRTC policy only AFTER commit succeeds
      if (typeof patch.webrtcProtectionEnabled === 'boolean') {
        await applyWebRTCProtection(patch.webrtcProtectionEnabled);
      }

      return { success: true };
    }

    default:
      return { success: false, error: 'Lệnh không xác định' };
  }
}
