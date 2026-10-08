// NetShield Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
  let currentTab = null;
  let currentHostname = '';
  let isMasterEnabled = true;

  // DOM Elements
  const masterToggleBtn = document.getElementById('masterToggleBtn');
  const shieldContainer = document.getElementById('shieldContainer');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const siteHostnameEl = document.getElementById('siteHostname');
  const siteFaviconEl = document.getElementById('siteFavicon');
  const siteProtectionLabel = document.getElementById('siteProtectionLabel');
  const siteToggleCheckbox = document.getElementById('siteToggleCheckbox');
  const tabBlockedCountEl = document.getElementById('tabBlockedCount');
  const totalBlockedCountEl = document.getElementById('totalBlockedCount');
  const quickAddForm = document.getElementById('quickAddForm');
  const quickAddInput = document.getElementById('quickAddInput');
  const quickAddFeedback = document.getElementById('quickAddFeedback');
  const tabRecentBtn = document.getElementById('tabRecentBtn');
  const tabLiveBtn = document.getElementById('tabLiveBtn');
  const recentListContainer = document.getElementById('recentListContainer');
  const liveListContainer = document.getElementById('liveListContainer');
  const recentBlockedList = document.getElementById('recentBlockedList');
  const liveRequestsList = document.getElementById('liveRequestsList');
  const btnOpenOptions = document.getElementById('btnOpenOptions');
  const btnOpenDashboard = document.getElementById('btnOpenDashboard');

  // 1. Get current active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      currentTab = tabs[0];
      if (currentTab.url && !currentTab.url.startsWith('chrome://')) {
        try {
          const u = new URL(currentTab.url);
          currentHostname = u.hostname;
          siteHostnameEl.textContent = currentHostname;
          if (currentTab.favIconUrl) {
            siteFaviconEl.src = currentTab.favIconUrl;
          }
        } catch {
          siteHostnameEl.textContent = 'Trang hệ thống';
        }
      } else {
        siteHostnameEl.textContent = 'Trang nội bộ trình duyệt';
        siteToggleCheckbox.disabled = true;
      }
    }
  } catch (err) {
    console.error('Error fetching tab:', err);
  }

  // 2. Load state from Background
  async function refreshState() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATE',
        tabId: currentTab ? currentTab.id : null
      });

      if (!response || !response.success) return;

      isMasterEnabled = response.enabled;
      updateMasterUI(isMasterEnabled);

      // Whitelist check
      const isWhitelisted = response.whitelist.some(w => 
        currentHostname && (currentHostname === w || currentHostname.endsWith('.' + w))
      );

      siteToggleCheckbox.checked = !isWhitelisted;
      updateSiteProtectionUI(!isWhitelisted);

      // Counters
      tabBlockedCountEl.textContent = response.tabBlocked || 0;
      totalBlockedCountEl.textContent = (response.totalBlocked || 0).toLocaleString();

      // Recent blocked list
      renderRecentBlocked(response.recentBlocked || []);
    } catch (err) {
      console.warn('Background communication error:', err);
    }
  }

  function updateMasterUI(enabled) {
    if (enabled) {
      shieldContainer.classList.remove('disabled');
      statusBadge.className = 'status-badge active';
      statusText.textContent = 'ĐANG BẢO VỆ';
    } else {
      shieldContainer.classList.add('disabled');
      statusBadge.className = 'status-badge disabled';
      statusText.textContent = 'TẠM DỪNG';
    }
  }

  function updateSiteProtectionUI(isProtected) {
    if (isProtected) {
      siteProtectionLabel.textContent = 'Bảo vệ đang bật cho trang này';
      siteProtectionLabel.style.color = '#94a3b8';
    } else {
      siteProtectionLabel.textContent = 'Đã tắt chặn cho trang này (Whitelist)';
      siteProtectionLabel.style.color = '#f59e0b';
    }
  }

  function renderRecentBlocked(list) {
    if (!list || list.length === 0) {
      recentBlockedList.innerHTML = '<div class="empty-state">Chưa có yêu cầu bị chặn trên phiên này</div>';
      return;
    }

    recentBlockedList.innerHTML = '';
    list.slice(0, 10).forEach(item => {
      const row = document.createElement('div');
      row.className = 'request-item';

      const tagType = item.isIp ? 'ip' : 'domain';
      const tagText = item.isIp ? 'IP' : 'AD';

      row.innerHTML = `
        <div class="req-left">
          <span class="badge-tag ${tagType}">${tagText}</span>
          <span class="req-host" title="${escapeHtml(item.url)}">${escapeHtml(item.hostname)}</span>
        </div>
        <span class="badge-tag blocked">ĐÃ CHẶN</span>
      `;
      recentBlockedList.appendChild(row);
    });
  }

  async function loadLiveRequests() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_LIVE_REQUESTS',
        tabId: currentTab ? currentTab.id : null
      });

      if (!response || !response.success || !response.requests || response.requests.length === 0) {
        liveRequestsList.innerHTML = '<div class="empty-state">Chưa ghi nhận kết nối mạng nào</div>';
        return;
      }

      liveRequestsList.innerHTML = '';
      response.requests.slice(0, 12).forEach(req => {
        const row = document.createElement('div');
        row.className = 'request-item';

        const tagClass = req.isIp ? 'ip' : 'domain';
        const tagText = req.isIp ? 'IP' : 'HOST';

        row.innerHTML = `
          <div class="req-left">
            <span class="badge-tag ${tagClass}">${tagText}</span>
            <span class="req-host" title="${escapeHtml(req.url)}">${escapeHtml(req.hostname)}</span>
          </div>
          <button class="btn-mini-block" data-target="${escapeHtml(req.hostname)}" data-isip="${req.isIp}">
            Chặn
          </button>
        `;
        liveRequestsList.appendChild(row);
      });

      // Bind mini block buttons
      document.querySelectorAll('.btn-mini-block').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const target = e.currentTarget.getAttribute('data-target');
          const isIp = e.currentTarget.getAttribute('data-isip') === 'true';
          await addCustomRule(target, isIp ? 'ip' : 'domain', 'Chặn nhanh từ Live Inspector');
          btn.textContent = 'Đã chặn';
          btn.disabled = true;
          btn.style.opacity = '0.5';
        });
      });
    } catch (err) {
      console.warn('Error loading live requests:', err);
    }
  }

  // 3. Event Listeners
  // Master Switch
  masterToggleBtn.addEventListener('click', async () => {
    isMasterEnabled = !isMasterEnabled;
    updateMasterUI(isMasterEnabled);
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_MASTER',
      enabled: isMasterEnabled
    });
    await refreshState();
  });

  // Site Toggle
  siteToggleCheckbox.addEventListener('change', async () => {
    if (!currentHostname) return;
    const res = await chrome.runtime.sendMessage({
      type: 'TOGGLE_WHITELIST_SITE',
      domain: currentHostname
    });
    if (res && res.success) {
      updateSiteProtectionUI(!res.isWhitelisted);
    }
  });

  // Quick Add Rule
  quickAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = quickAddInput.value.trim();
    if (!val) return;

    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(val) || val.includes(':');
    const success = await addCustomRule(val, isIp ? 'ip' : 'domain', 'Thêm thủ công từ Popup');

    if (success) {
      quickAddInput.value = '';
      showFeedback(`Đã kích hoạt chặn ${isIp ? 'IP' : 'Domain'}: ${val}`, 'success');
      await refreshState();
    } else {
      showFeedback('Không thể thêm quy tắc. Vui lòng kiểm tra lại!', 'error');
    }
  });

  async function addCustomRule(target, type, note) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'ADD_CUSTOM_RULE',
        target: target,
        type: type,
        note: note
      });
      return res && res.success;
    } catch {
      return false;
    }
  }

  function showFeedback(text, type) {
    quickAddFeedback.textContent = text;
    quickAddFeedback.className = `feedback-msg ${type}`;
    setTimeout(() => {
      quickAddFeedback.className = 'feedback-msg';
    }, 3000);
  }

  // Tab Switching
  tabRecentBtn.addEventListener('click', () => {
    tabRecentBtn.classList.add('active');
    tabLiveBtn.classList.remove('active');
    recentListContainer.classList.remove('hidden');
    liveListContainer.classList.add('hidden');
  });

  tabLiveBtn.addEventListener('click', () => {
    tabLiveBtn.classList.add('active');
    tabRecentBtn.classList.remove('active');
    liveListContainer.classList.remove('hidden');
    recentListContainer.classList.add('hidden');
    loadLiveRequests();
  });

  // Open Options / Dashboard
  function openOptions() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  }

  btnOpenOptions.addEventListener('click', openOptions);
  btnOpenDashboard.addEventListener('click', openOptions);

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Initial call
  await refreshState();
});
