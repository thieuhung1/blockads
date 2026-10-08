// NetShield Content Script: Cosmetic Filtering, Anti-Scam, Anti-Tracking & YouTube Ad Engine

(async function () {
  const currentHostname = window.location.hostname.toLowerCase();
  const isYouTube = currentHostname.includes('youtube.com');

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

    // 1. YouTube Specialized High-Speed Ad Skipper & Anti-Anti-Adblock Engine
    if (isYouTube) {
      initYouTubeEngine();
    }

    // 2. Anti-Tracking & Data Harvesting Protection
    if (antiTrackingEnabled !== false) {
      initAntiTrackingShield();
    }

    // 3. Anti-Scam Protection
    if (antiScamEnabled !== false && !isYouTube) {
      initAntiScamShield();
    }

    // 4. Cosmetic Filter
    if (cosmeticFiltering !== false) {
      runCosmeticCleanup();

      const observer = new MutationObserver(() => {
        runCosmeticCleanup();
        if (antiScamEnabled !== false && !isYouTube) {
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

  // =========================================================================
  // 🌟 YOUTUBE SPECIALIZED ENGINE (Instant Skip, Speed-Up & Modal Dismissal)
  // =========================================================================
  function initYouTubeEngine() {
    let adFastForwardActive = false;
    let userMutedState = false;

    // A. Polling loop optimized for YouTube video states
    setInterval(() => {
      handleYouTubeVideoAds();
      handleYouTubeAntiAdblockPopup();
      dismissYouTubeBannerAds();
    }, 150);

    // B. Fast forward & skip video ads instantly
    function handleYouTubeVideoAds() {
      const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');

      if (!player || !video) return;

      const isAdShowing = player.classList.contains('ad-showing') ||
                          player.classList.contains('ad-interrupting') ||
                          !!document.querySelector('.ytp-ad-player-overlay') ||
                          !!document.querySelector('.ytp-ad-text');

      if (isAdShowing) {
        if (!adFastForwardActive) {
          adFastForwardActive = true;
          userMutedState = video.muted;
          video.muted = true; // Tắt tiếng trong khoảnh khắc quảng cáo chạy
        }

        // Tăng tốc độ phát quảng cáo lên 16x
        try {
          video.playbackRate = 16.0;
        } catch {}

        // Nhảy thời gian tua thẳng về cuối quảng cáo
        if (Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration - 0.1;
        }

        // Bấm nút bỏ qua (Skip button) ngay khi nút xuất hiện
        const skipButtons = [
          '.ytp-ad-skip-button',
          '.ytp-ad-skip-button-modern',
          '.ytp-skip-ad-button',
          '.ytp-ad-skip-button-slot button',
          '.ytp-ad-preview-container button'
        ];

        for (const selector of skipButtons) {
          const btn = document.querySelector(selector);
          if (btn) {
            btn.click();
            break;
          }
        }
      } else {
        // Quảng cáo đã kết thúc -> Khôi phục trạng thái chuẩn
        if (adFastForwardActive) {
          adFastForwardActive = false;
          video.playbackRate = 1.0;
          video.muted = userMutedState;
        }
      }
    }

    // C. Tự động gỡ bỏ Popup cảnh báo chặn quảng cáo của YouTube
    function handleYouTubeAntiAdblockPopup() {
      const modalSelectors = [
        'ytd-enforcement-message-view-model',
        'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)',
        '#feedback.ytd-enforcement-message-view-model'
      ];

      for (const selector of modalSelectors) {
        const modal = document.querySelector(selector);
        if (modal) {
          const parentDialog = modal.closest('tp-yt-paper-dialog') || modal;
          parentDialog.remove();

          // Xóa lớp phủ đen mờ nền
          document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach(el => el.remove());

          // Cho video phát lại tự nhiên
          const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
          if (video && video.paused) {
            video.play().catch(() => {});
          }
        }
      }
    }

    // D. Đóng các banner quảng cáo nổi trên video
    function dismissYouTubeBannerAds() {
      const closeButtons = document.querySelectorAll('.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container button');
      closeButtons.forEach(btn => btn.click());
    }

    // E. Lắng nghe sự kiện chuyển video trong SPA của YouTube
    document.addEventListener('yt-navigate-finish', () => {
      handleYouTubeVideoAds();
      handleYouTubeAntiAdblockPopup();
    });
  }

  // --- 2. Anti-Tracking & Anti-Harvesting Core ---
  function initAntiTrackingShield() {
    try {
      Object.defineProperty(navigator, 'doNotTrack', { get: () => '1', configurable: true });
      Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true, configurable: true });
    } catch {}

    if (navigator.clipboard && navigator.clipboard.readText) {
      const originalReadText = navigator.clipboard.readText.bind(navigator.clipboard);
      let userGestureTimestamp = 0;

      window.addEventListener('keydown', () => { userGestureTimestamp = Date.now(); }, true);
      window.addEventListener('mousedown', () => { userGestureTimestamp = Date.now(); }, true);

      navigator.clipboard.readText = function () {
        if (Date.now() - userGestureTimestamp < 1000) {
          return originalReadText();
        }
        console.warn('[NetShield] Đã chặn nỗ lực ngầm đọc bộ nhớ tạm (Clipboard) trái phép!');
        return Promise.reject(new DOMException('Bị từ chối bởi NetShield Privacy Shield', 'NotAllowedError'));
      };
    }

    try {
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (type, ...args) {
        if (this.width > 0 && this.height > 0 && this.width < 350 && this.height < 150) {
          const ctx = this.getContext('2d');
          if (ctx) {
            try {
              const imgData = ctx.getImageData(0, 0, 1, 1);
              imgData.data[0] = (imgData.data[0] + 1) % 256;
              ctx.putImageData(imgData, 0, 0);
            } catch {}
          }
        }
        return origToDataURL.call(this, type, ...args);
      };
    } catch {}

    if ('getBattery' in navigator) {
      try {
        delete navigator.getBattery;
      } catch {}
    }
  }

  // --- 3. Anti-Scam Shield Functions ---
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

  // --- 4. Cosmetic Ad Cleanup ---
  function runCosmeticCleanup() {
    const adSelectors = [
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
