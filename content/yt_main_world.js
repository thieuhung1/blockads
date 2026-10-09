// NetShield Pro - YouTube Main World Engine (safe mode)
// Chỉ loại bỏ field quảng cáo, KHÔNG tạo lại Response → tránh màn hình đen

(function () {
  'use strict';

  if (window.__netshield_yt_injected) return;
  window.__netshield_yt_injected = true;

  // --- 1. Chỉ xóa field quảng cáo, giữ nguyên toàn bộ dữ liệu phát video ---
  function stripAds(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    try {
      if (obj.adPlacements) delete obj.adPlacements;
      if (obj.playerAds) delete obj.playerAds;
      if (obj.adSlots) delete obj.adSlots;
      if (obj.adBreakHeartbeatParams) delete obj.adBreakHeartbeatParams;
      // Một số bản YouTube đặt ads trong streamingData
      if (obj.streamingData && obj.streamingData.adPlacements) {
        delete obj.streamingData.adPlacements;
      }
    } catch (e) { }
    return obj;
  }

  // Intercept ytInitialPlayerResponse (an toàn – chỉ mutate object sẵn có)
  try {
    let _pr = window.ytInitialPlayerResponse;
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      get: () => _pr,
      set: (val) => { _pr = stripAds(val); },
      configurable: true
    });
    if (window.ytInitialPlayerResponse) {
      stripAds(window.ytInitialPlayerResponse);
    }
  } catch (e) { }

  // --- 2. Fetch: CHỈ chặn endpoint ad_break / log ad, KHÔNG đụng /player chính ---
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let url = '';
    try {
      url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    } catch (e) { }

    // Chỉ stub các request quảng cáo thuần, không đụng player response
    if (
      url.includes('/youtubei/v1/player/ad_break') ||
      url.includes('/youtubei/v1/log_event') &&
      args[1] &&
      typeof args[1].body === 'string' &&
      /"ad"|adBreak|adPlacement/i.test(args[1].body)
    ) {
      return new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Để nguyên mọi request khác (kể cả /youtubei/v1/player)
    return originalFetch.apply(this, args);
  };

  // --- 3. Không còn intercept XHR responseText của /player (tránh phá stream) ---
  // (Giữ nguyên XHR gốc)

  // --- 4. Skip quảng cáo an toàn – chỉ khi chắc chắn đang ad ---
  let isSkipping = false;
  let userMutedState = false;

  function isDefinitelyAd(player, video) {
    if (!player || !video) return false;

    // Ưu tiên API nội bộ của player
    try {
      if (typeof player.getAdState === 'function' && player.getAdState() > 0) {
        return true;
      }
    } catch (e) { }

    const hasAdClass =
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting');

    // Overlay quảng cáo thật sự
    const hasOverlay =
      !!document.querySelector('.ytp-ad-player-overlay:not([style*="display: none"])') ||
      !!document.querySelector('.ytp-ad-player-overlay-layout') ||
      !!document.querySelector('.ytp-ad-text') ||
      !!document.querySelector('.ytp-ad-preview-text') ||
      !!document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');

    // Tránh false-positive: nếu video đang phát nội dung dài và không có overlay → không coi là ad
    if (hasAdClass && hasOverlay) return true;
    if (hasAdClass && typeof player.getAdState === 'function') {
      try {
        return player.getAdState() > 0;
      } catch (e) { }
    }
    return hasAdClass && hasOverlay;
  }

  function clickSkipButtons() {
    const selectors = [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button-slot button',
      '.ytp-ad-preview-container button',
      '.ytp-ad-skip-button-container button',
      'button.ytp-ad-skip-button-modern'
    ];
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
        try {
          btn.click();
        } catch (e) {
          ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((t) => {
            btn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
          });
        }
        break;
      }
    }
  }

  function fastForwardAndSkip() {
    const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    const video = document.querySelector('video.html5-main-video') || document.querySelector('#movie_player video');

    if (!player || !video) return;

    if (isDefinitelyAd(player, video)) {
      if (!isSkipping) {
        isSkipping = true;
        userMutedState = video.muted;
        try { video.muted = true; } catch (e) { }
      }

      // Chỉ tua nhanh, không nhảy currentTime nếu duration bất thường (tránh phá video chính)
      try {
        if (video.playbackRate < 8) video.playbackRate = 16;
      } catch (e) { }

      try {
        if (typeof player.skipAd === 'function') player.skipAd();
      } catch (e) { }

      // Chỉ seek khi duration hợp lệ và khá ngắn (quảng cáo thường < 60–120s)
      try {
        const d = video.duration;
        if (Number.isFinite(d) && d > 0 && d < 120) {
          video.currentTime = d;
        }
      } catch (e) { }

      if (video.paused) {
        video.play().catch(() => { });
      }

      clickSkipButtons();
    } else if (isSkipping) {
      isSkipping = false;
      try {
        video.playbackRate = 1;
        video.muted = userMutedState;
      } catch (e) { }
    }
  }

  // Poll nhẹ hơn (150ms) để giảm tải
  setInterval(fastForwardAndSkip, 150);

  // Gỡ popup anti-adblock
  setInterval(() => {
    const dialogs = document.querySelectorAll(
      'ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)'
    );
    if (dialogs.length) {
      dialogs.forEach((d) => {
        const parent = d.closest('tp-yt-paper-dialog') || d;
        try { parent.remove(); } catch (e) { }
      });
      document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach((b) => {
        try { b.remove(); } catch (e) { }
      });
      const video = document.querySelector('video.html5-main-video') || document.querySelector('#movie_player video');
      if (video && video.paused) video.play().catch(() => { });
    }
  }, 400);
})();
