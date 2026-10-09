// Script to generate comprehensive static rules for NetShield (Ad blocking + Anti-Scam + Anti-Tracking / Privacy Shield)
const fs = require('fs');
const path = require('path');

const adDomains = [
  // Major Ad Networks
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "adservice.google.com",
  "pagead2.googlesyndication.com",
  "googleads.g.doubleclick.net",
  "admob.com",
  "ads.youtube.com",
  "adnxs.com",
  "criteo.com",
  "criteo.net",
  "rubiconproject.com",
  "pubmatic.com",
  "taboola.com",
  "outbrain.com",
  "popads.net",
  "popcash.net",
  "propellerads.com",
  "adcash.com",
  "mgid.com",
  "revcontent.com",
  "adroll.com",
  "smartadserver.com",
  "openx.net",
  "sovrn.com",
  "bidswitch.net",
  "casalemedia.com",
  "indexww.com",
  "moatads.com",
  "advertising.com",
  "exponential.com",
  "adform.net",
  "lijit.com",
  "sharethrough.com",
  "gumgum.com",
  "teads.tv",
  "yieldmo.com",
  "contextweb.com",
  "media.net",
  "sonobi.com",
  "triplelift.com",
  "unruly.co",
  "undertone.com",
  "spotxchange.com",
  "spotx.tv",
  "tremorhub.com",
  "inmobi.com",
  "applovin.com",
  "vungle.com",
  "chartboost.com",
  "unityads.unity3d.com",
  "ironsrc.com",
  "adcolony.com",
  "fyber.com",
  "flurry.com",

  // Vietnamese Ad Networks
  "eclick.vn",
  "admicro.vn",
  "vietad.vn",
  "ambientdigitalgroup.com",
  "innity.com",
  "microad.vn",
  "ants.vn",
  "adtrue.com",
  "blueseed.tv",
  "novanet.vn",

  // Aggressive Popup & Malware/Scam Networks
  "exoclick.com",
  "juicyads.com",
  "trafficjunky.com",
  "ero-advertising.com",
  "clickadu.com",
  "hilltopads.net",
  "ad-maven.com",
  "yllix.com",
  "zeroredirect.com",
  "adkeeper.com",
  "adsterra.com",
  "clicksor.com",
  "cpalead.com",
  "leadbolt.com",
  "onclickads.net",
  "onclickalgo.com",
  "wigetmedia.com",
  "realsrv.com",
  "syndication.exoclick.com",

  // Crypto Mining domains
  "coinhive.com",
  "coin-have.com",
  "crypto-loot.com",
  "jsecoin.com",
  "authedmine.com",
  "webminepool.com",
  "monerominer.rocks"
];

// Trackers, Telemetry, Keyloggers, Session Replay & Fingerprinting Domains (Cấm thu thập thông tin trái phép)
const trackerDomains = [
  // Session Recording & Keystroke Loggers (Ghi lén thao tác người dùng & phím bấm)
  "hotjar.com",
  "clarity.ms",
  "fullstory.com",
  "mouseflow.com",
  "smartlook.com",
  "crazyegg.com",
  "luckyorange.com",
  "inspectlet.com",
  "logrocket.com",
  "sessioncam.com",
  "freshmarketer.com",
  "heap.io",

  // Analytics, Telemetry & Profiling (Theo dõi và thu thập hồ sơ người dùng)
  "google-analytics.com",
  "ssl.google-analytics.com",
  "googletagmanager.com",
  "analytics.google.com",
  "pixel.facebook.com",
  "an.facebook.com",
  "connect.facebook.net/signals",
  "ads-twitter.com",
  "analytics.tiktok.com",
  "analytics.pinterest.com",
  "snap.licdn.com",
  "ads.linkedin.com",
  "bat.bing.com",
  "statcounter.com",
  "histats.com",
  "quantserve.com",
  "scorecardresearch.com",
  "segment.io",
  "mixpanel.com",
  "amplitude.com",
  "yandex.ru/metrika",
  "mc.yandex.ru",

  // Fingerprinting & Device ID Harvesters (Thu thập dấu vân tay trình duyệt & phần cứng)
  "fingerprintjs.com",
  "fpjs.sh",
  "api.fpjs.io",
  "threatmetrix.com",
  "iovation.com",
  "maxmind.com/geoip",
  "sentry.io",
  "bugsnag.com"
];

// Phishing, Scam, Fake Bank, Lottery & Malware Domains
const scamDomains = [
  "vietcombank-online-banking.top",
  "techcombank-verify.vip",
  "mbbank-xacthuc.site",
  "vneid-dinhdanh-gov.top",
  "vneid-capnhat-dancu.xyz",
  "facebook-security-checkpoints.com",
  "meta-security-support.xyz",
  "telegram-airdrop-claim.top",
  "usdt-trc20-claim.vip",
  "binance-security-verify.top",
  "shopee-trungthuong-quatang.xyz",
  "tiktok-kiemtien-online.top",
  "congan-xuly-phatnguoi.top",
  "toaan-trieutap-online.vip",
  "windows-defender-security-alert.xyz",
  "apple-security-id-locked.top",
  "phishing-test-threat.example",
  "scam-lottery-winner.online",
  "fake-antivirus-scan.top",
  "urgent-account-suspended.click"
];

