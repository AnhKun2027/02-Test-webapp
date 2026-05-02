/** Viewer Core — Load PDF/Image và render page chính */

import { saveBitmapToCache } from './cache.js';
import { renderImageOnCanvas } from './image-viewer.js';
import { getFitToPageScale, updateZoomDisplay } from './zoom-utils.js';
import { renderThumbnails, updateActiveThumbnail } from './thumbnails.js';

// ============================================
// STATE
// ============================================

// FIX Race Condition: Version-based render cancellation (replaces renderLock)
// Each render increments version; if a newer render starts, older ones are cancelled
let renderVersion = 0;
let currentRenderTask = null;

// ============================================
// LOAD PDF FROM ARRAY BUFFER
// ============================================

/** Helper: destroy PDF document cũ để giải phóng memory */
function _destroyOldPdf() {
  if (!appState.pdfDoc) return;
  try {
    appState.pdfDoc.destroy();
    console.log('[PDF-Viewer] Previous PDF document destroyed');
  } catch (e) {
    console.warn('[PDF-Viewer] Error destroying previous PDF:', e.message);
  }
  appState.pdfDoc = null;
}

/** Helper: cache kích thước trang thực tế thay vì hardcoded A4 */
async function _cachePageDimensions(pdfDoc) {
  try {
    const firstPage = await pdfDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    appState._pdfPageWidth = viewport.width;
    appState._pdfPageHeight = viewport.height;
  } catch (e) {
    console.warn('[PDF] Could not get page dimensions, using A4 default');
    appState._pdfPageWidth = 595;
    appState._pdfPageHeight = 842;
  }
}

/**
 * Rescale tất cả selection có cờ `isExisting` theo tỷ lệ oldScale → newScale.
 * Mutate window.selections — tách riêng để caller (loadPDFFromArrayBuffer) gọi
 * tường minh thay vì side-effect ngầm trong hàm tên "scale".
 */
function _rescaleSelections(oldScale, newScale) {
  if (!window.selections || window.selections.length === 0) return;
  if (oldScale === newScale) return;
  const ratio = newScale / oldScale;
  window.selections.forEach(selection => {
    if (selection.isExisting) {
      selection.x *= ratio;
      selection.y *= ratio;
      selection.width *= ratio;
      selection.height *= ratio;
      selection.scale = newScale;
    }
  });
}

/** Helper: tính auto-fit scale + apply vào appState (KHÔNG mutate selections — caller làm). */
function _computeAutoFitScale() {
  const autoFitScale = getFitToPageScale();
  appState.scale = autoFitScale;
  if (appState.currentFile) appState.currentFile.lastScale = autoFitScale;
  return autoFitScale;
}

export async function loadPDFFromArrayBuffer(arrayBuffer, fileName, suppressLoading = false) {
  try {
    _destroyOldPdf();

    // Tạo một bản sao mới của ArrayBuffer cho pdf.js (sẽ bị transfer sang Worker)
    const bufferForDisplay = arrayBuffer.slice(0);

    // Tạo một bản sao khác để lưu trữ toàn cục (buffer này an toàn, không bị detach)
    window.originalPdfBytes = new Uint8Array(arrayBuffer.slice(0));

    // Load với pdf.js để hiển thị
    const fileId = appState.currentFile?.id;
    const loadingTask = pdfjsLib.getDocument({data: bufferForDisplay});
    appState.pdfDoc = await loadingTask.promise;

    // State check: user có thể switch file trong lúc load
    if (appState.currentFile?.id !== fileId) return;

    appState.totalPages = appState.pdfDoc.numPages;

    await _cachePageDimensions(appState.pdfDoc);
    if (appState.currentFile?.id !== fileId) return;

    // Save pageCount and originalPdfBytes to current file object
    if (appState.currentFile) {
      appState.currentFile.pageCount = appState.totalPages;
      appState.currentFile.numPages = appState.totalPages;
      appState.currentFile.originalPdfBytes = window.originalPdfBytes;
    }

    const oldScale = appState.scale;
    const newScale = _computeAutoFitScale();
    _rescaleSelections(oldScale, newScale);

    // Kiểm tra và điều chỉnh currentPage nếu vượt quá số trang
    if (appState.currentPage > appState.totalPages) {
      appState.currentPage = appState.totalPages;
    }

    document.title = `${fileName} - PDF Viewer`;

    await renderPage(!suppressLoading);
    await renderThumbnails();

    if (typeof renderSelectionsForCurrentPage === 'function') {
      renderSelectionsForCurrentPage();
    }

    updateZoomDisplay();

    // Show PDF wrapper
    const pdfWrapper = document.getElementById('pdfWrapper');
    const pagesSidebar = document.getElementById('pagesSidebar');
    if (pdfWrapper) pdfWrapper.style.display = 'block';
    if (pagesSidebar) pagesSidebar.style.display = 'block';

  } catch (error) {
    if (error.name === 'RenderingCancelledException') {
      return;
    }
    console.error('[PDF-Viewer] Failed to load PDF:', appState.currentFile?.name, error);
    alert('Error loading PDF: ' + error.message);
  }
}

// ============================================
// LOAD IMAGE FROM BASE64
// ============================================

