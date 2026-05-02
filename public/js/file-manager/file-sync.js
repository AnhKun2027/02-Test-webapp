/**
 * File Sync Module
 * Handles syncing local files with Firebase Storage and remote session sync
 */

import { displayLocalFileList, switchToLocalFile, removeFileByIndex } from './file-core.js';
import { createBaseFileData } from './file-upload.js';

// ============================================
// FIREBASE SYNC HELPERS FOR LOCAL FILES
// ============================================

/**
 * Upload local files lên Firebase Storage (chưa có downloadUrl)
 * Metadata sẽ được saveSessionSnapshot() ghi chung khi Ctrl+S
 */
export async function syncLocalFilesToFirebase() {
  if (!window.FirebaseSync || !window.FirebaseSync.sessionId) return;

  // Filter only local files that need to be uploaded (no downloadUrl yet)
  const localFilesToUpload = appState.files.filter(f =>
    f.isLocal === true && !f.downloadUrl && !f.isRemoteSynced
  );

  if (localFilesToUpload.length === 0) return;

  showLoading(`Uploading ${localFilesToUpload.length} files to Firebase Storage...`);

  // PARALLEL UPLOAD: All files upload simultaneously (much faster than sequential)
  // Each file uploads independently - no dependencies between files
  const uploadPromises = localFilesToUpload.map(async (fileData) => {
    try {
      // Prepare file data for upload
      const uploadData = {
        id: fileData.id,
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        mimeType: isPdfFile(fileData) ? 'application/pdf' :
                  isTextFile(fileData) ? 'text/plain' :
                  (fileData.mimeType || 'image/jpeg'),
        // Include content for upload - support all file types
        base64: fileData.base64 || null,
        originalPdfBytes: fileData.originalPdfBytes || null,
        textContent: fileData.textContent || null,  // For text files
        arrayBuffer: fileData.arrayBuffer || null,  // For archive files
        // Include metadata
        pageCount: fileData.pageCount || 1,
        originalWidth: fileData.originalWidth || null,
        originalHeight: fileData.originalHeight || null,
        tags: fileData.tags || [],
        pageTags: fileData.pageTags || {},
        // === SOURCE INFO (schema v3.0) ===
        source: fileData.source || 'local'
      };

      // Upload to Firebase Storage
      const storageInfo = await FirebaseSync.uploadFileToStorage(uploadData);

      // Cập nhật RAM — metadata sẽ được saveSessionSnapshot() ghi RTDB sau
      // Update file object with Storage info
      fileData.downloadUrl = storageInfo.downloadUrl;
      fileData.storagePath = storageInfo.storagePath;
      // Keep original source - don't overwrite 'gmail' with 'local'
      // fileData.source is already set in addLocalFile() based on origin

      return { success: true, name: fileData.name };
    } catch (error) {
      console.error(`[FileManager] Error uploading ${fileData.name}:`, error);
      return { success: false, name: fileData.name, error: error.message };
    }
  });

  try {
    // Wait for ALL uploads to complete
    const results = await Promise.all(uploadPromises);

    // Log upload thất bại (không nuốt im lặng)
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.error('[FileSync] Upload failed:', failed.map(r => `${r.name}: ${r.error}`));
    }
  } finally {
    hideLoading();
  }
}

// ============================================
// SYNC SESSION FILES (ADDITIONS + DELETIONS)
// ============================================

/**
 * Merge new files from remote session (Firebase)
 * When another user uploads a file, this function adds it locally
 *
 * @param {Array} remoteFiles - Array of files from Firebase session
 */
