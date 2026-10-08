// NetShield Content Script: Cosmetic Filtering & Clean-up

(async function () {
  const currentHostname = window.location.hostname.toLowerCase();

  // Query state from storage or background
  try {
    const { enabled, cosmeticFiltering, whitelist } = await chrome.storage.local.get([
      'enabled',
      'cosmeticFiltering',
      'whitelist'
    ]);

    const isWhitelisted = Array.isArray(whitelist) && whitelist.some(w => currentHostname.includes(w.toLowerCase()));

    // If ad blocking is disabled or site is whitelisted, skip cosmetic cleanup
    if (enabled === false || cosmeticFiltering === false || isWhitelisted) {
      return;
    }

    // Run clean up
    runCosmeticCleanup();

    // Observe dynamic elements added after page load
    const observer = new MutationObserver((mutations) => {
      runCosmeticCleanup();
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });

    // Cleanup anti-adblock scroll locking
    window.addEventListener('DOMContentLoaded', unlockScrolling);
    window.addEventListener('load', unlockScrolling);
  } catch (e) {
    // Context might be invalidated or permission restricted
  }

  function runCosmeticCleanup() {
    const adSelectors = [
      'ins.adsbygoogle',
      '[id^="google_ads_"]',
      '[id^="div-gpt-ad"]',
      '.taboola-container',
      '.outbrain-container',
      'div[class*="banner-ads"]',
      'div[class*="ad-placement"]'
    ];

    for (const selector of adSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.style.display !== 'none') {
          el.style.setProperty('display', 'none', 'important');
        }
      }
    }
  }

  function unlockScrolling() {
    // If anti-adblock overlays add backdrop blur or overflow:hidden to body
    const body = document.body;
    if (body) {
      const computed = window.getComputedStyle(body);
      if (computed.overflow === 'hidden' && !document.querySelector('.modal.show, [role="dialog"][aria-modal="true"]')) {
        body.classList.add('netshield-unlock');
      }
    }
  }
})();
