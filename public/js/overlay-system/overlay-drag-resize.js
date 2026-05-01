/** Overlay System - Global drag and resize handlers */

// ============================================
// GLOBAL DRAG & RESIZE STATE (Fix Memory Leak)
// ============================================

/**
 * Global state for dragging overlays
 * Using single global listeners instead of creating new listeners for each overlay
 * This prevents memory leaks from accumulating event listeners
 */
export const globalDragState = {
  isDragging: false,
  element: null,
  overlayData: null,
  startX: 0,
  startY: 0,
  startLeft: 0,
  startTop: 0,
  isText: false
};

/**
 * Global state for resizing overlays
 */
export const globalResizeState = {
  isResizing: false,
  element: null,
  overlayData: null,
  startX: 0,
  startY: 0,
  startWidth: 0,
  startHeight: 0,
  isText: false
};

/**
 * Initialize global drag/resize listeners ONCE when module loads
 */
let _listenersInitialized = false;
export function initGlobalOverlayListeners() {
  if (_listenersInitialized) return;
  _listenersInitialized = true;

  // Global mousemove for dragging
  document.addEventListener('mousemove', (e) => {
    if (!globalDragState.isDragging || !globalDragState.element) return;

    const dx = e.clientX - globalDragState.startX;
    const dy = e.clientY - globalDragState.startY;

    const newLeft = globalDragState.startLeft + dx;
    const newTop = globalDragState.startTop + dy;

    globalDragState.element.style.left = `${newLeft}px`;
    globalDragState.element.style.top = `${newTop}px`;

    // Update overlay data - convert back to original scale coordinates
    const scaleRatio = window.appState.scale / (globalDragState.overlayData.scale || window.appState.scale);
    globalDragState.overlayData.x = newLeft / scaleRatio;
    globalDragState.overlayData.y = newTop / scaleRatio;
  });

  // Global mouseup for dragging
  document.addEventListener('mouseup', () => {
    if (globalDragState.isDragging) {
      globalDragState.element.style.cursor = 'move';
      globalDragState.isDragging = false;
      globalDragState.element = null;
      globalDragState.overlayData = null;
      globalDragState.isText = false;
    }
  });

  // Global mousemove for resizing
  document.addEventListener('mousemove', (e) => {
    if (!globalResizeState.isResizing || !globalResizeState.element) return;

    const dx = e.clientX - globalResizeState.startX;

    if (globalResizeState.isText) {
      // Text overlay: resize width only
      const newWidth = Math.max(80, globalResizeState.startWidth + dx);
      globalResizeState.element.style.width = `${newWidth}px`;

      const scaleRatio = window.appState.scale / (globalResizeState.overlayData.scale || window.appState.scale);
      globalResizeState.overlayData.width = newWidth / scaleRatio;
    } else {
      // Image overlay: maintain aspect ratio
      const aspectRatio = globalResizeState.overlayData.originalWidth / globalResizeState.overlayData.originalHeight;
      const newWidth = Math.max(50, globalResizeState.startWidth + dx);
      const newHeight = newWidth / aspectRatio;

      globalResizeState.element.style.width = `${newWidth}px`;
      globalResizeState.element.style.height = `${newHeight}px`;

      const scaleRatio = window.appState.scale / (globalResizeState.overlayData.scale || window.appState.scale);
      globalResizeState.overlayData.width = newWidth / scaleRatio;
      globalResizeState.overlayData.height = newHeight / scaleRatio;
    }
  });

  // Global mouseup for resizing
  document.addEventListener('mouseup', () => {
    if (globalResizeState.isResizing) {
      globalResizeState.isResizing = false;
      globalResizeState.element = null;
      globalResizeState.overlayData = null;
      globalResizeState.isText = false;
    }
  });

  console.log('[Overlay] Global drag/resize listeners initialized');
}

// Initialize global listeners when module loads
initGlobalOverlayListeners();

/**
 * Gộp chung: làm overlay draggable (image hoặc text)
 */
export function makeOverlayDraggable(element, overlayData, isText, textContent) {
  const type = isText ? 'text' : 'image';
  element.addEventListener('mousedown', (e) => {
    if (e.target.closest(`.${type}-overlay-resize`) || e.target.closest(`.${type}-overlay-controls`)) {
      return;
    }

    // Text overlay: skip khi đang editing
    if (isText && textContent) {
      if (e.target === textContent && element.classList.contains('editing')) return;
      if (document.activeElement === textContent) return;
    }

    globalDragState.isDragging = true;
    globalDragState.element = element;
    globalDragState.overlayData = overlayData;
    globalDragState.startX = e.clientX;
    globalDragState.startY = e.clientY;
    globalDragState.startLeft = element.offsetLeft;
    globalDragState.startTop = element.offsetTop;
    globalDragState.isText = isText;

    element.style.cursor = 'grabbing';
    e.preventDefault();
  });
}

/**
 * Gộp chung: làm overlay resizable (image hoặc text)
 */
export function makeOverlayResizable(element, handle, overlayData, isText) {
  handle.addEventListener('mousedown', (e) => {
    globalResizeState.isResizing = true;
    globalResizeState.element = element;
    globalResizeState.overlayData = overlayData;
    globalResizeState.startX = e.clientX;
    globalResizeState.startWidth = element.offsetWidth;
    globalResizeState.isText = isText;

    if (!isText) {
      globalResizeState.startY = e.clientY;
      globalResizeState.startHeight = element.offsetHeight;
    }

    e.preventDefault();
    e.stopPropagation();
  });
}
