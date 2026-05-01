/**
 * Firebase Sync Load — one-time data loading and B1 form switching
 */

import {
  state, getPath, getB1FormPath, comboCacheKey,
  rtdbToGroupedOverlays, selectionsToArray, unwrapLegacyData,
  B1_FORM_FIELDS, EMAIL_LANG_TEXTAREAS
} from './sync-core.js';
import { collectB1FormData } from './sync-save.js';

// ==================== CONSTANTS ====================

const _OLD_TO_NEW_LANG_KEY = {
  customer_email_body: 'email_customer',
  email_body: 'email_reply',
  email_submit_body: 'email_send',
  email_ai_body: 'email_ai'
};

// ==================== PRIVATE HELPERS ====================

function _isArrayFormat(dataObj) {
  if (!dataObj || typeof dataObj !== 'object') return false;
  const keys = Object.keys(dataObj);
  if (keys.length === 0) return false;
  return /^\d+$/.test(keys[0]);
}

// collectB1FormData imported from sync-save.js (no circular dep)

// ==================== SELECTIONS LOAD ====================

export async function migrateSelectionsToObjectFormat() {
  if (!window.firebaseDb || !state.sessionId) return;

  try {
    const dataRef = window.firebaseRef(
      window.firebaseDb,
      getPath('selections/data')
    );
    const snapshot = await window.firebaseGet(dataRef);
    if (!snapshot.exists()) return;

    const data = snapshot.val();
    if (!_isArrayFormat(data)) return;

    const objectFormat = {};
    const values = Array.isArray(data) ? data : Object.values(data);
    values.forEach(sel => {
      if (sel && sel.id) {
        objectFormat[sel.id] = sel;
      }
    });

    await window.firebaseSet(dataRef, objectFormat);
    console.log(`[FirebaseSync] Migrated selections to object format (${Object.keys(objectFormat).length} items)`);
  } catch (err) {
    console.error('[FirebaseSync] Migration error:', err);
  }
}

export async function loadSelections() {
  if (!window.firebaseDb || !state.sessionId) return null;

  try {
    const ref = window.firebaseRef(
      window.firebaseDb,
      getPath('selections')
    );

    const snapshot = await window.firebaseGet(ref);
    const data = snapshot.exists() ? snapshot.val() : null;
    if (!data) return null;

    const selectionsRaw = unwrapLegacyData(data);

    if (_isArrayFormat(selectionsRaw)) {
      await migrateSelectionsToObjectFormat();
      const snapshot2 = await window.firebaseGet(ref);
      const data2 = snapshot2.exists() ? snapshot2.val() : null;
      const raw2 = unwrapLegacyData(data2);
      return raw2 ? selectionsToArray(raw2) : null;
    }

    return selectionsToArray(selectionsRaw);
  } catch (error) {
    console.error('[FirebaseSync] Error loading selections:', error);
    return null;
  }
}

// ==================== B1 FORM ====================

export function applyB1FormData(data) {
  if (!data) return;

  Object.entries(B1_FORM_FIELDS).forEach(([elementId, dbKey]) => {
    const element = document.getElementById(elementId);
    if (element && data[dbKey] !== undefined) {
      if (element.type === 'checkbox') {
        element.checked = data[dbKey] === true;
      } else {
        if (dbKey === 'guiBai' && typeof data[dbKey] === 'string' && data[dbKey].includes(',')) {
          element.value = data[dbKey].split(',')[0];
        } else {
          element.value = data[dbKey];
        }
      }
    }
  });

  if (typeof KhiFlowThayDoi === 'function') {
    KhiFlowThayDoi();
  }
}

export function listenB1Form(callback) {
  if (!window.firebaseDb || !state.sessionId) return;
  state._b1FormCallback = callback;
  _attachB1FormListener(callback);
}

