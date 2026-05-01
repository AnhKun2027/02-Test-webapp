/**
 * Tag System — Entry point
 *
 * Re-export tất cả hàm từ các file con + gắn window.* bindings (legacy) +
 * init listeners khi DOM ready.
 *
 * Load từ webapp.html qua <script type="module" src="js/tag-system/index.js">.
 */

// ============================================
// IMPORT FROM SUBMODULES
// ============================================

import {
  createComboPill,
  showComboTagDropdown,
  updatePageThumbnailTags
} from './tag-ui.js';

import {
  addTagToFile,
  removeTagFromFile,
  addTagToPage,
  removeTagFromPage
} from './tag-crud.js';

import {
  filterByTags,
  fileMatchesFilter,
  pageMatchesFilter
} from './tag-filter.js';

import {
  loadSavedCombos,
  setCombos,
  _commitCombos,
  applyRemotePresets,
  populateComboSelect,
  addComboPreset,
  loadComboPreset
} from './combo-presets.js';

import {
  toggleTagsVisibility,
  initToolbarAddTagButton
} from './tag-toolbar.js';

import {
  applyRemoteFileTags,
  applyRemotePageTags
} from './tag-sync.js';

// ============================================
// RE-EXPORT (cho file khác có thể import trực tiếp)
// ============================================

export {
  createComboPill,
  showComboTagDropdown,
  updatePageThumbnailTags,
  addTagToFile,
  removeTagFromFile,
  addTagToPage,
  removeTagFromPage,
  filterByTags,
  fileMatchesFilter,
  pageMatchesFilter,
  loadSavedCombos,
  setCombos,
  applyRemotePresets,
  populateComboSelect,
  addComboPreset,
  loadComboPreset,
  toggleTagsVisibility,
  initToolbarAddTagButton,
  applyRemoteFileTags,
  applyRemotePageTags
};

// ============================================
// WINDOW BINDINGS — bare name (file-core.js, pdf-viewer.js, app-toolbar.js dùng trực tiếp)
// ============================================
window.createComboPill        = createComboPill;
window.showComboTagDropdown   = showComboTagDropdown;
window.addTagToFile           = addTagToFile;
window.removeTagFromFile      = removeTagFromFile;
window.addTagToPage           = addTagToPage;
window.removeTagFromPage      = removeTagFromPage;
window.filterByTags           = filterByTags;
window.fileMatchesFilter      = fileMatchesFilter;
window.pageMatchesFilter      = pageMatchesFilter;
window.loadSavedCombos        = loadSavedCombos;
window.setCombos              = setCombos;
window._commitCombos          = _commitCombos;
window.populateComboSelect    = populateComboSelect;
window.addComboPreset         = addComboPreset;
window.loadComboPreset        = loadComboPreset;
window.applyRemotePresets     = applyRemotePresets;
window.toggleTagsVisibility   = toggleTagsVisibility;
window.initToolbarAddTagButton = initToolbarAddTagButton;
window.applyRemoteFileTags    = applyRemoteFileTags;
window.applyRemotePageTags    = applyRemotePageTags;

// ============================================
// DOM READY INITIALIZATION
// ============================================

// Note: comboSelect listener + loadSavedCombos() đã được gọi từ initTagFilters()
// trong app.js
function _initTagSystem() {
  initToolbarAddTagButton();

  // Auto-generate combos when rowCountInput changes
  const rowCountInput = document.getElementById('rowCountInput');
  if (rowCountInput) {
    rowCountInput.addEventListener('change', () => {
      addComboPreset();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initTagSystem);
} else {
  _initTagSystem();
}

console.log('[TagSystem] Initialized');
