/**
 * File Upload Module
 * Handles adding local files (PDF, image), clipboard paste, shared upload helpers
 */

import { getFileCategory, getSourceFromFilename, isFileNameDuplicate, displayLocalFileList, switchToLocalFile } from './file-core.js';

// ============================================
// SHARED HELPERS
// ============================================

/**
 * Create base file data structure with common fields
 * @param {string} name - File name
 * @param {string} type - File type (from FILE_TYPES)
 * @param {string} mimeType - MIME type
 * @param {number} size - File size in bytes
 * @param {Object} extraFields - Type-specific fields to merge
 * @returns {Object} File data object
 */
export function createBaseFileData(name, type, mimeType, size, extraFields = {}) {
  return {
    id: generateUUID(),
    name: name,
    type: type,
    mimeType: mimeType,
    size: size,
    source: getSourceFromFilename(name),
    pageCount: 1,
    numPages: 1,
    originalWidth: null,
    originalHeight: null,
    lastPage: 1,
    lastScale: null,
    tags: [],
    pageTags: {},
    isLocal: true,
    updatedAt: Date.now(),
    updatedBy: window.FirebaseSync?.getUserIdentifier?.() || 'anonymous',
    ...extraFields
  };
}

/**
 * Finalize file addition: push to state, update UI, sync to Firebase
 * @param {Object} fileData - File data object
 * @param {string} logMessage - Console log message
 */
export async function finalizeFileAddition(fileData, logMessage) {
  appState.files.push(fileData);

  displayLocalFileList();
  await switchToLocalFile(appState.files.length - 1);

  const fileManager = document.getElementById('fileManagerHorizontal');
  if (fileManager) {
    fileManager.style.display = 'flex';
  }

  // File chỉ lưu RAM, đợi Ctrl+S mới upload Storage + ghi RTDB
  return true;
}

/**
 * Read file using FileReader with specified method
 * @param {Blob} fileOrBlob - File or Blob to read
 * @param {'arrayBuffer'|'dataURL'|'text'} method - Read method
 * @returns {Promise<*>} File content
 */
export function readFileAs(fileOrBlob, method) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    if (method === 'arrayBuffer') reader.readAsArrayBuffer(fileOrBlob);
    else if (method === 'dataURL') reader.readAsDataURL(fileOrBlob);
    else if (method === 'text') reader.readAsText(fileOrBlob, 'UTF-8');
  });
}

/**
 * Load image from base64 and get dimensions
 * @param {string} base64 - Base64 image data
 * @param {string} mimeType - Image MIME type
 * @returns {Promise<HTMLImageElement>}
 */
function createImageElement(base64, mimeType) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `data:${mimeType};base64,${base64}`;
  });
}

// ============================================
// ADD LOCAL FILE (dispatcher)
// ============================================

/**
 * Add local file to the application
 * Supports PDF, image, text, and archive files
 * @param {File} file - File object from input or drag/drop
 */
export async function addLocalFile(file) {
  const category = getFileCategory(file);

  if (!category) {
    console.warn('[LocalFile] Unsupported file type:', file.type);
    alert(`File không được hỗ trợ: ${file.name}\n\nChỉ hỗ trợ: PDF, JPG, PNG, GIF, WebP, TXT, ZIP, RAR, 7z`);
    return false;
  }

  // Duplicate check chung cho tất cả loại file
  if (isFileNameDuplicate(file.name)) {
    alert(`File "${file.name}" đã tồn tại trong session này.\nVui lòng đổi tên file trước khi upload.`);
    console.warn(`[LocalFile] Duplicate filename rejected: ${file.name}`);
    return false;
  }

  try {
    if (category === 'pdf') return await addLocalPDFFile(file);
    else if (category === 'text') {
      const { addLocalTextFile } = await import('./file-upload-handlers.js');
      return await addLocalTextFile(file);
    }
    else if (category === 'archive') {
      const { addLocalArchiveFile } = await import('./file-upload-handlers.js');
      return await addLocalArchiveFile(file);
    }
    else return await addLocalImageFile(file);
  } catch (error) {
    console.error('[LocalFile] Error adding file:', error);
    alert(`Lỗi khi thêm file ${file.name}: ${error.message}`);
    return false;
  }
}

// ============================================
// ADD FILE BY TYPE
// ============================================

export async function addLocalPDFFile(file) {
  showLoading(`Đang xử lý PDF: ${file.name}...`);

  try {
    const arrayBuffer = await readFileAs(file, 'arrayBuffer');
    // CRITICAL: Tạo bản sao THỰC SỰ của ArrayBuffer (không phải VIEW)
    const originalBytes = new Uint8Array(arrayBuffer.slice(0));

    const fileData = createBaseFileData(file.name, window.FILE_TYPES.PDF, 'application/pdf', file.size, {
      file: file,
      arrayBuffer: arrayBuffer,
      originalPdfBytes: originalBytes,
    });

    return await finalizeFileAddition(fileData, `[LocalFile] Added PDF: ${file.name}`);
  } finally {
    hideLoading();
  }
}

export async function addLocalImageFile(file) {
  showLoading(`Đang xử lý ảnh: ${file.name}...`);

  try {
    const dataURL = await readFileAs(file, 'dataURL');
    const base64 = dataURL.split(',')[1];
    const img = await createImageElement(base64, file.type);

    const fileData = createBaseFileData(file.name, window.FILE_TYPES.IMAGE, file.type ?? 'image/jpeg', file.size, {
      base64: base64,
      imageObject: img,
      originalWidth: img.width,
      originalHeight: img.height,
    });

    return await finalizeFileAddition(fileData, `[LocalFile] Added Image: ${file.name} (${img.width}x${img.height})`);
  } finally {
    hideLoading();
  }
}

/**
 * Add image from clipboard (paste event)
 * @param {Blob} blob - Image blob from clipboard
 * @param {string} mimeType - Image MIME type
 */
export async function addImageFromClipboard(blob, mimeType) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const extension = mimeType.split('/')[1] || 'png';
  const fileName = `Screenshot_${timestamp}.${extension}`;

  showLoading(`Đang xử lý ảnh từ clipboard...`);

  try {
    const dataURL = await readFileAs(blob, 'dataURL');
    const base64 = dataURL.split(',')[1];
    const img = await createImageElement(base64, mimeType);

    const fileData = createBaseFileData(fileName, window.FILE_TYPES.IMAGE, mimeType, blob.size, {
      base64: base64,
      imageObject: img,
      originalWidth: img.width,
      originalHeight: img.height,
      isFromClipboard: true,
    });

    return await finalizeFileAddition(fileData, `[Clipboard] Added Image: ${fileName} (${img.width}x${img.height})`);
  } catch (error) {
    console.error('[Clipboard] Error adding image:', error);
    alert(`Lỗi khi thêm ảnh từ clipboard: ${error.message}`);
    return false;
  } finally {
    hideLoading();
  }
}
