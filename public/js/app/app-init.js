/**
 * App Init - Khoi tao app, load du lieu tu Firebase, realtime sync
 * Tach tu index.js — chua toan bo luong khoi dong khi mo trang
 */

import { appState, getMimeType, showLoading, hideLoading, loadFile } from './app-core.js';
import { initToolbarButtons, initZoomControls, initTagFilters } from './app-toolbar.js';
import { initAiModelConfig } from './app-ai-config.js';
import { escapeHTML } from '../core-utils.js';

// === Khoi tao app ===

/**
 * Ham khoi tao chinh — chay khi DOMContentLoaded
 * Doc messageId tu URL → init UI → goi load du lieu
 */
export function initApp() {
  console.log('[App] Initializing CheckCongViec Webapp...');

  // Get URL parameters — ho tro ?messageId=xxx_1 de auto-switch combo
  const urlParams = new URLSearchParams(window.location.search);
  const rawMessageId = urlParams.get('messageId') || '';
  const parts = rawMessageId.split('_');
  if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
    appState.messageId = parts.slice(0, -1).join('_');
    appState.comboFromUrl = '_' + parts[parts.length - 1];
  } else {
    appState.messageId = rawMessageId;
    appState.comboFromUrl = null;
  }

  // Initialize UI
  initToolbarButtons();
  initZoomControls();
  initTagFilters();
  initAiModelConfig();
  if (typeof initDragDropHandlers === 'function') {
    initDragDropHandlers();
  }

  if (typeof initOverlayKeyboardHandler === 'function') {
    initOverlayKeyboardHandler();
  }
  if (typeof initOverlayDeselectHandler === 'function') {
    initOverlayDeselectHandler();
  }
  if (typeof initPasteHandler === 'function') {
    initPasteHandler();
  }

  if (typeof initSelectionManager === 'function') {
    initSelectionManager();
  }

  if (appState.messageId) {
    void loadFilesWithCache(appState.messageId).catch(err => console.error('[App] Load files failed:', err));
  }

  if (typeof ChatbotSystem !== 'undefined') {
    ChatbotSystem.init();
  }

  console.log('[App] Initialized');
}

// === Load du lieu tu Firebase ===

/**
 * Smart loading: Check RTDB first
 * Data is synced by Gmail Sync (Cloud Run) -> Load truc tiep tu RTDB
 */
async function loadFilesWithCache(messageId) {
  if (!messageId) {
    console.warn('[Cache] No messageId provided');
    return;
  }

  showLoading('Đang kiểm tra dữ liệu...');

  try {
    const cachedFiles = await loadFilesMetadataFromFirebase(messageId);

    if (cachedFiles === 'no_files') {
      appState.messageId = messageId;
      document.getElementById('fileManagerHorizontal').style.display = 'flex';
      initFirebaseSync();
    } else if (cachedFiles && cachedFiles.length > 0) {
      await loadFilesFromCache(messageId, cachedFiles);
    } else {
      alert(`Session "${messageId}" không tồn tại trong hệ thống.\nDữ liệu được tạo tự động từ Gmail sync.`);
    }
  } catch (error) {
    console.error('[Cache] Error loading session:', error);
    alert('Lỗi khi tải session: ' + error.message);
  } finally {
    hideLoading();
  }
}

/**
 * Load files from cached data in Realtime Database
 */