export function mergeRemoteSessionFiles(remoteFiles) {
  if (!remoteFiles || !Array.isArray(remoteFiles)) return;

  // Dùng id làm key duy nhất (không dùng name — 2 file có thể trùng tên)
  const localFileIds = new Set(appState.files.map(f => f.id).filter(Boolean));

  let addedCount = 0;

  for (const remoteMeta of remoteFiles) {
    // Skip file đã tồn tại (check bằng id)
    if (remoteMeta.id && localFileIds.has(remoteMeta.id)) continue;

    // Determine file type - normalize to FILE_TYPES constants
    const ext = remoteMeta.name?.toLowerCase().split('.').pop() || '';
    let fileType = remoteMeta.type;
    if (!fileType || fileType === 'unknown') {
      if (ext === 'pdf') {
        fileType = 'pdf';
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
        fileType = 'image';
      } else {
        fileType = 'unknown';
      }
    }

    // Get download URL - Cloud Run uses 'url', webapp uses 'downloadUrl'
    const downloadUrl = remoteMeta.url || remoteMeta.downloadUrl;

    // Build qua createBaseFileData để giữ schema thống nhất (xem docs/DATABASE.md).
    // extraFields ghi đè các field remote-specific.
    const fileData = createBaseFileData(remoteMeta.name, fileType, remoteMeta.mimeType, remoteMeta.size || 0, {
      id: remoteMeta.id || crypto.randomUUID(),
      downloadUrl,
      storagePath: remoteMeta.storage_path || remoteMeta.storagePath,
      source: remoteMeta.source || 'storage',
      tags: remoteMeta.tags || [],
      pageTags: remoteMeta.pageTags || {},
      pageCount: remoteMeta.pageCount || 1,
      numPages: remoteMeta.pageCount || 1,
      originalWidth: remoteMeta.originalWidth || null,
      originalHeight: remoteMeta.originalHeight || null,
      isLocal: false,
      isRemoteSynced: true,
      needsContentLoad: true,
    });

    appState.files.push(fileData);
    addedCount++;

  }

  if (addedCount > 0) {
    displayLocalFileList();
  }
}

/**
 * Sync file deletions from remote (Firebase session files)
 * When another user deletes a file, this function removes it locally
 *
 * @param {Array} remoteFiles - Array of files from Firebase session
 */
export function syncFileDeletions(remoteFiles) {
  if (!remoteFiles) {
    remoteFiles = [];
  }

  // Dùng id làm key so sánh (không dùng name — 2 file có thể trùng tên)
  const remoteFileIds = new Set(remoteFiles.map(f => f.id).filter(Boolean));

  // Tìm file local không còn trong remote
  // Skip file đang upload (chưa sync lên Firebase)
  const filesToRemove = appState.files.filter(localFile => {
    if (localFile.isLocal === true && !localFile.downloadUrl && !localFile.isRemoteSynced) {
      return false;
    }
    return localFile.id && !remoteFileIds.has(localFile.id);
  });

  if (filesToRemove.length === 0) return;


  // Xóa từ cuối lên đầu để tránh lệch index
  // removeFileByIndex tự xử lý splice + currentFileIndex + switchFile + displayLocalFileList
  const indexesToRemove = filesToRemove
    .map(f => appState.files.findIndex(lf => lf.id === f.id))
    .filter(i => i !== -1)
    .sort((a, b) => b - a);

  for (const index of indexesToRemove) {
    removeFileByIndex(index);
  }
}

/**
 * Đồng bộ thứ tự file từ remote (user khác kéo đổi vị trí)
 * So sánh thứ tự id trong remote vs local, nếu khác thì sắp xếp lại
 *
 * @param {Array} remoteFiles - Array file từ RTDB (đã đúng thứ tự)
 */
export function syncFileOrder(remoteFiles) {
  if (!remoteFiles || !Array.isArray(remoteFiles) || remoteFiles.length === 0) return;

  // Lấy thứ tự id từ remote
  const remoteOrder = remoteFiles.map(f => f.id).filter(Boolean);
  // Lấy thứ tự id từ local (chỉ file đã sync, bỏ file local chưa upload)
  const localSynced = appState.files.filter(f => !f.isLocal || f.downloadUrl || f.isRemoteSynced);
  const localOrder = localSynced.map(f => f.id).filter(Boolean);

  // So sánh nhanh — nếu giống nhau thì không làm gì
  if (remoteOrder.length === localOrder.length &&
      remoteOrder.every((id, i) => id === localOrder[i])) {
    return;
  }

  // Tách file local chưa upload (giữ nguyên ở cuối)
  const localOnlyFiles = appState.files.filter(f => f.isLocal && !f.downloadUrl && !f.isRemoteSynced);

  // Sắp xếp file synced theo thứ tự remote
  const idToFile = new Map(appState.files.map(f => [f.id, f]));
  const reordered = [];
  for (const remoteId of remoteOrder) {
    if (idToFile.has(remoteId)) {
      reordered.push(idToFile.get(remoteId));
    }
  }
  // File synced có trong local nhưng không có trong remote (edge case) → giữ cuối
  for (const f of localSynced) {
    if (!remoteOrder.includes(f.id)) {
      reordered.push(f);
    }
  }

  // Gộp lại: file đã sync (theo thứ tự remote) + file local chưa upload
  appState.files = [...reordered, ...localOnlyFiles];

  displayLocalFileList();
}
