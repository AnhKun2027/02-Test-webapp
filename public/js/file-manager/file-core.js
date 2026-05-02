/**
 * File Core Module
 * Display file list, switch file, navigation
 *
 * Depends on (window):
 *   appState, APP_CONSTANTS, FILE_TYPES, escapeHTML, generateUUID,
 *   isImageFile, isTextFile, isArchiveFile, isPdfFile,
 *   loadImageFromBase64, loadPDFFromArrayBuffer, loadText, base64ToUint8Array,
 *   syncAllTextareaValues, resetPdfWrapperStyles, renderSelectionsForCurrentPage,
 *   abortThumbnailRender, showFileContextMenu, showLoading, hideLoading,
 *   createComboPill, showComboTagDropdown, addTagToFile, removeTagFromFile,
 *   fileMatchesFilter, saveBitmapToCache, restoreBitmapFromCache,
 *   ServerFile (optional, Electron only)
 */

import { SUPPORTED_FILE_TYPES, ARCHIVE_EXTENSIONS } from './file-constants.js';
import { generateFileThumbnail } from './file-thumbnail.js';
import { setupFileItemDragHandlers } from './file-reorder.js';
import { showArchivePlaceholder, loadImageContent, loadTextContent, loadPdfContent } from './file-loader.js';

// ============================================
// SOURCE DETECTION FROM FILENAME
// ============================================

/**
 * Determine file source from filename prefix in square brackets
 * Rule: Filename starting with "[source]" → extract source value
 *       No prefix → default to 'local'
 *
 * Examples:
 *   "[Gmail] TEXT.txt" → 'gmail'
 *   "[Local] Document.pdf" → 'local'
 *   "TEXT.txt" → 'local' (default, no prefix)
 *
 * @param {string} filename - File name to check
 * @returns {string} - extracted source or 'local'
 */
export function getSourceFromFilename(filename) {
  if (!filename) return 'local';

  // Check for [source] prefix pattern (with optional space after)
  const match = filename.match(/^\[([^\]]+)\]/);
  if (match) {
    return match[1].toLowerCase();  // Return source value in lowercase
  }
  return 'local';
}

/**
 * Check if file type is supported
 * @param {File} file - File object to check
 * @returns {string|null} - 'pdf', 'image', 'text', 'archive', or null if not supported
 */
export function getFileCategory(file) {
  if (SUPPORTED_FILE_TYPES.pdf.includes(file.type)) {
    return 'pdf';
  }
  if (SUPPORTED_FILE_TYPES.image.includes(file.type)) {
    return 'image';
  }
  if (SUPPORTED_FILE_TYPES.text.includes(file.type)) {
    return 'text';
  }
  if (SUPPORTED_FILE_TYPES.archive.includes(file.type)) {
    return 'archive';
  }

  // Check by extension (some browsers may not set correct MIME type)
  const ext = file.name?.toLowerCase().split('.').pop();
  if (ext === 'txt') {
    return 'text';
  }
  // Archive detection by extension (MIME types can be inconsistent)
  if (ARCHIVE_EXTENSIONS.includes(ext)) {
    return 'archive';
  }
  return null;
}

/**
 * Check if filename already exists in current session
 * Case-insensitive comparison to prevent issues on different OS
 * @param {string} fileName - Name of file to check
 * @returns {boolean} - true if duplicate exists
 */
export function isFileNameDuplicate(fileName) {
  const lowerName = fileName.toLowerCase();
  return appState.files.some(f => f.name.toLowerCase() === lowerName);
}

// ============================================
// REMOVE FILE HELPER
// ============================================

/**
 * Xoa file khoi RAM theo index, cap nhat currentFileIndex, switch file hoac clear container
 * Dung chung cho deleteFileFromContextMenu va syncFileDeletions
 * @param {number} fileIndex - Index cua file trong appState.files
 */
