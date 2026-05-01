/**
 * Employee Projects Module
 * - Button on toolbar to view projects by employee
 * - Dropdown table with glassmorphism dark theme
 * - Realtime listener on /03_employeeProjects
 * - Filter by logged-in user email → employee name
 */

export const EmployeeProjects = {
  _initialized: false,
  _unsubscribe: null,
  _initTimer: null,
  _abortController: null,
  _allData: {},      // All entries from /03_employeeProjects

  COLUMNS: [
    { key: 'sessionId',     label: 'Session' },
    { key: 'traLoi',        label: 'Trả lời' },
    { key: 'guiBai',        label: 'Gửi bài' },
    { key: 'congTrinhVT',   label: 'Tên CTVT' },
    { key: 'ghiChuGuiNV',   label: 'Thông báo' },
    { key: 'congViec',      label: 'Công việc' },
    { key: 'ghiChuCongViec', label: 'Ghi chú' },
    { key: 'soGioTruoc',    label: 'Gửi trước (h)' },
    { key: 'ngayHoanThanh', label: 'Hạn nộp' },
    { key: 'thu',           label: 'Thứ' },
    { key: 'gioGui',        label: 'Giờ' },
    { key: 'flow',          label: 'Flow' },
    { key: 'soNha',         label: 'Số nhà' },
    { key: 'soView',        label: 'Số view' },
    { key: 'tongDiem',      label: 'Tổng điểm' },
    { key: 'soLoi',         label: 'Số lỗi' },
    { key: 'folderServer',  label: 'Server' },
  ],

  /** Cleanup listener + reset state */
  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._initTimer) {
      clearTimeout(this._initTimer);
      this._initTimer = null;
    }
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._initialized = false;
  },

  init() {
    if (this._initialized) return;
    if (!window.firebaseDb) {
      this._initTimer = setTimeout(() => this.init(), APP_CONSTANTS.UI_TIMING.INIT_RETRY_DELAY);
      return;
    }
    this._initialized = true;
    this._setupBellClick();
    this._setupClose();
    this._setupListDelegation(); // 1 listener, dùng cho tất cả tr/copy-btn render về sau
    this._listen();
    console.log('[EmployeeProjects] Initialized');
  },

  /** Event delegation — gắn 1 lần ở init, không re-attach mỗi _render() */
  _setupListDelegation() {
    const list = document.getElementById('empProjectsList');
    if (!list) return;
    list.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.copy-folder-btn');
      if (copyBtn) {
        this._handleCopyFolder(copyBtn);
        return;
      }
      const tr = e.target.closest('tr[data-session]');
      if (tr && tr.dataset.session) {
        window.location.href = `/app?messageId=${tr.dataset.session}`;
      }
    }, { signal: this._abortController?.signal });
  },

  _handleCopyFolder(btn) {
    const folder = btn.dataset.folder || '';
    if (!folder) return;
    const flash = () => {
      btn.textContent = '✓';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = '📁'; btn.classList.remove('copied'); }, 1000);
    };
    if (window.electronAPI) {
      window.electronAPI.showInFolder(folder);
      flash();
    } else {
      navigator.clipboard.writeText(folder).then(flash).catch(err => console.error('[EmployeeProjects] Copy failed:', err));
    }
  },

  /** Kiểm tra user hiện tại có role "admin" trong /04_employees không */
  _isAdmin() {
    const email = window.firebaseAuth?.currentUser?.email;
    if (!email || !window.employeesData) return false;
    const emp = Object.values(window.employeesData).find(e => e.email === email);
    return emp?.role === 'admin';
  },

  /** Get employee name from logged-in email */
  _getMyName() {
    const email = window.firebaseAuth?.currentUser?.email;
    if (!email || !window.employeesData) return '';
    const emp = Object.values(window.employeesData).find(e => e.email === email);
    return emp?.name || '';
  },

  _setupBellClick() {
    const bell = document.getElementById('empProjectsBell');
    const dropdown = document.getElementById('empProjectsDropdown');
    if (!bell || !dropdown) return;

    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      this._render();
      dropdown.classList.toggle('show');
    });

    this._abortController = new AbortController();
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    }, { signal: this._abortController.signal });
  },

  _setupClose() {
    const btn = document.getElementById('empProjectsClose');
    if (btn) {
      btn.addEventListener('click', () => {
        document.getElementById('empProjectsDropdown')?.classList.remove('show');
      });
    }
  },

  /** Listen to /03_employeeProjects in realtime */
  _listen() {
    const ref = window.firebaseRef(window.firebaseDb, '/03_employeeProjects');
    this._unsubscribe = window.firebaseOnValue(ref, (snapshot) => {
      this._allData = snapshot.val() ?? {};
      this._updateBadge();
      // Re-render if dropdown is visible
      if (document.getElementById('empProjectsDropdown')?.classList.contains('show')) {
        this._render();
      }
    });
  },

  /** Filter data by employee name — admin thấy tất cả */
  _filterByName(name) {
    const all = Object.values(this._allData);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Admin role → không lọc theo tên, thấy tất cả
    const filtered = this._isAdmin() ? all : (name ? all.filter(d => d.nhanVien === name) : all);
    return filtered
      .filter(d => d.guiBai !== 'SENT' || !d.ngayHoanThanh || new Date(d.ngayHoanThanh + 'T00:00:00') >= today);
  },

  /** Update badge count */
  _updateBadge() {
    const badge = document.getElementById('empProjectsBadge');
    if (!badge) return;
    // Chưa load danh sách nhân viên → chưa biết tên → không hiện badge sai
    if (!window.employeesData) return;
    const count = this._filterByName(this._getMyName()).length;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  },

  /** Render header title (top bar trong dropdown) */
  _renderHeader(displayName) {
    const title = document.getElementById('empProjectsTitle');
    if (!title) return;
    title.innerHTML = `<span style="opacity:0.6;margin-right:6px;">&#8862;</span> Công trình của: <span style="color:#f0abfc;font-weight:700;">${escapeHTML(displayName)}</span>`;
  },

  /** Build HTML cho bảng (không attach event — delegation ở init) */
  _buildTableHTML(filtered) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const thead = this.COLUMNS.map(c => `<th>${c.label}</th>`).join('');
    const tbody = filtered.map(d => {
      const cells = this.COLUMNS.map(c => this._renderCell(c.key, d[c.key] || '', d, now, today)).join('');
      const rowCls = d.guiBai === 'SENT' ? ' class="emp-row-sent"' : '';
      return `<tr data-session="${d.sessionId || ''}"${rowCls}>${cells}</tr>`;
    }).join('');
    return `<div style="overflow-x:auto;"><table class="emp-projects-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
  },

  /** Render table — chỉ build HTML, KHÔNG attach event (delegation ở init đảm nhiệm) */
  _render() {
    const list = document.getElementById('empProjectsList');
    const footer = document.getElementById('empProjectsFooter');
    if (!list) return;

    const name = this._getMyName();
    const filtered = this._filterByName(name);
    const displayName = this._isAdmin() ? 'Tất cả (Admin)' : (name || 'Tất cả');

    this._renderHeader(displayName);

    if (filtered.length === 0) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(148,163,184,0.5);">Không có công trình</div>';
      if (footer) footer.innerHTML = 'Tổng: 0 công trình';
      return;
    }

    list.innerHTML = this._buildTableHTML(filtered);
    if (footer) footer.innerHTML = `Tổng: ${filtered.length} công trình &nbsp;·&nbsp; <span style="color:rgba(34,197,94,0.5);">● Realtime</span>`;
  },

  /** Render individual cell */
  _renderCell(key, val, row, now, today) {
    switch (key) {
      case 'sessionId':
        return `<td class="emp-cell-session">${escapeHTML(val)}</td>`;
      case 'traLoi':
        return `<td class="${val === 'REPLIED' ? 'emp-text-green' : 'emp-text-orange'}">${escapeHTML(val)}</td>`;
      case 'guiBai':
        return `<td class="${val === 'SENT' ? 'emp-text-green' : 'emp-text-orange'}">${escapeHTML(val)}</td>`;
      case 'congTrinhVT':
        return `<td class="emp-cell-ct">${escapeHTML(val)}</td>`;
      case 'ghiChuGuiNV':
        return `<td class="emp-text-red-glow">${escapeHTML(val)}</td>`;
      case 'ghiChuCongViec':
        return `<td>${escapeHTML(val)}</td>`;
      case 'ngayHoanThanh': {
        let cls = '';
        if (val) {
          const [h, m] = (row.gioGui || '23:59').split(':').map(Number);
          const deadline = new Date(val + 'T00:00:00');
          deadline.setHours(h, m, 0, 0);
          const hoursLeft = (deadline - now) / 3600000;
          if (hoursLeft <= 2) cls = 'emp-date-overdue';
          else if (val === today) cls = 'emp-date-upcoming';
        }
        return `<td class="${cls}">${escapeHTML(val)}${cls === 'emp-date-overdue' ? ' ⚠' : ''}</td>`;
      }
      case 'flow':
        return `<td><span class="emp-badge-flow">${escapeHTML(val)}</span></td>`;
      case 'tongDiem':
        return `<td class="emp-text-purple">${escapeHTML(val)}</td>`;
      case 'soLoi':
        return `<td class="${parseInt(val) > 0 ? 'emp-text-red-glow' : ''}">${escapeHTML(val)}</td>`;
      case 'folderServer':
        return `<td><button class="copy-folder-btn" data-folder="${escapeHTML(val)}" title="${escapeHTML(val)}">📁</button></td>`;
      default:
        return `<td>${escapeHTML(val)}</td>`;
    }
  },

};

window.EmployeeProjects = EmployeeProjects;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EmployeeProjects.init());
} else {
  EmployeeProjects.init();
}

