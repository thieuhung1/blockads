(() => {
  const root = globalThis.__NETSHIELD_CONTENT__ || (globalThis.__NETSHIELD_CONTENT__ = {});
  const config = root.config.youtube;
  const logger = root.logger;

  root.modules = root.modules || {};
  root.modules.youtubeBlocker = { init: initYouTubeBlocker };

  let playerObserver = null;
  let playerDiscoveryObserver = null;
  let observedPlayer = null;
  let framePending = false;

  function initYouTubeBlocker() {
    document.addEventListener('yt-navigate-finish', handleNavigation);
    document.addEventListener('yt-page-data-updated', scheduleRun);
    observePlayerWhenAvailable();
    scheduleRun();
  }

  function handleNavigation() {
    observePlayerWhenAvailable();
    scheduleRun();
  }

  function observePlayerWhenAvailable() {
    const player = document.querySelector(config.playerSelector);
    if (player) {
      if (player !== observedPlayer) {
        if (playerObserver) playerObserver.disconnect();
        observedPlayer = player;
        playerObserver = new MutationObserver(scheduleRun);
        playerObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
      }
      if (playerDiscoveryObserver) {
        playerDiscoveryObserver.disconnect();
        playerDiscoveryObserver = null;
      }
      return;
    }

    if (!playerDiscoveryObserver) {
      playerDiscoveryObserver = new MutationObserver(() => {
        if (document.querySelector(config.playerSelector)) observePlayerWhenAvailable();
      });
      playerDiscoveryObserver.observe(document.documentElement || document, { childList: true, subtree: true });
    }
  }

  function scheduleRun() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      observePlayerWhenAvailable();
      handleYouTubeVideoAds();
      handleYouTubeShortsAds();
      handleYouTubeAntiAdblockPopup();
      dismissYouTubeBannerAds();
      cleanYouTubeFeedAds();
    });
  }

  function handleYouTubeVideoAds() {
    const player = document.querySelector(config.playerSelector) || document.querySelector('.html5-video-player');
    const video = document.querySelector('video.html5-main-video') || document.querySelector('#movie_player video');
    if (!player || !video) return;

    const hasAdClass = config.adPlayerClasses.some(className => player.classList.contains(className));
    if (!hasAdClass) return;

    let clickedSkip = false;
    for (const selector of config.skipButtonSelectors) {
      const button = document.querySelector(selector);
      if (!button) continue;
      try {
        button.click();
        clickedSkip = true;
        break;
      } catch (error) {
        logger.debug('Could not activate a YouTube skip button.', error);
      }
    }

    if (!clickedSkip) {
      try {
        const duration = video.duration;
        if (Number.isFinite(duration) && duration > 0 && video.currentTime < duration - config.adSeekSafetySeconds) {
          video.currentTime = duration - config.adSeekSafetySeconds;
        }
      } catch (error) {
        logger.debug('Could not seek to the end of a YouTube ad.', error);
      }
    }

    document.querySelectorAll(config.adOverlaySelector).forEach(element => {
      element.style.setProperty('display', 'none', 'important');
    });
  }

  function handleYouTubeShortsAds() {
    if (!window.location.pathname.startsWith('/shorts')) return;

    const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]') ||
      document.querySelector('ytd-reel-video-renderer[is-active=""]');
    if (!activeReel) return;

    const isShortAd = Boolean(activeReel.querySelector(
      'ytd-ad-slot-renderer, .ytd-in-feed-ad-layout-renderer, [aria-label*="Sponsored"], [aria-label*="Được tài trợ"]'
    ));
    if (!isShortAd) return;

    const nextButton = document.querySelector('#navigation-button-down button') ||
      document.querySelector('.navigation-button-down button');
    if (nextButton) {
      nextButton.click();
    } else {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true }));
    }
  }

  function cleanYouTubeFeedAds() {
    for (const selector of config.feedAdSelectors) {
      try {
        document.querySelectorAll(selector).forEach(element => element.remove());
      } catch (error) {
        logger.debug(`Could not apply YouTube selector: ${selector}`, error);
      }
    }
  }

  function handleYouTubeAntiAdblockPopup() {
    for (const selector of config.enforcementSelectors) {
      const modal = document.querySelector(selector);
      if (!modal) continue;

      const dialog = modal.closest('tp-yt-paper-dialog') || modal;
      dialog.remove();
      document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach(element => element.remove());

      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
      if (video && video.paused) {
        Promise.resolve(video.play()).catch(error => logger.debug('Could not resume YouTube playback.', error));
      }
    }
  }

  function dismissYouTubeBannerAds() {
    document.querySelectorAll(config.bannerCloseSelector).forEach(button => {
      try {
        button.click();
      } catch (error) {
        logger.debug('Could not close a YouTube ad banner.', error);
      }
    });
  }
})();
