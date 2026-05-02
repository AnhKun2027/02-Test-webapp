/** Overlay System - Render overlays for current page and deselect handler */

import { getOverlayKey, deselectAllOverlays } from './overlay-shared.js';
import { renderImageOverlay } from './image-overlay.js';
import { renderTextOverlay } from './text-overlay.js';
import { getOverlaySignal } from './overlay-shared.js';

/**
 * Render all overlays for current page (both image and text)
 */
export function renderOverlaysForCurrentPage() {
  document.querySelectorAll('.image-overlay-item').forEach(el => el.remove());
  document.querySelectorAll('.text-overlay-item').forEach(el => el.remove());

  const key = getOverlayKey();

  const imgOverlays = window.imageOverlays[key] || [];
  imgOverlays.forEach(overlayData => {
    renderImageOverlay(overlayData);
  });

  const txtOverlays = window.textOverlays[key] || [];
  txtOverlays.forEach(overlayData => {
    renderTextOverlay(overlayData);
  });
}

/**
 * Initialize click-to-deselect on empty area
 */
export function initOverlayDeselectHandler() {
  const signal = getOverlaySignal();
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.image-overlay-item') &&
        !e.target.closest('.text-overlay-item') &&
        !e.target.closest('.selection-box')) {
      deselectAllOverlays();
    }
  }, { signal });
}
