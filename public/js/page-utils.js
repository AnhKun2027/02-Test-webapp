/**
 * Page Utilities Module
 * Handles page rotation, visibility, and page-level operations
 */

// Page rotation storage
window.pageRotations = window.pageRotations || {};

// NOTE: getRotationKey() được định nghĩa trong core-utils.js (tránh duplicate)
// NOTE: getPageRotation() và setPageRotation() đã được xóa vì không được sử dụng
// Nếu cần, có thể dùng trực tiếp: window.pageRotations[getRotationKey(fileId, pageNum)]

/**
 * Rotate current page by 90 degrees
 * Supports both PDF and Image files
 */
export async function rotatePage() {
  // Chặn xoay khi trang có annotation (selection, overlay)
  // rotatePageBtn là <div> nên disabled không chặn click — phải check thủ công
  const btn = document.getElementById('rotatePageBtn');
  if (btn?.disabled) return;

  // Check if file is loaded
  if (!appState.currentFile) {
    console.warn('[rotatePage] Cannot rotate - no file loaded');
    return;
  }

  // For PDF files, require pdfDoc to be loaded
  // For image files, pdfDoc will be null - that's OK
  const isImage = isImageFile(appState.currentFile);
  if (!isImage && !appState.pdfDoc) {
    console.warn('[rotatePage] Cannot rotate PDF - pdfDoc not loaded');
    return;
  }

  // Use file.id (UUID) instead of file.name to avoid encoding issues
  const rotationKey = getRotationKey(appState.currentFile.id, appState.currentPage);
  const currentRotation = window.pageRotations[rotationKey] ?? 0;
  const newRotation = (currentRotation + 90) % 360;

  window.pageRotations[rotationKey] = newRotation;

  // Xóa thumbnail cache vì rotation đã thay đổi — buộc render lại
  if (typeof window.invalidateThumbnailCache === 'function') {
    window.invalidateThumbnailCache(appState.currentFile.id);
  }

  // Auto-fit scale — setScale() gọi renderPage() + displaySelectionsForCurrentPage() + renderOverlaysForCurrentPage()
  const autoFitScale = getFitToPageScale();
  await setScale(autoFitScale);

  // Render lại thumbnails với góc xoay mới
  await renderThumbnails();

  // KHÔNG ghi RTDB ngay — chờ user bấm Ctrl+S hoặc saveAndSyncAllBtn
  // saveAndSyncAll() sẽ gọi FirebaseSync.saveRotations(window.pageRotations)

  // KHÔNG cập nhật thumbnail File Manager khi xoay trang
  // Thumbnail được tạo 1 lần duy nhất với rotation cố định (thumbnailRotation)
  // Chỉ cập nhật khi reload webapp hoặc thêm file mới
}

/**
 * Kiểm tra trang có annotation (selection, overlay) không
 * Dùng để quyết định khóa/mở nút xoay trang
 */
export function hasAnnotationsOnPage(fileId, page) {
  const selections = (window.selections || []).filter(s => s.fileId === fileId && s.page === page);
  const key = `${fileId}_${page}`;
  const imageOvls = window.imageOverlays?.[key] || [];
  const textOvls = window.textOverlays?.[key] || [];

  return {
    hasAny: selections.length > 0 || imageOvls.length > 0 || textOvls.length > 0,
    selections: selections.length,
    imageOverlays: imageOvls.length,
    textOverlays: textOvls.length,
  };
}

/**
 * Bật/tắt nút xoay trang dựa trên annotation trên trang hiện tại
 * Khóa xoay khi có: selection, image overlay, hoặc text overlay
 */
export function updateRotateButtonState() {
  const rotateBtn = document.getElementById('rotatePageBtn');
  if (!rotateBtn) return;

  let currentFileId = window.currentFileId;
  if (!currentFileId && appState.files && appState.currentFileIndex !== undefined) {
    currentFileId = appState.files[appState.currentFileIndex]?.id;
  }

  const result = hasAnnotationsOnPage(currentFileId, appState.currentPage);

  if (result.hasAny) {
    rotateBtn.disabled = true;
    rotateBtn.style.opacity = '0.5';
    rotateBtn.style.cursor = 'not-allowed';
    // Tạo thông báo chi tiết
    const reasons = [];
    if (result.selections) reasons.push(`${result.selections} selections`);
    if (result.imageOverlays) reasons.push(`${result.imageOverlays} image overlays`);
    if (result.textOverlays) reasons.push(`${result.textOverlays} text overlays`);
    rotateBtn.title = `Không thể xoay trang có ${reasons.join(', ')}`;
  } else {
    rotateBtn.disabled = false;
    rotateBtn.style.opacity = '1';
    rotateBtn.style.cursor = 'pointer';
    rotateBtn.title = 'Xoay trang 90°';
  }
}

// Export functions globally (getRotationKey đã export trong core-utils.js)
window.rotatePage = rotatePage;
window.updateRotateButtonState = updateRotateButtonState;
window.hasAnnotationsOnPage = hasAnnotationsOnPage;

console.log('[PageUtils] Module loaded');
