// NetShield Options & Dashboard Controller with Anti-Scam Shield

document.addEventListener('DOMContentLoaded', async () => {
  let appState = {
    enabled: true,
    antiScamEnabled: true,
    cosmeticFiltering: true,
    totalBlocked: 0,
    totalScamBlocked: 0,
    customRules: [],
    whitelist: [],
    recentBlocked: []
  };

  let currentRuleFilter = 'all';
  let searchQuery = '';

  // DOM Elements - Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.content-section');

  // Overview Elements
  const dashTotalBlocked = document.getElementById('dashTotalBlocked');
  const dashScamCount = document.getElementById('dashScamCount');
  const dashIpRulesCount = document.getElementById('dashIpRulesCount');
  const dashWhitelistCount = document.getElementById('dashWhitelistCount');
  const dashMasterToggle = document.getElementById('dashMasterToggle');
  const dashAntiScamToggle = document.getElementById('dashAntiScamToggle');
  const dashCosmeticToggle = document.getElementById('dashCosmeticToggle');
  const btnResetStats = document.getElementById('btnResetStats');

  // Rules Elements
  const formAddRule = document.getElementById('formAddRule');
  const ruleTargetInput = document.getElementById('ruleTarget');
  const ruleTypeSelect = document.getElementById('ruleType');
  const ruleNoteInput = document.getElementById('ruleNote');
  const addRuleFeedback = document.getElementById('addRuleFeedback');
  const tabSingleRule = document.getElementById('tabSingleRule');
  const tabBatchRule = document.getElementById('tabBatchRule');
  const batchAddContainer = document.getElementById('batchAddContainer');
  const batchTextarea = document.getElementById('batchTextarea');
  const btnBatchSubmit = document.getElementById('btnBatchSubmit');
  const searchRulesInput = document.getElementById('searchRulesInput');
  const filterPills = document.querySelectorAll('.filter-pills .pill');
  const rulesTableBody = document.getElementById('rulesTableBody');

  // Whitelist Elements
  const formAddWhitelist = document.getElementById('formAddWhitelist');
  const whitelistInput = document.getElementById('whitelistInput');
  const whitelistContainer = document.getElementById('whitelistContainer');
  const whitelistFeedback = document.getElementById('whitelistFeedback');

  // Inspector Elements
  const inspectorTableBody = document.getElementById('inspectorTableBody');
  const btnRefreshLive = document.getElementById('btnRefreshLive');

  // Backup Elements
  const btnExportJson = document.getElementById('btnExportJson');
  const importFileInput = document.getElementById('importFileInput');
  const backupFeedback = document.getElementById('backupFeedback');
  const btnResetAll = document.getElementById('btnResetAll');

  // 1. Navigation logic
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetSection = item.getAttribute('data-section');
      navItems.forEach(n => n.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      item.classList.add('active');
      const activeEl = document.getElementById(`section-${targetSection}`);
      if (activeEl) activeEl.classList.add('active');

      if (targetSection === 'inspector') {
        loadLiveInspector();
      }
    });
  });

  // 2. Fetch Initial State
  async function loadState() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (res && res.success) {
        appState = res;
        renderOverview();
        renderRulesTable();
        renderWhitelist();
      }
    } catch (err) {
      console.warn('Error loading state from service worker:', err);
    }
  }

  // Render Overview
  function renderOverview() {
    dashTotalBlocked.textContent = (appState.totalBlocked || 0).toLocaleString();
    dashScamCount.textContent = (appState.totalScamBlocked || 0).toLocaleString();

    const rules = appState.customRules || [];
    const ipCount = rules.filter(r => r.type === 'ip').length;

    dashIpRulesCount.textContent = ipCount;
    dashWhitelistCount.textContent = (appState.whitelist || []).length;

    dashMasterToggle.checked = appState.enabled;
    dashAntiScamToggle.checked = appState.antiScamEnabled !== false;
    dashCosmeticToggle.checked = appState.cosmeticFiltering;
  }

  // Overview Listeners
  dashMasterToggle.addEventListener('change', async () => {
    const val = dashMasterToggle.checked;
    await chrome.runtime.sendMessage({ type: 'TOGGLE_MASTER', enabled: val });
    appState.enabled = val;
    renderOverview();
  });

  dashAntiScamToggle.addEventListener('change', async () => {
    const val = dashAntiScamToggle.checked;
    await chrome.runtime.sendMessage({ type: 'TOGGLE_ANTI_SCAM', enabled: val });
    appState.antiScamEnabled = val;
    renderOverview();
  });

  dashCosmeticToggle.addEventListener('change', async () => {
    const val = dashCosmeticToggle.checked;
    await chrome.runtime.sendMessage({ type: 'TOGGLE_COSMETIC', enabled: val });
    appState.cosmeticFiltering = val;
  });

  btnResetStats.addEventListener('click', async () => {
    if (confirm('Bạn có chắc muốn đặt lại toàn bộ số liệu thống kê về 0?')) {
      await chrome.runtime.sendMessage({ type: 'RESET_STATS' });
      appState.totalBlocked = 0;
      appState.totalScamBlocked = 0;
      renderOverview();
    }
  });

  // 3. Rules Manager Logic
  tabSingleRule.addEventListener('click', () => {
    tabSingleRule.classList.add('active');
    tabBatchRule.classList.remove('active');
    formAddRule.classList.remove('hidden');
    batchAddContainer.classList.add('hidden');
  });

  tabBatchRule.addEventListener('click', () => {
    tabBatchRule.classList.add('active');
    tabSingleRule.classList.remove('active');
    formAddRule.classList.add('hidden');
    batchAddContainer.classList.remove('hidden');
  });

  // Add Single Rule
  formAddRule.addEventListener('submit', async (e) => {
    e.preventDefault();
    const target = ruleTargetInput.value.trim();
    if (!target) return;

    let type = ruleTypeSelect.value;
    if (type === 'auto') {
      if (isTargetIp(target)) {
        type = 'ip';
      } else if (target.includes('scam') || target.includes('phish') || target.includes('fake')) {
        type = 'scam';
      } else {
        type = 'domain';
      }
    }

    const note = ruleNoteInput.value.trim();

    const res = await chrome.runtime.sendMessage({
      type: 'ADD_CUSTOM_RULE',
      target: target,
      type: type,
      note: note
    });

    if (res && res.success) {
      ruleTargetInput.value = '';
      ruleNoteInput.value = '';
      showFeedback(addRuleFeedback, 'Đã lưu và kích hoạt quy tắc chặn!', 'success');
      await loadState();
    } else {
      showFeedback(addRuleFeedback, 'Thêm quy tắc thất bại!', 'error');
    }
  });

  // Batch Add
  btnBatchSubmit.addEventListener('click', async () => {
    const text = batchTextarea.value.trim();
    if (!text) return;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    let addedCount = 0;

    for (const line of lines) {
      const type = isTargetIp(line) ? 'ip' : (line.includes('fake') || line.includes('scam') ? 'scam' : 'domain');
      const res = await chrome.runtime.sendMessage({
        type: 'ADD_CUSTOM_RULE',
        target: line,
        type: type,
        note: 'Nhập hàng loạt'
      });
      if (res && res.success) addedCount++;
    }

    batchTextarea.value = '';
    alert(`Đã thêm thành công ${addedCount} quy tắc vào bộ lọc!`);
    await loadState();
  });

  // Filter & Search
  searchRulesInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderRulesTable();
  });

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentRuleFilter = pill.getAttribute('data-filter');
      renderRulesTable();
    });
  });

  // Render Rules Table
  function renderRulesTable() {
    rulesTableBody.innerHTML = '';
    const rules = appState.customRules || [];

    const filtered = rules.filter(r => {
      if (currentRuleFilter !== 'all' && r.type !== currentRuleFilter) {
        return false;
      }
      if (searchQuery) {
        const matchTarget = r.target.toLowerCase().includes(searchQuery);
        const matchNote = (r.note || '').toLowerCase().includes(searchQuery);
        return matchTarget || matchNote;
      }
      return true;
    });

    if (filtered.length === 0) {
      rulesTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-dim);">
            Không có quy tắc nào phù hợp
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(rule => {
      const tr = document.createElement('tr');

      let tagClass = 'domain';
      let tagLabel = 'DOMAIN';

      if (rule.type === 'ip') {
        tagClass = 'ip';
        tagLabel = 'IP MẠNG';
      } else if (rule.type === 'scam') {
        tagClass = 'scam';
        tagLabel = 'LỪA ĐẢO';
      } else if (rule.type === 'pattern') {
        tagClass = 'pattern';
        tagLabel = 'PATTERN';
      }

      tr.innerHTML = `
        <td><span class="tag-badge ${tagClass}">${tagLabel}</span></td>
        <td style="font-weight: 600; color: var(--text-main); font-family: monospace;">${escapeHtml(rule.target)}</td>
        <td>${escapeHtml(rule.note || '-')}</td>
        <td>
          <label class="switch" style="width: 32px; height: 18px;">
            <input type="checkbox" class="rule-toggle" data-id="${rule.id}" ${rule.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </td>
        <td style="text-align: center;">
          <button class="btn-icon-delete" data-id="${rule.id}" title="Xóa quy tắc này">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </td>
      `;

      rulesTableBody.appendChild(tr);
    });

    document.querySelectorAll('.rule-toggle').forEach(input => {
      input.addEventListener('change', async (e) => {
        const id = parseInt(e.target.getAttribute('data-id'), 10);
        const enabled = e.target.checked;
        await chrome.runtime.sendMessage({
          type: 'TOGGLE_CUSTOM_RULE',
          ruleId: id,
          enabled: enabled
        });
      });
    });

    document.querySelectorAll('.btn-icon-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
        if (confirm('Bạn có chắc muốn xóa quy tắc này?')) {
          await chrome.runtime.sendMessage({
            type: 'DELETE_CUSTOM_RULE',
            ruleId: id
          });
          await loadState();
        }
      });
    });
  }

  // 4. Whitelist Logic
  formAddWhitelist.addEventListener('submit', async (e) => {
    e.preventDefault();
    const site = whitelistInput.value.trim();
    if (!site) return;

    const res = await chrome.runtime.sendMessage({
      type: 'TOGGLE_WHITELIST_SITE',
      domain: site
    });

    if (res && res.success) {
      whitelistInput.value = '';
      showFeedback(whitelistFeedback, `Đã thêm ${site} vào danh sách trắng!`, 'success');
      await loadState();
    }
  });

  function renderWhitelist() {
    whitelistContainer.innerHTML = '';
    const list = appState.whitelist || [];

    if (list.length === 0) {
      whitelistContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 13px;">Chưa có trang web nào trong danh sách trắng</div>';
      return;
    }

    list.forEach(site => {
      const chip = document.createElement('div');
      chip.className = 'whitelist-chip';
      chip.innerHTML = `
        <span>${escapeHtml(site)}</span>
        <button class="chip-remove" data-site="${escapeHtml(site)}" title="Xóa khỏi danh sách trắng">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      whitelistContainer.appendChild(chip);
    });

    document.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const site = e.currentTarget.getAttribute('data-site');
        await chrome.runtime.sendMessage({
          type: 'TOGGLE_WHITELIST_SITE',
          domain: site
        });
        await loadState();
      });
    });
  }

  // 5. Live Inspector Logic
  async function loadLiveInspector() {
    inspectorTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-dim);">
          Đang quét dữ liệu gói tin mạng thời gian thực...
        </td>
      </tr>
    `;

    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_LIVE_REQUESTS' });
      if (!res || !res.success || !res.requests || res.requests.length === 0) {
        inspectorTableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-dim);">
              Chưa có kết nối mạng nào được ghi nhận. Hãy mở một tab trang web bất kỳ để theo dõi!
            </td>
          </tr>
        `;
        return;
      }

      inspectorTableBody.innerHTML = '';
      res.requests.forEach(req => {
        const tr = document.createElement('tr');
        const tagType = req.isIp ? 'ip' : 'domain';
        const tagText = req.isIp ? 'IP MẠNG' : 'DOMAIN';

        tr.innerHTML = `
          <td><span class="tag-badge ${tagType}">${tagText}</span></td>
          <td style="font-family: monospace; font-weight: 600; color: var(--text-main);">${escapeHtml(req.hostname)}</td>
          <td style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(req.url)}">
            ${escapeHtml(req.url)}
          </td>
          <td><span style="font-size: 11px; text-transform: uppercase;">${escapeHtml(req.type || 'other')}</span></td>
          <td style="text-align: center;">
            <button class="btn-danger btn-block-live" data-target="${escapeHtml(req.hostname)}" data-isip="${req.isIp}">
              Chặn Ngay
            </button>
          </td>
        `;

        inspectorTableBody.appendChild(tr);
      });

      document.querySelectorAll('.btn-block-live').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const target = e.currentTarget.getAttribute('data-target');
          const isIp = e.currentTarget.getAttribute('data-isip') === 'true';
          await chrome.runtime.sendMessage({
            type: 'ADD_CUSTOM_RULE',
            target: target,
            type: isIp ? 'ip' : 'domain',
            note: 'Chặn từ Live Inspector'
          });
          btn.textContent = 'Đã chặn';
          btn.disabled = true;
          btn.style.opacity = '0.5';
          await loadState();
        });
      });
    } catch (err) {
      console.warn('Inspector error:', err);
    }
  }

  btnRefreshLive.addEventListener('click', loadLiveInspector);

  // 6. Backup & Restore
  btnExportJson.addEventListener('click', async () => {
    const res = await chrome.runtime.sendMessage({ type: 'EXPORT_CONFIG' });
    if (res && res.success) {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.config, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `netshield-config-backup-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showFeedback(backupFeedback, 'Đã xuất file cấu hình thành công!', 'success');
    }
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const config = JSON.parse(event.target.result);
        const res = await chrome.runtime.sendMessage({
          type: 'IMPORT_CONFIG',
          config: config
        });

        if (res && res.success) {
          showFeedback(backupFeedback, 'Đã khôi phục cấu hình từ file thành công!', 'success');
          await loadState();
        } else {
          showFeedback(backupFeedback, 'Tệp cấu hình không hợp lệ!', 'error');
        }
      } catch {
        showFeedback(backupFeedback, 'Lỗi định dạng tệp JSON!', 'error');
      }
    };
    reader.readAsText(file);
  });

  btnResetAll.addEventListener('click', async () => {
    if (confirm('CẢNH BÁO: Thao tác này sẽ xóa mọi quy tắc tùy chỉnh và đưa extension về trạng thái ban đầu. Bạn có chắc không?')) {
      await chrome.runtime.sendMessage({ type: 'RESET_STATS' });
      await chrome.storage.local.clear();
      window.location.reload();
    }
  });

  // Helpers
  function isTargetIp(target) {
    const clean = target.replace(/^(https?:\/\/)?/, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(clean);
  }

  function showFeedback(el, msg, type) {
    el.textContent = msg;
    el.className = `feedback-text ${type}`;
    setTimeout(() => {
      el.className = 'feedback-text';
      el.textContent = '';
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  await loadState();
});
