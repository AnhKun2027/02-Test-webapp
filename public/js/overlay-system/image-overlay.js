/**
 * Image Overlay Module
 * Handles image overlays: add, render, remove, drag/resize, upload pending
 */

import { generateUUID } from '../core-utils.js';
import { updateRotateButtonState } from '../page-utils.js';
import {
  ensureOverlaysVisible,
  getOverlayKey,
  deselectAllOverlays,
  calcOverlayCenterPosition,
  OVERLAY_CONSTANTS
} from './overlay-shared.js';
import { makeOverlayDraggable, makeOverlayResizable } from './overlay-drag-resize.js';
import { showOverlayContextMenu } from './overlay-context-menu.js';

// ============================================
// IMAGE OVERLAY FUNCTIONS
// ============================================

/**
 * Thêm image overlay từ Blob/File (staging - CHƯA lưu RTDB)
 * Dùng chung cho cả file picker và clipboard paste
 * @param {Blob|File} blob - Blob ảnh (File cũng là Blob)
 */
export async function addImageOverlayFromBlob(blob) {
  if (!window.appState.currentFile) {
    alert('Vui lòng mở file PDF/ảnh trước khi thêm overlay!');
    return false;
  }

  let dataUrl, img;
  try {
    dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
  } catch (error) {
    console.error('[Overlay] Lỗi đọc ảnh:', error);
    alert(`Lỗi khi đọc ảnh: ${error.message}`);
    return false;
  }

  // Tính kích thước (max width, giữ tỷ lệ)
  const maxWidth = OVERLAY_CONSTANTS.MAX_IMAGE_WIDTH;
  let width = img.width;
  let height = img.height;
  if (width > maxWidth) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * ratio);
  }

  const { x, y } = calcOverlayCenterPosition(width, height);
  const overlayId = generateUUID();

  const overlayData = {
    id: overlayId,
    fileId: window.appState.currentFile.id,
    imageUrl: dataUrl,
    x, y, width, height,
    originalWidth: img.width,
    originalHeight: img.height,
    scale: window.appState.scale,
    page: window.appState.currentPage,
    _pending: true
  };

  const key = getOverlayKey();
  if (!window.imageOverlays[key]) window.imageOverlays[key] = [];
  window.imageOverlays[key].push(overlayData);

  ensureOverlaysVisible();
  renderImageOverlay(overlayData);

  updateRotateButtonState();

  return true;
}

// Wrapper cho clipboard paste — giữ semantic naming, có caller bên ngoài
// (overlay-paste.js import; file-upload-handlers.js qua window).
export async function addImageOverlayFromClipboard(blob) {
  return addImageOverlayFromBlob(blob);
}

/**
 * Lưu tất cả overlay đang chờ vào Storage + RTDB
 */
export async function uploadPendingImageOverlays() {
  let savedCount = 0;

  for (const overlays of Object.values(window.imageOverlays)) {
    for (const overlay of overlays) {
      if (!overlay._pending) continue;

      try {
        if (window.FirebaseSync?.sessionId) {
          const storageUrl = await window.FirebaseSync.uploadImageOverlayToStorage(overlay.id, overlay.imageUrl);
          overlay.imageUrl = storageUrl;
          delete overlay._pending;
          savedCount++;
        }
      } catch (err) {
        console.error(`[Overlay] Lỗi upload overlay ${overlay.id}:`, err);
      }
    }
  }

  if (savedCount > 0) console.log(`[Overlay] Đã upload ${savedCount} overlay lên Storage`);
}

/**
 * Xử lý khi user chọn file ảnh từ nút staging
 * @param {FileList} files - Danh sách file từ input
 */
export async function handleOverlayFiles(files) {
  if (!files || files.length === 0) return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    await addImageOverlayFromBlob(file);
  }
}

/**
 * Render a single image overlay element
 * Luôn tạo mới — DOM cũ đã được xóa bởi renderOverlaysForCurrentPage()
 */
export function renderImageOverlay(overlayData) {
  const selectionOverlay = document.getElementById('selectionOverlay');
  if (!selectionOverlay) return;

  const appState = window.appState;
  const scaleRatio = appState.scale / (overlayData.scale || appState.scale);

  const container = document.createElement('div');
  container.className = 'image-overlay-item';
  if (!window.isSelBoxesVisible) container.style.display = 'none';
  container.id = `overlay-${overlayData.id}`;

  container.setAttribute('data-file-id', overlayData.fileId || '');
  container.setAttribute('data-page', overlayData.page);

  container.style.left = `${overlayData.x * scaleRatio}px`;
  container.style.top = `${overlayData.y * scaleRatio}px`;
  container.style.width = `${overlayData.width * scaleRatio}px`;
  container.style.height = `${overlayData.height * scaleRatio}px`;

  // Create image - support both new Storage URL and old base64
  const img = document.createElement('img');
  img.src = overlayData.imageUrl || overlayData.dataUrl;  // New: imageUrl from Storage, fallback to old dataUrl
  img.alt = 'Overlay image';

  // Resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'image-overlay-resize';

  // Append elements
  container.appendChild(img);
  container.appendChild(resizeHandle);
  selectionOverlay.appendChild(container);

  makeOverlayDraggable(container, overlayData, false);
  makeOverlayResizable(container, resizeHandle, overlayData, false);

  // Click to select
  container.onmousedown = (e) => {
    if (e.target === resizeHandle) return;

    deselectAllOverlays();

    container.classList.add('selected');
  };

  // Right-click context menu
  container.oncontextmenu = (e) => {
    showOverlayContextMenu(e, 'image', overlayData, container);
  };
}

/**
 * Remove an image overlay
 */
export async function removeImageOverlay(overlayId) {
  const element = document.getElementById(`overlay-${overlayId}`);
  if (element) {
    element.remove();
  }

  const key = getOverlayKey();
  if (window.imageOverlays[key]) {
    window.imageOverlays[key] = window.imageOverlays[key].filter(o => o.id !== overlayId);
  }

  updateRotateButtonState();

  // Luôn xóa RTDB + Storage (vì overlay có thể đã được save trước đó dù đang pending lại do drag)
  if (window.FirebaseSync && window.FirebaseSync.sessionId) {
    try {
      await window.FirebaseSync.deleteImageOverlayFromStorage(overlayId);
    } catch (error) {
      console.error('[Overlay] Failed to delete from Storage:', error);
    }

    // [REMOVED] deleteSingleImageOverlay — chờ Ctrl+S để sync
  }

}
