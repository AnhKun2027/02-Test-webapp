/**
 * App Save - Save workflow, sidebar/B1 toggles
 * Extracted from app.js
 */

import { appState } from './app-core.js';
import { saveTextFile } from './app-text-editor.js';

/**
 * Hien thi badge trang thai luu goc tren-phai cua nut saveAndSyncAllBtn
 * state: 'saving' | 'success' | 'error'
 */
/**
 * Xoa cac entry da bi user xoa khoi RAM nhung con tren Storage
 * @param {Array} entries - Danh sach {storagePath, name}
 * @param {string} label - Nhan log (vd: 'file', 'email attachment')
 */
async function _deleteStorageEntries(entries, label) {
  if (!entries || entries.length === 0) return;
  for (const entry of entries) {
    try {
      if (window.firebaseStorageCheckcongviec) {
        const storageRef = window.firebaseStorageRef(
          window.firebaseStorageCheckcongviec, entry.storagePath
        );
        await window.firebaseDeleteObject(storageRef);
        console.log(`[SaveAll] Da xoa ${label} Storage: ${entry.name}`);
      }
    } catch (err) {
      if (err.code !== 'storage/object-not-found') {
        console.warn(`[SaveAll] Xoa ${label} Storage warning: ${entry.name}`, err.message);
      }
    }
  }
}

let _saveStatusTimer = null;
function showSaveStatus(state) {
  const icon = document.getElementById('save-status-icon');
  if (!icon) return;

  clearTimeout(_saveStatusTimer);
  icon.className = '';
  icon.textContent = '';

  if (state === 'saving') {
    icon.className = 'sav-saving';
  } else if (state === 'success') {
    icon.className = 'sav-success';
    icon.textContent = '✓';
    _saveStatusTimer = setTimeout(() => {
      icon.className = '';
      icon.textContent = '';
    }, 2000);
  } else if (state === 'error') {
    icon.className = 'sav-error';
    icon.textContent = '✕';
  }
}

/**
 * Luu TAT CA thay doi pending len RTDB + dong bo sang user khac
 * Goi boi: nut saveAndSyncAllBtn hoac Ctrl+S
 *
 * Luong: 1. Upload Storage truoc (selections, text file)
 *        2. Ghi toan bo session len RTDB bang set() — 1 request duy nhat
 */
let _isSaving = false;
export async function saveAndSyncAll() {
  if (_isSaving) return;
  if (!window.FirebaseSync || !window.FirebaseSync.sessionId) {
    console.warn('[SaveAll] FirebaseSync chua khoi tao');
    return;
  }
  _isSaving = true;

  console.log('[SaveAll] Bat dau luu tat ca...');
  showSaveStatus('saving');

  try {

  // 1. Selections pending -> upload anh len Storage truoc
  if (typeof window.captureAndUploadPendingSelections === 'function' &&
      typeof window.hasPendingSelections === 'function' &&
      window.hasPendingSelections()) {
    await window.captureAndUploadPendingSelections();
    console.log('[SaveAll] Selections pending da upload');
  }

  // 1.5 Image overlay pending -> upload anh len Storage truoc
  if (typeof window.uploadPendingImageOverlays === 'function') {
    await window.uploadPendingImageOverlays();
  }

  // 2. Text file — upload len Storage truoc
  const textEditor = document.getElementById('textEditor');
  const currentFile = appState.currentFile;
  if (textEditor && currentFile && (currentFile.type === 'text' || currentFile.type === 'text/plain')) {
    if (textEditor.value !== currentFile.originalTextContent) {
      await saveTextFile();
      console.log('[SaveAll] Text file da upload');
    }
  }

  // 3. Upload file local chua co tren Storage
  if (typeof window.syncLocalFilesToFirebase === 'function') {
    await window.syncLocalFilesToFirebase();
    console.log('[SaveAll] Local files da upload');
  }

  // 4. Xoa file da bi user xoa khoi RAM nhung con tren Storage
  await _deleteStorageEntries(window.pendingFileDeletes, 'file');
  if (window.pendingFileDeletes) window.pendingFileDeletes.length = 0;

  // 4b. Xoa email attachment da bi user xoa khoi RAM nhung con tren Storage
  await _deleteStorageEntries(window.pendingEmailAttachmentDeletes, 'email attachment');
  if (window.pendingEmailAttachmentDeletes) window.pendingEmailAttachmentDeletes = [];

  // 5. Ghi toan bo session snapshot len RTDB — 1 request duy nhat
  const ok = await window.FirebaseSync.saveSessionSnapshot();
  if (ok) {
    console.log('[SaveAll] Da luu toan bo session thanh cong');
    showSaveStatus('success');
  } else {
    console.error('[SaveAll] Luu session that bai');
    showSaveStatus('error');
  }

  } catch (err) {
    console.error('[SaveAll] Loi:', err);
    showSaveStatus('error');
  } finally {
    _isSaving = false;
  }
}

export function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('sidebar-hidden');
  }
}

export function toggleB1Form() {
  const sidebar = document.getElementById('sidebarB1Form');
  if (sidebar) {
    sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
  }
}

console.log('[AppSave] Module loaded');
