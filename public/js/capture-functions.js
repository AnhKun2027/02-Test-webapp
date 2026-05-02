/**
 * Capture Functions Module
 * Handles high-resolution capture of selections from PDF and images
 * Migrated from D-index_WebApp.html
 */

// ============================================
// HELPER: DYNAMIC SCALE CALCULATION
// ============================================

function calculateDynamicScale(selectionWidth, selectionHeight) {
  const area = selectionWidth * selectionHeight;
  return area < APP_CONSTANTS.HIGH_RES.AREA_THRESHOLDS.SMALL ? APP_CONSTANTS.HIGH_RES.SMALL_AREA_SCALE :
         area < APP_CONSTANTS.HIGH_RES.AREA_THRESHOLDS.MEDIUM ? APP_CONSTANTS.HIGH_RES.MEDIUM_AREA_SCALE :
         APP_CONSTANTS.HIGH_RES.LARGE_AREA_SCALE;
}

// ============================================
// CAPTURE FROM PDF SOURCE
// ============================================

export async function captureFromPDFSource(selection) {
  let fullCanvas = null;
  let fullCtx = null;
  let resultCanvas = null;
  let resultCtx = null;

  try {
    const directRenderScale = calculateDynamicScale(selection.width, selection.height);

    // Check if we're dealing with an image or PDF
    if (appState.currentFile && isImageFile(appState.currentFile)) {
      // For images, capture from original source at high resolution
      // This provides quality similar to PDF captures
      return captureFromImageSource(selection);
    }

    // For PDFs, continue with original logic
    const page = await appState.pdfDoc.getPage(selection.page);

    // Calculate rotation for this page (use file.id instead of name)
    const rotationKey = getRotationKey(appState.currentFile.id, selection.page);
    const rotation = window.pageRotations[rotationKey] ?? 0;

    // Create viewport with high resolution
    const viewport = page.getViewport({scale: directRenderScale, rotation: rotation});

    // Calculate coordinates ratio from current scale to direct render scale
    const scaleRatio = directRenderScale / (selection.scale ?? appState.scale);

    // Calculate the exact region we want to capture
    const cropX = selection.x * scaleRatio;
    const cropY = selection.y * scaleRatio;
    const cropWidth = selection.width * scaleRatio;
    const cropHeight = selection.height * scaleRatio;

    // Create a canvas for the entire page at high resolution
    fullCanvas = document.createElement('canvas');
    fullCanvas.width = viewport.width;
    fullCanvas.height = viewport.height;
    fullCtx = fullCanvas.getContext('2d');

    // Render the full page at high resolution
    const renderContext = {
      canvasContext: fullCtx,
      viewport: viewport,
      annotationMode: 0  // No annotations for clean capture
    };

    await page.render(renderContext).promise;

    // Extract the specific region we want
    const imageData = fullCtx.getImageData(cropX, cropY, cropWidth, cropHeight);

    // Create final canvas with the cropped region
    resultCanvas = document.createElement('canvas');
    resultCanvas.width = cropWidth;
    resultCanvas.height = cropHeight;
    resultCtx = resultCanvas.getContext('2d');
    resultCtx.putImageData(imageData, 0, 0);

    const result = resultCanvas.toDataURL('image/png', APP_CONSTANTS.PNG_QUALITY);

    return result;

  } catch (error) {
    console.warn('[Capture] Direct PDF capture failed, using fallback:', error);
    // Fallback to the old high-res method
    return captureHighResSelectionFallback(selection);
  } finally {
    // Cleanup canvases to prevent memory leaks
    cleanupCanvas(fullCanvas, fullCtx);
    cleanupCanvas(resultCanvas, resultCtx);
  }
}

// ============================================
// CAPTURE FROM IMAGE SOURCE
// ============================================

/**
 * Capture selection from original image source at high resolution
 * Similar to how PDF captures work - renders from original source
 * @param {Object} selection - Selection object with coordinates
 * @returns {String} Base64 encoded image of the selection at high quality
 */
