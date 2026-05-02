/**
 * Selection Actions - CRUD operations and filter functions for selections
 */
import { updateRotateButtonState } from '../page-utils.js';

import { createSelectionSidebarElement } from './selection-sidebar.js';
import { updateSelectionCount, updatePendingBadge, updateAiBadge } from './selection-badges.js';

/**
 * Get selection fields (corrected_text, translation, ocr_accuracy)
 * Supports both new schema (separate fields) and old schema (combined string)
 */
export function getSelectionFields(selection) {
  const t = selection.translation ?? '';

  const jpMatch = t.match(/japanese\s*:\s*(.+?)(?:\n\n|$)/s);
  const vnMatch = t.match(/vietnamese\s*:\s*(.+?)(?:\n\n|$)/s);
  const accMatch = t.match(/ocr_accuracy\s*:\s*(.+?)(?:\n\n|$)/s);
  const isOldFormat = !!(jpMatch || vnMatch);

  if (selection.corrected_text !== undefined || selection.ocr_accuracy !== undefined) {
    return {
      corrected_text: selection.corrected_text ?? '',
      translation: isOldFormat ? (vnMatch ? vnMatch[1].trim() : '') : t,
      ocr_accuracy: selection.ocr_accuracy !== undefined ? String(selection.ocr_accuracy)
        : (accMatch ? accMatch[1].trim() : '')
    };
  }

  if (isOldFormat) {
    return {
      corrected_text: jpMatch ? jpMatch[1].trim() : '',
      translation: vnMatch ? vnMatch[1].trim() : '',
      ocr_accuracy: accMatch ? accMatch[1].trim() : ''
    };
  }

  return { corrected_text: '', translation: t, ocr_accuracy: '' };
}

/**
 * Queue a selection for batch processing (no capture/upload yet)
 */
export function queueSelection(selection) {
  selection.note = '';
  selection.url = null;

  window.selections.push(selection);
  window.pendingSelections.push(selection.id);

  const selectionList = document.getElementById('selectionList');
  if (selectionList) {
    const sidebarItem = createSelectionSidebarElement(selection);
    const preview = sidebarItem.querySelector('.selection-preview, img');
    if (preview) {
      preview.style.opacity = '0.4';
    }
    const badge = document.createElement('span');
    badge.className = 'batch-pending-dot';
    badge.title = 'Chưa lưu - đang chờ batch save';
    sidebarItem.style.position = 'relative';
    sidebarItem.appendChild(badge);
    selectionList.appendChild(sidebarItem);
  }

  updateSelectionCount();
  updatePendingBadge();
  updateAiBadge();
  updateRotateButtonState();

  // Double rAF: chờ DOM commit + 1 frame layout xong rồi mới scroll/highlight
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      showOnlySelection(selection.id);
    });
  });
}

/**
 * Delete selection by ID (UUID string)
 */
export async function deleteSelection(id) {
  id = String(id);

  const pendingIdx = window.pendingSelections.indexOf(id);
  const wasPending = pendingIdx > -1;
  if (wasPending) {
    window.pendingSelections.splice(pendingIdx, 1);
    updatePendingBadge();
  }

  const index = window.selections.findIndex(s => s.id === id);
  if (index > -1) {
    window.selections.splice(index, 1);
  }

  document.querySelector(`[data-selection-id="${id}"]`)?.remove();
  document.querySelector(`[data-item-id="${id}"]`)?.remove();

  updateSelectionCount();
  updateAiBadge();

  updateRotateButtonState();

  if (window.FirebaseSync && window.FirebaseSync.sessionId) {
    if (!wasPending) {
      try {
        await window.FirebaseSync.deleteSelectionFromStorage(id);
      } catch (err) {
        console.warn('[Selection] Storage deletion failed:', err);
      }
    }
  }
}

// ============================================
// FILTER FUNCTIONS
// ============================================

export function clearActiveSelections() {
  document.querySelectorAll('.selection-item.active').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.selection-box.active').forEach(el => el.classList.remove('active'));
}

export function showOnlySelection(selectionId) {
  const sidebar = document.querySelector('.sidebar');
  window.activeSelectionId = selectionId;
  if (sidebar) sidebar.classList.add('filter-active');
  clearActiveSelections();

  const selectedItem = document.querySelector(`[data-item-id="${selectionId}"]`);
  const selectedBox = document.querySelector(`[data-selection-id="${selectionId}"]`);
  if (selectedItem) selectedItem.classList.add('active');
  if (selectedBox) selectedBox.classList.add('active');
}

export function showAllSelections() {
  const sidebar = document.querySelector('.sidebar');
  window.activeSelectionId = null;
  if (sidebar) sidebar.classList.remove('filter-active');
  clearActiveSelections();

  if (window.activeTagFilters?.length > 0 && typeof filterByTags === 'function') {
    filterByTags([]);
  }
}

/**
 * Get the current file ID from appState or window fallback
 */
export function getCurrentFileId() {
  return window.appState?.currentFile?.id ?? window.currentFileId ?? null;
}
