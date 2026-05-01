/**
 * Selection Badges - Badge counters and toggle functions for selection UI
 */

import { getSelectionFields, getCurrentFileId } from './selection-actions.js';

// ============================================
// BADGE FUNCTIONS
// ============================================

/**
 * Update selection count display
 */
export function updateSelectionCount() {
  const selectionCount = document.getElementById('selectionCount');
  if (!selectionCount) return;

  const totalAllFiles = window.selections?.length ?? 0;

  const currentFileId = getCurrentFileId();


  const currentFileTotal = !currentFileId
    ? window.selections.length
    : window.selections.filter(s => s.fileId === currentFileId).length;
  const currentPageCount = !currentFileId
    ? window.selections.filter(s => s.page === appState.currentPage).length
    : window.selections.filter(s => s.fileId === currentFileId && s.page === appState.currentPage).length;

  if (appState.files && appState.files.length > 1) {
    selectionCount.textContent = `Trang ${appState.currentPage}: ${currentPageCount} vùng | File hiện tại: ${currentFileTotal} vùng | Tất cả files: ${totalAllFiles} vùng`;
  } else {
    selectionCount.textContent = `Trang ${appState.currentPage}: ${currentPageCount} vùng | Tổng: ${currentFileTotal} vùng`;
  }
}

/**
 * Update the pending selections badge on selectAreaBtn
 */
export function updatePendingBadge() {
  const btn = document.getElementById('selectAreaBtn');
  if (!btn) return;

  const existing = btn.querySelector('.pending-badge');
  if (existing) existing.remove();

  const count = window.pendingSelections.length;
  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'pending-badge';
    badge.textContent = count;
    btn.appendChild(badge);
  }
}

/**
 * Update badge counting selections waiting for AI processing on combinedAiBtn
 */
export function updateAiBadge() {
  const btn = document.getElementById('combinedAiBtn');
  if (!btn) return;

  const existing = btn.querySelector('.ai-pending-badge');
  if (existing) existing.remove();

  const count = (window.selections || []).filter(s => {
    const hasNote = !!(s.note && s.note.trim());
    if (hasNote) return false;
    const fields = getSelectionFields(s);
    return !fields.corrected_text && !fields.translation;
  }).length;

  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'ai-pending-badge';
    badge.textContent = count;
    btn.appendChild(badge);
  }
}

// ============================================
// TOGGLE FUNCTIONS
// ============================================

export function toggleVnOverlay() {
  window.isVnOverlayVisible = !window.isVnOverlayVisible;
  const btn = document.getElementById('toggleVnOverlayBtn');
  if (btn) {
    btn.classList.toggle('active', window.isVnOverlayVisible);
  }
  document.querySelectorAll('.vn-overlay-text').forEach(el => {
    el.style.display = window.isVnOverlayVisible ? 'flex' : 'none';
  });
}

export function toggleSelBoxes() {
  window.isSelBoxesVisible = !window.isSelBoxesVisible;
  const btn = document.getElementById('toggleSelBoxesBtn');
  if (btn) {
    btn.classList.toggle('active', !window.isSelBoxesVisible);
  }
  const display = window.isSelBoxesVisible ? '' : 'none';
  document.querySelectorAll('.selection-box, .image-overlay-item, .text-overlay-item').forEach(el => {
    el.style.display = display;
  });
}
