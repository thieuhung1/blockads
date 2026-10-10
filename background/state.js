// NetShield State Management, Synchronization & Atomic Mutation Queue

import { DEFAULTS, TIMING } from './constants.js';
import { doSyncDynamicRules } from './rules.js';
import { logger, setDeveloperMode } from './logger.js';

// Global in-memory configuration state
export let S = { ...DEFAULTS };

// Transient runtime telemetry
export let tabBlockStats = {}; // { tabId: count }
export let liveNetworkRequests = []; // Circular buffer

if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !Object.prototype.hasOwnProperty.call(changes, 'developerMode')) return;
    S.developerMode = changes.developerMode.newValue === true;
    setDeveloperMode(S.developerMode);
  });
}

// Global mutation queue: ensures all configuration mutations and rule syncs run strictly serialized
let actionQueue = Promise.resolve();
export function mutate(task) {
  const p = actionQueue.then(task);
  actionQueue = p.catch(err => {
    logger.error('Action queue execution error.', err);
  });
  return p;
}

// Atomic commit helper: evaluates patch inside queue, writes storage, syncs DNR, and rolls back on error
export const commit = fn => mutate(async () => {
  const patch = typeof fn === 'function' ? fn(S) : fn;
  if (!patch || typeof patch !== 'object') return;
  const prev = S;
  S = { ...S, ...patch };
  try {
    await chrome.storage.local.set(patch);
    await doSyncDynamicRules(S);
  } catch (err) {
    S = prev;
    try {
      await chrome.storage.local.set(prev);
      await doSyncDynamicRules(S);
    } catch (rollbackError) {
      logger.debug('Configuration rollback failed.', rollbackError);
    }
    throw err;
  }
});

// Lifecycle initialization synchronization
let isInitialized = false;
let initPromise = null;

export async function ensureInitialized() {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const stored = await chrome.storage.local.get(DEFAULTS);
        S = stored;
        setDeveloperMode(stored.developerMode);

        if (chrome.storage && chrome.storage.session) {
          try {
            const sess = await chrome.storage.session.get(['tabBlockStats']);
            if (sess.tabBlockStats && typeof sess.tabBlockStats === 'object') {
              tabBlockStats = sess.tabBlockStats;
            }
          } catch (error) {
            logger.debug('Could not restore session tab statistics.', error);
          }
        }
        isInitialized = true;
      } catch (err) {
        initPromise = null; // Reset on failure so subsequent calls can retry
        throw err;
      }
    })();
  }
  await initPromise;
}

// Persist transient session state with throttling
let saveSessionTimer = null;
export function scheduleSaveSessionState() {
  if (saveSessionTimer) return;
  saveSessionTimer = setTimeout(async () => {
    saveSessionTimer = null;
    if (chrome.storage && chrome.storage.session) {
      try {
        await chrome.storage.session.set({ tabBlockStats });
      } catch (error) {
        logger.debug('Could not persist session tab statistics.', error);
      }
    }
  }, TIMING.sessionSaveDebounceMs);
}
