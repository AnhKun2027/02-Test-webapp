/**
 * Firebase Sync Listeners — realtime listener callbacks for session data
 */

import {
  state, getPresencePath, selectionsToArray, rtdbToGroupedOverlays, unwrapLegacyData
} from './sync-core.js';

import { applyB1FormData, fillEmailFieldsFromRTDB } from './sync-load.js';

// ==================== PRESENCE LISTENER ====================

export function listenPresence(callback) {
  if (!window.firebaseDb || !state.sessionId) return;

  const presenceRef = window.firebaseRef(
    window.firebaseDb,
    getPresencePath()
  );

  const unsubscribe = window.firebaseOnValue(presenceRef, (snapshot) => {
    const data = snapshot.val() ?? {};
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000;

    Object.entries(data).forEach(([id, user]) => {
      const lastSeen = user.lastSeen ?? 0;
      if (now - lastSeen > STALE_THRESHOLD && id !== state.browserSessionId) {
        const staleRef = window.firebaseRef(
          window.firebaseDb,
          getPresencePath(id)
        );
        void window.firebaseRemove(staleRef).catch(err => console.error('[FirebaseSync] Stale presence remove error:', err));
      }
    });

    const users = Object.entries(data)
      .filter(([id, user]) => {
        const lastSeen = user.lastSeen ?? 0;
        const isStale = now - lastSeen > STALE_THRESHOLD;
        return user.online && !isStale;
      })
      .map(([id, user]) => ({
        id,
        ...user
      }));

    callback(users);
  });

  state.listeners.push(unsubscribe);
}

// ==================== LISTEN ALL HELPERS ====================

/** Helper: apply selections từ remote session */
function _applySelections(session) {
  const selectionsRaw = unwrapLegacyData(session.selections);
  if (selectionsRaw && typeof selectionsRaw === 'object') {
    window.selections = selectionsToArray(selectionsRaw);
  } else {
    window.selections = [];
  }
  if (typeof renderSelectionsForCurrentPage === 'function') {
    renderSelectionsForCurrentPage();
  }
  if (typeof updateSelectionCount === 'function') {
    updateSelectionCount();
  }
}

/** Helper: apply image + text overlays từ remote session */
function _applyOverlays(session) {
  const imgRaw = unwrapLegacyData(session.imageOverlays);
  if (imgRaw && typeof imgRaw === 'object') {
    window.imageOverlays = rtdbToGroupedOverlays(imgRaw);
  } else {
    window.imageOverlays = {};
  }

  const txtRaw = unwrapLegacyData(session.textOverlays);
  if (txtRaw && typeof txtRaw === 'object') {
    window.textOverlays = rtdbToGroupedOverlays(txtRaw);
  } else {
    window.textOverlays = {};
  }

  if (typeof renderOverlaysForCurrentPage === 'function') {
    renderOverlaysForCurrentPage();
  }
  if (typeof updateRotateButtonState === 'function') {
    updateRotateButtonState();
  }
}

/** Helper: apply rotations từ remote session */
function _applyRotations(session) {
  const rotRaw = unwrapLegacyData(session.rotations);
  const newRotations = (rotRaw && typeof rotRaw === 'object') ? rotRaw : {};

  const _fileId = window.currentFileId || appState?.currentFile?.id;
  const _page   = appState?.currentPage ?? 1;
  const _rotKey = _fileId ? `${_fileId}_${_page}` : null;
  const prevRot = _rotKey ? (window.pageRotations?.[_rotKey] ?? 0) : 0;
  const newRot  = _rotKey ? (newRotations[_rotKey] ?? 0) : 0;

  const oldRot = window.pageRotations ?? {};
  const oldKeys = Object.keys(oldRot);
  const newKeys = Object.keys(newRotations);
  const hasRotChanged = oldKeys.length !== newKeys.length || newKeys.some(k => oldRot[k] !== newRotations[k]);

  window.pageRotations = newRotations;

  if (newRot !== prevRot && typeof renderPage === 'function') {
    renderPage(false);
  }
  if (hasRotChanged && typeof renderThumbnails === 'function') {
    renderThumbnails();
  }
}

