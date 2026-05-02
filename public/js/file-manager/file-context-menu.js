/**
 * File Context Menu Module
 * Click phải file → hiện menu xóa, giải nén
 */

import { displayLocalFileList, switchToLocalFile, removeFileByIndex } from './file-core.js';

// ============================================
// STATE
// ============================================

// File đang được click phải
let contextMenuTarget = null;

// ============================================
// SHOW / HIDE
// ============================================

/**
 * Show context menu at mouse position
 * @param {MouseEvent} e - Mouse event
 * @param {number} fileIndex - Index of file in appState.files
 * @param {Object} fileData - File data object
 */
export function showFileContextMenu(e, fileIndex, fileData) {
  const contextMenu = document.getElementById('fileContextMenu');
  if (!contextMenu) return;

  // Store target for delete action
  contextMenuTarget = { fileIndex, fileData };

  // Show/hide "Giải nén" option based on file type
  const extractBtn = document.getElementById('contextMenuExtract');
  if (extractBtn) {
    extractBtn.style.display = isArchiveFile(fileData) ? 'flex' : 'none';
  }

  // Show menu first to get dimensions
  contextMenu.classList.add('show');
  const menuRect = contextMenu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;

  // Position menu ABOVE cursor (file manager is at bottom of screen)
  let menuTop = e.clientY - menuRect.height;

  // If menu would go above viewport, show below cursor instead
  if (menuTop < 0) {
    menuTop = e.clientY;
  }

  // Horizontal position - adjust if goes off right edge
  let menuLeft = e.clientX;
  if (e.clientX + menuRect.width > viewportWidth) {
    menuLeft = e.clientX - menuRect.width;
  }

  contextMenu.style.left = `${menuLeft}px`;
  contextMenu.style.top = `${menuTop}px`;
}

/**
 * Hide context menu
 */
export function hideFileContextMenu() {
  const contextMenu = document.getElementById('fileContextMenu');
  if (contextMenu) {
    contextMenu.classList.remove('show');
  }
  contextMenuTarget = null;
}

// ============================================
// ACTIONS
// ============================================

/**
 * Xóa file khỏi RAM. Storage + RTDB sẽ được xử lý khi bấm Ctrl+S
 */
export function deleteFileFromContextMenu() {
  if (!contextMenuTarget) return;

  const { fileData } = contextMenuTarget;

  // Tìm lại index bằng id (tránh stale index do sync thay đổi mảng)
  const fileIndex = appState.files.findIndex(f => f.id === fileData.id);
  if (fileIndex === -1) {
    hideFileContextMenu();
    return;
  }

  // Confirm deletion
  const confirmed = confirm(`Bạn có chắc muốn xóa file "${fileData.name}"?\n\nFile sẽ bị xóa khỏi Cloud khi bạn bấm Ctrl+S.`);
  if (!confirmed) {
    hideFileContextMenu();
    return;
  }

  // 1. Track file cần xóa Storage khi Ctrl+S (chỉ file đã có storagePath)
  const storagePath = fileData.storagePath;
  if (storagePath) {
    window.pendingFileDeletes.push({
      id: fileData.id,
      storagePath: storagePath,
      name: fileData.name
    });
  }

  // 2. Xóa bitmap cache và thumbnail cache của file này
  if (typeof window.invalidateBitmapCache === 'function') {
    window.invalidateBitmapCache(fileData.id);
  }
  if (typeof window.invalidateThumbnailCache === 'function') {
    window.invalidateThumbnailCache(fileData.id);
  }

  // 3. Xóa file khỏi RAM + cập nhật UI (helper chung)
  removeFileByIndex(fileIndex);

  hideFileContextMenu();
}

/**
 * Extract archive file from context menu
 */
export async function extractArchiveFromContextMenu() {
  if (!contextMenuTarget) return;

  const { fileIndex, fileData } = contextMenuTarget;
  hideFileContextMenu();

  // Check if file has downloadUrl (from Cloud Storage)
  if (!fileData.downloadUrl) {
    alert('File chưa được upload lên Cloud Storage.\nVui lòng đợi file sync xong rồi thử lại.');
    return;
  }

  if (typeof showLoading === 'function') showLoading('Đang giải nén file...');

  try {
    // Gọi Cloud Function qua ApiClient (tự xử lý URL + error)
    const data = await window.ApiClient.callCloudFunction('unzipArchive', { url: fileData.downloadUrl });

    if (!data.success) {
      throw new Error(data.error || 'Giải nén thất bại');
    }

    // Add extracted files to app
    const { addLocalFile } = await import('./file-upload.js');
    let addedCount = 0;
    for (let i = 0; i < data.files.length; i++) {
      const extractedFile = data.files[i];

      if (typeof showLoading === 'function') {
        showLoading(`Đang thêm: ${extractedFile.name} (${i + 1}/${data.files.length})...`);
      }

      try {
        // Convert base64 → Uint8Array → File
        const byteArray = window.base64ToUint8Array(extractedFile.base64);
        const blob = new Blob([byteArray], { type: extractedFile.mimeType });
        const fileObj = new File([blob], extractedFile.name, { type: extractedFile.mimeType });

        await addLocalFile(fileObj);
        addedCount++;
      } catch (fileError) {
        console.error(`[Extract] Error adding ${extractedFile.name}:`, fileError);
      }
    }

    alert(`✅ Đã giải nén ${addedCount}/${data.extracted_count} files từ "${data.archive_name}"`);

  } catch (error) {
    console.error('[Extract] Error:', error);
    alert('Lỗi giải nén: ' + error.message);
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}

// ============================================
// INIT LISTENERS
// ============================================

/**
 * Initialize context menu event listeners
 * Called once when module loads
 */
export function initContextMenuListeners() {
  // Named handlers (để cleanup trong destroy)
  function handleClickOutside(e) {
    const contextMenu = document.getElementById('fileContextMenu');
    if (contextMenu && !contextMenu.contains(e.target)) {
      hideFileContextMenu();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      hideFileContextMenu();
    }
  }

  // Hide context menu when clicking elsewhere
  document.addEventListener('click', handleClickOutside);

  // Hide context menu on scroll
  document.addEventListener('scroll', hideFileContextMenu, true);

  // Hide context menu on Escape key
  document.addEventListener('keydown', handleKeydown);

  // Add click handler to delete menu item
  const deleteBtn = document.getElementById('contextMenuDelete');
  if (deleteBtn) {
    deleteBtn.onclick = deleteFileFromContextMenu;
  }

  // Add click handler to extract menu item
  const extractBtn = document.getElementById('contextMenuExtract');
  if (extractBtn) {
    extractBtn.onclick = extractArchiveFromContextMenu;
  }

  // Return destroy function for cleanup
  return function destroy() {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('scroll', hideFileContextMenu, true);
    document.removeEventListener('keydown', handleKeydown);
    if (deleteBtn) deleteBtn.onclick = null;
    if (extractBtn) extractBtn.onclick = null;
  };
}
