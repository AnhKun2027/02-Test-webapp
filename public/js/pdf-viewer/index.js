/** PDF Viewer — Entry point, re-export + window bindings */

// ============================================
// IMPORTS
// ============================================

import {
  saveBitmapToCache, restoreBitmapFromCache,
  invalidateBitmapCache, invalidateThumbnailCache,
  destroy as cacheDestroy,
} from './cache.js';
import {
  getFitToPageScale, setScale, updateZoomDisplay,
} from './zoom-utils.js';
import {
  renderThumbnails, abortThumbnailRender,
  updateActiveThumbnail, cleanupThumbnails,
  destroy as thumbnailsDestroy,
} from './thumbnails.js';
import {
  loadPDFFromArrayBuffer, loadImageFromBase64, renderPage,
  destroy as viewerDestroy,
} from './viewer-core.js';

/** Cleanup all pdf-viewer state: cache, thumbnail render, viewer GPU resources */
export function destroyPdfViewer() {
  cacheDestroy();
  thumbnailsDestroy();
  viewerDestroy();
}

// ============================================
// RE-EXPORT
// ============================================

export {
  saveBitmapToCache, restoreBitmapFromCache,
  invalidateBitmapCache, invalidateThumbnailCache,
  getFitToPageScale, setScale, updateZoomDisplay,
  renderThumbnails, abortThumbnailRender,
  updateActiveThumbnail, cleanupThumbnails,
  loadPDFFromArrayBuffer, loadImageFromBase64, renderPage,
};

// ============================================
// WINDOW BINDINGS
// ============================================

window.saveBitmapToCache = saveBitmapToCache;
window.restoreBitmapFromCache = restoreBitmapFromCache;
window.invalidateBitmapCache = invalidateBitmapCache;
window.invalidateThumbnailCache = invalidateThumbnailCache;
window.getFitToPageScale = getFitToPageScale;
window.setScale = setScale;
window.updateZoomDisplay = updateZoomDisplay;
window.loadPDFFromArrayBuffer = loadPDFFromArrayBuffer;
window.loadImageFromBase64 = loadImageFromBase64;
window.renderPage = renderPage;
window.renderThumbnails = renderThumbnails;
window.abortThumbnailRender = abortThumbnailRender;
window.updateActiveThumbnail = updateActiveThumbnail;
window.cleanupThumbnails = cleanupThumbnails;
window.destroyPdfViewer = destroyPdfViewer;

console.log('[PDF-Viewer] Module loaded');
