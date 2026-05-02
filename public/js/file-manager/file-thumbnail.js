/**
 * File Thumbnail Module
 * Tạo thumbnail cho file trong file list (image + PDF)
 */

import { getAuthFetch } from './file-constants.js';
import { readFileAs } from './file-upload.js';

// ============================================
// HELPERS
// ============================================

// pageRotations key cho thumbnail (page = 1 của file)
const THUMB_PAGE_KEY = (id) => `${id}_1`;

/**
 * Lưu thumbnail URL và rotation vào fileData (dùng chung cho image + PDF)
 */
function _storeThumbnailState(fileData, thumbnailUrl) {
  fileData.thumbnailUrl = thumbnailUrl;
  fileData.thumbnailRotation = window.pageRotations?.[THUMB_PAGE_KEY(fileData.id)] ?? 0;
}

/**
 * Lấy MIME type cho thumbnail từ extension
 */
function getImageMimeFromExt(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext;
}

// ============================================
// IMAGE THUMBNAIL
// ============================================

/**
 * Tạo thumbnail cho file ảnh (từ base64 hoặc Cloud Storage)
 * @returns {Promise<string|null>} thumbnailUrl hoặc null
 */
async function generateImageThumbnail(fileData) {
  if (fileData.base64) {
    const mimeType = getImageMimeFromExt(fileData.name);
    const thumbnailUrl = `data:image/${mimeType};base64,${fileData.base64}`;
    _storeThumbnailState(fileData, thumbnailUrl);
    return thumbnailUrl;
  }

  if (!fileData.downloadUrl) return null;

  try {
    const response = await getAuthFetch()(fileData.downloadUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const blob = await response.blob();

    const dataURL = await readFileAs(blob, 'dataURL');

    const base64 = dataURL.split(',')[1];
    fileData.base64 = base64;
    fileData.mimeType = blob.type || 'image/jpeg';
    const mimeType = getImageMimeFromExt(fileData.name);
    const thumbnailUrl = `data:image/${mimeType};base64,${base64}`;
    _storeThumbnailState(fileData, thumbnailUrl);
    return thumbnailUrl;
  } catch (error) {
    console.error('[Thumbnail] Error fetching image:', error);
    return null;
  }
}

// ============================================
// PDF THUMBNAIL
// ============================================

/**
 * Load PDF document từ các nguồn (cache, arrayBuffer, bytes, URL)
 * Clone buffer để tránh "detached ArrayBuffer" error từ PDF.js Web Worker
 */
async function loadPdfDocForThumbnail(fileData) {
  if (fileData.pdfDocument) return fileData.pdfDocument;

  if (fileData.arrayBuffer) {
    try {
      return await pdfjsLib.getDocument({ data: fileData.arrayBuffer.slice(0) }).promise;
    } catch (error) {
      console.error('[Thumbnail] Error loading PDF from arrayBuffer:', error);
      return null;
    }
  }

  if (fileData.originalPdfBytes) {
    try {
      return await pdfjsLib.getDocument({ data: new Uint8Array(fileData.originalPdfBytes) }).promise;
    } catch (error) {
      console.error('[Thumbnail] Error loading PDF from originalPdfBytes:', error);
      return null;
    }
  }

  if (fileData.downloadUrl) {
    try {
      const response = await getAuthFetch()(fileData.downloadUrl);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const pdfBytes = new Uint8Array(await response.arrayBuffer());
      fileData.originalPdfBytes = pdfBytes;
      fileData.type = window.FILE_TYPES.PDF;
      return await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
    } catch (error) {
      console.error('[Thumbnail] Error fetching PDF:', error);
    }
  }

  return null;
}

/**
 * Render trang 1 PDF thành thumbnail, scale giữ tỷ lệ fit vào maxSize
 * @returns {Promise<string>} thumbnailUrl
 */
async function renderPdfPageThumbnail(pdfDoc, fileData) {
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: APP_CONSTANTS.THUMBNAIL.PDF_VIEWPORT_SCALE });

  const maxSize = APP_CONSTANTS.THUMBNAIL.MAX_SIZE;
  let width = viewport.width;
  let height = viewport.height;

  if (width > height) {
    if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
  } else {
    if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);

  await page.render({
    canvasContext: canvas.getContext('2d'),
    viewport: page.getViewport({ scale: width / viewport.width })
  }).promise;

  const thumbnailUrl = canvas.toDataURL('image/png');
  _storeThumbnailState(fileData, thumbnailUrl);

  // Giải phóng GPU memory của canvas + cleanup page operator list
  canvas.width = 0;
  canvas.height = 0;
  page.cleanup();

  if (!fileData.pdfDocument && pdfDoc) pdfDoc.destroy();
  return thumbnailUrl;
}

/**
 * Tạo thumbnail cho file PDF (ưu tiên reuse sidebar thumbnail)
 * @returns {Promise<string|null>} thumbnailUrl hoặc null
 */
async function generatePdfThumbnail(fileData) {
  const thumbnailList = document.getElementById('thumbnailList');
  if (fileData === appState.currentFile && thumbnailList) {
    const firstThumbnail = thumbnailList.querySelector('[data-page="1"] canvas');
    if (firstThumbnail) {
      _storeThumbnailState(fileData, firstThumbnail.toDataURL('image/png'));
      return fileData.thumbnailUrl;
    }
  }

  const pdfDoc = await loadPdfDocForThumbnail(fileData);
  if (!pdfDoc) {
    console.error('[Thumbnail] No PDF document for:', fileData.name);
    return null;
  }

  try {
    return await renderPdfPageThumbnail(pdfDoc, fileData);
  } catch (error) {
    console.error('[Thumbnail] Render failed for:', fileData.name, error);
    return null;
  }
}

// ============================================
// DISPATCHER (export chính)
// ============================================

/**
 * Generate thumbnail cho file (dispatcher chính)
 * Được gọi từ createFileItemElement() trong file-core.js
 */
export async function generateFileThumbnail(fileData, callback) {
  try {
    if (fileData.thumbnailUrl) { callback(fileData.thumbnailUrl); return; }

    const isUnknown = fileData.type === 'unknown' && !isArchiveFile(fileData);
    if (isArchiveFile(fileData) || isUnknown) { callback(null); return; }

    let thumbnailUrl = null;
    if (isImageFile(fileData)) {
      thumbnailUrl = await generateImageThumbnail(fileData);
    } else if (isPdfFile(fileData)) {
      thumbnailUrl = await generatePdfThumbnail(fileData);
    }
    callback(thumbnailUrl);
  } catch (error) {
    console.error('[Thumbnail] Failed for:', fileData?.name, error);
    callback(null);
  }
}