async function loadFilesFromCache(messageId, cachedFiles) {
  showLoading('Đang tải files từ cache...');

  try {
    appState.messageId = messageId;

    appState.files = cachedFiles.map(file => ({
      id: file.id ?? crypto.randomUUID(),
      name: file.name,
      type: file.type ?? 'unknown',
      mimeType: file.mimeType ?? getMimeType(file.name),
      size: file.size ?? 0,
      source: file.source ?? (window.getSourceFromFilename ? window.getSourceFromFilename(file.name) : 'local'),
      downloadUrl: file.url,
      storagePath: file.storage_path ?? file.storagePath,
      tags: file.tags ?? [],
      pageTags: file.pageTags ?? {},
      pageCount: file.pageCount ?? 1,
      numPages: file.pageCount ?? 1,
      needsContentLoad: true,
      isLocal: false,
      lastPage: 1,
      lastScale: null
    }));

    displayFiles(appState.files);
    document.getElementById('fileManagerHorizontal').style.display = 'flex';

    initFirebaseSync();

    await loadDataFromFirebase();

    // Auto-switch combo neu URL co suffix (vd: ?messageId=xxx_1)
    if (appState.comboFromUrl) {
      const select = document.getElementById('comboSelect');
      if (select && [...select.options].some(o => o.value === appState.comboFromUrl)) {
        select.value = appState.comboFromUrl;
        select.dispatchEvent(new Event('change'));
      }
    }

    if (appState.files.length > 0) {
      await loadFile(appState.files[0]);
    }

    // Setup UI cho B1 Form sau khi data duoc load tu RTDB
    setTimeout(() => {
      if (typeof window.SauKhiGetRow === 'function') {
        window.SauKhiGetRow();
      }
    }, 500);

  } catch (error) {
    console.error('[Cache] Error loading from cache:', error);
    alert('Lỗi khi tải từ cache: ' + error.message);
  } finally {
    hideLoading();
  }
}

/**
 * Load files metadata from Firebase Realtime Database
 */
async function loadFilesMetadataFromFirebase(messageId) {
  if (!window.firebaseDb) {
    console.warn('[Firebase] Database not initialized');
    return null;
  }

  try {
    const ref = window.firebaseRef(
      window.firebaseDb,
      `sessions/${messageId}`
    );

    const snapshot = await window.firebaseGet(ref);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.val();

    if (data.files && Array.isArray(data.files)) {
      return data.files;
    }

    if (data.updatedBy) {
      return 'no_files';
    }

    return null;
  } catch (error) {
    console.error('[Firebase] Error loading files metadata:', error);
    return null;
  }
}

// === Firebase Sync Integration ===

let _firebaseSyncInitialized = false;
function initFirebaseSync() {
  if (!window.FirebaseSync || !appState.messageId) {
    return;
  }

  if (_firebaseSyncInitialized) {
    return;
  }
  _firebaseSyncInitialized = true;

  FirebaseSync.init(appState.messageId);
  FirebaseSync.listenAll();

  FirebaseSync.listenPresence((users) => {
    updateOnlineUsersDisplay(users);
  });
}

/**
 * Migrate old overlay data to add fileId field
 */
function migrateOverlayFileIds(overlays, type) {
  if (!overlays || typeof overlays !== 'object') return;

  let migratedCount = 0;
  let notFoundCount = 0;

  Object.keys(overlays).forEach(key => {
    const overlayArray = overlays[key];
    if (!Array.isArray(overlayArray)) return;

    overlayArray.forEach(overlay => {
      if (overlay.fileId) return;

      if (overlay.fileName && appState.files && appState.files.length > 0) {
        const file = appState.files.find(f => f.name === overlay.fileName);
        if (file) {
          overlay.fileId = file.id;
          migratedCount++;
        } else {
          notFoundCount++;
          console.warn(`[Migration] Cannot find file for ${type} overlay ${overlay.id}: ${overlay.fileName}`);
          overlay.fileId = '';
        }
      } else {
        overlay.fileId = '';
      }
    });
  });

  if (migratedCount > 0) {
    console.log(`[Migration] ${migratedCount} ${type} overlays migrated — bam Ctrl+S de luu`);
  }
  if (notFoundCount > 0) {
    console.warn(`[Migration] ${notFoundCount} ${type} overlays could not find matching file`);
  }
}

/**
 * Load existing data from Firebase on startup
 */
