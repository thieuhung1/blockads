(() => {
  const root = globalThis.__NETSHIELD_CONTENT__ || (globalThis.__NETSHIELD_CONTENT__ = {});
  const selectors = root.config.cosmeticSelectors;
  const logger = root.logger;

  root.modules = root.modules || {};
  root.modules.cosmeticFilter = { init: initCosmeticFilter, cleanup: runCosmeticCleanup };

  function initCosmeticFilter() {
    runCosmeticCleanup();

    let debounceTimer = null;
    const scheduleCleanup = () => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runCosmeticCleanup();
        if (root.featureFlags?.antiScamEnabled) root.modules.antiScam?.neutralizeOverlays();
      }, root.config.observerDebounceMs);
    };

    const observer = new MutationObserver(scheduleCleanup);
    observer.observe(document.documentElement || document, { childList: true, subtree: true });

    window.addEventListener('DOMContentLoaded', unlockScrolling, { once: true });
    window.addEventListener('load', unlockScrolling, { once: true });
    unlockScrolling();
  }

  function runCosmeticCleanup() {
    for (const selector of selectors) {
      try {
        for (const element of document.querySelectorAll(selector)) {
          if (element.style.display !== 'none') {
            element.style.setProperty('display', 'none', 'important');
          }
        }
      } catch (error) {
        logger.debug(`Could not apply cosmetic selector: ${selector}`, error);
      }
    }
  }

  function unlockScrolling() {
    const body = document.body;
    if (!body) return;

    try {
      const computed = window.getComputedStyle(body);
      const hasModal = document.querySelector('.modal.show, [role="dialog"][aria-modal="true"]');
      if (computed.overflow === 'hidden' && !hasModal) body.classList.add('netshield-unlock');
    } catch (error) {
      logger.debug('Could not inspect the page scroll lock.', error);
    }
  }
})();
