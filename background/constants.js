// NetShield Constants, Helpers & Default Settings

export const ALL = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
  'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
];

export const SUB = ALL.slice(1); // Subresource types (excludes main_frame)

// Public suffixes and multi-tenant platforms: whitelisting these directly is strictly forbidden
export const PUBLIC_SUFFIXES = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'io', 'co', 'ai', 'app', 'dev', 'vn', 'me', 'info', 'biz', 'top', 'xyz', 'site', 'online',
  'github.io', 'gitlab.io', 'blogspot.com', 'wordpress.com', 'pages.dev', 'vercel.app', 'netlify.app', 'herokuapp.com',
  'ngrok-free.app', 'firebaseapp.com', 'web.app', 'cloudfront.net', 'azurewebsites.net'
]);

export const host = t => (t || '').replace(/^https?:\/\//i, '').replace(/[/:].*$/, '').trim().toLowerCase();

export const normalizeUrl = raw => {
  try { return new URL(raw).href; } catch { return raw || ''; }
};

export function isValidWhitelistDomain(d) {
  const clean = host(d);
  if (!clean || !/^[a-z0-9.-]+$/.test(clean)) return false;
  const parts = clean.split('.');
  if (parts.length < 2) return false;
  if (PUBLIC_SUFFIXES.has(clean)) return false;
  const twoPartSuffix = parts.slice(-2).join('.');
  if (PUBLIC_SUFFIXES.has(twoPartSuffix) && parts.length <= 2) return false;
  return true;
}

export const DEFAULTS = {
  enabled: true,
  antiScamEnabled: true,
  antiTrackingEnabled: true,
  ipAdShieldEnabled: true,
  webrtcProtectionEnabled: true,
  cosmeticFiltering: true,
  totalBlocked: 0,
  totalScamBlocked: 0,
  totalTrackingBlocked: 0,
  totalIpBlocked: 0,
  customRules: [
    { id: 1, type: 'domain', target: 'adservice.google.com', note: 'Mẫu chặn máy chủ quảng cáo', enabled: true },
    { id: 2, type: 'tracker', target: 'hotjar.com', note: 'Session Replay ghi lén thao tác màn hình', enabled: true },
    { id: 3, type: 'scam', target: 'vietcombank-online-banking.top', note: 'Mạo danh ngân hàng lừa đảo (Phishing)', enabled: true },
    { id: 4, type: 'scam', target: 'vneid-dinhdanh-gov.top', note: 'Giả mạo cổng dịch vụ công VNeID', enabled: true }
  ],
  whitelist: [],
  recentBlocked: []
};

export const MAX_LIVE_REQUESTS = 100;
export const MAX_RECENT_BLOCKED = 50;
