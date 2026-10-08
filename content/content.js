// NetShield Content Script: Cosmetic Filtering & Anti-Scam Protection

(async function () {
  const currentHostname = window.location.hostname.toLowerCase();

  try {
    const { enabled, antiScamEnabled, cosmeticFiltering, whitelist } = await chrome.storage.local.get([
      'enabled',
      'antiScamEnabled',
      'cosmeticFiltering',
      'whitelist'
    ]);

    const isWhitelisted = Array.isArray(whitelist) && whitelist.some(w => currentHostname.includes(w.toLowerCase()));

    // Skip if disabled or whitelisted
    if (enabled === false || isWhitelisted) {
      return;
    }

    // 1. Anti-Scam Protection Modules (If enabled)
    if (antiScamEnabled !== false) {
      initAntiScamShield();
    }

    // 2. Cosmetic Filter (If enabled)
    if (cosmeticFiltering !== false) {
      runCosmeticCleanup();

      const observer = new MutationObserver(() => {
        runCosmeticCleanup();
        if (antiScamEnabled !== false) {
          neutralizeClickJackingOverlays();
        }
      });

      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });

      window.addEventListener('DOMContentLoaded', unlockScrolling);
      window.addEventListener('load', unlockScrolling);
    }
  } catch (e) {
    // Ignore isolated context errors
  }

  // --- Anti-Scam Shield Functions ---
  function initAntiScamShield() {
    neutralizeClickJackingOverlays();

    // Neutralize abusive click events on body attempting to open scam tabs
    document.addEventListener('click', handleScamClickTrap, true);

    // Prevent fake tech-support full-screen hijack
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        const text = (document.fullscreenElement.innerText || '').toLowerCase();
        if (text.includes('virus') || text.includes('microsoft support') || text.includes('cảnh báo')) {
          document.exitFullscreen().catch(() => {});
        }
      }
    });
  }

  // Detect and remove invisible full-screen click traps
  function neutralizeClickJackingOverlays() {
    const elements = document.querySelectorAll('div, a, span');
    for (const el of elements) {
      // Check for elements that span entire screen with extreme z-index
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'absolute') {
        const zIndex = parseInt(style.zIndex, 10);
        if (zIndex > 99999) {
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          const screenW = window.innerWidth;
          const screenH = window.innerHeight;

          // If it covers more than 80% of viewport and is mostly transparent
          if (w >= screenW * 0.8 && h >= screenH * 0.8 && parseFloat(style.opacity) < 0.1) {
            el.remove();
          }
        }
      }
    }
  }

  // Intercept links leading to known scam patterns
  function handleScamClickTrap(e) {
    const target = e.target.closest('a');
    if (!target || !target.href) return;

    const href = target.href.toLowerCase();
    const isSuspicious = (
      href.includes('trungthuong') ||
      href.includes('airdrop-claim') ||
      href.includes('urgent-security') ||
      href.includes('dinhdanh-gov') ||
      href.includes('vietcombank-online')
    );

    if (isSuspicious) {
      e.preventDefault();
      e.stopPropagation();
      alert('🛡️ NetShield đã chặn một liên kết lừa đảo vừa kích hoạt!');
    }
  }

  // --- Cosmetic Ad Cleanup Functions ---
  function runCosmeticCleanup() {
    const adSelectors = [
      'ins.adsbygoogle',
      '[id^="google_ads_"]',
      '[id^="div-gpt-ad"]',
      '.taboola-container',
      '.outbrain-container',
      'div[class*="banner-ads"]',
      'div[class*="ad-placement"]',
      'div[class*="fake-alert"]'
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
    const body = document.body;
    if (body) {
      const computed = window.getComputedStyle(body);
      if (computed.overflow === 'hidden' && !document.querySelector('.modal.show, [role="dialog"][aria-modal="true"]')) {
        body.classList.add('netshield-unlock');
      }
    }
  }
})();
