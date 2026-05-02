/**
 * Firebase Realtime Database Sync Module
 * Re-exports all methods as a single FirebaseSync object
 *
 * Split from firebase-sync.js into:
 * - sync-core.js      — shared state, init, helpers, presence setup
 * - sync-listeners.js — realtime listener callbacks
 * - sync-load.js      — one-time data loading, B1 form switching
 * - sync-save.js      — save/collect methods
 * - sync-storage.js   — Storage upload/delete operations
 */

import {
  state, getUserIdentifier, getUserDisplayName, trackingFields,
  getPath, getPresencePath, getB1FormPath, getEmailLangPath,
  comboCacheKey, debounce, rtdbToGroupedOverlays, selectionsToArray,
  init, setupPresence, goOffline,
  destroy
} from './sync-core.js';

import {
  listenPresence, listenAll
} from './sync-listeners.js';

import {
  migrateSelectionsToObjectFormat, loadSelections,
  applyB1FormData, fillEmailFieldsFromRTDB,
  listenB1Form, switchB1FormCombo, loadB1FormData,
  loadAllData, loadFileTags, loadPageTags, loadEmailAttachments
} from './sync-load.js';

import {
  B1_FORM_FIELDS, EMAIL_LANG_TEXTAREAS, EMPLOYEE_PROJECTS_FIELDS,
  collectB1FormData, collectEmailLangFromDOM, collectEmailAttachments,
  collectFileTags, collectPageTags, flattenOverlays, selectionsToObject,
  updateEmployeeProjects, saveSessionSnapshot
} from './sync-save.js';

import {
  uploadFileToStorage, uploadSelectionToStorage, deleteSelectionFromStorage,
  uploadImageOverlayToStorage, deleteImageOverlayFromStorage,
  uploadEmailAttachmentToStorage, deleteFromStorage
} from './sync-storage.js';

export const FirebaseSync = {
  // === Shared state (accessed as FirebaseSync.browserSessionId etc.) ===
  get browserSessionId() { return state.browserSessionId; },
  set browserSessionId(v) { state.browserSessionId = v; },
  get sessionId() { return state.sessionId; },
  set sessionId(v) { state.sessionId = v; },
  get userName() { return state.userName; },
  set userName(v) { state.userName = v; },
  get listeners() { return state.listeners; },
  get debounceTimers() { return state.debounceTimers; },
  get activeCombo() { return state.activeCombo; },
  set activeCombo(v) { state.activeCombo = v; },
  get _b1FormCache() { return state._b1FormCache; },
  get _b1FormUnsubscribe() { return state._b1FormUnsubscribe; },
  get _b1FormCallback() { return state._b1FormCallback; },
  get isB1FormSyncing() { return state.isB1FormSyncing; },

  // === Constants ===
  B1_FORM_FIELDS,
  EMAIL_LANG_TEXTAREAS,
  EMPLOYEE_PROJECTS_FIELDS,
  // === Helpers ===
  getUserIdentifier,
  getUserDisplayName,
  trackingFields,
  getPath,
  getPresencePath,
  getB1FormPath,
  getEmailLangPath,
  comboCacheKey,
  debounce,
  rtdbToGroupedOverlays,
  selectionsToArray,

  // === Init & Presence ===
  init,
  setupPresence,
  goOffline,
  listenPresence,

  // === Selections ===
  migrateSelectionsToObjectFormat,
  loadSelections,

  // === B1 Form ===
  applyB1FormData,
  fillEmailFieldsFromRTDB,
  listenB1Form,
  switchB1FormCombo,
  loadB1FormData,

  // === Listeners ===
  listenAll,

  // === Load ===
  loadAllData,
  loadFileTags,
  loadPageTags,
  loadEmailAttachments,

  // === Save/Collect ===
  collectB1FormData,
  collectEmailLangFromDOM,
  collectEmailAttachments,
  collectFileTags,
  collectPageTags,
  flattenOverlays,
  selectionsToObject,
  updateEmployeeProjects,
  saveSessionSnapshot,

  // === Storage ===
  uploadFileToStorage,
  uploadSelectionToStorage,
  deleteSelectionFromStorage,
  uploadImageOverlayToStorage,
  deleteImageOverlayFromStorage,
  uploadEmailAttachmentToStorage,
  deleteFromStorage,

  // === Cleanup ===
  destroy,
};

// Export globally
window.FirebaseSync = FirebaseSync;

console.log('[FirebaseSync] Module loaded (split version)');
