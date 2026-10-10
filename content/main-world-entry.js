// Runs before page scripts so privacy API hooks are installed in the page's world.
(() => {
  const root = globalThis.__NETSHIELD_CONTENT__;
  const privacyShield = root.modules.privacyShield;
  const logger = root.logger;
  const configEvent = root.config.privacyConfigEvent;
  privacyShield.configure(true);
  delete globalThis.__NETSHIELD_CONTENT__;

  window.addEventListener(configEvent, event => {
    const detail = event.detail || {};
    logger.configure(detail.developerMode === true);
    privacyShield.configure(detail.enabled === true);
  });
})();