export async function captureFromImageSource(selection) {
  let tempCanvas = null;
  let resultCanvas = null;

  try {
    if (!appState.currentFile || !appState.currentFile.imageObject) {
      throw new Error('No image source available');
    }

    const img = appState.currentFile.imageObject;

    const targetScale = calculateDynamicScale(selection.width, selection.height);

    // Clamp scale to memory limit if needed
    const estimatedMemory = img.width * targetScale * img.height * targetScale * 4;
    let finalScale = targetScale;

    if (estimatedMemory > APP_CONSTANTS.MEMORY_LIMITS.MAX_CANVAS_MEMORY) {
      const maxSafeScale = Math.sqrt(APP_CONSTANTS.MEMORY_LIMITS.MAX_CANVAS_MEMORY / (img.width * img.height * 4));
      finalScale = Math.min(targetScale, maxSafeScale);
      console.warn('[captureFromImageSource] Scale reduced for memory safety:', { targetScale, finalScale });
    }

    // Get rotation
    const rotationKey = getRotationKey(appState.currentFile.id, 1);
    const rotation = window.pageRotations[rotationKey] ?? 0;

    // Create canvas with rotation-aware dimensions
    tempCanvas = document.createElement('canvas');
    if (rotation === 90 || rotation === 270) {
      tempCanvas.width = img.height * finalScale;
      tempCanvas.height = img.width * finalScale;
    } else {
      tempCanvas.width = img.width * finalScale;
      tempCanvas.height = img.height * finalScale;
    }

    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';

    // Apply rotation and draw (dùng hàm chung từ core-utils.js)
    tempCtx.save();
    applyCanvasRotation(tempCtx, rotation, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(img, 0, 0, img.width * finalScale, img.height * finalScale);
    tempCtx.restore();

    // Calculate crop region
    const scaleRatio = finalScale / (selection.scale ?? appState.scale);
    const cropX = Math.max(0, selection.x * scaleRatio);
    const cropY = Math.max(0, selection.y * scaleRatio);
    const cropWidth = Math.min(selection.width * scaleRatio, tempCanvas.width - cropX);
    const cropHeight = Math.min(selection.height * scaleRatio, tempCanvas.height - cropY);

    // Extract region
    const imageData = tempCtx.getImageData(cropX, cropY, cropWidth, cropHeight);

    if (imageData.width === 0 || imageData.height === 0) {
      throw new Error('Failed to extract valid image data');
    }

    // Create result canvas
    resultCanvas = document.createElement('canvas');
    resultCanvas.width = imageData.width;
    resultCanvas.height = imageData.height;
    resultCanvas.getContext('2d').putImageData(imageData, 0, 0);

    return resultCanvas.toDataURL('image/png', APP_CONSTANTS.PNG_QUALITY);

  } catch (error) {
    console.warn('[Capture] Direct image capture failed, using fallback:', error);
    return captureSelectionFromCanvas(selection);
  } finally {
    // Cleanup canvases to prevent memory leaks
    cleanupCanvas(tempCanvas);
    cleanupCanvas(resultCanvas);
  }
}

// ============================================
// CAPTURE SELECTION FROM CANVAS (OLD METHOD)
// ============================================

export function captureSelectionFromCanvas(selection) {
  let tempCanvas = null;
  let tempCtx = null;
  try {
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');

    // Create a temporary canvas for the selection
    tempCanvas = document.createElement('canvas');
    tempCanvas.width = selection.width;
    tempCanvas.height = selection.height;
    tempCtx = tempCanvas.getContext('2d');

    // Enable high quality rendering
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';

    // Get the image data from the main canvas
    const imageData = ctx.getImageData(
      selection.x,
      selection.y,
      selection.width,
      selection.height
    );

    // Put the image data on the temporary canvas
    tempCtx.putImageData(imageData, 0, 0);

    // Convert to base64
    const base64 = tempCanvas.toDataURL('image/png', APP_CONSTANTS.PNG_QUALITY);

    return base64;
  } catch (error) {
    console.error('[Capture] Canvas capture failed, using standard fallback:', error);
    // Fallback to standard capture
    return captureStandardSelection(selection);
  } finally {
    cleanupCanvas(tempCanvas, tempCtx);
  }
}

// ============================================
// FALLBACK HIGH-RES CAPTURE
// ============================================

export function captureHighResSelectionFallback(selection) {
  let highResCanvas = null;
  let highResCtx = null;

  try {
    const canvas = document.getElementById('pdfCanvas');
    const highResScale = APP_CONSTANTS.RENDER_QUALITY.FALLBACK_SCALE; // High-res fallback for small selections
    const scaleRatio = highResScale / appState.scale; // Current scale vs high-res scale

    const targetWidth = selection.width * scaleRatio;
    const targetHeight = selection.height * scaleRatio;

    // Create high-res canvas with memory safety
    const highResCanvasData = createCanvasWithContext(targetWidth, targetHeight, {
      smoothing: false // Disable smoothing for crisp text
    });
    highResCanvas = highResCanvasData.canvas;
    highResCtx = highResCanvasData.ctx;

    // Draw the selection area with high resolution
    highResCtx.drawImage(
      canvas,
      selection.x, selection.y, selection.width, selection.height, // Source
      0, 0, targetWidth, targetHeight // Destination (scaled up)
    );

    // Apply sharpening effect for better text readability
    const imageData = highResCtx.getImageData(0, 0, targetWidth, targetHeight);
    const sharpened = applySharpenFilter(imageData);
    highResCtx.putImageData(sharpened, 0, 0);

    const result = highResCanvas.toDataURL('image/png');
    return result;

  } finally {
    // Cleanup canvas to prevent memory leaks
    cleanupCanvas(highResCanvas, highResCtx);
  }
}

// ============================================
// STANDARD CAPTURE
// ============================================

export function captureStandardSelection(selection) {
  let tempCanvas = null;
  let tempCtx = null;

  try {
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(selection.x, selection.y, selection.width, selection.height);

    const tempCanvasData = createCanvasWithContext(selection.width, selection.height);
    tempCanvas = tempCanvasData.canvas;
    tempCtx = tempCanvasData.ctx;
    tempCtx.putImageData(imageData, 0, 0);

    const result = tempCanvas.toDataURL('image/png');
    return result;

  } finally {
    // Cleanup canvas to prevent memory leaks
    cleanupCanvas(tempCanvas, tempCtx);
  }
}

// ============================================
// SHARPENING FILTER
// ============================================

function applySharpenFilter(imageData) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new Uint8ClampedArray(data);

  // Sharpening kernel (enhance edges)
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB channels only
        let sum = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = ((y + ky) * width + (x + kx)) * 4;
            const weight = kernel[(ky + 1) * 3 + (kx + 1)];
            sum += data[pixel + c] * weight;
          }
        }

        const outputPixel = (y * width + x) * 4;
        output[outputPixel + c] = Math.max(0, Math.min(255, sum));
      }
    }
  }

  return new ImageData(output, width, height);
}

// ============================================
// EXPORT FUNCTIONS GLOBALLY
// ============================================

window.captureFromPDFSource = captureFromPDFSource;
window.captureFromImageSource = captureFromImageSource;
window.captureSelectionFromCanvas = captureSelectionFromCanvas;
window.captureHighResSelectionFallback = captureHighResSelectionFallback;
window.captureStandardSelection = captureStandardSelection;

