/**
 * Firebase Sync Core — shared state, helpers, init/destroy, presence setup
 */

// ==================== HELPER FUNCTIONS ====================

/**
 * Unwrap RTDB legacy schema: một số node có dạng `{data: [...], updatedAt, updatedBy}`
 * (wrapper từ saveSessionSnapshot), một số node là array/object trực tiếp.
 * Helper này gom logic `node?.data || node` rải rác 6+ chỗ trong sync-load + sync-listeners.
 *
 * Note: dùng `||` (KHÔNG `??`) để giữ semantic cũ — `{data: null}` fallback `node`,
 * không phải `null`.
 */
export function unwrapLegacyData(node) {
  if (node == null) return node;
  return node.data || node;
}

/**
 * Migrate overlay keys from old format (fileName_page) to new format (fileId_page)
 */
function migrateOverlayKeys(overlays) {
  if (!overlays || typeof overlays !== 'object') return overlays;

  const migrated = {};
  let migrationCount = 0;

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_\d+$/i;

  for (const [key, overlayArray] of Object.entries(overlays)) {
    if (uuidPattern.test(key)) {
      migrated[key] = overlayArray;
    } else if (Array.isArray(overlayArray) && overlayArray.length > 0) {
      const firstOverlay = overlayArray[0];
      if (firstOverlay && firstOverlay.fileId && firstOverlay.page !== undefined) {
        const newKey = `${firstOverlay.fileId}_${firstOverlay.page}`;
        migrated[newKey] = overlayArray;
        migrationCount++;
      } else {
        migrated[key] = overlayArray;
        console.warn(`[FirebaseSync] Cannot migrate overlay key "${key}" - missing fileId/page`);
      }
    }
  }

  return migrated;
}

// ==================== SHARED STATE ====================

export const state = {
  browserSessionId: null,
  sessionId: null,
  userName: null,
  listeners: [],
  debounceTimers: {},
  activeCombo: null,
  _b1FormCache: {},
  _b1FormUnsubscribe: null,
  _b1FormCallback: null,
  isB1FormSyncing: false,
};

// ==================== SHARED HELPERS ====================

export function getUserIdentifier() {
  if (window.firebaseAuth?.currentUser?.email) {
    return window.firebaseAuth.currentUser.email;
  }
  return 'anonymous';
}

export function getUserDisplayName() {
  if (window.firebaseAuth?.currentUser?.email) {
    return window.firebaseAuth.currentUser.email;
  }
  return `User_${state.browserSessionId.substring(0, 6)}`;
}

export function trackingFields() {
  return {
    updatedBy: getUserIdentifier(),
    updatedBySession: state.browserSessionId,
    updatedAt: window.firebaseServerTimestamp ? window.firebaseServerTimestamp() : Date.now()
  };
}

export function getPath(subpath) {
  return `sessions/${state.sessionId}/${subpath}`;
}

export function getPresencePath(browserSessionId) {
  if (browserSessionId) return `06_presence/${state.sessionId}/${browserSessionId}`;
  return `06_presence/${state.sessionId}`;
}

export function getB1FormPath() {
  if (state.activeCombo) {
    return getPath('b1Form' + state.activeCombo);
  }
  return getPath('b1Form');
}

export function getEmailLangPath(textareaId) {
  if (textareaId) {
    return getPath(`emailLang/${textareaId}`);
  }
  return getPath('emailLang');
}

export function comboCacheKey(combo) {
  return combo || '';
}

export function debounce(key, fn, delay = 300) {
  if (state.debounceTimers[key]) {
    clearTimeout(state.debounceTimers[key]);
  }
  state.debounceTimers[key] = setTimeout(fn, delay);
}

/**
 * Convert RTDB flat overlay data -> grouped format cho in-memory
 */
export function rtdbToGroupedOverlays(data) {
  if (!data || typeof data !== 'object') return {};

  const grouped = {};

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      grouped[key] = value;
    } else if (value && typeof value === 'object' && value.fileId && value.page != null) {
      const groupKey = `${value.fileId}_${value.page}`;
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(value);
    }
  }

  return migrateOverlayKeys(grouped);
}

export function selectionsToArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(Boolean);
  return Object.values(data).filter(Boolean);
}

// ==================== CONSTANTS (shared with sync-save.js) ====================

