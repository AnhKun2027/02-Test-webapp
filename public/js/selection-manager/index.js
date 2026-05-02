/**
 * Selection Manager - Entry Point
 * Re-exports all functions + keeps ALL window.* assignments
 */

// Store all selections
window.selections = window.selections || [];

// Global active selection tracking (for preserving state across re-renders)
window.activeSelectionId = null;

// Batch mode: queue selections, capture+upload all at once when exiting select mode
window.pendingSelections = [];
window.isBatchSaving = false;

// Toggle defaults
window.isVnOverlayVisible = false;
window.isSelBoxesVisible = true;

// === Re-export from selection-core.js ===
export {
  initSelectionManager,
  createSelectionBoxElement,
  renderSelectionsForCurrentPage,
} from './selection-core.js';

// === Re-export from selection-actions.js ===
export {
  getSelectionFields,
  queueSelection,
  deleteSelection,
  clearActiveSelections,
  showOnlySelection,
  showAllSelections,
  getCurrentFileId,
} from './selection-actions.js';

// === Re-export from selection-sidebar.js ===
export {
  createSelectionSidebarElement,
} from './selection-sidebar.js';

// === Re-export from selection-clipboard.js ===
export {
  getSelectionImageData,
  getSelectionBlob,
  copySelection,
  downloadSelection,
} from './selection-clipboard.js';

// === Re-export from selection-badges.js ===
export {
  updateSelectionCount,
  updatePendingBadge,
  updateAiBadge,
  toggleVnOverlay,
  toggleSelBoxes,
} from './selection-badges.js';

// === Re-export from selection-search.js ===
export {
  applySelectionSearchFilter,
  initSelectionSearch,
} from './selection-search.js';

// === Re-export from selection-ai.js ===
export {
  captureAndUploadPendingSelections,
  hasPendingSelections,
} from './selection-ai.js';

// === Import for window.* assignments ===
import { initSelectionManager, renderSelectionsForCurrentPage } from './selection-core.js';
import { deleteSelection, showOnlySelection, showAllSelections } from './selection-actions.js';
import { copySelection, downloadSelection } from './selection-clipboard.js';
import { updateSelectionCount, updatePendingBadge, updateAiBadge, toggleVnOverlay, toggleSelBoxes } from './selection-badges.js';
import { captureAndUploadPendingSelections, hasPendingSelections } from './selection-ai.js';
import { applySelectionSearchFilter, initSelectionSearch } from './selection-search.js';

// === Window assignments (preserve original global API) ===
window.initSelectionManager = initSelectionManager;
window.renderSelectionsForCurrentPage = renderSelectionsForCurrentPage;
window.deleteSelection = deleteSelection;
window.updateSelectionCount = updateSelectionCount;

window.showOnlySelection = showOnlySelection;
window.showAllSelections = showAllSelections;

window.copySelection = copySelection;
window.downloadSelection = downloadSelection;

window.captureAndUploadPendingSelections = captureAndUploadPendingSelections;
window.hasPendingSelections = hasPendingSelections;
window.updatePendingBadge = updatePendingBadge;
window.updateAiBadge = updateAiBadge;

window.toggleVnOverlay = toggleVnOverlay;
window.toggleSelBoxes = toggleSelBoxes;

window.applySelectionSearchFilter = applySelectionSearchFilter;

// Initialize when DOM ready
function _initSelections() {
  initSelectionManager();
  initSelectionSearch();
  const vnBtn = document.getElementById('toggleVnOverlayBtn');
  if (vnBtn) vnBtn.addEventListener('click', toggleVnOverlay);
  const selBtn = document.getElementById('toggleSelBoxesBtn');
  if (selBtn) selBtn.addEventListener('click', toggleSelBoxes);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initSelections);
} else {
  _initSelections();
}
