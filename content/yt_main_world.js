// NetShield Pro - YouTube High-Efficiency Main World Engine
// Runs directly in the YouTube page context (MAIN world) to intercept player API data & force instant ad skips

(function () {
  'use strict';

  if (window.__netshield_yt_injected) return;
  window.__netshield_yt_injected = true;

  // --- 1. Sanitize Initial Player Response (Eliminates prerolls & midrolls before render) ---
  function sanitizePlayerResponse(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (obj.adPlacements) delete obj.adPlacements;
    if (obj.playerAds) delete obj.playerAds;
    if (obj.adSlots) delete obj.adSlots;
    if (obj.adBreakHeartbeatParams) delete obj.adBreakHeartbeatParams;

    return obj;
  }

  // Intercept window.ytInitialPlayerResponse
  let _ytInitialPlayerResponse = window.ytInitialPlayerResponse;
  Object.defineProperty(window, 'ytInitialPlayerResponse', {
    get: () => _ytInitialPlayerResponse,
    set: (val) => {
      _ytInitialPlayerResponse = sanitizePlayerResponse(val);
    },
    configurable: true
  });

  if (window.ytInitialPlayerResponse) {
    window.ytInitialPlayerResponse = sanitizePlayerResponse(window.ytInitialPlayerResponse);
  }

  // --- 2. Intercept fetch API for /youtubei/v1/player ---
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';

    // Block ad telemetry / logging calls & ad breaks
    if (
      url.includes('/youtubei/v1/player/ad_break') ||
      (url.includes('/youtubei/v1/log_event') && args[1] && typeof args[1].body === 'string' && args[1].body.includes('ad'))
    ) {
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const response = await originalFetch.apply(this, args);

    if (url.includes('/youtubei/v1/player')) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        const sanitized = sanitizePlayerResponse(data);
        return new Response(JSON.stringify(sanitized), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } catch (e) {
        return response;
      }
    }

    return response;
  };

  // --- 3. Intercept XMLHttpRequest for /youtubei/v1/player ---
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._netshield_url = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this._netshield_url && typeof this._netshield_url === 'string' && this._netshield_url.includes('/youtubei/v1/player')) {
      this.addEventListener('readystatechange', function () {
        if (this.readyState === 4 && this.status === 200) {
          try {
            const data = JSON.parse(this.responseText);
            const sanitized = sanitizePlayerResponse(data);
            Object.defineProperty(this, 'responseText', {
              value: JSON.stringify(sanitized),
              configurable: true
            });
            Object.defineProperty(this, 'response', {
              value: JSON.stringify(sanitized),
              configurable: true
            });
          } catch (e) {}
        }
      });
    }
    return originalSend.apply(this, args);
  };

  // --- 4. Direct Movie Player Controller & Realtime Ad Skip Hook ---
  let isSkipping = false;
  let userMutedState = false;

  function fastForwardAndSkip() {
    const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    const video = document.querySelector('video.html5-main-video') || document.querySelector('video');

    if (!player || !video) return;

    // Check all possible YouTube ad indicators
    const isAd = player.classList.contains('ad-showing') ||
                 player.classList.contains('ad-interrupting') ||
                 (typeof player.getAdState === 'function' && player.getAdState() > 0) ||
                 !!document.querySelector('.ytp-ad-player-overlay') ||
                 !!document.querySelector('.ytp-ad-player-overlay-layout') ||
                 !!document.querySelector('.ytp-ad-module > *') ||
                 !!document.querySelector('.ytp-ad-text') ||
                 !!document.querySelector('.ytp-ad-preview-text');

    if (isAd) {
      if (!isSkipping) {
        isSkipping = true;
        userMutedState = video.muted;
        video.muted = true;
      }

      // Boost speed to 16x
      try {
        video.playbackRate = 16.0;
      } catch (e) {}

      // Call internal movie_player API if available
      try {
        if (typeof player.skipAd === 'function') {
          player.skipAd();
        }
      } catch (e) {}

      // Jump to end of ad video
      try {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration;
        } else {
          video.currentTime = 999999;
        }
      } catch (e) {}

      // Ensure playback doesn't stall
      if (video.paused) {
        video.play().catch(() => {});
      }

      // Click all skip buttons
      clickSkipButtons();
    } else {
      if (isSkipping) {
        isSkipping = false;
        video.playbackRate = 1.0;
        video.muted = userMutedState;
      }
    }
  }

  function clickSkipButtons() {
    const skipSelectors = [
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

    for (const sel of skipSelectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(evtType => {
          btn.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window }));
        });
        break;
      }
    }
  }

  // Run at high frequency for instant reaction (50ms interval)
  setInterval(fastForwardAndSkip, 50);

  // Hook into video ratechange & play to counter YouTube's attempt to slow ads down
  document.addEventListener('ratechange', (e) => {
    const player = document.getElementById('movie_player');
    if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
      const video = e.target;
      if (video && video.playbackRate !== 16.0) {
        video.playbackRate = 16.0;
        video.muted = true;
      }
    }
  }, true);

  // Clean anti-adblock modals in main world as well
  setInterval(() => {
    const dialogs = document.querySelectorAll(
      'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model), ytd-enforcement-message-view-model'
    );
    if (dialogs.length > 0) {
      dialogs.forEach(d => {
        const parent = d.closest('tp-yt-paper-dialog') || d;
        parent.remove();
      });
      document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach(b => b.remove());
      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
      if (video && video.paused) {
        video.play().catch(() => {});
      }
    }
  }, 200);

})();
