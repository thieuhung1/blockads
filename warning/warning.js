// NetShield Warning Interstitial Controller

document.addEventListener('DOMContentLoaded', async () => {
  const blockedUrlDisplay = document.getElementById('blockedUrlDisplay');
  const btnGoBack = document.getElementById('btnGoBack');
  const btnProceedAnyway = document.getElementById('btnProceedAnyway');

  let blockedUrl = '';

  function getSafeHttpUrl(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
    } catch {}
    return null;
  }

  // 1. Try to read from query params or storage
  const urlParams = new URLSearchParams(window.location.search);
  const paramUrl = urlParams.get('url');

  if (paramUrl && getSafeHttpUrl(paramUrl)) {
    blockedUrl = getSafeHttpUrl(paramUrl);
  } else {
    try {
      const data = await chrome.storage.local.get(['lastBlockedScamUrl']);
      blockedUrl = getSafeHttpUrl(data.lastBlockedScamUrl) || 'https://unknown-threat-target.xyz';
    } catch {
      blockedUrl = 'https://unknown-threat-target.xyz';
    }
  }

  blockedUrlDisplay.textContent = blockedUrl;

  // 2. Action: Go Back to Safety
  btnGoBack.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'https://www.google.com';
    }
  });

  // 3. Action: Bypass warning
  btnProceedAnyway.addEventListener('click', async () => {
    const confirmed = confirm('CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn truy cập vào trang này? Trang web có thể cố gắng lừa đảo hoặc cài mã độc vào thiết bị của bạn!');
    if (!confirmed) return;

    const safeDestination = getSafeHttpUrl(blockedUrl);
    if (!safeDestination) {
      alert('Địa chỉ không an toàn hoặc không hợp lệ.');
      window.location.href = 'https://www.google.com';
      return;
    }

    try {
      const parsed = new URL(safeDestination);
      const hostname = parsed.hostname.toLowerCase();

      // Add to temporary bypass list
      await chrome.runtime.sendMessage({
        type: 'BYPASS_SCAM_DOMAIN',
        domain: hostname
      });

      // Redirect user to the validated safe destination
      window.location.href = safeDestination;
    } catch {
      window.location.href = 'https://www.google.com';
    }
  });
});