/** Helper: cache all b1Form combos + apply active combo */
function _applyB1FormCombos(session) {
  for (const key of Object.keys(session)) {
    if (key === 'b1Form' || key.startsWith('b1Form_')) {
      const cacheKey = key === 'b1Form' ? '' : key.replace('b1Form', '');
      state._b1FormCache[cacheKey] = session[key];
    }
  }
  const localCombos = window.tagFilterCombos || [];
  for (const cacheKey of Object.keys(state._b1FormCache)) {
    const rtdbKey = cacheKey ? 'b1Form' + cacheKey : 'b1Form';
    if (!session[rtdbKey] && !localCombos.includes(cacheKey)) {
      delete state._b1FormCache[cacheKey];
    }
  }
  const activeRtdbKey = state.activeCombo ? 'b1Form' + state.activeCombo : 'b1Form';
  if (session[activeRtdbKey]) {
    applyB1FormData(session[activeRtdbKey]);
  }
}

/** Helper: apply emailLang + emailAttachments từ remote session */
function _applyEmailData(session) {
  if (session.emailLang) {
    fillEmailFieldsFromRTDB(session.emailLang);
  }

  if (session.emailAttachments && window.emailAttachmentManager) {
    const mgr = window.emailAttachmentManager;
    for (const [tabKey, attObj] of Object.entries(session.emailAttachments)) {
      const remoteAtts = Object.values(attObj)
        .sort((a, b) => (a.uploadedAt ?? 0) - (b.uploadedAt ?? 0));
      mgr.attachmentsByTab[tabKey] = remoteAtts;
      mgr._loadedTabs[tabKey] = true;
    }
    for (const tabKey of Object.keys(mgr.attachmentsByTab)) {
      if (!session.emailAttachments[tabKey]) {
        mgr.attachmentsByTab[tabKey] = [];
      }
    }
    mgr.render();
  }
}

/** Helper: merge remote files + deletions + order */
function _applyFiles(session) {
  const remoteFiles = Array.isArray(session.files) ? session.files : [];
  if (appState.files && appState.files.length > 0) {
    if (typeof mergeRemoteSessionFiles === 'function') {
      mergeRemoteSessionFiles(remoteFiles);
    }
    if (typeof syncFileDeletions === 'function') {
      syncFileDeletions(remoteFiles);
    }
    if (typeof syncFileOrder === 'function') {
      syncFileOrder(remoteFiles);
    }
  }
}

// ==================== LISTEN ALL ====================

export function listenAll() {
  if (!window.firebaseDb || !state.sessionId) return;

  const sessionRef = window.firebaseRef(
    window.firebaseDb,
    `sessions/${state.sessionId}`
  );

  // Tầng 3: skip listener fire đầu tiên (initial data load)
  let isFirstLoad = true;
  // Tầng 2: ngăn auto-save trigger lại khi đang apply remote data
  let isSyncing = false;

  const unsub = window.firebaseOnValue(sessionRef, (snapshot) => {
    if (!snapshot.exists()) return;

    const session = snapshot.val();

    // Tầng 3: skip lần fire đầu — data đã được load qua loadFilesFromCache
    if (isFirstLoad) {
      isFirstLoad = false;
      return;
    }

    // Tầng 2: đang apply remote → skip để tránh loop
    if (isSyncing) return;

    // Tầng 1: skip nếu chính session này vừa save
    if (session.updatedBySession === state.browserSessionId) return;

    if (typeof showSaveStatus === 'function') showSaveStatus('success');

    isSyncing = true;
    try {
      _applySelections(session);
      _applyOverlays(session);
      _applyRotations(session);

      // FILE TAGS + PAGE TAGS + PRESETS
      if (typeof window.applyRemoteFileTags === 'function') {
        window.applyRemoteFileTags(session.fileTags || {});
      }
      if (typeof window.applyRemotePageTags === 'function') {
        window.applyRemotePageTags(session.pageTags || {});
      }
      const presetsRaw = Array.isArray(session.presets) ? session.presets : (session.presets?.data || []);
      if (typeof window.applyRemotePresets === 'function') {
        window.applyRemotePresets(presetsRaw);
      }

      _applyB1FormCombos(session);
      _applyEmailData(session);
      _applyFiles(session);

      console.log('[FirebaseSync] listenAll() — nhan snapshot toan session');
    } finally {
      isSyncing = false;
    }
  });

  state.listeners.push(unsub);
}