export const B1_FORM_FIELDS = {
  // TAB WORK (24 fields)
  'b1_O_MessageID': 'messageID',
  'b1_O_Flow': 'flow',
  'b1_O_CongViec': 'congViec',
  'b1_O_MaCongTy': 'maCongTy',
  'b1_O_CongTrinhVT': 'congTrinhVT',
  'b1_O_SoPJ': 'soPJ',
  'b1_O_KyHieuTiem': 'kyHieuTiem',
  'b1_O_NhapTenTiengNhat': 'nhapTenTiengNhat',
  'b1_O_TenCTrTiengNhat': 'tenCTrTiengNhat',
  'b1_O_TrangThaiTaoCT': 'trangThaiTaoCT',
  'b1_O_FolderMail': 'folderMail',
  'b1_O_FolderServer': 'folderServer',
  'b1_O_FolderSend': 'folderSend',
  'b1_O_NhanVien': 'nhanVien',
  'b1_O_GhiChuCongViec': 'ghiChuCongViec',
  'b1_O_Thu': 'thu',
  'b1_O_NgayHoanThanh': 'ngayHoanThanh',
  'b1_O_ThuJP': 'thuJP',
  'b1_O_GioGui': 'gioGui',
  'b1_O_SoGioTruoc': 'soGioTruoc',
  'b1_O_ChonSoGioTruoc': 'chonSoGioTruoc',
  'b1_O_TraLoi': 'traLoi',
  'b1_O_GuiBai': 'guiBai',
  'b1_O_GhiChuGuiNV': 'ghiChuGuiNV',

  // TAB DIEM (9 fields)
  'b1_O_SoNha': 'soNha',
  'b1_O_SoView': 'soView',
  'b1_O_DiemGoc': 'diemGoc',
  'b1_O_PhanTramDiem': 'phanTramDiem',
  'b1_O_HeSo': 'heSo',
  'b1_O_TongDiem': 'tongDiem',
  'b1_O_DiemDuTinh': 'diemDuTinh',
  'b1_O_SoLoi': 'soLoi',
  'b1_O_DanhGia': 'danhGia',

  // TAB OTHER - Danh Ba (14 fields)
  'b1_O_DinhKemTraLoi': 'dinhKemTraLoi',
  'b1_O_ToEmail': 'toEmail',
  'b1_O_EmailKhachHang': 'emailKhachHang',
  'b1_O_EmailCC': 'emailCC',
  'b1_O_DanhBaWebsite': 'danhBaWebsite',
  'b1_O_DanhBaCongTy': 'danhBaCongTy',
  'b1_O_DanhBaChiNhanh': 'danhBaChiNhanh',
  'b1_O_DanhBaHo': 'danhBaHo',
  'b1_O_DanhBaMotNhieu': 'danhBaMotNhieu',
  'b1_O_DanhBaTen': 'danhBaTen',
  'b1_O_DanhBaSoPhone': 'danhBaSoPhone',
  'b1_O_DanhBaSoMobile': 'danhBaSoMobile',
  'b1_O_DanhBaCachGuiFile': 'danhBaCachGuiFile',
};

export const EMAIL_LANG_TEXTAREAS = [
  'email_customer',
  'email_reply',
  'email_send',
  'email_ai'
];

export const EMPLOYEE_PROJECTS_FIELDS = [
  'nhanVien', 'congTrinhVT', 'ghiChuGuiNV', 'congViec', 'ghiChuCongViec',
  'soGioTruoc', 'ngayHoanThanh', 'thu', 'gioGui', 'flow', 'soNha', 'soView', 'tongDiem',
  'soLoi', 'folderServer', 'traLoi', 'guiBai'
];

// ==================== INIT ====================

export function init(sessionId, userName = null) {
  if (!sessionId) {
    console.warn('[FirebaseSync] No sessionId provided, sync disabled');
    return;
  }

  if (!window.firebaseDb) {
    console.warn('[FirebaseSync] Firebase not initialized');
    return;
  }

  if (state.sessionId === sessionId && state.browserSessionId) {
    const newUserName = userName || getUserDisplayName();
    if (newUserName !== state.userName) {
      state.userName = newUserName;
      setupPresence();
    }
    return;
  }

  state.sessionId = sessionId;
  state.browserSessionId = crypto.randomUUID();
  state.userName = userName || getUserDisplayName();

  console.log(`[FirebaseSync] Initialized for session: ${sessionId}`);

  setupPresence();
}

// ==================== PRESENCE SYSTEM ====================

export function setupPresence() {
  if (!window.firebaseDb) return;

  const connectedRef = window.firebaseRef(window.firebaseDb, '.info/connected');
  const myPresenceRef = window.firebaseRef(
    window.firebaseDb,
    getPresencePath(state.browserSessionId)
  );

  const unsubscribe = window.firebaseOnValue(connectedRef, (snapshot) => {
    if (snapshot.val() === true) {
      if (window.firebaseOnDisconnect) {
        window.firebaseOnDisconnect(myPresenceRef).remove();
      }

      window.firebaseSet(myPresenceRef, {
        name: state.userName,
        online: true,
        lastSeen: window.firebaseServerTimestamp ? window.firebaseServerTimestamp() : Date.now(),
        currentPage: null,
        currentFile: null
      }).catch(err => console.error('[FirebaseSync] Presence set error:', err));
    }
  });

  state.listeners.push(unsubscribe);
}

export function goOffline() {
  if (!window.firebaseDb || !state.sessionId) return;

  const myPresenceRef = window.firebaseRef(
    window.firebaseDb,
    getPresencePath(state.browserSessionId)
  );

  void window.firebaseRemove(myPresenceRef).catch(err => console.error('[FirebaseSync] Presence remove error:', err));
}

// ==================== DESTROY ====================

export function destroy() {
  state.listeners.forEach(unsubscribe => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  });
  state.listeners = [];

  Object.values(state.debounceTimers).forEach(timer => clearTimeout(timer));
  state.debounceTimers = {};

  state.activeCombo = null;
  state._b1FormCache = {};
  // Da duoc cleanup qua state.listeners.forEach(unsub) o tren — chi reset reference
  state._b1FormUnsubscribe = null;
  state._b1FormCallback = null;
  state.sessionId = null;
  state.browserSessionId = null;
  state.userName = null;
  state.isB1FormSyncing = false;

  goOffline();
}
