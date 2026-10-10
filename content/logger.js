// Set developerMode in chrome.storage.local to enable content-script diagnostics.
(() => {
  const root = globalThis.__NETSHIELD_CONTENT__ || (globalThis.__NETSHIELD_CONTENT__ = {});
  let enabled = false;

  root.logger = Object.freeze({
    configure(developerMode) {
      enabled = developerMode === true;
    },
    debug(...args) {
      if (enabled) console.debug('[NetShield]', ...args);
    },
    warn(...args) {
      if (enabled) console.warn('[NetShield]', ...args);
    },
    error(...args) {
      if (enabled) console.error('[NetShield]', ...args);
    }
  });
})();
