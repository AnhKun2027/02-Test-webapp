/**
 * Save/collect methods for Firebase sync
 * Extracted from firebase-sync.js
 */

import {
  state, getPath, getUserIdentifier, trackingFields, comboCacheKey, debounce,
  B1_FORM_FIELDS, EMAIL_LANG_TEXTAREAS, EMPLOYEE_PROJECTS_FIELDS
} from './sync-core.js';

// Re-export constants so index.js can import from here too
export { B1_FORM_FIELDS, EMAIL_LANG_TEXTAREAS, EMPLOYEE_PROJECTS_FIELDS };

// ==================== COLLECT METHODS ====================

/**
 * Collect all B1 Form field values
 * @returns {Object} - Object with all field values
 */
export function collectB1FormData() {
  const data = {};

  Object.entries(B1_FORM_FIELDS).forEach(([elementId, dbKey]) => {
    const element = document.getElementById(elementId);
    if (element) {
      if (element.type === 'checkbox') {
        data[dbKey] = element.checked;
      } else {
        data[dbKey] = element.value || '';
      }
    }
  });

  if (!data.messageID && state.sessionId) {
    data.messageID = state.sessionId;
  }

  return data;
}

/**
 * Thu thap emailLang tu DOM textareas
 * @returns {Object} - { email_customer: { body_jp, body_vn, ... }, ... }
 */
export function collectEmailLangFromDOM() {
  const result = {};
  EMAIL_LANG_TEXTAREAS.forEach(tabKey => {
    const bodyJp = document.getElementById(tabKey + '_jp');
    const bodyVn = document.getElementById(tabKey + '_vn');
    const subJp = document.getElementById('subject_' + tabKey + '_jp');
    const subVn = document.getElementById('subject_' + tabKey + '_vn');

    const fields = {};
    if (bodyJp && bodyJp.value) fields.body_jp = bodyJp.value;
    if (bodyVn && bodyVn.value) fields.body_vn = bodyVn.value;
    if (subJp && subJp.value) fields.subject_jp = subJp.value;
    if (subVn && subVn.value) fields.subject_vn = subVn.value;

    const ccEl = document.getElementById('cc_' + tabKey);
    if (ccEl && ccEl.value.trim()) fields.cc = ccEl.value.trim();

    const msgidEl = document.getElementById('msgid_' + tabKey);
    if (msgidEl && msgidEl.value.trim()) fields.msgid = msgidEl.value.trim();

    if (tabKey === 'email_ai') {
      const aiTypeEl = document.getElementById('email_ai_type');
      if (aiTypeEl && aiTypeEl.value) fields.ai_type = aiTypeEl.value;
    }

    if (Object.keys(fields).length > 0) {
      result[tabKey] = fields;
    }
  });
  return result;
}

/**
 * Thu thap emailAttachments tu emailAttachmentManager
 * @returns {Object} - { email_customer: { attId: {...}, ... }, ... }
 */
export function collectEmailAttachments() {
  if (!window.emailAttachmentManager) return {};

  const result = {};
  const mgr = window.emailAttachmentManager;

  Object.entries(mgr.attachmentsByTab).forEach(([tabKey, attachments]) => {
    if (!Array.isArray(attachments) || attachments.length === 0) return;

    result[tabKey] = {};
    attachments.forEach(att => {
      if (!att.id) return;
      const { data, ...attWithoutData } = att;
      result[tabKey][att.id] = attWithoutData;
    });
  });
  return result;
}

/**
 * Thu thap fileTags tu appState.files
 */
export function collectFileTags() {
  if (!window.appState || !window.appState.files) return {};

  const result = {};
  window.appState.files.forEach(file => {
    if (!file.id || !file.tags || file.tags.length === 0) return;
    result[file.id] = {
      fileId: file.id,
      fileName: file.name || '',
      tags: file.tags
    };
  });
  return result;
}

/**
 * Thu thap pageTags tu appState.files
 */
export function collectPageTags() {
  if (!window.appState || !window.appState.files) return {};

  const result = {};
  window.appState.files.forEach(file => {
    if (!file.id || !file.pageTags) return;
    Object.entries(file.pageTags).forEach(([pageNum, tags]) => {
      if (!Array.isArray(tags) || tags.length === 0) return;
      const key = `${file.id}_${pageNum}`;
      result[key] = {
        fileId: file.id,
        fileName: file.name || '',
        pageNum: parseInt(pageNum),
        tags: tags
      };
    });
  });
  return result;
}

/**
 * Chuyen overlays tu grouped format -> flat UUID keys
 */
export function flattenOverlays(grouped) {
  if (!grouped) return {};
  const flat = {};
  for (const arr of Object.values(grouped)) {
    if (!Array.isArray(arr)) continue;
    for (const overlay of arr) {
      if (overlay.id) flat[overlay.id] = overlay;
    }
  }
  return flat;
}

/**
 * Chuyen selections array -> object keyed by UUID
 */
export function selectionsToObject(selections) {
  if (!Array.isArray(selections)) return {};
  const result = {};
  selections.forEach(sel => {
    if (sel.id) result[sel.id] = sel;
  });
  return result;
}

// Cached reverse map for employee projects
let _empFieldMap = null;

/**
 * Sync key b1Form fields to /03_employeeProjects/{sessionKey}.
 *
 * Snapshot DOM values + key NGAY khi gọi (KHÔNG đợi 2s mới đọc) — tránh user đổi
 * combo trong cửa sổ debounce → key cũ + value DOM mới (đã đổi sang combo mới)
 * gây ghi lệch RTDB.
 */