export function removeFileByIndex(fileIndex) {
  if (fileIndex < 0 || fileIndex >= appState.files.length) return;

  // Xoa khoi RAM
  appState.files.splice(fileIndex, 1);

  // Cap nhat currentFileIndex
  if (appState.currentFileIndex === fileIndex) {
    if (appState.files.length > 0) {
      const newIndex = Math.max(0, fileIndex - 1);
      void switchToLocalFile(newIndex).catch(err => console.error('[FileManager] switchToLocalFile failed:', err));
    } else {
      appState.currentFile = null;
      appState.currentFileIndex = -1;
      const container = document.getElementById('pdfPagesContainer');
      if (container) container.replaceChildren();
    }
  } else if (appState.currentFileIndex > fileIndex) {
    appState.currentFileIndex--;
  }

  // Re-render file list
  displayLocalFileList();
}

// ============================================
// DISPLAY FILE LIST
// ============================================

/**
 * Xác định icon và label cho file dựa trên loại file
 */
function getFileIconAndLabel(fileData) {
  const ext = fileData.name?.toLowerCase().split('.').pop() || '';
  const isUnknown = fileData.type === 'unknown' && !isArchiveFile(fileData) && !isTextFile(fileData);

  if (isImageFile(fileData)) return { icon: '🖼️', label: 'Image' };
  if (isTextFile(fileData)) return { icon: '📄', label: 'TEXT' };
  if (isArchiveFile(fileData)) return { icon: '📦', label: ext.toUpperCase() || 'Archive' };
  if (isUnknown) return { icon: '❓', label: ext.toUpperCase() || 'Unknown' };
  return { icon: '📄', label: 'PDF' };
}

/** Helper: render tag pills + Add Tag button vào container */
function _renderFileTags(fileTagsContainer, fileData) {
  if (!fileTagsContainer) return;

  if (fileData.tags && fileData.tags.length > 0) {
    fileData.tags.forEach(comboStr => fileTagsContainer.appendChild(createComboPill(comboStr)));
  }

  const addTagBtn = document.createElement('button');
  addTagBtn.className = 'add-tag-btn';
  addTagBtn.textContent = '+ Tag';
  addTagBtn.onclick = (e) => {
    e.stopPropagation();
    showComboTagDropdown(addTagBtn, fileData.tags || [], (comboStr, isSelected) => {
      if (isSelected) addTagToFile(fileData.id, comboStr);
      else removeTagFromFile(fileData.id, comboStr);
    });
  };
  fileTagsContainer.appendChild(addTagBtn);
}

/** Helper: gắn click, context menu, drag handlers cho file item */
function _setupFileItemListeners(fileItem, index, fileData, fileListContainer) {
  // Click → chuyển file
  fileItem.onclick = () => {
    const emailComposer = document.getElementById('emailComposerView');
    if (emailComposer && emailComposer.style.display !== 'none') emailComposer.style.display = 'none';
    const emailBtn = document.getElementById('emailComposerFixed');
    if (emailBtn) emailBtn.classList.remove('active');
    switchToLocalFile(index);
  };

  // Right-click → context menu
  fileItem.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.showFileContextMenu(e, index, fileData);
  };

  // Drag & drop
  setupFileItemDragHandlers(fileItem, index, fileListContainer);
}

/**
 * Tạo DOM element cho 1 file item trong file list
 */
function createFileItemElement(fileData, index, fileListContainer) {
  const { icon: fileIcon, label: fileTypeLabel } = getFileIconAndLabel(fileData);

  const fileItem = document.createElement('div');
  fileItem.className = 'file-item-horizontal';
  fileItem.setAttribute('data-file-index', index);
  fileItem.draggable = true;

  if (index === appState.currentFileIndex) fileItem.classList.add('active');

  fileItem.innerHTML = `
    <span class="drag-handle" title="Kéo để sắp xếp">⋮</span>
    <div class="file-thumbnail loading">${fileIcon}</div>
    <div class="file-info">
      <div class="file-name" title="${escapeHTML(fileData.name)}">${escapeHTML(fileData.name)}</div>
      <div class="file-size">${(fileData.size / 1024).toFixed(1)} KB - ${fileTypeLabel}</div>
      <div class="file-tags" id="file-tags-${index}"></div>
    </div>
  `;

  _renderFileTags(fileItem.querySelector(`#file-tags-${index}`), fileData);

  // Tag filter
  if (!fileMatchesFilter(fileData)) fileItem.style.display = 'none';

  _setupFileItemListeners(fileItem, index, fileData, fileListContainer);

  // Thumbnail (async)
  generateFileThumbnail(fileData, (thumbnailUrl) => {
    const thumbnailElement = fileItem.querySelector('.file-thumbnail');
    if (thumbnailElement && thumbnailUrl) {
      const img = document.createElement('img');
      img.className = 'file-thumbnail';
      img.src = thumbnailUrl;

      const rotation = fileData.thumbnailRotation ?? 0;
      if (rotation !== 0) {
        img.style.transform = (rotation === 90 || rotation === 270)
          ? `rotate(${rotation}deg) scale(${APP_CONSTANTS.THUMBNAIL.ROTATE_SCALE})`
          : `rotate(${rotation}deg)`;
      }

      img.onerror = () => {
        thumbnailElement.classList.add('loading');
        thumbnailElement.innerHTML = fileIcon;
      };
      thumbnailElement.replaceWith(img);
    }
  });

  return fileItem;
}

