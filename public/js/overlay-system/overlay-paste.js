/** Overlay System - Paste handler with context-aware behavior */

import { addImageOverlayFromClipboard } from './image-overlay.js';
import { addTextOverlayFromClipboard } from './text-overlay.js';
import { getOverlaySignal } from './overlay-shared.js';

// ============================================
// PASTE STATE
// ============================================

let _isShiftPaste = false;

export function setIsShiftPaste(value) {
  _isShiftPaste = value;
}

// Track mouse position for paste context
let lastMouseTarget = null;

// ============================================
// PASTE HANDLER
// ============================================

/**
 * Initialize paste handler with context-aware behavior
 */
export function initPasteHandler() {
  const signal = getOverlaySignal();

  document.addEventListener('mousemove', (e) => {
    lastMouseTarget = e.target;
  }, { signal });

  document.addEventListener('paste', async (e) => {
    const activeElement = document.activeElement;
    const tagName = activeElement?.tagName?.toLowerCase();

    if (activeElement?.contentEditable === 'true') {
      return;
    }

    if (tagName === 'input' || tagName === 'textarea') {
      return;
    }

    const isHoverOnViewer = lastMouseTarget?.closest('.pdf-area') || lastMouseTarget?.closest('#pdfWrapper');

    const items = e.clipboardData?.items;
    let foundFile = false;

    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          foundFile = true;

          const blob = items[i].getAsFile();
          if (blob) {
            if (isHoverOnViewer && window.appState.currentFile) {
              await addImageOverlayFromClipboard(blob);
            } else {
              if (typeof window.addImageFromClipboard === 'function') {
                await window.addImageFromClipboard(blob, items[i].type);
              }
            }
          }
          break;
        }

        // File không phải image → thêm vào danh sách file
        if (items[i].kind === 'file' && !items[i].type.startsWith('image/')) {
          e.preventDefault();
          foundFile = true;
          const file = items[i].getAsFile();
          if (file && typeof window.addLocalFile === 'function') {
            await window.addLocalFile(file);
          }
          break;
        }
      }
    }

    if (!foundFile) {
      const text = e.clipboardData?.getData('text/plain');
      if (text && text.trim() && window.appState.currentFile) {
        if (_isShiftPaste || isHoverOnViewer) {
          e.preventDefault();
          await addTextOverlayFromClipboard(text);
          _isShiftPaste = false;
        }
      }
    }
  }, { signal });

}
