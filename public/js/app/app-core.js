/**
 * App Core - State, file loading, rendering, page navigation
 * Extracted from app.js
 */

import { base64ToUint8Array } from '../core-utils.js';
import { renderTextEditor } from './app-text-editor.js';
// Global state
export const appState = {
  currentFile: null,
  currentFileIndex: -1,  // Index of current file in files array
  currentPage: 1,
  totalPages: 0,
  scale: 1.0,
  pdfDoc: null,          // PDF.js document object
  isSelectMode: false,
  messageId: '',         // Session ID - used to load from Cloud Storage: gs://checkcongviec/{messageId}/
  files: [],
  comboFromUrl: null     // Combo suffix tu URL ?messageId=xxx_1 -> '_1' | null neu khong co
};

/**
 * Helper: Get MIME type from filename
 */
export function getMimeType(filename) {
  if (!filename) return 'application/octet-stream';
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'txt': 'text/plain'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Utility functions
export function showLoading(message = 'Đang xử lý...') {
  document.getElementById('loadingText').textContent = message;
  document.getElementById('loadingOverlay').style.display = 'flex';
}

export function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

// Bang display cho 4 viewer mode — sua 1 cho ap dung tat ca file type
const VIEWER_MODES = {
  archive: { textEditorContainer: 'none', pdfCanvas: 'none',  pagesSidebar: 'none',  archivePlaceholder: 'block', resetPdfWrapper: false },
  pdf:     { textEditorContainer: 'none', pdfCanvas: 'block', pagesSidebar: 'block', archivePlaceholder: 'none',  resetPdfWrapper: true  },
  image:   { textEditorContainer: 'none', pdfCanvas: 'block', pagesSidebar: 'block', archivePlaceholder: 'none',  resetPdfWrapper: true  },
  text:    { textEditorContainer: 'flex', pdfCanvas: 'none', pagesSidebar: 'none', archivePlaceholder: 'none', resetPdfWrapper: true },
};

/** Helper: setup viewer DOM cho 1 file type (tap trung quan ly display 4 element) */
function _setViewerMode(type) {
  const cfg = VIEWER_MODES[type];
  if (!cfg) return;
  if (cfg.resetPdfWrapper) {
    const pdfWrapper = resetPdfWrapperStyles();
    if (pdfWrapper) pdfWrapper.style.display = 'block';
  }
  for (const [id, display] of Object.entries(cfg)) {
    if (id === 'resetPdfWrapper') continue;
    const el = document.getElementById(id);
    if (el) el.style.display = display;
  }
}

/** Helper: fetch với timeout (auto attach Firebase auth nếu có), throw nếu !ok */
async function _fetchWithTimeout(url, timeoutMs) {
  const fetchFn = window.firebaseAuthFetch || fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Cloud Storage fetch failed: ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Guard chống double-click khi user spam click nhiều file liên tiếp
let _isLoadingFile = false;

/**
 * Load a file for viewing
 */
export async function loadFile(file) {
  if (_isLoadingFile) return;
  _isLoadingFile = true;
  try {
    await _loadFileInner(file);
  } finally {
    _isLoadingFile = false;
  }
}

async function _loadFileInner(file) {
  // Auto-save pending selections before switching files
  if (typeof window.hasPendingSelections === 'function' && window.hasPendingSelections()) {
    await window.captureAndUploadPendingSelections();
    // Race-guard: trong lúc upload, có thể có loadFile khác đã chạy → bỏ qua
    if (appState.currentFile && appState.currentFile.id !== file.id && _isLoadingFile === false) return;
  }
  // Exit select mode when switching files
  window.exitSelectMode();

  appState.currentFile = file;
  appState.currentFileIndex = appState.files.indexOf(file);  // Set current file index
  appState.currentPage = 1;
  window.currentFileId = file.id;  // Always sync window.currentFileId for all file types

  // Update active state in file list
  document.querySelectorAll('.file-item-horizontal').forEach((el, i) => {
    el.classList.toggle('active', appState.files[i] === file);
  });
  // Remove active from email button when viewing file
  const emailBtn = document.getElementById('emailComposerFixed');
  if (emailBtn) emailBtn.classList.remove('active');

  // Check file type using shared helpers from core-utils.js
  const isPdf = isPdfFile(file);
  const isImage = isImageFile(file);
  const isText = isTextFile(file);
  const isArchive = isArchiveFile(file);

  if (isArchive) {
    _setViewerMode('archive');
    if (typeof renderSelectionsForCurrentPage === 'function') {
      renderSelectionsForCurrentPage();
    }
    return;
  }

  if (isPdf) {
    _setViewerMode('pdf');
    await loadPDF(file);
    if (appState.currentFile?.id !== file.id) return; // race-guard sau await
  } else if (isImage) {
    _setViewerMode('image');
    await loadImage(file);
    if (appState.currentFile?.id !== file.id) return; // race-guard sau await
  } else if (isText) {
    _setViewerMode('text');
    await loadText(file);
  }
}

/** Helper: Lấy PDF bytes từ cache/local/server/cloud storage */
async function _fetchPdfBytes(file) {
  // Priority 1: Already have content cached
  if (file.originalPdfBytes) {
    return file.originalPdfBytes;
  }
  // Priority 2: Local file with base64
  if (file.isLocal && file.base64) {
    return base64ToUint8Array(file.base64);
  }
  // Priority 2.5: Doc tu Server LAN (Electron only)
  if (window.ServerFile) {
    const serverData = await window.ServerFile.tryLoadBinary(appState.messageId, file.name);
    if (serverData) {
      console.log('[ServerFile] PDF loaded from server:', file.name);
      return base64ToUint8Array(serverData.base64);
    }
  }
  // Priority 3: Fetch from Cloud Storage URL (primary source)
  if (file.downloadUrl) {
    const response = await _fetchWithTimeout(file.downloadUrl, 60000);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
  return null;
}

/**
 * Load and render PDF
 * Files are loaded from Cloud Storage (pre-synced by Cloud Run API)
 * Delegates to loadPDFFromArrayBuffer() (pdf-viewer.js) for proper cleanup and rendering
 */
export async function loadPDF(file) {
  showLoading('Đang tải PDF...');
  try {
    const pdfBytes = await _fetchPdfBytes(file);
    if (!pdfBytes) {
      throw new Error('Không có nguồn dữ liệu. File cần được sync từ Cloud Storage trước.');
    }

    // Save bytes to file object for switchToLocalFile() reuse
    file.originalPdfBytes = pdfBytes;
    file.type = window.FILE_TYPES?.PDF || 'pdf';
    file.needsContentLoad = false;

    // Delegate to loadPDFFromArrayBuffer() for proper cleanup (destroy old pdfDoc),
    // buffer cloning, page dimension caching, auto-fit, and thumbnail generation
    const freshBytes = new Uint8Array(pdfBytes);
    await loadPDFFromArrayBuffer(freshBytes.buffer, file.name);

    // Update rotate button state after loading (matches original D-index_WebApp.html)
    if (typeof updateRotateButtonState === 'function') {
      updateRotateButtonState();
    }

  } catch (error) {
    console.error('[App] Failed to load PDF:', appState.currentFile?.name, error);
    alert('Lỗi khi tải PDF: ' + error.message);
  } finally {
    hideLoading();
  }
}

/** Helper: Lấy image data (base64 + mimeType) từ cache/server/cloud storage — pure, caller tu cache vao file */
async function _fetchImageData(file) {
  // Priority 1: Already have base64 cached
  if (file.base64) {
    const mimeType = file.mimeType ?? 'image/jpeg';
    return { base64: file.base64, mimeType, src: `data:${mimeType};base64,${file.base64}` };
  }
  // Priority 1.5: Doc tu Server LAN (Electron only)
  if (window.ServerFile) {
    const serverData = await window.ServerFile.tryLoadBinary(appState.messageId, file.name);
    if (serverData) {
      const mimeType = file.mimeType ?? 'image/jpeg';
      console.log('[ServerFile] Image loaded from server:', file.name);
      return { base64: serverData.base64, mimeType, src: `data:${mimeType};base64,${serverData.base64}` };
    }
  }
  // Priority 2: Fetch from Cloud Storage URL (primary source)
  if (file.downloadUrl) {
    const response = await _fetchWithTimeout(file.downloadUrl, 30000);
    const blob = await response.blob();
    const mimeType = blob.type ?? 'image/jpeg';

    // Convert blob to base64 for caching
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return { base64, mimeType, src: `data:${mimeType};base64,${base64}` };
  }
  return null;
}

/**
 * Load and display image
 * Files are loaded from Cloud Storage (pre-synced by Cloud Run API)
 * IMPORTANT: This function saves base64 to file object for later use by switchToLocalFile()
 */
export async function loadImage(file) {
  showLoading('Đang tải ảnh...');
  try {
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');

    const imageData = await _fetchImageData(file);
    if (!imageData) {
      throw new Error('Khong co nguon du lieu. File can duoc sync tu Cloud Storage truoc.');
    }

    // Cache vao file object cho switchToLocalFile() reuse
    file.base64 = imageData.base64;
    file.mimeType = imageData.mimeType;
    file.type = window.FILE_TYPES?.IMAGE || 'image';
    file.needsContentLoad = false;

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width * appState.scale;
        canvas.height = img.height * appState.scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        appState.totalPages = 1;
        file.pageCount = 1;
        file.numPages = 1;
        file.originalWidth = img.width;
        file.originalHeight = img.height;
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData.src;
    });
  } catch (error) {
    console.error('[App] Failed to load image:', file?.name, error);
    alert('Lỗi khi tải ảnh: ' + error.message);
  } finally {
    hideLoading();
  }
}

/** Helper: Lấy text content từ FileObject/server/cloud storage/base64/cache */
async function _fetchTextContent(file) {
  // Priority 1: Local file with File object -> FileReader.readAsText() (best for UTF-8)
  if (file.fileObject instanceof File) {
    return await readFileAs(file.fileObject, 'text');
  }
  // Priority 1.5: Doc tu Server LAN (Electron only)
  if (window.ServerFile) {
    const serverText = await window.ServerFile.tryLoadText(appState.messageId, file.name);
    if (serverText !== null) {
      console.log('[ServerFile] Text loaded from server:', file.name);
      return serverText;
    }
  }
  // Priority 2: Fetch from Cloud Storage URL -> fetch().text() (auto UTF-8)
  if (file.url || file.downloadUrl) {
    const response = await _fetchWithTimeout(file.url || file.downloadUrl, 15000);
    return await response.text();
  }
  // Priority 3: Base64 fallback -> TextDecoder for proper UTF-8
  if (file.base64) {
    const bytes = base64ToUint8Array(file.base64);
    return new TextDecoder('utf-8').decode(bytes);
  }
  // Priority 4: textContent already loaded
  if (file.textContent) {
    return file.textContent;
  }
  // No content source available -> Use filename as default content
  return file.name || 'Empty file';
}

/**
 * Load and display text file (EDITABLE - like Notepad)
 * Uses <textarea> for editing, with Save button
 */
export async function loadText(file, suppressLoading = false) {
  if (!suppressLoading) showLoading('Đang tải text file...');

  const fileId = file.id;
  try {
    const textContent = await _fetchTextContent(file);

    // Abort nếu user đã switch file khác trong lúc fetch
    if (appState.currentFile?.id !== fileId) return;

    // Store original content for change detection
    file.originalTextContent = textContent;
    file.textContent = textContent;

    // Render editable text content
    renderTextEditor(textContent, file);

    // Update file state
    file.type = window.FILE_TYPES?.TEXT || 'text';
    file.needsContentLoad = false;

    // Update app state
    appState.pdfDoc = null;
    appState.totalPages = 1;
    appState.currentPage = 1;

    updatePageInfo();

    // CRITICAL FIX: Clear selections when switching to text file
    // Text files don't support selections, so hide any selections from previous files
    if (typeof renderSelectionsForCurrentPage === 'function') {
      renderSelectionsForCurrentPage();
    }

  } catch (error) {
    console.error('[App] Failed to load text file:', appState.currentFile?.name, error);
    alert('Lỗi khi tải text file: ' + error.message);
  } finally {
    if (!suppressLoading) hideLoading();
  }
}

// renderTextEditor, saveTextFile → moved to app-text-editor.js (caller import direct từ đó)

/**
 * Update page info display (for text files shows "1/1")
 */
function updatePageInfo() {
  const pageInfo = document.getElementById('pageInfo');
  if (pageInfo) {
    pageInfo.textContent = `${appState.currentPage} / ${appState.totalPages}`;
  }
}

// NOTE: renderPage() is defined in pdf-viewer.js with full rotation support
// Do NOT redefine it here to avoid overriding the complete implementation

/**
 * Change page (matches original D-index_WebApp.html behavior)
 */
export async function changePage(delta) {
  const newPage = appState.currentPage + delta;
  if (newPage >= 1 && newPage <= appState.totalPages) {
    appState.currentPage = newPage;
    const autoFitScale = getFitToPageScale();
    await setScale(autoFitScale);
    if (typeof renderSelectionsForCurrentPage === 'function') {
      renderSelectionsForCurrentPage();
    }
    updateRotateButtonState();
  }
}

console.log('[AppCore] Module loaded');
