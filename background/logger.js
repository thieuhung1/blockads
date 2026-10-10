let developerModeEnabled = false;

export function setDeveloperMode(enabled) {
  developerModeEnabled = enabled === true;
}

export const logger = Object.freeze({
  debug(...args) {
    if (developerModeEnabled) console.debug('[NetShield]', ...args);
  },
  warn(...args) {
    if (developerModeEnabled) console.warn('[NetShield]', ...args);
  },
  error(...args) {
    if (developerModeEnabled) console.error('[NetShield]', ...args);
  }
});
