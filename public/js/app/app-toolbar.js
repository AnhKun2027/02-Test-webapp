/**
 * App Toolbar - Su kien UI cho toolbar, zoom, tag filters
 * Tach tu index.js — chua toan bo event handlers cho cac nut tren toolbar
 */

import { appState, changePage } from './app-core.js';
import { saveAndSyncAll, toggleSidebar, toggleB1Form } from './app-save.js';
import { TAG_CONSTANTS } from '../tag-system/tag-constants.js';

const { RESERVED } = TAG_CONSTANTS;

let _toolbarAbortController = null;

/** Helper: Hamburger button toggle (click-outside close gộp ở _setupOutsideClickClose) */
function _setupHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const hamburgerDropdown = document.getElementById('hamburgerDropdown');
  if (!hamburgerBtn || !hamburgerDropdown) return;

  hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = hamburgerBtn.getBoundingClientRect();
    hamburgerDropdown.style.top = (rect.bottom + 4) + 'px';
    hamburgerDropdown.style.left = rect.left + 'px';
    hamburgerDropdown.classList.toggle('open');
  });
}

/** Helper: 1 listener document.click — close mọi dropdown khi click ngoài */
function _setupOutsideClickClose(signal) {
  document.addEventListener('click', (e) => {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const hamburgerDropdown = document.getElementById('hamburgerDropdown');
    if (hamburgerDropdown && !hamburgerDropdown.contains(e.target) && e.target !== hamburgerBtn) {
      hamburgerDropdown.classList.remove('open');
    }
    // Presence button đã stopPropagation → click vào button KHÔNG fire handler này
    document.getElementById('presenceDropdown')?.classList.remove('show');
  }, { signal });
}

/** Helper: File upload + overlay buttons */
function _setupFileButtons() {
  document.getElementById('uploadLocalBtnBottom')?.addEventListener('click', () => {
    document.getElementById('localFileInput')?.click();
  });
  document.getElementById('localFileInput')?.addEventListener('change', (e) => {
    processMultipleFiles(e.target.files);
  });
  document.getElementById('stagingFilesBtn')?.addEventListener('click', () => {
    document.getElementById('overlayFileInput')?.click();
  });
  document.getElementById('overlayFileInput')?.addEventListener('change', (e) => {
    if (typeof handleOverlayFiles === 'function') handleOverlayFiles(e.target.files);
    e.target.value = '';
  });
  document.getElementById('stagingTextBtn')?.addEventListener('click', () => {
    if (typeof addEmptyTextOverlay === 'function') addEmptyTextOverlay();
  });
}

/** Helper: Check Finish button + file input */
function _setupCheckFinish() {
  document.getElementById('checkFinishBtn')?.addEventListener('click', () => {
    let changed = false;
    Object.values(RESERVED).forEach(name => {
      if (window.tagFilterCombos && !window.tagFilterCombos.includes(name)) {
        window.tagFilterCombos.push(name);
        changed = true;
      }
    });
    if (changed && typeof window._commitCombos === 'function') {
      window._commitCombos(window.tagFilterCombos);
    }
    document.getElementById('checkFinishFileInput')?.click();
    document.getElementById('hamburgerDropdown')?.classList.remove('open');
  });
  document.getElementById('checkFinishFileInput')?.addEventListener('change', handleCheckFinishFiles);
}

/** Helper: Keyboard shortcuts (Ctrl+S, Escape) + action buttons */
function _setupKeyboardAndActions(signal) {
  document.getElementById('selectAreaBtn')?.addEventListener('click', toggleSelectMode);
  document.querySelectorAll('.staging-files-btn').forEach(btn => {
    if (btn.id === 'selectAreaBtn' || btn.id === 'saveAndSyncAllBtn') return;
    btn.addEventListener('click', () => exitSelectMode());
  });
  document.getElementById('rotatePageBtn')?.addEventListener('click', rotatePage);
  document.getElementById('saveAndSyncAllBtn')?.addEventListener('click', saveAndSyncAll);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      void saveAndSyncAll().catch(err => console.error('[App] Save failed:', err));
    }
    if (e.key === 'Escape') {
      exitSelectMode();
    }
  }, { signal });

  document.getElementById('combinedAiBtn')?.addEventListener('click', processWithAI);
  document.getElementById('prevPageBtn')?.addEventListener('click', () => changePage(-1));
  document.getElementById('nextPageBtn')?.addEventListener('click', () => changePage(1));
}

/** Helper: Toggle visibility + sidebar + presence dropdown (click-outside close gộp ở _setupOutsideClickClose) */
function _setupViewToggles() {
  document.getElementById('showAllBtn')?.addEventListener('click', async () => {
    if (typeof window.hasPendingSelections === 'function' && window.hasPendingSelections()) {
      if (typeof window.captureAndUploadPendingSelections === 'function') {
        await window.captureAndUploadPendingSelections();
      }
    }
    showAllSelections();
  });
  document.getElementById('toggleSidebarBtn')?.addEventListener('click', toggleSidebar);
  document.getElementById('toggleB1FormBtn')?.addEventListener('click', toggleB1Form);

  const presenceBtn = document.getElementById('presenceBtn');
  if (presenceBtn) {
    presenceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('presenceDropdown')?.classList.toggle('show');
    });
  }
}

