/** File Upload Handlers — text/archive file upload, drag & drop, multi-file processing */

import { getFileCategory } from './file-core.js';
import { readFileAs, createBaseFileData, finalizeFileAddition, addLocalFile } from './file-upload.js';

// ============================================
// ADD FILE BY TYPE
// ============================================

export async function addLocalTextFile(file) {
  showLoading(`Đang xử lý file text: ${file.name}...`);

  try {
    const textContent = await readFileAs(file, 'text');

    const fileData = createBaseFileData(file.name, window.FILE_TYPES.TEXT, 'text/plain', file.size, {
      textContent: textContent,
    });

    return await finalizeFileAddition(fileData, `[LocalFile] Added Text: ${file.name} (${textContent.length} chars)`);
  } finally {
    hideLoading();
  }
}

export async function addLocalArchiveFile(file) {
  showLoading(`Đang xử lý file nén: ${file.name}...`);

  try {
    const arrayBuffer = await readFileAs(file, 'arrayBuffer');
    const ext = file.name.toLowerCase().split('.').pop();

    const fileData = createBaseFileData(file.name, window.FILE_TYPES.ARCHIVE, file.type || `application/x-${ext}-compressed`, file.size, {
      arrayBuffer: arrayBuffer,
      archiveType: ext.toUpperCase(),
      pageCount: 0,
      numPages: 0,
    });

    return await finalizeFileAddition(fileData, `[LocalFile] Added Archive: ${file.name} (${ext.toUpperCase()}, ${(file.size / 1024).toFixed(1)} KB)`);
  } finally {
    hideLoading();
  }
}

// ============================================
// MULTI-FILE PROCESSING
// ============================================

/**
 * Process multiple files (from input or drag/drop)
 * @param {FileList} files - List of files to process
 */
export async function processMultipleFiles(files) {
  if (!files || files.length === 0) return;

  const fileArray = Array.from(files);
  // Phân loại 1 vòng duy nhất — tránh gọi getFileCategory() 2 lần mỗi file
  const validFiles = [];
  const invalidNames = [];
  for (const f of fileArray) {
    if (getFileCategory(f) !== null) validFiles.push(f);
    else invalidNames.push(f.name);
  }

  // Warn about invalid files
  if (invalidNames.length > 0) {
    console.warn('[LocalFile] Skipping unsupported files:', invalidNames.join('\n'));
  }

  // Check file size limit — lọc file quá lớn ra, vẫn xử lý file còn lại
  const maxFileSize = APP_CONSTANTS?.MEMORY_LIMITS?.MAX_FILE_SIZE ?? 100 * 1024 * 1024;
  const maxMB = (maxFileSize / 1024 / 1024).toFixed(0);
  const oversizedFiles = validFiles.filter(f => f.size > maxFileSize);
  if (oversizedFiles.length > 0) {
    const oversizedNames = oversizedFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join('\n');
    alert(`Bỏ qua file quá lớn (tối đa ${maxMB}MB):\n\n${oversizedNames}`);
    // Lọc ra thay vì return — file nhỏ vẫn được xử lý
    const sized = validFiles.filter(f => f.size <= maxFileSize);
    validFiles.length = 0;
    validFiles.push(...sized);
  }

  if (validFiles.length === 0) {
    alert('Không có file hợp lệ!\n\nChỉ hỗ trợ: PDF, JPG, PNG, GIF, WebP, TXT, ZIP, RAR, 7z');
    return;
  }

  // Process files tuần tự — finalizeFileAddition gọi switchToLocalFile, song song sẽ race
  for (const file of validFiles) {
    await addLocalFile(file);
  }
}

// ============================================
// DRAG & DROP HANDLERS
// ============================================