function _attachB1FormListener(callback, skipFirstLoad = false) {
  if (!window.firebaseDb || !state.sessionId) return;

  const ref = window.firebaseRef(
    window.firebaseDb,
    getB1FormPath()
  );

  let isFirstLoad = true;

  const unsubscribe = window.firebaseOnValue(ref, (snapshot) => {
    const data = snapshot.val();

    if (isFirstLoad) {
      isFirstLoad = false;
      if (skipFirstLoad) return;
      if (data) {
        state.isB1FormSyncing = true;
        try { callback(data); } finally { state.isB1FormSyncing = false; }
      }
      return;
    }

    if (state.isB1FormSyncing) {
      return;
    }

    if (data && data.updatedBySession !== state.browserSessionId) {
      state.isB1FormSyncing = true;
      try { callback(data); } finally { state.isB1FormSyncing = false; }
    }
  });

  state._b1FormUnsubscribe = unsubscribe;
  state.listeners.push(unsubscribe);
}

export async function loadB1FormData() {
  if (!window.firebaseDb || !state.sessionId) return null;

  try {
    const ref = window.firebaseRef(
      window.firebaseDb,
      getB1FormPath()
    );

    if (window.firebaseGet) {
      const snapshot = await window.firebaseGet(ref);
      const data = snapshot.exists() ? snapshot.val() : null;
      if (data) {
        state._b1FormCache[comboCacheKey(state.activeCombo)] = data;
      }
      return data;
    }
    return null;
  } catch (error) {
    console.error('[FirebaseSync] Error loading B1 Form data:', error);
    return null;
  }
}

export async function switchB1FormCombo(newCombo, onDataLoaded) {
  if (!window.firebaseDb || !state.sessionId) return;

  const oldCombo = state.activeCombo;
  if (oldCombo === newCombo) {
    return;
  }

  const oldKey = comboCacheKey(oldCombo);
  state._b1FormCache[oldKey] = collectB1FormData();

  if (state._b1FormUnsubscribe) {
    state._b1FormUnsubscribe();
    const idx = state.listeners.indexOf(state._b1FormUnsubscribe);
    if (idx !== -1) state.listeners.splice(idx, 1);
    state._b1FormUnsubscribe = null;
  }

  state.activeCombo = newCombo;

  const newKey = comboCacheKey(newCombo);
  let newData;
  const hasCache = !!state._b1FormCache[newKey];
  if (hasCache) {
    newData = state._b1FormCache[newKey];
  } else {
    newData = await loadB1FormData();
    if (newData) {
      state._b1FormCache[newKey] = newData;
    }
  }

  const callback = onDataLoaded || state._b1FormCallback;
  if (newData && Object.keys(newData).length > 2) {
    state.isB1FormSyncing = true;
    try { if (callback) callback(newData); } finally { state.isB1FormSyncing = false; }
  } else {
    if (callback) callback(null);
  }

  _attachB1FormListener(callback, hasCache);
}

// ==================== EMAIL FIELDS ====================

/**
 * Set value vào element nếu (1) element tồn tại, (2) user không đang focus, (3) value khác giá trị mới.
 * Tránh ghi đè input khi user đang gõ + tránh dispatch input thừa.
 * @param {HTMLElement|null} el
 * @param {string} newVal
 * @param {boolean} [dispatchInput=false] - dispatch event 'input' để trigger highlight/autosave
 */
function _setIfNotFocused(el, newVal, dispatchInput = false) {
  if (!el || document.activeElement === el || el.value === newVal) return;
  el.value = newVal;
  if (dispatchInput) el.dispatchEvent(new Event('input'));
}

export function fillEmailFieldsFromRTDB(emailLangData) {
  if (!emailLangData) return;

  for (const [oldKey, newKey] of Object.entries(_OLD_TO_NEW_LANG_KEY)) {
    if (emailLangData[oldKey] && !emailLangData[newKey]) {
      emailLangData[newKey] = emailLangData[oldKey];
    }
  }

  EMAIL_LANG_TEXTAREAS.forEach(baseId => {
    const langData = emailLangData[baseId];
    if (!langData) return;

    _setIfNotFocused(document.getElementById(baseId + '_jp'), langData.body_jp ?? '');
    _setIfNotFocused(document.getElementById(baseId + '_vn'), langData.body_vn ?? '', /* dispatchInput */ true);
    _setIfNotFocused(document.getElementById('subject_' + baseId + '_jp'), langData.subject_jp ?? '');
    _setIfNotFocused(document.getElementById('subject_' + baseId + '_vn'), langData.subject_vn ?? '');
    _setIfNotFocused(document.getElementById('cc_' + baseId), langData.cc ?? '');

    // msgid: không cần guard activeElement (read-only field)
    const msgidEl = document.getElementById('msgid_' + baseId);
    const newMsgid = langData.msgid ?? '';
    if (msgidEl && msgidEl.value !== newMsgid) msgidEl.value = newMsgid;
  });

  const aiLangData = emailLangData['email_ai'];
  if (aiLangData && aiLangData.ai_type) {
    _setIfNotFocused(document.getElementById('email_ai_type'), aiLangData.ai_type);
  }
}

