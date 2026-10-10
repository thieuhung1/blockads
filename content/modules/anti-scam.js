(() => {
  const root = globalThis.__NETSHIELD_CONTENT__ || (globalThis.__NETSHIELD_CONTENT__ = {});
  const rules = root.config.antiScam;
  const overlayConfig = root.config.clickjacking;
  const logger = root.logger;

  root.modules = root.modules || {};
  root.modules.antiScam = {
    init: initAntiScamShield,
    neutralizeOverlays: neutralizeClickJackingOverlays
  };

  function initAntiScamShield() {
    neutralizeClickJackingOverlays();
    document.addEventListener('click', handleScamClickTrap, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  }

  function handleFullscreenChange() {
    const fullscreenElement = document.fullscreenElement;
    if (!fullscreenElement) return;

    const text = (fullscreenElement.innerText || '').toLowerCase();
    if (!rules.suspiciousFullscreenKeywords.some(term => text.includes(term))) return;

    try {
      Promise.resolve(document.exitFullscreen()).catch(error => {
        logger.debug('Could not exit suspicious fullscreen view.', error);
      });
    } catch (error) {
      logger.debug('Could not exit suspicious fullscreen view.', error);
    }
  }

  function neutralizeClickJackingOverlays() {
    for (const element of document.querySelectorAll('div, a, span')) {
      try {
        const style = window.getComputedStyle(element);
        if (style.position !== 'fixed' && style.position !== 'absolute') continue;

        const zIndex = Number.parseInt(style.zIndex, 10);
        if (!Number.isFinite(zIndex) || zIndex <= overlayConfig.minimumZIndex) continue;

        const coversViewport = element.offsetWidth >= window.innerWidth * overlayConfig.minimumViewportCoverage &&
          element.offsetHeight >= window.innerHeight * overlayConfig.minimumViewportCoverage;
        if (coversViewport && Number.parseFloat(style.opacity) < overlayConfig.maximumOverlayOpacity) {
          element.remove();
        }
      } catch (error) {
        logger.debug('Could not inspect a possible clickjacking overlay.', error);
      }
    }
  }

  function isPublicIpAdUrl(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch (error) {
      logger.debug('Could not parse a link during scam inspection.', error);
      return false;
    }

    const host = url.hostname;
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;

    const isPrivateOrLocal = host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') ||
      /^172\.(?:1[6-9]|2\d|3[0-1])\./.test(host);
    if (isPrivateOrLocal) return false;

    const pathAndQuery = `${url.pathname}${url.search}${url.hash}`.toLowerCase();
    return rules.publicIpAdPathKeywords.some(keyword => pathAndQuery.includes(keyword));
  }

  function handleScamClickTrap(event) {
    const target = event.target instanceof Element ? event.target.closest('a') : null;
    if (!target || !target.href) return;

    const href = target.href.toLowerCase();
    const suspicious = rules.suspiciousUrlKeywords.some(keyword => href.includes(keyword));
    if (!suspicious && !isPublicIpAdUrl(target.href)) return;

    event.preventDefault();
    event.stopPropagation();
    logger.warn('Blocked a suspicious link click.', target.href);
  }
})();
