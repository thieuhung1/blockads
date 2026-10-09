// NetShield State Management, Synchronization & Atomic Mutation Queue

import { DEFAULTS } from './constants.js';
import { doSyncDynamicRules } from './rules.js';

// Global in-memory configuration state
export let S = { ...DEFAULTS };

// Transient runtime telemetry
export let tabBlockStats = {}; // { tabId: count }
export let liveNetworkRequests = []; // Circular buffer

// Global mutation queue: ensures all configuration mutations and rule syncs run strictly serialized
let actionQueue = Promise.resolve();
export function mutate(task) {
  const p = actionQueue.then(task);
  actionQueue = p.catch(err => {
    console.error('[NetShield] Action queue execution error:', err);
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
    } catch {}
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

        if (chrome.storage && chrome.storage.session) {
          try {
            const sess = await chrome.storage.session.get(['tabBlockStats']);
            if (sess.tabBlockStats && typeof sess.tabBlockStats === 'object') {
              tabBlockStats = sess.tabBlockStats;
            }
          } catch {}
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
      } catch {}
    }
  }, 1000);
}