/**
 * Initialize toolbar button handlers
 */
export function initToolbarButtons() {
  _toolbarAbortController = new AbortController();
  const signal = _toolbarAbortController.signal;

  _setupHamburgerMenu();
  _setupFileButtons();
  _setupCheckFinish();
  _setupKeyboardAndActions(signal);
  _setupViewToggles();
  _setupOutsideClickClose(signal);
}

/** Cleanup document-level listeners */
export function destroyToolbar() {
  if (_toolbarAbortController) {
    _toolbarAbortController.abort();
    _toolbarAbortController = null;
  }
}

/**
 * Initialize zoom controls
 */
export function initZoomControls() {
  const slider = document.getElementById('toolbarRange');
  if (slider) {
    slider.addEventListener('input', async () => {
      const percentage = parseInt(slider.value);
      const newScale = percentage / 100 * APP_CONSTANTS.RENDER_QUALITY.BASE_SCALE;
      await setScale(newScale);
    });
  }

  document.getElementById('fitToPageBtn')?.addEventListener('click', async () => {
    const fitScale = getFitToPageScale();
    await setScale(fitScale);
  });
}

/**
 * Initialize tag filter controls
 */
export function initTagFilters() {
  document.getElementById('comboSelect')?.addEventListener('change', loadComboPreset);
  document.getElementById('toggleTagsBtn')?.addEventListener('click', toggleTagsVisibility);
  loadSavedCombos();
}

// === Select mode, copy, download ===

function toggleSelectMode() {
  if (appState.isSelectMode) return;
  appState.isSelectMode = true;
  document.getElementById('selectAreaBtn')?.classList.add('active');
  document.getElementById('pdfCanvas')?.classList.add('select-mode');
}

export function exitSelectMode() {
  if (!appState.isSelectMode) return;
  appState.isSelectMode = false;
  document.getElementById('selectAreaBtn')?.classList.remove('active');
  document.getElementById('pdfCanvas')?.classList.remove('select-mode');
}

/** Helper: Replace content của file đã tồn tại (giữ UUID, thay data) */
async function _replaceExistingFile(file, existingFile) {
  const category = typeof getFileCategory === 'function' ? getFileCategory(file) : null;

  if (category === 'pdf') {
    const arrayBuffer = await readFileAs(file, 'arrayBuffer');
    existingFile.originalPdfBytes = new Uint8Array(arrayBuffer.slice(0));
    existingFile.size = file.size;
  } else if (category === 'image') {
    const dataURL = await readFileAs(file, 'dataURL');
    existingFile.base64 = dataURL.split(',')[1];
    existingFile.size = file.size;
    existingFile.mimeType = file.type;
  } else if (category === 'text') {
    const textContent = await readFileAs(file, 'text');
    existingFile.textContent = textContent;
    existingFile.size = file.size;
  }

  // Re-upload len Firebase Storage (de file cu cung path)
  if (window.FirebaseSync && window.FirebaseSync.sessionId) {
    try {
      await window.FirebaseSync.uploadFileToStorage(existingFile);
    } catch (uploadErr) {
      console.warn(`[CheckFinish] Storage upload failed (local replace OK):`, uploadErr);
    }
  }

  if (typeof addTagToFile === 'function') {
    addTagToFile(existingFile.id, RESERVED.CHECK);
  }
  displayFiles(appState.files);

  // Reload viewer neu dang xem file nay
  if (appState.currentFile && appState.currentFile.id === existingFile.id) {
    const idx = appState.files.indexOf(existingFile);
    if (idx >= 0) switchToLocalFile(idx);
  }
}

/** Helper: Thêm file mới vào list + gán tag "CHECK" */
async function _addNewCheckFile(file) {
  const beforeCount = appState.files.length;
  if (typeof processMultipleFiles === 'function') {
    await processMultipleFiles([file]);
  }
  const newFiles = appState.files.slice(beforeCount);
  newFiles.forEach(f => {
    if (typeof addTagToFile === 'function') {
      addTagToFile(f.id, RESERVED.CHECK);
    }
  });
}

/**
 * Xu ly file duoc chon tu Check Finish input
 * Neu file trung ten -> replace content (giu UUID)
 * Neu file moi -> them vao list + gan tag "CHECK"
 */
async function handleCheckFinishFiles(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    const existingFile = appState.files.find(f => f.name.toLowerCase() === file.name.toLowerCase());

    if (existingFile) {
      try {
        await _replaceExistingFile(file, existingFile);
      } catch (err) {
        console.error(`[CheckFinish] Replace error:`, err);
        alert(`Lỗi replace file ${file.name}: ${err.message}`);
      }
    } else {
      await _addNewCheckFile(file);
    }
  }
  e.target.value = '';
}

console.log('[AppToolbar] Module loaded');
