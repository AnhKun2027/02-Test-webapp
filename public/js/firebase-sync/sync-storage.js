/**
 * Firebase Storage upload/delete operations
 * Extracted from firebase-sync.js
 */

import { state, getUserIdentifier } from './sync-core.js';
const { isPdfFile, isTextFile, isImageFile } = window;

/**
 * Retry async fn với exponential backoff. Private helper — chỉ dùng cho upload Storage
 * (caller duy nhất). Đã từng nằm ở sync-core nhưng không có user thứ 2.
 */
async function _retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    operation = 'operation',
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        console.error(`[Retry] ${operation} failed after ${maxRetries + 1} attempts:`, error.message);
        throw error;
      }

      const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
      console.warn(`[Retry] ${operation} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * Upload selection image to Firebase Storage
 * Path: {sessionId}/selections/{selectionId}.png
 * @param {string} selectionId - UUID of the selection
 * @param {string} base64Data - Base64 data URL (data:image/png;base64,...)
 * @returns {Promise<string>} - Download URL from Firebase Storage
 */
export async function uploadSelectionToStorage(selectionId, base64Data) {
  if (!window.firebaseStorageCheckcongviec || !state.sessionId) {
    throw new Error('Firebase Storage not initialized');
  }

  if (!base64Data || !base64Data.startsWith('data:image')) {
    throw new Error('Invalid base64 image data');
  }

  const storagePath = `${state.sessionId}/selections/${selectionId}.png`;
  const storageReference = window.firebaseStorageRef(window.firebaseStorageCheckcongviec, storagePath);

  const response = await fetch(base64Data);
  const blob = await response.blob();

  await window.firebaseUploadBytes(storageReference, blob);

  const encodedPath = encodeURIComponent(storagePath);
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/checkcongviec/o/${encodedPath}?alt=media`;

  return downloadUrl;
}

/**
 * Xoa file tu Firebase Storage theo subfolder
 * @param {string} subfolder - 'selections' hoac 'imageOverlays'
 * @param {string} itemId - UUID cua item
 * @returns {Promise<boolean>} - True neu xoa thanh cong
 */
export async function deleteFromStorage(subfolder, itemId) {
  if (!window.firebaseStorageCheckcongviec || !state.sessionId) {
    console.warn('[FirebaseSync] Storage not initialized, skip deletion');
    return false;
  }

  const storagePath = `${state.sessionId}/${subfolder}/${itemId}.png`;
  const storageReference = window.firebaseStorageRef(window.firebaseStorageCheckcongviec, storagePath);

  try {
    if (window.firebaseDeleteObject) {
      await window.firebaseDeleteObject(storageReference);
      return true;
    } else {
      console.warn('[FirebaseSync] deleteObject not available');
      return false;
    }
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      console.log(`[FirebaseSync] ${subfolder} not in Storage (old data): ${itemId}`);
      return false;
    }
    console.error(`[FirebaseSync] Error deleting ${subfolder}:`, error);
    return false;
  }
}

export async function deleteSelectionFromStorage(selectionId) {
  return deleteFromStorage('selections', selectionId);
}

/**
 * Upload image overlay to Firebase Storage
 * Path: {sessionId}/imageOverlays/{overlayId}.png
 * @param {string} overlayId - UUID of the overlay
 * @param {string} base64Data - Base64 data URL (data:image/png;base64,...)
 * @returns {Promise<string>} - Download URL from Firebase Storage
 */