// ==================== LOAD ALL DATA ====================

export async function loadAllData() {
  if (!window.firebaseDb || !state.sessionId) return null;

  const result = {
    selections: null,
    imageOverlays: null,
    textOverlays: null,
    rotations: null,
    fileTags: null,
    pageTags: null
  };

  const paths = [
    'selections',
    'imageOverlays',
    'textOverlays',
    'rotations',
    'fileTags',
    'pageTags'
  ];

  const promises = paths.map(async (path) => {
    try {
      const ref = window.firebaseRef(
        window.firebaseDb,
        getPath(path)
      );

      if (window.firebaseGet) {
        const snapshot = await window.firebaseGet(ref);
        const data = snapshot.exists() ? snapshot.val() : null;
        return { path, data: unwrapLegacyData(data) };
      } else {
        return new Promise((resolve) => {
          window.firebaseOnValue(ref, (snapshot) => {
            const data = snapshot.val();
            resolve({ path, data: unwrapLegacyData(data) });
          }, { onlyOnce: true });
        });
      }
    } catch (error) {
      console.error(`[FirebaseSync] Error loading ${path}:`, error);
      return { path, data: null };
    }
  });

  try {
    const results = await Promise.all(promises);

    results.forEach(({ path, data }) => {
      if ((path === 'imageOverlays' || path === 'textOverlays') && data) {
        result[path] = rtdbToGroupedOverlays(data);
      } else {
        result[path] = data;
      }
    });

    return result;
  } catch (error) {
    console.error('[FirebaseSync] Error loading all data:', error);
    return result;
  }
}

export async function loadFileTags() {
  if (!window.firebaseDb || !state.sessionId) return null;

  try {
    const ref = window.firebaseRef(
      window.firebaseDb,
      getPath('fileTags')
    );
    const snapshot = await window.firebaseGet(ref);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('[FirebaseSync] Error loading file tags:', error);
    return null;
  }
}

export async function loadPageTags() {
  if (!window.firebaseDb || !state.sessionId) return null;

  try {
    const ref = window.firebaseRef(
      window.firebaseDb,
      getPath('pageTags')
    );
    const snapshot = await window.firebaseGet(ref);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('[FirebaseSync] Error loading page tags:', error);
    return null;
  }
}

export async function loadEmailAttachments(tabKey) {
  const rtdbPath = getPath(`emailAttachments/${tabKey}`);
  const ref = window.firebaseRef(window.firebaseDb, rtdbPath);
  const snapshot = await window.firebaseGet(ref);

  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data).sort((a, b) => (a.uploadedAt ?? 0) - (b.uploadedAt ?? 0));
  }

  const KEY_TO_OLD_TAB = {
    email_customer: 'tab1',
    email_reply: 'tab2',
    email_send: 'tab3',
    email_ai: 'tab4'
  };
  const oldTab = KEY_TO_OLD_TAB[tabKey];
  if (oldTab) {
    const oldPath = getPath(`emailAttachments/${oldTab}`);
    const oldRef = window.firebaseRef(window.firebaseDb, oldPath);
    const oldSnapshot = await window.firebaseGet(oldRef);
    if (oldSnapshot.exists()) {
      const oldData = oldSnapshot.val();
      return Object.values(oldData).sort((a, b) => (a.uploadedAt ?? 0) - (b.uploadedAt ?? 0));
    }
  }

  return [];
}