/**
 * Render LẠI TOÀN BỘ file list (full rebuild, không diff-based).
 *
 * QUYẾT ĐỊNH THIẾT KẾ: project chỉ ~10-50 file/session
 *   → full rebuild <10ms, đơn giản, không cần track diff.
 *   Caller nên gom nhiều thay đổi rồi gọi 1 LẦN cuối
 *   (vd: processMultipleFiles, _applyFiles trong sync-listeners).
 *
 * KHI NÀO cần đổi sang diff-based:
 *   - N file > 200 thường xuyên
 *   - Render >50ms gây giật
 *   - User báo lag khi scroll/switch file
 *
 * KHÔNG đề xuất tối ưu trừ khi gặp 1 trong 3 điều kiện trên.
 */
export function displayLocalFileList() {
  const fileListContainer = document.getElementById('fileListHorizontal');
  const fileManagerBar = document.getElementById('fileManagerHorizontal');
  if (!fileListContainer || !fileManagerBar) return;

  fileListContainer.replaceChildren();

  const fragment = document.createDocumentFragment();
  appState.files.forEach((fileData, index) => {
    fragment.appendChild(createFileItemElement(fileData, index, fileListContainer));
  });
  fileListContainer.appendChild(fragment);

  fileManagerBar.style.display = appState.files.length > 0 ? 'flex' : 'none';
}

// ============================================
// SWITCH FILE
// ============================================

/**
 * Update only the active highlight in file list (no full DOM rebuild)
 * Used by switchToLocalFile() for faster file switching
 */
export function updateActiveFileHighlight(activeIndex) {
  document.querySelectorAll('.file-item-horizontal').forEach((el, i) => {
    el.classList.toggle('active', i === activeIndex);
  });
}

// FIX item 5.2: Debounce file switching to prevent rapid click issues.
// _pendingIndex được cập nhật mỗi click → khi timeout fire, dùng index MỚI nhất
// (tránh trường hợp click idx2 trong cửa sổ debounce nhưng switch về idx1 cũ).
let switchFileTimeout = null;
let lastSwitchTime = 0;
let _pendingIndex = -1;
const SWITCH_DEBOUNCE_MS = APP_CONSTANTS.FILE_SWITCH_DEBOUNCE;

/** Helper: lưu state file hiện tại (lastPage, lastScale, bitmap cache, PDF bytes) */
function _saveCurrentFileState() {
  if (!appState.currentFile || appState.currentFileIndex < 0 || appState.currentFileIndex >= appState.files.length) return;

  appState.files[appState.currentFileIndex].lastPage = appState.currentPage;
  appState.files[appState.currentFileIndex].lastScale = appState.scale;

  // Cache canvas bitmap để switch lại file này tức thì (~1ms)
  if (typeof window.saveBitmapToCache === 'function') {
    window.saveBitmapToCache(appState.currentFile.id, appState.currentPage);
  }

  // LƯU PDF DATA để không mất khi chuyển file
  if (window.originalPdfBytes) {
    appState.files[appState.currentFileIndex].originalPdfBytes = window.originalPdfBytes;
  }
}

/** Helper: restore state từ cache (page, scale) */
function _restoreFileState(file) {
  if (file.lastPage) {
    appState.currentPage = file.lastPage;
  } else {
    appState.currentPage = 1;
  }

  if (file.lastScale) {
    appState.scale = file.lastScale;
  }
}

