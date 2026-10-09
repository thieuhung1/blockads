// NetShield Warning Interstitial Controller

document.addEventListener('DOMContentLoaded', () => {
  // 0. Anti-Clickjacking: block framing/embedding completely
  if (window.top !== window) {
    document.body.innerHTML = '<div style="padding:40px;color:#ef4444;font-family:sans-serif;text-align:center;"><h2>Cảnh Báo Bảo Mật NetShield</h2><p>Trang cảnh báo không được phép nhúng trong khung (frame) của trang web khác.</p></div>';
    throw new Error('Clickjacking frame blocked');
  }

  const blockedUrlDisplay = document.getElementById('blockedUrlDisplay');
  const btnGoBack = document.getElementById('btnGoBack');
  const btnProceedAnyway = document.getElementById('btnProceedAnyway');

  let blockedUrl = null;

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

  // 1. Extract blocked URL directly from location search & hash (preserves full & query params and # fragments)
  function extractBlockedUrlFromLocation() {
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    const prefix = '?url=';
    const index = search.indexOf(prefix);
    if (index !== -1) {
      const raw = search.substring(index + prefix.length) + hash;
      return getSafeHttpUrl(raw);
    }
    return null;
  }

  blockedUrl = extractBlockedUrlFromLocation();

  if (blockedUrl) {
    // Render URL using textContent to prevent any XSS
    blockedUrlDisplay.textContent = blockedUrl;

    // Notify background for accurate production metrics (DNR redirects do not fire onErrorOccurred in store builds)
    chrome.runtime.sendMessage({
      type: 'RECORD_SCAM_BLOCKED',
      url: blockedUrl
    }).catch(() => {});
  } else {
    blockedUrlDisplay.textContent = 'Không thể xác định địa chỉ trang web đích.';
    btnProceedAnyway.disabled = true;
    btnProceedAnyway.style.opacity = '0.5';
    btnProceedAnyway.style.cursor = 'not-allowed';
    btnProceedAnyway.title = 'Không có địa chỉ hợp lệ để tiếp tục';
  }

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
    if (!blockedUrl) return;

    const confirmed = confirm('CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn truy cập vào trang này? Trang web có thể cố gắng lừa đảo hoặc cài mã độc vào thiết bị của bạn!');
    if (!confirmed) return;

    const hostname = new URL(blockedUrl).hostname.toLowerCase();

    // Add to temporary session bypass list
    const res = await chrome.runtime.sendMessage({
      type: 'BYPASS_SCAM_DOMAIN',
      domain: hostname
    });

    if (!res?.success) {
      alert('Không thể mở khóa tên miền này: ' + (res?.error || 'Lỗi không xác định'));
      return;
    }

    // Redirect user to the validated safe destination
    window.location.href = blockedUrl;
  });
});
