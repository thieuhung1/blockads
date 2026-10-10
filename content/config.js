// Shared content-script configuration. Each ordered manifest script group has
// its own global in its JavaScript world.
(() => {
  const root = globalThis.__NETSHIELD_CONTENT__ || (globalThis.__NETSHIELD_CONTENT__ = {});

  root.config = Object.freeze({
    privacyConfigEvent: 'netshield:privacy-config',
    observerDebounceMs: 200,
    youtube: Object.freeze({
      hostname: 'youtube.com',
      playerSelector: '#movie_player',
      adSeekSafetySeconds: 0.1,
      adOverlaySelector: '.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout',
      adPlayerClasses: Object.freeze(['ad-showing', 'ad-interrupting']),
      skipButtonSelectors: Object.freeze([
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button-slot button'
      ]),
      feedAdSelectors: Object.freeze([
        'ytd-ad-slot-renderer',
        'ytd-in-feed-ad-layout-renderer',
        'ytd-banner-promo-renderer',
        'ytd-statement-banner-renderer',
        'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)',
        'ytd-rich-section-renderer:has(ytd-ad-slot-renderer)',
        '#masthead-ad',
        '#player-ads',
        'ytd-promoted-sparkles-web-renderer',
        'ytd-compact-promoted-video-renderer',
        'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]'
      ]),
      enforcementSelectors: Object.freeze([
        'ytd-enforcement-message-view-model',
        'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
        '#feedback.ytd-enforcement-message-view-model'
      ]),
      bannerCloseSelector: '.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container button, button.ytp-ad-overlay-close-button'
    }),
    cosmeticSelectors: Object.freeze([
      'ins.adsbygoogle',
      '[id^="google_ads_"]',
      '[id^="div-gpt-ad"]',
      '.taboola-container',
      '.outbrain-container',
      'div[class*="banner-ads"]',
      'div[class*="ad-placement"]',
      'div[class*="fake-alert"]',
      '#masthead-ad',
      'ytd-ad-slot-renderer'
    ]),
    antiScam: Object.freeze({
      version: 1,
      source: 'bundled',
      suspiciousFullscreenKeywords: Object.freeze(['virus', 'microsoft support', 'cảnh báo']),
      suspiciousUrlKeywords: Object.freeze([
        'trungthuong',
        'airdrop-claim',
        'urgent-security',
        'dinhdanh-gov',
        'vietcombank-online'
      ]),
      publicIpAdPathKeywords: Object.freeze([
        'ad', 'banner', 'popup', 'popunder', 'click', 'affiliate', 'track', 'pixel', 'jump', 'bid'
      ])
    }),
    clickjacking: Object.freeze({
      minimumZIndex: 99999,
      minimumViewportCoverage: 0.8,
      maximumOverlayOpacity: 0.1
    }),
    canvas: Object.freeze({
      maximumWidth: 512,
      maximumHeight: 512,
      noisePixelCount: 3
    })
  });
})();
