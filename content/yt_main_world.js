// NetShield - YouTube MAIN world (disabled safe mode)
// Tạm tắt toàn bộ can thiệp player để video load bình thường.

(function () {
  'use strict';
  if (window.__netshield_yt_injected) return;
  window.__netshield_yt_injected = true;
  // Không intercept fetch/XHR, không sửa ytInitialPlayerResponse,
  // không tua video — để YouTube phát bình thường.
})();
