/** Overlay System - Shared state and helper functions */

// ============================================
// SHARED STATE
// ============================================

// Store overlay images per page - use window scope for realtime sync compatibility
if (!window.imageOverlays) {
  window.imageOverlays = {}; // { "fileId_pageNum": [overlayData, ...] } - Uses UUID for key
}

// Store text overlays per page - use window scope for realtime sync compatibility
if (!window.textOverlays) {
  window.textOverlays = {}; // { "fileId_pageNum": [overlayData, ...] } - Uses UUID for key
}

// Store copied overlay for Ctrl+C/Ctrl+V
export let copiedOverlay = null; // { type: 'image'|'text', data: overlayData }

export function setCopiedOverlay(value) {
  copiedOverlay = value;
}

// Biến lưu menu context hiện tại (chỉ 1 menu tồn tại cùng lúc)
export let overlayContextMenu = null;

export function setOverlayContextMenu(value) {
  overlayContextMenu = value;
}

// ============================================
// HELPER: Tự động bật hiển thị overlays khi tạo mới
// ============================================

export function ensureOverlaysVisible() {
  if (!window.isSelBoxesVisible) {
    window.isSelBoxesVisible = true;
    const btn = document.getElementById('toggleSelBoxesBtn');
    if (btn) btn.classList.remove('active');
    document.querySelectorAll('.selection-box, .image-overlay-item, .text-overlay-item').forEach(el => {
      el.style.display = '';
    });
  }
}

// ============================================
// SHARED HELPERS
// ============================================

/**
 * Get overlay key for current file/page
 */
export function getOverlayKey() {
  if (!window.appState.currentFile) return null;
  return `${window.appState.currentFile.id}_${window.appState.currentPage}`;
}

/**
 * Bỏ chọn tất cả overlay và selection box
 */
export function deselectAllOverlays() {
  document.querySelectorAll('.image-overlay-item.selected, .text-overlay-item.selected, .selection-box.selected')
    .forEach(el => el.classList.remove('selected'));
}

// ============================================
// SHARED CONSTANTS
// ============================================

export const OVERLAY_CONSTANTS = Object.freeze({
  MAX_IMAGE_WIDTH: 300,
  PASTE_OFFSET: 20,
  TEXT_DEFAULT_FONT_SIZE: 16,
  TEXT_DEFAULT_COLOR: '#0055cc',
  TEXT_DEFAULT_BG: '#F5F5F5',
  TEXT_DEFAULT_WIDTH: 200,
  TEXT_DEFAULT_HEIGHT: 100,
});

// ============================================
// SHARED ABORT CONTROLLER (init guard + cleanup)
// ============================================

let _overlayAbortController = null;

/** Lấy signal chung cho tất cả overlay document listeners */
export function getOverlaySignal() {
  if (!_overlayAbortController) {
    _overlayAbortController = new AbortController();
  }
  return _overlayAbortController.signal;
}

/** Cleanup tất cả overlay document listeners */
export function destroyOverlaySystem() {
  if (_overlayAbortController) {
    _overlayAbortController.abort();
    _overlayAbortController = null;
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Tính vị trí giữa vùng hiển thị cho overlay mới
 */
export function calcOverlayCenterPosition(overlayWidth = 200, overlayHeight = 100) {
  const pdfArea = document.querySelector('.pdf-area');
  const pdfWrapper = document.getElementById('pdfWrapper');
  let x = 50, y = 50;
  if (pdfArea && pdfWrapper) {
    const areaRect = pdfArea.getBoundingClientRect();
    const wrapperRect = pdfWrapper.getBoundingClientRect();
    x = Math.max(10, (areaRect.width / 2) - (overlayWidth / 2) - (wrapperRect.left - areaRect.left) + pdfArea.scrollLeft);
    y = Math.max(10, (areaRect.height / 2) - (overlayHeight / 2) - (wrapperRect.top - areaRect.top) + pdfArea.scrollTop);
  }
  return { x, y };
}
