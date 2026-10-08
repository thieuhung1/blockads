// NetShield Content Script: Cosmetic Filtering, Anti-Scam & Anti-Tracking Shield

(async function () {
  const currentHostname = window.location.hostname.toLowerCase();

  try {
    const {
      enabled,
      antiScamEnabled,
      antiTrackingEnabled,
      cosmeticFiltering,
      whitelist
    } = await chrome.storage.local.get([
      'enabled',
      'antiScamEnabled',
      'antiTrackingEnabled',
      'cosmeticFiltering',
      'whitelist'
    ]);

    const isWhitelisted = Array.isArray(whitelist) && whitelist.some(w => currentHostname.includes(w.toLowerCase()));

    // Skip if disabled or whitelisted
    if (enabled === false || isWhitelisted) {
      return;
    }

    // 1. Anti-Tracking & Data Harvesting Protection (Cấm thu thập thông tin trái phép)
    if (antiTrackingEnabled !== false) {
      initAntiTrackingShield();
    }

    // 2. Anti-Scam Protection
    if (antiScamEnabled !== false) {
      initAntiScamShield();
    }

    // 3. Cosmetic Filter
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
    // Ignore context errors
  }

  // --- 1. Anti-Tracking & Anti-Harvesting Core ---
  function initAntiTrackingShield() {
    // A. Bật tín hiệu Do Not Track & Global Privacy Control
    try {
      Object.defineProperty(navigator, 'doNotTrack', { get: () => '1', configurable: true });
      Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true, configurable: true });
    } catch {}

    // B. Chống đọc trộm bộ nhớ tạm (Anti-Clipboard Sniffing)
    if (navigator.clipboard && navigator.clipboard.readText) {
      const originalReadText = navigator.clipboard.readText.bind(navigator.clipboard);
      let userGestureTimestamp = 0;

      // Ghi nhận tương tác chuột hoặc phím gần nhất của người dùng
      window.addEventListener('keydown', () => { userGestureTimestamp = Date.now(); }, true);
      window.addEventListener('mousedown', () => { userGestureTimestamp = Date.now(); }, true);

      navigator.clipboard.readText = function () {
        // Chỉ cho phép đọc nếu vừa có thao tác từ người dùng trong vòng 1 giây
        if (Date.now() - userGestureTimestamp < 1000) {
          return originalReadText();
        }
        console.warn('[NetShield] Đã chặn nỗ lực ngầm đọc bộ nhớ tạm (Clipboard) trái phép!');
        return Promise.reject(new DOMException('Bị từ chối bởi NetShield Privacy Shield', 'NotAllowedError'));
      };
    }

    // C. Chống lấy dấu vân tay trình duyệt (Anti-Canvas Fingerprinting)
    try {
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (type, ...args) {
        // Nếu canvas có kích thước nhỏ thường dùng để lấy hash vân tay (vd: 16x16, 200x50)
        if (this.width > 0 && this.height > 0 && this.width < 350 && this.height < 150) {
          const ctx = this.getContext('2d');
          if (ctx) {
            try {
              // Thêm 1 lượng nhiễu siêu nhỏ vi lượng ở pixel góc để bẻ gãy mã hash định danh
              const imgData = ctx.getImageData(0, 0, 1, 1);
              imgData.data[0] = (imgData.data[0] + 1) % 256;
              ctx.putImageData(imgData, 0, 0);
            } catch {}
          }
        }
        return origToDataURL.call(this, type, ...args);
      };
    } catch {}

    // D. Giấu thông tin pin và phần cứng (Tránh fingerprinting qua API pin)
    if ('getBattery' in navigator) {
      try {
        delete navigator.getBattery;
      } catch {}
    }
  }

  // --- 2. Anti-Scam Shield Functions ---
  function initAntiScamShield() {
    neutralizeClickJackingOverlays();

    document.addEventListener('click', handleScamClickTrap, true);

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        const text = (document.fullscreenElement.innerText || '').toLowerCase();
        if (text.includes('virus') || text.includes('microsoft support') || text.includes('cảnh báo')) {
          document.exitFullscreen().catch(() => {});
        }
      }
    });
  }

  function neutralizeClickJackingOverlays() {
    const elements = document.querySelectorAll('div, a, span');
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'absolute') {
        const zIndex = parseInt(style.zIndex, 10);
        if (zIndex > 99999) {
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          const screenW = window.innerWidth;
          const screenH = window.innerHeight;

          if (w >= screenW * 0.8 && h >= screenH * 0.8 && parseFloat(style.opacity) < 0.1) {
            el.remove();
          }
        }
      }
    }
  }

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

  // --- 3. Cosmetic Cleanup ---
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