/** Helper: cleanup PDF doc khi target không phải PDF (tránh memory leak) */
function _cleanupPdfDocIfNeeded(targetFile) {
  const targetIsPdf = targetFile && !isImageFile(targetFile) && !isTextFile(targetFile) && !isArchiveFile(targetFile) && targetFile.type !== 'unknown';
  if (appState.pdfDoc && !targetIsPdf) {
    try {
      appState.pdfDoc.destroy();
      appState.pdfDoc = null;
    } catch (e) {
      console.warn('[switchToLocalFile] Error destroying PDF:', e.message);
    }
  }
}

/** Helper: clear selectionOverlay DOM + re-render selections cho page hiện tại */
function _resetOverlayAndRender(index) {
  updateActiveFileHighlight(index);
  const overlay = document.getElementById('selectionOverlay');
  if (overlay) while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
  if (typeof renderSelectionsForCurrentPage === 'function') renderSelectionsForCurrentPage();
}

/** Helper: reset UI placeholder + wrapper khi load file thường (không phải archive) */
function _resetUIForNormalFile() {
  const archivePlaceholder = document.getElementById('archivePlaceholder');
  if (archivePlaceholder) archivePlaceholder.style.display = 'none';

  const pdfWrapper = resetPdfWrapperStyles();
  if (pdfWrapper) {
    pdfWrapper.classList.remove('pdf-wrapper--archive-mode');
    pdfWrapper.style.display = '';
  }
}

/** Helper: load nội dung file (image/text/PDF), restore bitmap cache nếu có */
async function _loadFileContent(curFile) {
  const isImage = isImageFile(curFile);
  const isText = isTextFile(curFile);

  // Instant restore từ bitmap cache (tránh flash trắng)
  if (!isText && typeof window.restoreBitmapFromCache === 'function') {
    const cacheHit = window.restoreBitmapFromCache(curFile.id, appState.currentPage);
    if (cacheHit) {
      document.getElementById('pdfCanvas').style.display = 'block';
      const textEditor = document.getElementById('textEditorContainer');
      if (textEditor) textEditor.style.display = 'none';
      window._bitmapCacheActive = true;
    }
  }

  // Load nội dung theo loại file
  if (isImage) {
    await loadImageContent(curFile);
  } else if (isText) {
    await loadTextContent();
  } else {
    await loadPdfContent(curFile);
  }
}

export async function switchToLocalFile(index) {
  if (index < 0 || index >= appState.files.length) return;

  // Debounce: click nhanh trong cửa sổ → schedule với index MỚI nhất, hủy lần trước
  const now = Date.now();
  if (now - lastSwitchTime < SWITCH_DEBOUNCE_MS) {
    _pendingIndex = index;
    if (switchFileTimeout) clearTimeout(switchFileTimeout);
    switchFileTimeout = setTimeout(() => {
      const target = _pendingIndex;
      _pendingIndex = -1;
      switchFileTimeout = null;
      switchToLocalFile(target);
    }, SWITCH_DEBOUNCE_MS);
    return;
  }
  lastSwitchTime = now;

  if (typeof abortThumbnailRender === 'function') abortThumbnailRender();
  _cleanupPdfDocIfNeeded(appState.files[index]);

  // Sync textarea + save state file CŨ trước khi chuyển
  syncAllTextareaValues();
  _saveCurrentFileState();

  // Set new state
  appState.currentFileIndex = index;
  appState.currentFile = appState.files[index];
  _restoreFileState(appState.currentFile);
  window.currentFileId = appState.currentFile.id;

  // Archive/Unknown → placeholder, return sớm (không load content)
  const curFile = appState.currentFile;
  const isArchive = isArchiveFile(curFile);
  const isUnknown = curFile.type === 'unknown' && !isArchive && !isTextFile(curFile);
  if (isArchive || isUnknown) {
    showArchivePlaceholder(index);
    _resetOverlayAndRender(index);
    return;
  }

  // File thường: reset UI + load content + race-guard
  _resetUIForNormalFile();
  try {
    await _loadFileContent(curFile);
  } catch (err) {
    console.error('[switchToLocalFile] Load failed:', curFile.name, err);
  }
  if (appState.currentFile?.id !== curFile.id) return; // user switch khác giữa chừng
  _resetOverlayAndRender(index);
}