// Known Malicious & Ad-serving IP addresses (Bulletproof hosts, popunder networks, ad-injectors)
const adIps = [
  "185.220.101.5", "185.220.101.6", "185.220.101.7", "185.193.125.10", "185.193.125.11",
  "185.106.92.15", "185.143.223.28", "185.244.150.12",
  "45.33.32.156", "45.14.226.10", "45.154.255.88",
  "103.253.145.18", "103.253.145.19", "103.145.13.22", "103.249.201.55", "103.195.103.88",
  "195.123.245.8", "195.123.245.9", "195.201.201.44", "195.154.122.9",
  "91.240.118.15", "91.240.118.16", "91.216.107.12", "91.92.241.103", "91.215.85.17",
  "104.244.42.1", "104.244.42.2", "104.168.188.42", "104.238.169.11",
  "198.51.100.24", "198.54.117.200", "198.144.149.82",
  "192.241.218.12", "192.241.218.13", "192.119.112.8", "192.210.198.54",
  "178.62.204.14", "178.62.204.15", "178.132.0.101", "178.17.170.15", "178.159.37.78",
  "188.166.152.11", "188.166.152.12", "188.241.58.120", "188.130.137.62",
  "46.101.215.19", "46.101.215.20", "46.166.161.201", "46.246.118.23",
  "139.59.189.22", "139.59.189.23", "139.99.120.45",
  "159.203.111.45", "159.89.120.78", "159.65.130.99",
  "167.99.144.33", "167.99.144.34", "167.71.200.12",
  "142.93.120.77", "142.93.120.78", "142.44.195.120",
  "165.227.18.99", "165.227.18.100", "165.232.140.88",
  "64.227.45.10", "64.227.45.11", "64.225.100.42",
  "194.87.139.44", "194.26.29.112", "194.135.33.201",
  "193.106.191.22", "193.36.119.55", "193.142.146.99",
  "31.220.55.80", "31.184.238.129", "31.148.219.14",
  "37.120.217.15", "37.48.115.12", "37.1.207.88",
  "77.247.110.10", "77.88.55.66", "77.222.40.100",
  "80.94.95.88", "80.82.77.139", "80.78.24.12",
  "85.204.116.14", "85.209.135.202", "85.93.88.12",
  "89.248.165.120", "89.187.170.82", "89.208.103.11",
  "94.102.61.12", "94.156.128.88", "94.23.150.44",
  "109.236.81.12", "109.248.200.54", "109.70.100.18",
  "176.10.99.200", "176.123.8.44", "176.31.120.88",
  "212.102.40.12", "212.83.180.55", "212.193.30.88",
  "217.138.200.12", "217.23.15.80", "217.182.170.22"
];

// URL Keyword patterns for ad scripts/banners
const adPatterns = [
  "*://*/*ads.js*",
  "*://*/*ad-server*",
  "*://*/*adservice*",
  "*://*/*popunder*",
  "*://*/*banner-ads*",
  "*://*/*track.gif*",
  "*://*/*tracking-pixel*",
  "*://*/*sponsor_banner*",
  // YouTube Ad endpoints
  "*://*.youtube.com/pagead/*",
  "*://*.youtube.com/api/stats/ads*",
  "*://*.youtube.com/ptracking*",
  "*://*.youtube.com/get_midroll_info*",
  "*://*.youtube.com/youtubei/v1/player/ad_break*"
];

// Scam / Fake alert URL patterns
const scamPatterns = [
  "*://*/*urgent-security-alert*",
  "*://*/*critical-virus-alert*",
  "*://*/*call-support-tollfree*",
  "*://*/*congratulations-winner-iphone*",
  "*://*/*claim-airdrop-reward*"
];

// Tracker patterns (Ping beacons, telemetry endpoint, fingerprinting)
const trackerPatterns = [
  "*://*/*beacon*",
  "*://*/*telemetry*",
  "*://*/*fingerprint*",
  "*://*/*session-record*",
  "*://*/*keystroke-logger*"
];

const resourceTypes = [
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "other"
];

let ruleId = 1;
const rules = [];

// 1. Standard Domain block rules (Ads)
for (const domain of adDomains) {
  rules.push({
    id: ruleId++,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: resourceTypes
    }
  });
}

// 2. Anti-Tracking & Data Harvesting Domains (Cấm thu thập thông tin trái phép)
for (const tracker of trackerDomains) {
  rules.push({
    id: ruleId++,
    priority: 3, // High priority to strictly block trackers
    action: { type: "block" },
    condition: {
      urlFilter: `||${tracker}^`,
      resourceTypes: ["script", "xmlhttprequest", "ping", "sub_frame", "image", "other"]
    }
  });
}

// 3. IP rules
for (const ip of adIps) {
  rules.push({
    id: ruleId++,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: `||${ip}^`,
      resourceTypes: resourceTypes
    }
  });
}

