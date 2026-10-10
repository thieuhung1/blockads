// Content-script entry point: read extension settings, then start enabled modules.
(async () => {
  const root = globalThis.__NETSHIELD_CONTENT__;
  let settings = {};

  try {
    settings = await chrome.storage.local.get([
      'enabled',
      'antiScamEnabled',
      'antiTrackingEnabled',
      'cosmeticFiltering',
      'whitelist',
      'developerMode'
    ]);
  } catch (error) {
    root.logger.error('Could not load protection settings.', error);
    settings = {
      enabled: true,
      antiScamEnabled: true,
      antiTrackingEnabled: true,
      cosmeticFiltering: true,
      whitelist: [],
      developerMode: false
    };
  }

  root.logger.configure(settings.developerMode);

  const currentHostname = window.location.hostname.toLowerCase();
  const isYouTube = isSameOrSubdomain(currentHostname, root.config.youtube.hostname);
  const whitelist = Array.isArray(settings.whitelist) ? settings.whitelist : [];
  let isWhitelisted = whitelist.some(domain =>
    typeof domain === 'string' && isSameOrSubdomain(currentHostname, domain.toLowerCase())
  );
  root.featureFlags = Object.freeze({
    antiScamEnabled: settings.antiScamEnabled !== false && !isYouTube
  });

  dispatchPrivacyConfiguration();
  if (chrome.storage && chrome.storage.onChanged) chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const privacySettings = ['developerMode', 'enabled', 'antiTrackingEnabled', 'whitelist'];
    const hasRelevantChange = privacySettings.some(key => Object.prototype.hasOwnProperty.call(changes, key));
    if (!hasRelevantChange) return;

    for (const key of privacySettings) {
      if (Object.prototype.hasOwnProperty.call(changes, key)) settings[key] = changes[key].newValue;
    }

    const updatedWhitelist = Array.isArray(settings.whitelist) ? settings.whitelist : [];
    isWhitelisted = updatedWhitelist.some(domain =>
      typeof domain === 'string' && isSameOrSubdomain(currentHostname, domain.toLowerCase())
    );
    root.featureFlags = Object.freeze({
      antiScamEnabled: settings.antiScamEnabled !== false && !isYouTube
    });
    root.logger.configure(settings.developerMode);
    dispatchPrivacyConfiguration();
  });

  if (settings.enabled === false || isWhitelisted) return;

  if (isYouTube) initializeModule('youtubeBlocker');
  if (root.featureFlags.antiScamEnabled) initializeModule('antiScam');
  if (settings.cosmeticFiltering !== false) initializeModule('cosmeticFilter');

  function isSameOrSubdomain(hostname, domain) {
    const normalizedDomain = domain.trim().replace(/^\.+|\.+$/g, '');
    return normalizedDomain !== '' &&
      (hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`));
  }

  function dispatchPrivacyConfiguration() {
    try {
      window.dispatchEvent(new CustomEvent(root.config.privacyConfigEvent, {
        detail: {
          enabled: settings.enabled !== false && !isWhitelisted && settings.antiTrackingEnabled !== false,
          developerMode: settings.developerMode === true
        }
      }));
    } catch (error) {
      root.logger.error('Could not synchronize privacy settings with the page world.', error);
    }
  }

  function initializeModule(name) {
    try {
      root.modules[name].init();
    } catch (error) {
      root.logger.error(`Could not initialize ${name}.`, error);
    }
  }
})();
