/**
 * Selection AI Module
 * AI/capture: batch capture+upload, progress UI
 */

import { renderSelectionsForCurrentPage } from './selection-core.js';
import { captureFromPDFSource, captureHighResSelectionFallback, captureStandardSelection } from '../capture-functions.js';
import { updatePendingBadge } from './selection-badges.js';

/**
 * Capture selection image and upload to Firebase Storage
 * Shared logic for both single save and batch save
 */
async function captureAndUploadSelection(selection) {
  let base64Data = null;
  try {
    base64Data = await captureFromPDFSource(selection);
  } catch (error) {
    console.warn('[Selection] Direct source capture failed, using fallback:', error);
    try {
        base64Data = captureHighResSelectionFallback(selection);
    } catch (fallbackError) {
      console.warn('[Selection] Fallback capture also failed:', fallbackError);
    }
  }

  if (base64Data && window.FirebaseSync?.sessionId) {
    try {
      const storageUrl = await window.FirebaseSync.uploadSelectionToStorage(selection.id, base64Data);
      return storageUrl;
    } catch (uploadError) {
      console.warn('[Selection] Storage upload failed, using base64 fallback:', uploadError);
      return base64Data;
    }
  } else if (base64Data) {
    return base64Data;
  }
  return null;
}

/**
 * Capture and upload all pending selections in parallel
 * Called when user exits select mode or clicks save button
 */
export async function captureAndUploadPendingSelections() {
  const pendingIds = [...window.pendingSelections];
  if (pendingIds.length === 0) return 0;

  if (window.isBatchSaving) {
    console.warn('[Selection] Batch save already in progress');
    return 0;
  }

  window.isBatchSaving = true;
  updateBatchProgress(0, pendingIds.length);

  const tasks = pendingIds.map(async (selectionId, index) => {
    const selection = window.selections.find(s => s.id === selectionId);
    if (!selection) return;

    selection.url = await captureAndUploadSelection(selection);
    updateBatchProgress(index + 1, pendingIds.length);
  });

  const results = await Promise.allSettled(tasks);
  const successCount = results.filter(r => r.status === "fulfilled").length;

  window.pendingSelections = [];
  window.isBatchSaving = false;

  // Update UI: remove pending indicators
  document.querySelectorAll('.batch-pending-dot').forEach(el => el.remove());
  document.querySelectorAll('.selection-item img, .selection-item .selection-preview').forEach(el => {
    el.style.opacity = '';
  });

  // Re-render sidebar to show updated previews with URLs
  renderSelectionsForCurrentPage();

  updatePendingBadge();
  hideBatchProgress();

  return successCount;
}

/**
 * Check if there are pending selections that need saving
 */
export function hasPendingSelections() {
  return window.pendingSelections.length > 0;
}

// ============================================
// BATCH PROGRESS UI
// ============================================

function updateBatchProgress(current, total) {
  let progressEl = document.getElementById('batchSaveProgress');
  if (!progressEl) {
    progressEl = document.createElement('div');
    progressEl.id = 'batchSaveProgress';
    progressEl.className = 'batch-save-progress';
    const toolbar = document.querySelector('.app-toolbar');
    if (toolbar) {
      toolbar.parentNode.insertBefore(progressEl, toolbar.nextSibling);
    } else {
      document.body.appendChild(progressEl);
    }
  }

  const pct = Math.round((current / total) * 100);
  progressEl.innerHTML = `
    <div class="batch-progress-bar">
      <div class="batch-progress-fill" style="width: ${pct}%"></div>
    </div>
    <span class="batch-progress-text">Đang lưu ${current}/${total} vùng chọn...</span>
  `;
  progressEl.style.display = 'flex';
}

function hideBatchProgress() {
  const progressEl = document.getElementById('batchSaveProgress');
  if (progressEl) {
    progressEl.style.display = 'none';
  }
}
