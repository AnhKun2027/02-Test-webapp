/**
 * Overlay System - Index Module (barrel file)
 * Re-exports from sub-modules + window.* bindings for backward compatibility
 */

// ============================================
// IMPORTS FROM SUB-MODULES
// ============================================

import {
  ensureOverlaysVisible,
  getOverlayKey,
  deselectAllOverlays,
  calcOverlayCenterPosition,
  getOverlaySignal,
  destroyOverlaySystem
} from './overlay-shared.js';

import {
  globalDragState,
  globalResizeState,
  initGlobalOverlayListeners,
  makeOverlayDraggable,
  makeOverlayResizable
} from './overlay-drag-resize.js';

import { showOverlayContextMenu, await_imports } from './overlay-context-menu.js';

import { initOverlayKeyboardHandler } from './overlay-keyboard.js';

import { initPasteHandler } from './overlay-paste.js';

import { renderOverlaysForCurrentPage, initOverlayDeselectHandler } from './overlay-render.js';

import {
  addImageOverlayFromBlob,
  addImageOverlayFromClipboard,
  uploadPendingImageOverlays,
  handleOverlayFiles,
  renderImageOverlay,
  removeImageOverlay
} from './image-overlay.js';

import {
  addEmptyTextOverlay,
  addTextOverlayFromClipboard,
  renderTextOverlay,
  removeTextOverlay
} from './text-overlay.js';

// ============================================
// WIRE UP LAZY IMPORTS (avoids circular dependency)
// ============================================

await_imports._image = { renderImageOverlay, removeImageOverlay };
await_imports._text = { renderTextOverlay, removeTextOverlay };

// ============================================
// RE-EXPORT EVERYTHING
// ============================================

export {
  // overlay-shared
  ensureOverlaysVisible,
  getOverlayKey,
  deselectAllOverlays,
  calcOverlayCenterPosition,
  getOverlaySignal,
  destroyOverlaySystem,
  // overlay-drag-resize
  globalDragState,
  globalResizeState,
  initGlobalOverlayListeners,
  makeOverlayDraggable,
  makeOverlayResizable,
  // overlay-context-menu
  showOverlayContextMenu,
  // overlay-keyboard
  initOverlayKeyboardHandler,
  // overlay-paste
  initPasteHandler,
  // overlay-render
  renderOverlaysForCurrentPage,
  initOverlayDeselectHandler,
  // image-overlay
  addImageOverlayFromBlob,
  addImageOverlayFromClipboard,
  uploadPendingImageOverlays,
  handleOverlayFiles,
  renderImageOverlay,
  removeImageOverlay,
  // text-overlay
  addEmptyTextOverlay,
  addTextOverlayFromClipboard,
  renderTextOverlay,
  removeTextOverlay
};

// ============================================
// EXPORT TO GLOBAL SCOPE (backward compat)
// ============================================

window.getOverlayKey = getOverlayKey;
window.deselectAllOverlays = deselectAllOverlays;

// Image overlay
window.addImageOverlayFromClipboard = addImageOverlayFromClipboard;
window.renderImageOverlay = renderImageOverlay;
window.removeImageOverlay = removeImageOverlay;
window.uploadPendingImageOverlays = uploadPendingImageOverlays;
window.handleOverlayFiles = handleOverlayFiles;

// Text overlay
window.addTextOverlayFromClipboard = addTextOverlayFromClipboard;
window.addEmptyTextOverlay = addEmptyTextOverlay;
window.renderTextOverlay = renderTextOverlay;
window.removeTextOverlay = removeTextOverlay;

// Render
window.renderOverlaysForCurrentPage = renderOverlaysForCurrentPage;

// Init handlers
window.initOverlayKeyboardHandler = initOverlayKeyboardHandler;
window.initOverlayDeselectHandler = initOverlayDeselectHandler;
window.initPasteHandler = initPasteHandler;

// Cleanup
window.destroyOverlaySystem = destroyOverlaySystem;

// FIX: Export drag/resize state so Firebase listeners can check if user is dragging
window.globalDragState = globalDragState;
window.globalResizeState = globalResizeState;
