// NetShield Warning Interstitial Controller

document.addEventListener('DOMContentLoaded', async () => {
  const blockedUrlDisplay = document.getElementById('blockedUrlDisplay');
  const btnGoBack = document.getElementById('btnGoBack');
  const btnProceedAnyway = document.getElementById('btnProceedAnyway');

  let blockedUrl = '';

  // 1. Try to read from query params or storage
  const urlParams = new URLSearchParams(window.location.search);
  const paramUrl = urlParams.get('url');

  if (paramUrl) {
    blockedUrl = paramUrl;
  } else {
    try {
      const data = await chrome.storage.local.get(['lastBlockedScamUrl']);
      blockedUrl = data.lastBlockedScamUrl || 'https://unknown-threat-target.xyz';
    } catch {
      blockedUrl = 'Trang web độc hại chưa xác định';
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

    try {
      let hostname = '';
      try {
        hostname = new URL(blockedUrl).hostname;
      } catch {
        hostname = blockedUrl;
      }

      // Add to temporary bypass list
      await chrome.runtime.sendMessage({
        type: 'BYPASS_SCAM_DOMAIN',
        domain: hostname
      });

      // Redirect user to the original destination
      window.location.href = blockedUrl;
    } catch {
      window.location.href = blockedUrl;
    }
  });
});
