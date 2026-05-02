/** PDF Viewer Cache — Bitmap cache và thumbnail DOM cache */

// ============================================
// THUMBNAIL DOM CACHE — Switch file không render lại thumbnails
// Lưu DOM elements đã render theo fileId, gắn lại khi quay lại file (~0ms)
// ============================================
export const thumbnailDomCache = new Map();
export const THUMBNAIL_CACHE_MAX_FILES = 10;

// ============================================
// IMAGEBITMAP CACHE — Switch file không nhấp nháy
// Chụp canvas thành ImageBitmap khi rời file, dán lại khi quay lại (~1ms)
// Key format: "{fileId}_{page}"
// ============================================
const bitmapCache = new Map();
const BITMAP_CACHE_MAX_ENTRIES = 20;

// ============================================
// BITMAP CACHE FUNCTIONS
// ============================================

/**
 * Chụp canvas hiện tại thành ImageBitmap và lưu vào cache
 * Gọi khi: rời file (switchToLocalFile) hoặc sau render thành công
 */
export async function saveBitmapToCache(fileId, page) {
  const canvas = document.getElementById('pdfCanvas');
  if (!canvas || canvas.width === 0 || canvas.height === 0) return;
  if (canvas.style.display === 'none') return; // text file — không có canvas

  const key = `${fileId}_${page}`;
  const rotationKey = getRotationKey(fileId, page);

  try {
    const bitmap = await createImageBitmap(canvas);

    // Giới hạn số entry — xóa entry cũ nhất (LRU)
    if (bitmapCache.size >= BITMAP_CACHE_MAX_ENTRIES) {
      const firstKey = bitmapCache.keys().next().value;
      const old = bitmapCache.get(firstKey);
      if (old && old.bitmap) old.bitmap.close();
      bitmapCache.delete(firstKey);
    }

    // Xóa entry cũ cùng key (giải phóng GPU memory)
    const existing = bitmapCache.get(key);
    if (existing && existing.bitmap) existing.bitmap.close();

    bitmapCache.set(key, {
      bitmap,
      width: canvas.width,
      height: canvas.height,
      cssWidth: parseInt(canvas.style.width),
      cssHeight: parseInt(canvas.style.height),
      scale: appState.scale,
      rotation: window.pageRotations[rotationKey] ?? 0
    });
  } catch (e) {
    console.debug('[Cache] Bitmap save skipped:', e.message);
  }
}

/**
 * Lấy ImageBitmap từ cache và vẽ lên canvas (~1ms)
 * Return true nếu cache hit, false nếu miss
 */
export function restoreBitmapFromCache(fileId, page) {
  const key = `${fileId}_${page}`;
  const cached = bitmapCache.get(key);
  if (!cached) return false;

  // Validate: scale + rotation phải khớp, không thì xóa cache cũ
  const rotationKey = getRotationKey(fileId, page);
  const currentRotation = window.pageRotations[rotationKey] ?? 0;
  if (cached.scale !== appState.scale || cached.rotation !== currentRotation) {
    cached.bitmap.close();
    bitmapCache.delete(key);
    return false;
  }

  const canvas = document.getElementById('pdfCanvas');
  if (!canvas) return false;

  // Set canvas dimensions khớp với cached bitmap
  canvas.width = cached.width;
  canvas.height = cached.height;
  canvas.style.width = cached.cssWidth + 'px';
  canvas.style.height = cached.cssHeight + 'px';

  // Đồng bộ selectionOverlay dimensions
  const overlay = document.getElementById('selectionOverlay');
  if (overlay) {
    overlay.style.width = cached.cssWidth + 'px';
    overlay.style.height = cached.cssHeight + 'px';
  }

  // Vẽ cached bitmap lên canvas — ~1ms
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cached.bitmap, 0, 0);

  return true;
}

/**
 * Xóa cache cho 1 file (hoặc 1 trang cụ thể)
 * Gọi khi: file bị xóa, hoặc cần invalidate
 */
export function invalidateBitmapCache(fileId, page) {
  if (page !== undefined) {
    const key = `${fileId}_${page}`;
    const cached = bitmapCache.get(key);
    if (cached && cached.bitmap) cached.bitmap.close();
    bitmapCache.delete(key);
  } else {
    for (const [key, entry] of bitmapCache) {
      if (key.startsWith(fileId + '_')) {
        if (entry.bitmap) entry.bitmap.close();
        bitmapCache.delete(key);
      }
    }
  }
}

// ============================================
// THUMBNAIL CACHE FUNCTIONS
// ============================================

/**
 * Destroy canvas bên trong cached thumbnail DOM nodes
 */
export function destroyCachedThumbnailCanvases(nodes) {
  if (!nodes) return;
  nodes.forEach(node => {
    const canvases = node.querySelectorAll('canvas');
    canvases.forEach(c => {
      const ctx = c.getContext('2d');
      if (typeof cleanupCanvas === 'function') cleanupCanvas(c, ctx);
    });
  });
}

/**
 * Xóa thumbnail cache cho 1 file (khi rotation thay đổi, v.v.)
 */
export function invalidateThumbnailCache(fileId) {
  if (fileId && thumbnailDomCache.has(fileId)) {
    destroyCachedThumbnailCanvases(thumbnailDomCache.get(fileId));
    thumbnailDomCache.delete(fileId);
  }
}

/** Cleanup toàn bộ cache — gọi khi destroy module */
export function destroy() {
  // Bitmap cache — close GPU memory
  for (const [, entry] of bitmapCache) {
    if (entry.bitmap) entry.bitmap.close();
  }
  bitmapCache.clear();

  // Thumbnail DOM cache — cleanup canvases
  for (const [, nodes] of thumbnailDomCache) {
    destroyCachedThumbnailCanvases(nodes);
  }
  thumbnailDomCache.clear();
}
