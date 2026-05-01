/** Overlay System - Keyboard shortcuts (DELETE, Ctrl+C/V, Escape) */

import { generateUUID } from '../core-utils.js';
import { updateRotateButtonState } from '../page-utils.js';
import { copiedOverlay, setCopiedOverlay, getOverlayKey, OVERLAY_CONSTANTS } from './overlay-shared.js';
import { copyOverlayToClipboard } from './overlay-context-menu.js';
import { setIsShiftPaste } from './overlay-paste.js';
import { renderImageOverlay, removeImageOverlay } from './image-overlay.js';
import { renderTextOverlay, removeTextOverlay } from './text-overlay.js';
import { getOverlaySignal } from './overlay-shared.js';

// ============================================
// KEYBOARD SHORTCUTS FOR OVERLAYS
// ============================================

/** Helper: xử lý phím Delete/Backspace — xóa overlay đang selected */
function _handleDelete(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
    return;
  }

  const selectedImage = document.querySelector('.image-overlay-item.selected');
  if (selectedImage) {
    const overlayId = selectedImage.id.replace('overlay-', '');
    removeImageOverlay(overlayId);
    e.preventDefault();
    return;
  }

  const selectedText = document.querySelector('.text-overlay-item.selected');
  if (selectedText) {
    const overlayId = selectedText.id.replace('text-overlay-', '');
    removeTextOverlay(overlayId);
    e.preventDefault();
  }
}

/** Helper: xử lý Ctrl+C — copy overlay đang selected vào clipboard */
function _handleCopy() {
  const selectedImage = document.querySelector('.image-overlay-item.selected');
  if (selectedImage) {
    const overlayId = selectedImage.id.replace('overlay-', '');
    const key = getOverlayKey();
    const overlayData = window.imageOverlays[key]?.find(o => o.id === overlayId);
    if (overlayData) {
      setCopiedOverlay({ type: 'image', data: { ...overlayData } });
      void copyOverlayToClipboard(overlayData, 'image').catch(err => console.error('[Overlay] Copy failed:', err));
    }
    return true;
  }

  const selectedText = document.querySelector('.text-overlay-item.selected');
  if (selectedText) {
    const overlayId = selectedText.id.replace('text-overlay-', '');
    const key = getOverlayKey();
    const overlayData = window.textOverlays[key]?.find(o => o.id === overlayId);
    if (overlayData) {
      setCopiedOverlay({ type: 'text', data: { ...overlayData } });
      void copyOverlayToClipboard(overlayData, 'text').catch(err => console.error('[Overlay] Copy failed:', err));
    }
    return true;
  }
  return false;
}

/** Helper: xử lý Ctrl+V — paste overlay đã copy sang vị trí mới */
function _handlePaste(e) {
  if (!copiedOverlay || !window.appState.currentFile) return;
  e.preventDefault();

  if (copiedOverlay.type === 'image') {
    const newData = {
      ...copiedOverlay.data,
      id: generateUUID(),
      fileId: window.appState.currentFile.id,
      x: copiedOverlay.data.x + OVERLAY_CONSTANTS.PASTE_OFFSET,
      y: copiedOverlay.data.y + OVERLAY_CONSTANTS.PASTE_OFFSET,
      scale: window.appState.scale,
      page: window.appState.currentPage,
      _pending: true
    };

    const key = getOverlayKey();
    if (!window.imageOverlays[key]) window.imageOverlays[key] = [];
    window.imageOverlays[key].push(newData);
    renderImageOverlay(newData);

  } else if (copiedOverlay.type === 'text') {
    const newData = {
      ...copiedOverlay.data,
      id: generateUUID(),
      fileId: window.appState.currentFile.id,
      x: copiedOverlay.data.x + OVERLAY_CONSTANTS.PASTE_OFFSET,
      y: copiedOverlay.data.y + OVERLAY_CONSTANTS.PASTE_OFFSET,
      scale: window.appState.scale,
      page: window.appState.currentPage
    };

    const key = getOverlayKey();
    if (!window.textOverlays[key]) window.textOverlays[key] = [];
    window.textOverlays[key].push(newData);
    renderTextOverlay(newData);
  }
  updateRotateButtonState();
}

/**
 * Initialize overlay keyboard handlers (DELETE, Ctrl+C, Ctrl+V, Ctrl+Shift+V, Escape)
 */
export function initOverlayKeyboardHandler() {
  const signal = getOverlaySignal();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      _handleDelete(e);
      return;
    }

    // Guard: không intercept Ctrl+C/V khi user đang gõ trong input/textarea/contentEditable
    const isEditing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true';

    if (e.ctrlKey && e.key === 'c') {
      if (!isEditing && _handleCopy()) return;
    }

    if (e.key === 'Escape') {
      if (copiedOverlay) {
        setCopiedOverlay(null);
        console.log('[Overlay] Đã xóa overlay đã copy (Escape)');
      }
    }

    if (e.ctrlKey && e.shiftKey && e.key === 'v') {
      if (!isEditing) setIsShiftPaste(true);
      return;
    }

    if (e.ctrlKey && !e.shiftKey && e.key === 'v') {
      if (!isEditing) _handlePaste(e);
    }
  }, { signal });
}