export function updateEmployeeProjects() {
  if (!window.firebaseDb || !state.sessionId) return;

  // Snapshot ngay tại thời điểm gọi
  const key = (state.activeCombo && state.activeCombo !== '')
    ? state.sessionId + state.activeCombo
    : state.sessionId;

  if (!_empFieldMap) {
    _empFieldMap = {};
    for (const [elId, dbField] of Object.entries(B1_FORM_FIELDS)) {
      if (EMPLOYEE_PROJECTS_FIELDS.includes(dbField)) {
        _empFieldMap[dbField] = elId;
      }
    }
  }

  const data = { sessionId: document.getElementById('b1_O_MessageID')?.value ?? state.sessionId };
  EMPLOYEE_PROJECTS_FIELDS.forEach(field => {
    const elId = _empFieldMap[field];
    if (elId) data[field] = document.getElementById(elId)?.value ?? '';
  });

  // Debounce CHỈ phần ghi RTDB (snapshot data đã đóng băng theo closure)
  debounce('employeeProjects', () => {
    const ref = window.firebaseRef(window.firebaseDb, `/03_employeeProjects/${key}`);
    window.firebaseUpdate(ref, data)
      .catch(err => console.error('[FirebaseSync] employeeProjects update error:', err));
  }, 2000);
}

// ==================== SAVE SESSION SNAPSHOT ====================

// Runtime fields KHÔNG ghi RTDB (xem docs/DATABASE.md). Freeze để tránh mutate accidental.
const SKIP_FIELDS = Object.freeze([
  'originalPdfBytes', 'thumbnailUrl', 'base64', 'textContent', 'originalTextContent',
  'pdfDocument', 'downloadUrl', 'needsContentLoad', 'isLocal', 'numPages',
  'lastPage', 'lastScale', 'selections', 'thumbnailRotation', 'storagePath',
  'file', 'arrayBuffer', 'imageObject', 'isFromClipboard', 'isRemoteSynced', 'archiveType',
]);

/** Helper: thu thập và build snapshot data từ DOM + state */
function _buildSnapshotData() {
  const tracking = trackingFields();

  // Files — strip runtime fields, serialize storagePath→storage_path (RTDB schema)
  const rawFiles = window.appState ? (window.appState.files ?? []) : [];
  const files = rawFiles.map(f => {
    const clean = {};
    Object.keys(f).forEach(key => {
      if (!SKIP_FIELDS.includes(key)) clean[key] = f[key];
    });
    const storagePath = f.storagePath;
    if (storagePath) clean.storage_path = storagePath;
    if (f.downloadUrl) {
      clean.url = f.downloadUrl;
    } else if (storagePath) {
      clean.url = `https://firebasestorage.googleapis.com/v0/b/checkcongviec/o/${encodeURIComponent(storagePath)}?alt=media`;
    }
    return clean;
  });

  // B1 Form — cache active combo rồi collect all
  const activeKey = comboCacheKey(state.activeCombo);
  state._b1FormCache[activeKey] = collectB1FormData();
  const allB1FormEntries = {};
  for (const [cacheKey, data] of Object.entries(state._b1FormCache)) {
    const rtdbKey = cacheKey ? 'b1Form' + cacheKey : 'b1Form';
    if (data && Object.keys(data).length > 0) {
      allB1FormEntries[rtdbKey] = data;
    }
  }

  // Collect all data sources
  const selectionsData = selectionsToObject(window.selections);
  const rotationsData = window.pageRotations ?? {};
  const imageOverlaysFlat = flattenOverlays(window.imageOverlays);
  const textOverlaysFlat = flattenOverlays(window.textOverlays);
  const fileTags = collectFileTags();
  const pageTags = collectPageTags();
  const presets = window.tagFilterCombos || [];
  const emailLang = collectEmailLangFromDOM();
  const emailAttachments = collectEmailAttachments();

  // Helper: object có key → giữ, rỗng → null (để update() xóa node RTDB)
  const orNull = (obj) => Object.keys(obj).length > 0 ? obj : null;

  const snapshot = {
    updatedBy: tracking.updatedBy,
    updatedBySession: tracking.updatedBySession,
    updatedAt: tracking.updatedAt,
    files,
    selections: orNull(selectionsData),
    rotations: orNull(rotationsData),
    imageOverlays: orNull(imageOverlaysFlat),
    textOverlays: orNull(textOverlaysFlat),
    fileTags: orNull(fileTags),
    pageTags: orNull(pageTags),
    presets: presets.length > 0 ? presets : null,
    ...allB1FormEntries,
    emailLang: orNull(emailLang),
    emailAttachments: orNull(emailAttachments)
  };

  // undefined → null để update() xóa node
  Object.keys(snapshot).forEach(key => {
    if (snapshot[key] === undefined) snapshot[key] = null;
  });

  return snapshot;
}

/**
 * Luu toan bo session snapshot bang update() — giu nguyen field khong quan ly (vd: aiClassification)
 * @returns {Promise<boolean>} - true neu thanh cong
 */
export async function saveSessionSnapshot() {
  if (!window.firebaseDb || !state.sessionId) {
    console.warn('[Snapshot] FirebaseSync chua khoi tao');
    return false;
  }

  console.log('[Snapshot] Bat dau thu thap data...');

  const snapshot = _buildSnapshotData();
  const sessionRef = window.firebaseRef(window.firebaseDb, `sessions/${state.sessionId}`);

  try {
    await window.firebaseUpdate(sessionRef, snapshot);
    console.log('[Snapshot] Da luu toan bo session (update) —', Object.keys(snapshot).length, 'nodes');
    updateEmployeeProjects();
    return true;
  } catch (err) {
    console.error('[Snapshot] Loi khi luu:', err);
    return false;
  }
}
