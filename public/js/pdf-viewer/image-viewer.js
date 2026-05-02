/** Image Viewer — Render ảnh lên canvas với rotation và HiDPI support */

// ============================================
// RENDER IMAGE ON CANVAS
// ============================================

async function renderImageOnCanvas() {
  if (!appState.currentFile || !appState.currentFile.imageObject) {
    console.warn('[PDF-Viewer] No image loaded for file:', appState.currentFile?.name || 'unknown');
    return;
  }

  const img = appState.currentFile.imageObject;
  const canvas = document.getElementById('pdfCanvas');
  const context = canvas.getContext('2d');

  // Get rotation for current image (use file.id instead of name)
  const rotationKey = getRotationKey(appState.currentFile.id, 1); // Page 1 for images
  const rotation = window.pageRotations[rotationKey] ?? 0;

  // HiDPI/Retina/4K support
  const outputScale = window.devicePixelRatio || 1;

  // Calculate display dimensions based on rotation (CSS size)
  let displayWidth, displayHeight;
  const originalWidth = img.width;
  const originalHeight = img.height;

  if (rotation === 90 || rotation === 270) {
    displayWidth = originalHeight * appState.scale;
    displayHeight = originalWidth * appState.scale;
  } else {
    displayWidth = originalWidth * appState.scale;
    displayHeight = originalHeight * appState.scale;
  }

  // Canvas pixel size = display size × devicePixelRatio (actual render resolution)
  canvas.width = Math.floor(displayWidth * outputScale);
  canvas.height = Math.floor(displayHeight * outputScale);

  // CSS size = display size (what user sees on screen)
  canvas.style.width = Math.floor(displayWidth) + 'px';
  canvas.style.height = Math.floor(displayHeight) + 'px';

  // Clear canvas
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Scale context for HiDPI
  context.save();
  context.scale(outputScale, outputScale);

  // Apply rotation transformation (dùng hàm chung từ core-utils.js)
  applyCanvasRotation(context, rotation, displayWidth, displayHeight);

  // Enable high-quality image rendering
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  // Draw image at display size (will be scaled by outputScale)
  if (rotation === 90 || rotation === 270) {
    context.drawImage(img, 0, 0, originalWidth * appState.scale, originalHeight * appState.scale);
  } else {
    context.drawImage(img, 0, 0, displayWidth, displayHeight);
  }

  context.restore();

  // Update selection overlay dimensions (CSS size)
  const overlay = document.getElementById('selectionOverlay');
  if (overlay) {
    overlay.style.width = Math.floor(displayWidth) + 'px';
    overlay.style.height = Math.floor(displayHeight) + 'px';
  }
}

export { renderImageOnCanvas };
