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

// Known Malicious & Ad-serving IP addresses
const adIps = [
  "185.220.101.5",
  "185.220.101.6",
  "185.220.101.7",
  "45.33.32.156",
  "103.253.145.18",
  "195.123.245.8",
  "185.193.125.10",
  "91.240.118.15",
  "104.244.42.1",
  "198.51.100.24",
  "192.241.218.12",
  "178.62.204.14",
  "188.166.152.11",
  "46.101.215.19",
  "139.59.189.22",
  "159.203.111.45",
  "167.99.144.33",
  "142.93.120.77",
  "165.227.18.99",
  "64.227.45.10"
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

const rulesDir = path.join(__dirname, '..', 'rules');
if (!fs.existsSync(rulesDir)) {
  fs.mkdirSync(rulesDir, { recursive: true });
}

const outputPath = path.join(rulesDir, 'rules.json');
fs.writeFileSync(outputPath, JSON.stringify(rules, null, 2), 'utf-8');
console.log(`Generated ${rules.length} static rules to ${outputPath}`);