async function loadDataFromFirebase() {
  if (!window.FirebaseSync || !appState.messageId) return;

  try {
    const data = await FirebaseSync.loadAllData();
    if (!data) return;

    if (data.selections) {
      if (Array.isArray(data.selections)) {
        window.selections = data.selections;
      } else if (typeof data.selections === 'object') {
        window.selections = Object.values(data.selections).filter(Boolean);
      }
    }

    if (data.imageOverlays && typeof data.imageOverlays === 'object') {
      window.imageOverlays = data.imageOverlays;
      migrateOverlayFileIds(window.imageOverlays, 'image');
    }

    if (data.textOverlays && typeof data.textOverlays === 'object') {
      window.textOverlays = data.textOverlays;
      migrateOverlayFileIds(window.textOverlays, 'text');
    }

    if (data.rotations && typeof data.rotations === 'object') {
      window.pageRotations = data.rotations;
    }

    const fileTags = await FirebaseSync.loadFileTags();
    if (fileTags && typeof fileTags === 'object') {
      if (typeof window.applyRemoteFileTags === 'function') {
        window.applyRemoteFileTags(fileTags);
      }
    }

    const pageTags = await FirebaseSync.loadPageTags();
    if (pageTags && typeof pageTags === 'object') {
      if (typeof window.applyRemotePageTags === 'function') {
        window.applyRemotePageTags(pageTags);
      }
    }

    if (typeof renderSelectionsForCurrentPage === 'function') {
      renderSelectionsForCurrentPage();
    }
    if (typeof renderOverlaysForCurrentPage === 'function') {
      renderOverlaysForCurrentPage();
    }
    updateSelectionCount();

  } catch (error) {
    console.error('[App] Error loading Firebase data:', error);
  }
}

// === Presence ===

/**
 * Cap nhat danh sach nguoi dung dang online vao presenceBtn dropdown
 */
function updateOnlineUsersDisplay(users) {
  const badge = document.getElementById('presenceBadge');
  const dropdown = document.getElementById('presenceDropdown');
  if (!dropdown) return;

  if (users.length === 0) {
    if (badge) badge.style.display = 'none';
    dropdown.innerHTML = '<div class="presence-header">Online (0)</div><div class="presence-empty">Không có ai online</div>';
    return;
  }

  if (badge) {
    const showBadge = users.length >= 2;
    badge.style.display = showBadge ? 'flex' : 'none';
    if (showBadge) badge.textContent = users.length;
  }

  const usersHTML = users.map(u => `<div class="presence-user">● ${escapeHTML(u.name)}</div>`).join('');
  dropdown.innerHTML = `<div class="presence-header">Online (${users.length})</div>${usersHTML}`;
}

// === Cleanup on page unload ===

window.addEventListener('beforeunload', (e) => {
  // Uu tien message tu cao xuong thap — chi 1 message duoc set
  const checks = [
    {
      test: () => typeof window.hasPendingSelections === 'function' && window.hasPendingSelections(),
      msg: 'Có vùng chọn chưa được lưu. Bạn có chắc muốn rời trang?'
    },
    {
      test: () => Object.values(window.imageOverlays || {}).some(arr => arr.some(o => o._pending)),
      msg: 'Có overlay chưa được lưu. Bạn có chắc muốn rời trang?'
    },
    {
      test: () => appState.files.some(f => f.isLocal && !f.downloadUrl)
        || window.pendingFileDeletes?.length > 0
        || window.pendingEmailAttachmentDeletes?.length > 0,
      msg: 'Có file chưa được lưu lên Cloud. Bạn có chắc muốn rời trang?'
    },
  ];
  const hit = checks.find(c => c.test());
  if (hit) {
    e.preventDefault();
    e.returnValue = hit.msg;
  }

  if (window.FirebaseSync?.sessionId && window.selections?.length > 0) {
    if (typeof syncAllTextareaValues === 'function') {
      syncAllTextareaValues();
    }
  }

  // KHÔNG gọi FirebaseSync.destroy() ở đây — destroy() ngắt listener trước khi
  // RTDB ghi xong → mất data cuối khi user đóng tab. Browser tự cleanup connection
  // khi page unload; presence onDisconnect đã handle.
});

console.log('[AppInit] Module loaded');
