/**
 * File Manager Module - Entry Point
 * Re-exports all functions + ALL window.* assignments + DOMContentLoaded listener
 *
 * Split from original file-manager.js into:
 *   - file-constants.js        → shared constants, state, helpers (tránh circular import)
 *   - file-core.js             → display, navigation, switch file
 *   - file-loader.js           → load nội dung file (image, PDF, text, archive placeholder)
 *   - file-reorder.js          → drag-to-reorder file trong sidebar
 *   - file-thumbnail.js        → thumbnail generation (image + PDF)
 *   - file-context-menu.js     → right-click menu (delete, extract)
 *   - file-upload.js           → add local files (PDF, image), clipboard, shared helpers
 *   - file-upload-handlers.js  → text/archive upload, drag & drop, multi-file processing
 *   - file-sync.js             → sync with Firebase Storage and remote sessions
 */

// ============================================
// CONSTANTS & SHARED STATE (từ file-constants.js)
// ============================================

import { pendingFileDeletes, SUPPORTED_FILE_TYPES, ARCHIVE_EXTENSIONS } from './file-constants.js';
export { pendingFileDeletes, SUPPORTED_FILE_TYPES, ARCHIVE_EXTENSIONS };
window.pendingFileDeletes = pendingFileDeletes;

// ============================================
// IMPORTS FROM SUB-MODULES (import 1 lần, re-export + gán window bên dưới)
// ============================================

// file-core.js
import {
  getSourceFromFilename,
  getFileCategory,
  isFileNameDuplicate,
  displayLocalFileList,
  switchToLocalFile,
  removeFileByIndex,
} from './file-core.js';

// file-reorder.js
import { reorderFile, setupFileItemDragHandlers } from './file-reorder.js';

// file-loader.js
import { showArchivePlaceholder, loadImageContent, loadTextContent, loadPdfContent } from './file-loader.js';

// file-thumbnail.js
import { generateFileThumbnail } from './file-thumbnail.js';

// file-context-menu.js
import {
  showFileContextMenu,
  hideFileContextMenu,
  deleteFileFromContextMenu,
  extractArchiveFromContextMenu,
  initContextMenuListeners,
} from './file-context-menu.js';

// file-upload.js
import {
  readFileAs,
  addLocalFile,
  addLocalPDFFile,
  addLocalImageFile,
  addImageFromClipboard,
} from './file-upload.js';

// file-upload-handlers.js
import {
  addLocalTextFile,
  addLocalArchiveFile,
  processMultipleFiles,
  initDragDropHandlers,
} from './file-upload-handlers.js';

// file-sync.js
import {
  syncLocalFilesToFirebase,
  mergeRemoteSessionFiles,
  syncFileDeletions,
  syncFileOrder,
} from './file-sync.js';

// ============================================
// RE-EXPORTS (để module khác import từ index.js)
// ============================================

export {
  // file-core
  getSourceFromFilename,
  getFileCategory,
  isFileNameDuplicate,
  displayLocalFileList,
  switchToLocalFile,
  removeFileByIndex,
  // file-reorder
  reorderFile,
  setupFileItemDragHandlers,
  // file-loader
  showArchivePlaceholder,
  loadImageContent,
  loadTextContent,
  loadPdfContent,
  // file-thumbnail
  generateFileThumbnail,
  // file-context-menu
  showFileContextMenu,
  hideFileContextMenu,
  deleteFileFromContextMenu,
  extractArchiveFromContextMenu,
  initContextMenuListeners,
  // file-upload
  readFileAs,
  addLocalFile,
  addLocalPDFFile,
  addLocalImageFile,
  addImageFromClipboard,
  // file-upload-handlers
  addLocalTextFile,
  addLocalArchiveFile,
  processMultipleFiles,
  initDragDropHandlers,
  // file-sync
  syncLocalFilesToFirebase,
  mergeRemoteSessionFiles,
  syncFileDeletions,
  syncFileOrder,
};

// ============================================
// WINDOW.* ASSIGNMENTS (global access for other modules)
// ============================================

window.SUPPORTED_FILE_TYPES = SUPPORTED_FILE_TYPES;
window.ARCHIVE_EXTENSIONS = ARCHIVE_EXTENSIONS;
window.readFileAs = readFileAs;
window.getSourceFromFilename = getSourceFromFilename;
window.isFileNameDuplicate = isFileNameDuplicate;
window.getFileCategory = getFileCategory;
window.generateFileThumbnail = generateFileThumbnail;
window.displayFiles = displayLocalFileList;
window.switchToLocalFile = switchToLocalFile;
window.addLocalFile = addLocalFile;
window.addLocalPDFFile = addLocalPDFFile;
window.addLocalImageFile = addLocalImageFile;
window.addLocalArchiveFile = addLocalArchiveFile;
window.addImageFromClipboard = addImageFromClipboard;
window.processMultipleFiles = processMultipleFiles;
window.initDragDropHandlers = initDragDropHandlers;
window.syncLocalFilesToFirebase = syncLocalFilesToFirebase;
// Sync functions
window.mergeRemoteSessionFiles = mergeRemoteSessionFiles;
window.syncFileDeletions = syncFileDeletions;
window.syncFileOrder = syncFileOrder;
// Context menu functions
window.showFileContextMenu = showFileContextMenu;
window.hideFileContextMenu = hideFileContextMenu;
window.deleteFileFromContextMenu = deleteFileFromContextMenu;
window.extractArchiveFromContextMenu = extractArchiveFromContextMenu;

// ============================================
// DOMContentLoaded - Initialize context menu
// ============================================

let _contextMenuDestroy = null;

function _initContextMenu() {
  _contextMenuDestroy = initContextMenuListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initContextMenu);
} else {
  _initContextMenu();
}

/** Cleanup file-manager listeners (gọi khi destroy app) */
export function destroyFileManager() {
  _contextMenuDestroy?.();
  _contextMenuDestroy = null;
}
window.destroyFileManager = destroyFileManager;

console.log('[FileManager] Module loaded');
