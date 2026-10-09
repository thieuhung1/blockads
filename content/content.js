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
      injectMainWorldScript();
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

  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/yt_main_world.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {}
  }

  // =========================================================================
  // 🌟 YOUTUBE SPECIALIZED ENGINE (Instant Skip, Speed-Up, Shorts & DOM Purge)
  // =========================================================================
  function initYouTubeEngine() {
    let adFastForwardActive = false;
    let userMutedState = false;

    // Fast polling loop for YouTube video & UI states
    setInterval(() => {
      handleYouTubeVideoAds();
      handleYouTubeShortsAds();
      handleYouTubeAntiAdblockPopup();
      dismissYouTubeBannerAds();
      cleanYouTubeFeedAds();
    }, 80);

    // B. Fast forward & skip video ads instantly
    function handleYouTubeVideoAds() {
      const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');

      if (!player || !video) return;

      const isAdShowing = player.classList.contains('ad-showing') ||
                          player.classList.contains('ad-interrupting') ||
                          !!document.querySelector('.ytp-ad-player-overlay') ||
                          !!document.querySelector('.ytp-ad-player-overlay-layout') ||
                          !!document.querySelector('.ytp-ad-module > *') ||
                          !!document.querySelector('.ytp-ad-text') ||
                          !!document.querySelector('.ytp-ad-preview-text');

      if (isAdShowing) {
        if (!adFastForwardActive) {
          adFastForwardActive = true;
          userMutedState = video.muted;
          video.muted = true; // Tắt tiếng ngay lập tức
        }

        // Tăng tốc độ phát quảng cáo lên 16x
        try {
          video.playbackRate = 16.0;
        } catch {}

        // Tua thẳng về cuối quảng cáo
        if (Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration || 999999;
        }

        // Đảm bảo video không bị YouTube dừng hình (unpause)
        if (video.paused) {
          video.play().catch(() => {});
        }

        // Bấm nút bỏ qua (Skip button) với đầy đủ chuỗi sự kiện chuột
        const skipButtons = [
          '.ytp-ad-skip-button',
          '.ytp-ad-skip-button-modern',
          '.ytp-skip-ad-button',
          '.ytp-ad-skip-button-slot button',
          '.ytp-ad-preview-container button',
          '.ytp-ad-skip-button-container button',
          'button.ytp-ad-skip-button-modern',
          '.ytp-ad-skip-button-text',
          '.ytp-ad-survey-answer-button'
        ];

        for (const selector of skipButtons) {
          const btn = document.querySelector(selector);
          if (btn) {
            ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(evt => {
              btn.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
            });
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

    // C. Tự động bỏ qua quảng cáo trong YouTube Shorts
    function handleYouTubeShortsAds() {
      if (!window.location.pathname.startsWith('/shorts')) return;
      const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]') ||
                         document.querySelector('ytd-reel-video-renderer[is-active=""]');
      if (activeReel) {
        const isShortAd = !!activeReel.querySelector(
          'ytd-ad-slot-renderer, .ytd-in-feed-ad-layout-renderer, [aria-label*="Sponsored"], [aria-label*="Được tài trợ"]'
        );
        if (isShortAd) {
          const nextBtn = document.querySelector('#navigation-button-down button') ||
                          document.querySelector('.navigation-button-down button');
          if (nextBtn) {
            nextBtn.click();
          } else {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true }));
          }
        }
      }
    }

    // D. Xóa sạch các thẻ quảng cáo in-feed trên trang chủ và thanh gợi ý
    function cleanYouTubeFeedAds() {
      const feedAdSelectors = [
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
      ];

      for (const sel of feedAdSelectors) {
        document.querySelectorAll(sel).forEach(el => el.remove());
      }
    }

    // E. Tự động gỡ bỏ Popup cảnh báo chặn quảng cáo của YouTube
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

    // F. Đóng các banner quảng cáo nổi trên video
    function dismissYouTubeBannerAds() {
      const closeButtons = document.querySelectorAll(
        '.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container button, button.ytp-ad-overlay-close-button'
      );
      closeButtons.forEach(btn => btn.click());
    }

    // G. Lắng nghe sự kiện chuyển video trong SPA của YouTube
    document.addEventListener('yt-navigate-finish', () => {
      handleYouTubeVideoAds();
      handleYouTubeAntiAdblockPopup();
      dismissYouTubeBannerAds();
      cleanYouTubeFeedAds();
    });

    document.addEventListener('yt-page-data-updated', () => {
      handleYouTubeVideoAds();
      cleanYouTubeFeedAds();
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

    // E. Chống lộ IP qua WebRTC (Anti-WebRTC IP Leak)
    try {
      if (window.RTCPeerConnection) {
        const origAddEventListener = RTCPeerConnection.prototype.addEventListener;
        RTCPeerConnection.prototype.addEventListener = function (type, listener, options) {
          if (type === 'icecandidate') {
            const wrapped = function (e) {
              if (e && e.candidate && e.candidate.candidate) {
                const cand = e.candidate.candidate;
                if (/typ host|typ srflx/i.test(cand) && (/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(cand))) {
                  return; // Chặn rò rỉ IP ngầm
                }
              }
              if (typeof listener === 'function') {
                listener.call(this, e);
              }
            };
            return origAddEventListener.call(this, type, wrapped, options);
          }
          return origAddEventListener.call(this, type, listener, options);
        };
      }
    } catch {}
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

  function isPublicIpAdUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      const host = u.hostname;
      // Kiểm tra định dạng IPv4
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        // Loại trừ localhost & dải IP riêng tư (Private IP)
        if (
          host === '127.0.0.1' ||
          host.startsWith('192.168.') ||
          host.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
        ) {
          return false;
        }
        // Kiểm tra từ khóa quảng cáo / popunder / affiliate
        const full = (u.pathname + u.search + u.hash).toLowerCase();
        return /ad|banner|popup|popunder|click|affiliate|track|pixel|jump|bid/i.test(full);
      }
    } catch {}
    return false;
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
    const isDirectIpAd = isPublicIpAdUrl(target.href);

    if (isSuspicious || isDirectIpAd) {
      e.preventDefault();
      e.stopPropagation();
      console.warn('[NetShield] Đã ngăn chặn click-trap/popunder dẫn tới IP hoặc liên kết độc hại:', target.href);
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
