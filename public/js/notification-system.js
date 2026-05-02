/**
 * Notification System Module
 * - Badge counter on toolbar bell icon
 * - Dropdown list of notifications
 * - Browser notifications (Notification API)
 * - Realtime listener on RTDB /05_notifications/{userEmailKey}
 */

export const NotificationSystem = {
  _initialized: false,
  _unsubscribe: null,
  _initTimer: null,
  _abortController: null,

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

  /** Convert email to RTDB-safe key: @ and . → _ */
  emailToKey(email) {
    return email.replace(/[@.]/g, '_');
  },

  /** Initialize: start listening for notifications */
  init() {
    if (this._initialized) return;

    const email = window.getCurrentEmail();
    if (!email || !window.firebaseDb) {
      // Retry when auth is ready — lưu reference tránh timer leak
      this._initTimer = setTimeout(() => this.init(), APP_CONSTANTS.UI_TIMING.INIT_RETRY_DELAY);
      return;
    }

    this._initialized = true;
    this._setupBellClick();
    this._setupMarkAllRead();
    this._setupDeleteRead();
    this._requestBrowserPermission();
    this._listenNotifications(email);

    console.log('[Notification] Initialized for', email);
  },

  /** Setup bell icon click → toggle dropdown */
  _setupBellClick() {
    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    if (!bell || !dropdown) return;

    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    this._abortController = new AbortController();
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    }, { signal: this._abortController.signal });
  },

  /** Setup "Mark all read" button */
  _setupMarkAllRead() {
    const btn = document.getElementById('notifMarkAllRead');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const email = window.getCurrentEmail();
      if (!email || !window.firebaseDb) return;

      try {
        const key = this.emailToKey(email);
        const notifsRef = window.firebaseRef(window.firebaseDb, `/05_notifications/${key}`);
        const snapshot = await window.firebaseGet(notifsRef);
        const data = snapshot.val();
        if (!data) return;

        const updates = {};
        Object.keys(data).forEach(id => {
          if (!data[id].read) {
            updates[`/05_notifications/${key}/${id}/read`] = true;
          }
        });

        if (Object.keys(updates).length > 0) {
          await window.firebaseUpdate(window.firebaseRef(window.firebaseDb), updates);
        }
      } catch (err) {
        console.error('[Notification] Mark all read failed:', err);
      }
    });
  },

  /** Setup "Delete read" button - xóa thông báo đã đọc khỏi RTDB */
  _setupDeleteRead() {
    const btn = document.getElementById('notifDeleteRead');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const email = window.getCurrentEmail();
      if (!email || !window.firebaseDb) return;

      try {
        const key = this.emailToKey(email);
        const notifsRef = window.firebaseRef(window.firebaseDb, `/05_notifications/${key}`);
        const snapshot = await window.firebaseGet(notifsRef);
        const data = snapshot.val();
        if (!data) return;

        const updates = {};
        Object.keys(data).forEach(id => {
          if (data[id].read) {
            updates[`/05_notifications/${key}/${id}`] = null;
          }
        });

        if (Object.keys(updates).length > 0) {
          await window.firebaseUpdate(window.firebaseRef(window.firebaseDb), updates);
        }
      } catch (err) {
        console.error('[Notification] Delete read failed:', err);
      }
    });
  },

  /** Request browser notification permission */
  _requestBrowserPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {});
    }
  },

  /** Listen to /05_notifications/{emailKey} in realtime */
  _listenNotifications(email) {
    const key = this.emailToKey(email);
    const notifsRef = window.firebaseRef(window.firebaseDb, `/05_notifications/${key}`);

    // Track known IDs to detect new ones for browser notification
    let knownIds = new Set();
    let firstLoad = true;

    this._unsubscribe = window.firebaseOnValue(notifsRef, (snapshot) => {
      const data = snapshot.val();
      const notifications = [];

      if (data) {
        Object.keys(data).forEach(id => {
          notifications.push({ id, ...data[id] });
        });
        // Sort newest first
        notifications.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }

      // Detect new notifications (not on first load)
      if (!firstLoad) {
        notifications.forEach(n => {
          if (!knownIds.has(n.id) && !n.read) {
            this._showBrowserNotification(n);
          }
        });
      }
      firstLoad = false;
      knownIds = new Set(notifications.map(n => n.id));

      this._updateBadge(notifications);
      this._renderList(notifications);
    });
  },

  /** Update badge count */
  _updateBadge(notifications) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  },

  /** Render notification list in dropdown */
  _renderList(notifications) {
    const list = document.getElementById('notificationList');
    if (!list) return;

    if (notifications.length === 0) {
      list.innerHTML = '<div class="notification-empty">Không có thông báo</div>';
      return;
    }

    list.innerHTML = notifications.map(n => {
      const isUnread = !n.read;
      const timeAgo = this._timeAgo(n.createdAt);

      // Dòng 1: congTrinhVT in đậm (trống thì ẩn)
      const nameHTML = n.congTrinhVT
        ? `<div class="notification-name">${escapeHTML(n.congTrinhVT)}</div>`
        : '';

      // Dòng 2: congTy ・ chiNhanh ・ hoKhach (bỏ field trống, bỏ dấu ・ thừa)
      const infoParts = [n.congTy, n.chiNhanh, n.hoKhach].filter(Boolean);
      const infoHTML = infoParts.length > 0
        ? `<div class="notification-info">${escapeHTML(infoParts.join(' ・ '))}</div>`
        : '';

      // Dòng 3: số file đính kèm (ẩn nếu 0)
      const fileHTML = n.soFile > 0
        ? `<div class="notification-file">📎 ${n.soFile} file đính kèm</div>`
        : '';

      return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${n.id}" data-session="${n.sessionId || ''}">
          <div class="notification-dot">${isUnread ? '●' : ''}</div>
          <div class="notification-content">
            ${nameHTML}
            ${infoHTML}
            ${fileHTML}
            ${n.note ? `<div class="notification-note">${escapeHTML(n.note)}</div>` : ''}
            <div class="notification-meta">Gán bởi: ${escapeHTML(n.assignedBy || '')}</div>
            <div class="notification-time">${timeAgo}${!isUnread ? ' · đã đọc' : ''}</div>
          </div>
        </div>
      `;
    }).join('');

    // Click notification → mark as read + open session
    list.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const sessionId = item.dataset.session;
        this._markAsRead(id);
        if (sessionId) {
          window.open(`/app?messageId=${sessionId}`, '_blank');
        }
      });
    });
  },

  /** Mark single notification as read */
  _markAsRead(notifId) {
    const email = window.getCurrentEmail();
    if (!email || !window.firebaseDb) return;

    const key = this.emailToKey(email);
    const path = `/05_notifications/${key}/${notifId}/read`;
    void window.firebaseSet(window.firebaseRef(window.firebaseDb, path), true)
      .catch(err => console.error('[Notification] Mark read failed:', err));
  },

  /** Show browser notification */
  _showBrowserNotification(n) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    new Notification('CheckCongViec', {
      body: `${n.congTrinhVT || 'Công trình mới'}\nGán bởi: ${n.assignedBy || ''}`,
      icon: '/favicon.ico'
    });
  },

  /** Time ago helper */
  _timeAgo(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  },


  /** Send notification to an employee (called from B1 form) */
  async sendNotification(employeeName, congTrinhVT, sessionId, note, extraFields) {
    if (!window.firebaseDb || !window.employeesData) {
      console.warn('[Notification] Firebase or employees data not ready');
      return false;
    }

    // Find employee email by name
    let targetEmail = null;
    Object.values(window.employeesData).forEach(emp => {
      if (emp.name === employeeName) {
        targetEmail = emp.email;
      }
    });

    if (!targetEmail) {
      console.warn('[Notification] Employee not found:', employeeName);
      return false;
    }

    const key = this.emailToKey(targetEmail);
    const notifsRef = window.firebaseRef(window.firebaseDb, `/05_notifications/${key}`);
    const newNotifRef = window.firebasePush(notifsRef);

    const data = {
      congTrinhVT: congTrinhVT,
      congTy: extraFields?.congTy ?? '',
      chiNhanh: extraFields?.chiNhanh ?? '',
      hoKhach: extraFields?.hoKhach ?? '',
      soFile: extraFields?.soFile ?? 0,
      sessionId: sessionId ?? '',
      assignedBy: window.getCurrentEmail() ?? 'unknown',
      createdAt: window.firebaseServerTimestamp ? window.firebaseServerTimestamp() : Date.now(),
      read: false
    };
    if (note) data.note = note;

    try {
      await window.firebaseSet(newNotifRef, data);
      console.log('[Notification] Sent to', targetEmail);
      return true;
    } catch (err) {
      console.error('[Notification] Error sending:', err);
      return false;
    }
  }
};

// Export
window.NotificationSystem = NotificationSystem;

// Auto-init when auth is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => NotificationSystem.init());
} else {
  NotificationSystem.init();
}