export async function loadImageFromBase64(base64String, fileName, suppressLoading = false) {
  const fileId = appState.currentFile?.id;
  try {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = async function() {
        // Abort nếu user đã switch file khác trong lúc decode image
        if (appState.currentFile?.id !== fileId) return resolve();
        // Store image object for later use
        if (appState.currentFile) {
          appState.currentFile.imageObject = img;
          appState.currentFile.type = window.FILE_TYPES.IMAGE;
          appState.currentFile.numPages = 1;
          appState.currentFile.pageCount = 1;
          appState.currentFile.originalWidth = img.width;
          appState.currentFile.originalHeight = img.height;
        }

        // Set totalPages to 1 for images
        appState.totalPages = 1;
        appState.currentPage = 1;

        // Auto-fit to page size
        const autoFitScale = getFitToPageScale();
        appState.scale = autoFitScale;
        if (appState.currentFile) {
          appState.currentFile.lastScale = autoFitScale;
        }

        document.title = `${fileName} - Image Viewer`;

        // Render the image
        await renderPage(!suppressLoading);

        // Hide pages sidebar for images
        const pagesSidebar = document.getElementById('pagesSidebar');
        if (pagesSidebar) {
          pagesSidebar.style.display = 'none';
        }

        // Clear selection overlay when loading image
        const overlay = document.getElementById('selectionOverlay');
        if (overlay) {
          while (overlay.firstChild) {
            overlay.removeChild(overlay.firstChild);
          }
        }

        // CRITICAL FIX: Render selections for current file only (filter by fileId + page)
        // This prevents selections from other files appearing when switching to image files
        if (typeof renderSelectionsForCurrentPage === 'function') {
          renderSelectionsForCurrentPage();
        }

        resolve();
      };

      img.onerror = function(error) {
        console.error('[PDF-Viewer] Failed to load image from base64:', error);
        reject(new Error('Failed to load image'));
      };

      // Set image source (with data URI prefix)
      img.src = `data:image/png;base64,${base64String}`;
    });
  } catch (error) {
    console.error('[PDF-Viewer] Image base64 decode failed:', appState.currentFile?.name, error);
    alert('Lỗi khi load image: ' + error.message);
  }
}

// ============================================
// RENDER PAGE (PDF or Image)
// ============================================

/** Helper: render trang PDF lên canvas với HiDPI support */
async function _renderPdfPage(page, canvas, selectionOverlay) {
  const ctx = canvas.getContext('2d');

  // Use file.id instead of name to avoid encoding issues
  const rotationKey = getRotationKey(appState.currentFile.id, appState.currentPage);
  const rotation = window.pageRotations[rotationKey] ?? 0;

  const viewport = page.getViewport({scale: appState.scale, rotation: rotation});

  // HiDPI/Retina/4K support - render at higher resolution for sharp display
  const outputScale = window.devicePixelRatio ?? 1;

  // Canvas pixel size = viewport × devicePixelRatio (actual render resolution)
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);

  // CSS size = viewport (display size on screen)
  canvas.style.width = Math.floor(viewport.width) + 'px';
  canvas.style.height = Math.floor(viewport.height) + 'px';

  selectionOverlay.style.width = Math.floor(viewport.width) + 'px';
  selectionOverlay.style.height = Math.floor(viewport.height) + 'px';

  // Enable high-quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Transform matrix for HiDPI scaling
  const transform = outputScale !== 1
    ? [outputScale, 0, 0, outputScale, 0, 0]
    : null;

  const renderContext = {
    canvasContext: ctx,
    transform: transform,
    viewport: viewport,
    annotationMode: 0
  };

  // Track the render task so we can cancel it if needed
  currentRenderTask = page.render(renderContext);
  await currentRenderTask.promise;
  currentRenderTask = null;
}

/** Helper: render image file lên canvas */
async function _renderImagePage() {
  await renderImageOnCanvas();
  if (typeof updateRotateButtonState === 'function') {
    updateRotateButtonState();
  }
}

export async function renderPage(showLoadingIndicator = true) {
  // FIX Race Condition: Version-based cancellation
  const thisVersion = ++renderVersion;

  // Suppress loading indicator khi đã có cached bitmap đang hiển thị
  if (showLoadingIndicator && !window._bitmapCacheActive) {
    const loadingText = isImageFile(appState.currentFile) ? 'Đang vẽ ảnh...' : 'Đang vẽ trang PDF...';
    showLoading(loadingText);
  }

  try {
    const canvas = document.getElementById('pdfCanvas');
    const selectionOverlay = document.getElementById('selectionOverlay');

    if (appState.currentFile && isImageFile(appState.currentFile)) {
      await _renderImagePage();

      if (thisVersion !== renderVersion) return;

    } else if (appState.pdfDoc) {
      // Cancel any ongoing render operation
      if (currentRenderTask) {
        try { currentRenderTask.cancel(); } catch (_e) { /* Intentionally ignored: cancelling render task is expected to throw */ }
        currentRenderTask = null;
      }

      const page = await appState.pdfDoc.getPage(appState.currentPage);
      if (thisVersion !== renderVersion) return;

      await _renderPdfPage(page, canvas, selectionOverlay);
      if (thisVersion !== renderVersion) return;

      // FIX Memory: Cleanup page resources after successful render
      page.cleanup();
      updateActiveThumbnail();
    }

    // Auto-save cache sau mỗi render thành công — fire-and-forget có catch
    if (appState.currentFile && appState.currentFile.id) {
      void Promise.resolve(saveBitmapToCache(appState.currentFile.id, appState.currentPage))
        .catch(err => console.warn('[Cache] saveBitmap failed:', err));
    }

  } finally {
    const wasCacheActive = window._bitmapCacheActive;
    window._bitmapCacheActive = false;
    if (showLoadingIndicator && !wasCacheActive) {
      hideLoading();
    }
  }
}

/** Cleanup render state — gọi khi destroy module */
export function destroy() {
  if (currentRenderTask) {
    try { currentRenderTask.cancel(); } catch (_e) { /* Intentionally ignored */ }
    currentRenderTask = null;
  }
  renderVersion = 0;
}
