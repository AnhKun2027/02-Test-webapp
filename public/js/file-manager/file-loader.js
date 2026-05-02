/** File Loader — load nội dung file theo loại (image, PDF, text, archive placeholder) */

import { getAuthFetch } from './file-constants.js';
import { readFileAs } from './file-upload.js';

// ============================================
// FILE CONTENT LOADERS (tách từ switchToLocalFile)
// ============================================

/**
 * Hiển thị archive/unknown placeholder trong viewer
 */
export function showArchivePlaceholder(index) {
  const textEditorContainer = document.getElementById('textEditorContainer');
  if (textEditorContainer) textEditorContainer.style.display = 'none';
  document.getElementById('pdfCanvas').style.display = 'none';

  const pagesSidebar = document.getElementById('pagesSidebar');
  if (pagesSidebar) pagesSidebar.style.display = 'none';

  const pdfWrapper = document.getElementById('pdfWrapper');
  if (pdfWrapper) {
    pdfWrapper.classList.add('pdf-wrapper--archive-mode');

    let placeholder = document.getElementById('archivePlaceholder');
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.id = 'archivePlaceholder';
      pdfWrapper.appendChild(placeholder);
    }

    const fileName = appState.files[index]?.name || 'Archive';
    const fileExt = fileName.split('.').pop().toUpperCase();
    placeholder.innerHTML = `
      <div class="archive-icon">📦</div>
      <div class="archive-name">${escapeHTML(fileName)}</div>
      <div class="archive-hint">File ${fileExt} - Click phải để giải nén</div>
    `;
    placeholder.style.display = 'block';
  }
}

/**
 * Load image content: memory → Server LAN → Cloud Storage
 */
export async function loadImageContent(curFile) {
  const textEditorContainer = document.getElementById('textEditorContainer');
  if (textEditorContainer) textEditorContainer.style.display = 'none';
  document.getElementById('pdfCanvas').style.display = 'block';

  const pagesSidebar = document.getElementById('pagesSidebar');
  if (pagesSidebar) pagesSidebar.style.display = 'none';

  // Load image: memory → Server LAN → Storage
  if (curFile.base64) {
    if (appState.currentFile?.id !== curFile.id) return;
    await loadImageFromBase64(curFile.base64, curFile.name, true);
    return;
  } else if (window.ServerFile) {
    const serverData = await window.ServerFile.tryLoadBinary(appState.messageId, curFile.name);
    if (appState.currentFile?.id !== curFile.id) return;
    if (serverData) {
      curFile.base64 = serverData.base64;
      curFile.mimeType = curFile.mimeType ?? 'image/jpeg';
      await loadImageFromBase64(serverData.base64, curFile.name, true);
      console.log('[ServerFile] Image loaded from server:', curFile.name);
    }
  }
  // Fallback: Fetch from Cloud Storage
  if (!curFile.base64 && curFile.downloadUrl) {
    const response = await getAuthFetch()(curFile.downloadUrl);
    if (appState.currentFile?.id !== curFile.id) return;
    if (!response.ok) throw new Error(`Cloud Storage fetch failed: ${response.status}`);
    const blob = await response.blob();
    if (appState.currentFile?.id !== curFile.id) return;
    const dataURL = await readFileAs(blob, 'dataURL');
    if (appState.currentFile?.id !== curFile.id) return;
    curFile.base64 = dataURL.split(',')[1];
    curFile.mimeType = blob.type ?? 'image/jpeg';
    await loadImageFromBase64(curFile.base64, curFile.name, true);
  }
  if (!curFile.base64) {
    throw new Error('Không có nguồn dữ liệu. File cần được sync từ Cloud Storage trước.');
  }
}

/**
 * Load text file content
 */
export async function loadTextContent() {
  const pagesSidebar = document.getElementById('pagesSidebar');
  if (pagesSidebar) pagesSidebar.style.display = 'none';

  if (typeof window.loadText === 'function') {
    await window.loadText(appState.currentFile, true);
  } else {
    console.error('[FileManager] loadText function not available');
  }
}

/**
 * Load PDF content: memory → Server LAN → Cloud Storage
 * pdf.js transfers ArrayBuffer to worker → buffer bị detached sau lần load đầu
 */
export async function loadPdfContent(curFile) {
  const textEditorContainer = document.getElementById('textEditorContainer');
  if (textEditorContainer) textEditorContainer.style.display = 'none';
  document.getElementById('pdfCanvas').style.display = 'block';

  let pdfLoaded = false;
  if (curFile.originalPdfBytes) {
    try {
      const freshBytes = new Uint8Array(curFile.originalPdfBytes);
      if (appState.currentFile?.id !== curFile.id) return;
      await loadPDFFromArrayBuffer(freshBytes.buffer, curFile.name, true);
      if (appState.currentFile?.id !== curFile.id) return; // race-guard sau await
      pdfLoaded = true;
    } catch (bufferErr) {
      console.warn('[FileManager] Buffer detached, will re-fetch from Storage:', bufferErr.message);
    }
  }
  // Priority: Đọc từ Server LAN (Electron only)
  if (!pdfLoaded && window.ServerFile) {
    const serverData = await window.ServerFile.tryLoadBinary(appState.messageId, curFile.name);
    if (appState.currentFile?.id !== curFile.id) return;
    if (serverData) {
      const pdfBytes = base64ToUint8Array(serverData.base64);
      curFile.originalPdfBytes = pdfBytes;
      curFile.type = window.FILE_TYPES.PDF;
      const freshBytes = new Uint8Array(pdfBytes);
      await loadPDFFromArrayBuffer(freshBytes.buffer, curFile.name, true);
      if (appState.currentFile?.id !== curFile.id) return; // race-guard sau await
      pdfLoaded = true;
      console.log('[ServerFile] PDF loaded from server:', curFile.name);
    }
  }
  if (!pdfLoaded && curFile.downloadUrl) {
    const response = await getAuthFetch()(curFile.downloadUrl);
    if (appState.currentFile?.id !== curFile.id) return;
    if (!response.ok) throw new Error(`Cloud Storage fetch failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    if (appState.currentFile?.id !== curFile.id) return;
    const pdfBytes = new Uint8Array(arrayBuffer);
    curFile.originalPdfBytes = pdfBytes;
    curFile.type = window.FILE_TYPES.PDF;
    const freshBytes = new Uint8Array(pdfBytes);
    await loadPDFFromArrayBuffer(freshBytes.buffer, curFile.name, true);
    if (appState.currentFile?.id !== curFile.id) return; // race-guard sau await
  } else if (!pdfLoaded) {
    throw new Error('Không có nguồn dữ liệu. File cần được sync từ Cloud Storage trước.');
  }
}