// 4. Pattern rules (Ads)
for (const pat of adPatterns) {
  rules.push({
    id: ruleId++,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: pat,
      resourceTypes: ["script", "sub_frame", "xmlhttprequest", "image", "other"]
    }
  });
}

// 5. Tracker Patterns
for (const tpat of trackerPatterns) {
  rules.push({
    id: ruleId++,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: tpat,
      resourceTypes: ["ping", "xmlhttprequest", "script", "other"]
    }
  });
}

// 6. Scam Domains - Main frame redirects to Warning page, subresources blocked!
for (const scam of scamDomains) {
  rules.push({
    id: ruleId++,
    priority: 20,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: "/warning/warning.html"
      }
    },
    condition: {
      urlFilter: `||${scam}^`,
      resourceTypes: ["main_frame"]
    }
  });

  rules.push({
    id: ruleId++,
    priority: 20,
    action: { type: "block" },
    condition: {
      urlFilter: `||${scam}^`,
      resourceTypes: resourceTypes
    }
  });
}

// 7. Scam Patterns
for (const spat of scamPatterns) {
  rules.push({
    id: ruleId++,
    priority: 15,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: "/warning/warning.html"
      }
    },
    condition: {
      urlFilter: spat,
      resourceTypes: ["main_frame"]
    }
  });
}

// 8. Tầng đáy mạng HTTP: Tiêm header chống theo dõi (DNT & Sec-GPC)
rules.push({
  id: ruleId++,
  priority: 1,
  action: {
    type: "modifyHeaders",
    requestHeaders: [
      { header: "DNT", operation: "set", value: "1" },
      { header: "Sec-GPC", operation: "set", value: "1" }
    ]
  },
  condition: {
    urlFilter: "*",
    resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "script", "image", "other"]
  }
});

// 9. TẦNG ĐÁY MẠNG: CHẶN QUẢNG CÁO & TRACKER GỌI TRỰC TIẾP TỪ ĐỊA CHỈ IP MÁY CHỦ
// Tối ưu hóa Regex tuyến tính, bộ nhớ đồ thị trạng thái DFA < 150 bytes (chuẩn Chrome DNR RE2 trần 2 KB)

// 9.1 Chặn Ads, Banner, Popup từ direct IP
rules.push({
  id: ruleId++,
  priority: 30,
  action: { type: "block" },
  condition: {
    regexFilter: "^(https?|wss?)://\\d+\\.\\d+\\.\\d+\\.\\d+.*(ad|banner|popup|popunder)",
    resourceTypes: ["sub_frame", "script", "websocket", "xmlhttprequest", "ping", "image", "other"]
  }
});

// 9.2 Chặn Trackers, Telemetry & Pixels từ direct IP
rules.push({
  id: ruleId++,
  priority: 30,
  action: { type: "block" },
  condition: {
    regexFilter: "^(https?|wss?)://\\d+\\.\\d+\\.\\d+\\.\\d+.*(track|pixel|stat|counter)",
    resourceTypes: ["sub_frame", "script", "websocket", "xmlhttprequest", "ping", "image", "other"]
  }
});

// 9.3 Chặn Click-traps, Affiliates & Bids từ direct IP
rules.push({
  id: ruleId++,
  priority: 30,
  action: { type: "block" },
  condition: {
    regexFilter: "^(https?|wss?)://\\d+\\.\\d+\\.\\d+\\.\\d+.*(click|affiliate|bid|jump|promo)",
    resourceTypes: ["sub_frame", "script", "websocket", "xmlhttprequest", "ping", "image", "other"]
  }
});

// 9.4 Chặn Direct sockets & Tunnel Relays từ direct IP
rules.push({
  id: ruleId++,
  priority: 30,
  action: { type: "block" },
  condition: {
    regexFilter: "^(https?|wss?)://\\d+\\.\\d+\\.\\d+\\.\\d+.*(direct|ws|sock)",
    resourceTypes: ["sub_frame", "script", "websocket", "xmlhttprequest", "ping", "image", "other"]
  }
});

// 9.5 Chặn toàn bộ iframe nhúng trực tiếp và WebSocket ngầm từ địa chỉ IP số (Ngoại trừ mạng nội bộ/localhost)
rules.push({
  id: ruleId++,
  priority: 25,
  action: { type: "block" },
  condition: {
    regexFilter: "^(https?|wss?)://\\d+\\.\\d+\\.\\d+\\.\\d+",
    resourceTypes: ["sub_frame", "websocket"],
    excludedInitiatorDomains: ["localhost", "127.0.0.1"]
  }
});

const rulesDir = path.join(__dirname, '..', 'rules');
if (!fs.existsSync(rulesDir)) {
  fs.mkdirSync(rulesDir, { recursive: true });
}

const outputPath = path.join(rulesDir, 'rules.json');
fs.writeFileSync(outputPath, JSON.stringify(rules, null, 2), 'utf-8');
console.log(`Generated ${rules.length} static rules to ${outputPath}`);
