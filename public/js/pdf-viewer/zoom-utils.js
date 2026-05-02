/** Zoom Utils — getFitToPageScale, setScale, updateZoomDisplay */

// ============================================
// GET FIT TO PAGE SCALE
// ============================================

export function getFitToPageScale() {
  const pdfArea = document.querySelector('.pdf-area');
  if (!pdfArea) return APP_CONSTANTS.DEFAULT_SCALE;

  // Lấy kích thước gốc tùy loại file (ảnh hoặc PDF)
  let contentWidth, contentHeight;
  if (appState.currentFile && isImageFile(appState.currentFile)) {
    if (!appState.currentFile.imageObject) return APP_CONSTANTS.DEFAULT_SCALE;
    contentWidth = appState.currentFile.originalWidth || appState.currentFile.imageObject.width;
    contentHeight = appState.currentFile.originalHeight || appState.currentFile.imageObject.height;
  } else if (appState.pdfDoc) {
    contentWidth = appState._pdfPageWidth || 595;   // Fallback A4
    contentHeight = appState._pdfPageHeight || 842;
  } else {
    return APP_CONSTANTS.DEFAULT_SCALE;
  }

  // Tính scale vừa khít khung hiển thị
  const availableWidth = pdfArea.clientWidth - 60;   // Trừ padding + scrollbar
  const availableHeight = pdfArea.clientHeight - 60;
  const fitScale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);

  return Math.max(APP_CONSTANTS.MIN_SCALE, Math.min(fitScale, APP_CONSTANTS.MAX_SCALE));
}

// ============================================
// SET SCALE (matches original D-index_WebApp.html)
// ============================================

export async function setScale(newScale) {
  appState.scale = validateScale(newScale);

  // Sync với file object hiện tại
  if (appState.currentFile && appState.currentFileIndex >= 0) {
    appState.files[appState.currentFileIndex].lastScale = appState.scale;
  }

  updateZoomDisplay();

  if (appState.pdfDoc || (appState.currentFile && isImageFile(appState.currentFile))) {
    await window.renderPage(false);
    if (typeof renderSelectionsForCurrentPage === 'function') {
      renderSelectionsForCurrentPage();
    }
    // Update overlays scale after zoom
    if (typeof renderOverlaysForCurrentPage === 'function') {
      renderOverlaysForCurrentPage();
    }
  }
}

// ============================================
// UPDATE ZOOM DISPLAY
// ============================================

export function updateZoomDisplay() {
  const percentage = Math.round(appState.scale / APP_CONSTANTS.RENDER_QUALITY.BASE_SCALE * 100);

  const zoomLevel = document.getElementById('zoomLevel');
  if (zoomLevel) {
    zoomLevel.textContent = percentage + '%';
  }

  // Sync slider value
  const slider = document.getElementById('toolbarRange');
  if (slider) {
    slider.value = percentage;
  }
}