/** Helper: detect file type from dataTransfer — 'image', 'pdf', or 'other' */
function _detectDraggedFileType(dataTransfer) {
  if (!dataTransfer || !dataTransfer.items) return 'other';

  let hasImage = false;
  let hasPdf = false;

  for (const item of dataTransfer.items) {
    if (item.type && item.type.startsWith('image/')) hasImage = true;
    if (item.type === 'application/pdf') hasPdf = true;
  }

  if (hasImage) return 'image';
  if (hasPdf) return 'pdf';
  return 'other';
}

/** Helper: detect zone from mouse coordinates using bounding rect */
function _detectZoneFromCoordinates(pdfArea, clientX, clientY) {
  if (pdfArea && appState.currentFile) {
    const rect = pdfArea.getBoundingClientRect();
    const isOverViewer = (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
    return isOverViewer ? 'viewer' : 'filemanager';
  }
  return 'filemanager';
}

/** Helper: clear all zone highlights */
function _clearHighlights(pdfArea, fileManager) {
  pdfArea?.classList.remove('drag-highlight');
  fileManager?.classList.remove('drag-highlight');
}

/** Helper: apply highlight based on zone and file type */
function _applyHighlight(pdfArea, fileManager, zone, fileType) {
  _clearHighlights(pdfArea, fileManager);

  if (fileType === 'image' && zone === 'viewer' && appState.currentFile) {
    pdfArea?.classList.add('drag-highlight');
  } else {
    fileManager?.classList.add('drag-highlight');
  }
}

/** Helper: handle drop event — create overlay or new files */
async function _handleDrop(isDropOnViewer, files) {
  if (!files || files.length === 0) return;

  if (isDropOnViewer && appState.currentFile) {
    const imageFiles = [];
    const otherFiles = [];

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        imageFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    }

    for (const imgFile of imageFiles) {
      if (typeof addImageOverlayFromClipboard === 'function') {
        await addImageOverlayFromClipboard(imgFile, imgFile.type);
      }
    }

    if (otherFiles.length > 0) {
      await processMultipleFiles(otherFiles);
    }
  } else {
    await processMultipleFiles(files);
  }
}

/**
 * Initialize drag & drop handlers with zone-based visual highlight
 * - Drop on File Manager → Create new file (highlight File Manager)
 * - Drop on Viewer Area → Create overlay for images (highlight Viewer)
 * - Drop PDF anywhere → Create new file (always highlight File Manager)
 */
let _dragAbortController = null;

export function initDragDropHandlers() {
  if (_dragAbortController) return;
  _dragAbortController = new AbortController();
  const signal = _dragAbortController.signal;

  const pdfArea = document.querySelector('.pdf-area');
  const fileManager = document.getElementById('fileManagerHorizontal');
  let dragCounter = 0;
  let currentDragZone = null;
  let draggedFileType = null;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes('Files')) return;

    dragCounter++;
    if (dragCounter === 1) {
      draggedFileType = _detectDraggedFileType(e.dataTransfer);
      currentDragZone = _detectZoneFromCoordinates(pdfArea, e.clientX, e.clientY);
      _applyHighlight(pdfArea, fileManager, currentDragZone, draggedFileType);
    }
  }, { signal });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes('Files')) return;

    dragCounter--;
    if (dragCounter === 0) {
      _clearHighlights(pdfArea, fileManager);
      currentDragZone = null;
      draggedFileType = null;
    }
  }, { signal });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes('Files')) return;

    const newZone = _detectZoneFromCoordinates(pdfArea, e.clientX, e.clientY);
    if (newZone !== currentDragZone) {
      currentDragZone = newZone;
      _applyHighlight(pdfArea, fileManager, currentDragZone, draggedFileType);
    }
  }, { signal });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    _clearHighlights(pdfArea, fileManager);

    const isDropOnViewer = currentDragZone === 'viewer';
    currentDragZone = null;
    draggedFileType = null;

    await _handleDrop(isDropOnViewer, e.dataTransfer?.files);
  }, { signal });
}

/** Cleanup drag listeners */
export function destroyDragDrop() {
  if (_dragAbortController) {
    _dragAbortController.abort();
    _dragAbortController = null;
  }
}