export async function uploadImageOverlayToStorage(overlayId, base64Data) {
  if (!window.firebaseStorageCheckcongviec || !state.sessionId) {
    throw new Error('Firebase Storage not initialized');
  }

  if (!base64Data || !base64Data.startsWith('data:image')) {
    throw new Error('Invalid base64 image data');
  }

  const storagePath = `${state.sessionId}/imageOverlays/${overlayId}.png`;
  const storageReference = window.firebaseStorageRef(window.firebaseStorageCheckcongviec, storagePath);

  try {
    const base64String = base64Data.split(',')[1];

    if (!window.firebaseUploadString) {
      throw new Error('uploadString not available');
    }

    const uploadSnapshot = await window.firebaseUploadString(
      storageReference,
      base64String,
      'base64',
      { contentType: 'image/png' }
    );

    const downloadUrl = await window.firebaseGetDownloadURL(uploadSnapshot.ref);

    return downloadUrl;
  } catch (error) {
    console.error('[FirebaseSync] Error uploading image overlay:', error);
    throw error;
  }
}

export async function deleteImageOverlayFromStorage(overlayId) {
  return deleteFromStorage('imageOverlays', overlayId);
}

/**
 * Upload file to Firebase Storage
 * Path: {sessionId}/{originalFilename}
 * @param {Object} fileData - File data object
 * @returns {Promise<{storagePath, downloadUrl}>}
 */
export async function uploadFileToStorage(fileData) {
  if (!window.firebaseStorageCheckcongviec || !state.sessionId) {
    throw new Error('Firebase Storage (checkcongviec bucket) not initialized');
  }

  const storagePath = `${state.sessionId}/${fileData.name}`;
  const storageReference = window.firebaseStorageRef(window.firebaseStorageCheckcongviec, storagePath);

  let blob;
  if (isPdfFile(fileData) && fileData.originalPdfBytes) {
    blob = new Blob([fileData.originalPdfBytes], { type: 'application/pdf' });
  } else if (isTextFile(fileData) && (fileData.textBlob || fileData.textContent)) {
    blob = fileData.textBlob || new Blob([fileData.textContent], { type: 'text/plain' });
  } else if (fileData.base64) {
    const ia = window.base64ToUint8Array(fileData.base64);
    const mimeType = fileData.mimeType ||
                     (isImageFile(fileData) ? 'image/jpeg' : 'application/octet-stream');
    blob = new Blob([ia], { type: mimeType });
  } else if (fileData.arrayBuffer) {
    const mimeType = fileData.mimeType || 'application/octet-stream';
    blob = new Blob([fileData.arrayBuffer], { type: mimeType });
  } else {
    throw new Error('No file content to upload');
  }

  await _retryWithBackoff(
    () => window.firebaseUploadBytes(storageReference, blob),
    { maxRetries: 3, operation: `Upload ${fileData.name}` }
  );

  const encodedPath = encodeURIComponent(storagePath);
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/checkcongviec/o/${encodedPath}?alt=media`;

  return {
    storagePath,
    downloadUrl
  };
}

/**
 * Upload email attachment len Storage
 * Storage path: {sessionId}/emailAttachments/{tabKey}/{filename}
 */
export async function uploadEmailAttachmentToStorage(tabKey, fileObj) {
  if (!window.firebaseStorageCheckcongviec || !state.sessionId) {
    throw new Error('Firebase Storage not initialized');
  }

  const id = 'att_' + crypto.randomUUID().split('-')[0];
  const fileName = fileObj.name || 'untitled';

  const storagePath = `${state.sessionId}/emailAttachments/${tabKey}/${fileName}`;
  const storageReference = window.firebaseStorageRef(window.firebaseStorageCheckcongviec, storagePath);

  const response = await fetch(fileObj.data);
  const blob = await response.blob();
  const size = blob.size;

  await window.firebaseUploadBytes(storageReference, blob);

  const encodedPath = encodeURIComponent(storagePath);
  const url = `https://firebasestorage.googleapis.com/v0/b/checkcongviec/o/${encodedPath}?alt=media`;

  return {
    id,
    name: fileName,
    type: fileObj.type || '',
    isImage: !!fileObj.isImage,
    size,
    url,
    storage_path: storagePath,
    uploadedBy: getUserIdentifier(),
    uploadedAt: window.firebaseServerTimestamp ? window.firebaseServerTimestamp() : Date.now()
  };
}

