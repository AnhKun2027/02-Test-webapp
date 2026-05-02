
/**
 * B1 Form Sync — Firebase realtime sync + employees dropdown
 */

import { applyTrangThaiTaoCTStyle, TraLoiThayDoi, GuiBaiThayDoi } from './b1-form-workflow.js';
import { retryUntilReady } from './b1-form-utils.js';

// Dùng bởi notification-system.js để hiển thị tên nhân viên
// Được set trong loadEmployeesDropdown()

// Controllers để cancel retry khi destroy() module
let _empController = null;
let _syncController = null;

const _isFirebaseReady = () =>
  !!(window.firebaseDb && window.firebaseRef && window.firebaseGet);

// =============================================
// EMPLOYEES DROPDOWN
// =============================================

/** Load employees từ RTDB /04_employees → populate dropdown */
export function loadEmployeesDropdown() {
  _empController?.abort();
  _empController = retryUntilReady(_loadEmployeesNow, _isFirebaseReady, 'Firebase (employees)');
}

async function _loadEmployeesNow() {
  try {
    const employeesRef = window.firebaseRef(window.firebaseDb, '/04_employees');
    const snapshot = await window.firebaseGet(employeesRef);
    const data = snapshot.val();
    if (!data) {
      console.warn('[B1Form] No employees data in RTDB');
      return;
    }

    // Cache for use by notification system
    window.employeesData = data;

    const select = document.getElementById('b1_O_NhanVien');
    if (!select) return;

    const currentValue = select.value;
    const placeholder = select.options[0];

    // Build options trong fragment → replace 1 lần (1 reflow)
    const frag = document.createDocumentFragment();
    Object.keys(data).sort().forEach(key => {
      const emp = data[key];
      if (emp.active === false) return;
      frag.appendChild(new Option(emp.name, emp.name));
    });
    frag.appendChild(new Option('Other', 'Other'));

    select.replaceChildren(placeholder, frag);

    // Restore selection if it still exists
    if (currentValue && currentValue !== 'Chua chon NV ...') {
      select.value = currentValue;
    }

  } catch (error) {
    console.error('[B1Form] Error loading employees:', error);
  }
}

// =============================================
// FIREBASE REALTIME SYNC FOR B1 FORM
// =============================================

const _isSyncReady = () =>
  !!(window.FirebaseSync && window.FirebaseSync.sessionId);

export function initB1FormSync() {
  _syncController?.abort();
  _syncController = retryUntilReady(_initSyncNow, _isSyncReady, 'FirebaseSync');
}

function _initSyncNow() {
  // Listen for changes from other users → Local UI
  window.FirebaseSync.listenB1Form((data) => {
    window.FirebaseSync.applyB1FormData(data);
    applyTrangThaiTaoCTStyle();
    TraLoiThayDoi();
    GuiBaiThayDoi();
    showSyncIndicator();
  });
}

let _syncIndicatorTimer = null;

/**
 * Show visual indicator when data is synced from another user
 */
export function showSyncIndicator() {
  let indicator = document.getElementById('b1_sync_indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'b1_sync_indicator';
    indicator.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 10px;
      background: #28a745;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 9999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    `;
    indicator.textContent = '🔄 Form info updated';
    document.body.appendChild(indicator);
  }

  indicator.style.opacity = '1';

  clearTimeout(_syncIndicatorTimer);
  _syncIndicatorTimer = setTimeout(() => {
    indicator.style.opacity = '0';
  }, 2000);
}

/** Cleanup timers — gọi khi destroy module */
export function destroy() {
  _empController?.abort();
  _syncController?.abort();
  clearTimeout(_syncIndicatorTimer);
  _empController = null;
  _syncController = null;
}
