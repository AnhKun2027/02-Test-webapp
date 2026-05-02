/**
 * Core Utilities Module
 * Contains constants, coordinate transformations, and utility functions
 * Migrated from D-index_WebApp.html
 */

// ============================================
// CONSTANTS
// ============================================

export const FILE_TYPES = {
  PDF: 'pdf',
  IMAGE: 'image',
  TEXT: 'text',
  ARCHIVE: 'archive'  // ZIP, RAR, 7z, TAR, GZ
};

// File type checker helpers - used across entire app
export function isImageFile(fileData) {
  if (!fileData) return false;
  return fileData.type === FILE_TYPES.IMAGE ||
         fileData.type === 'image' ||
         fileData.type?.startsWith('image/');
}

export function isPdfFile(fileData) {
  if (!fileData) return false;
  return fileData.type === FILE_TYPES.PDF ||
         fileData.type === 'pdf' ||
         fileData.type === 'application/pdf' ||
         fileData.name?.toLowerCase().endsWith('.pdf');
}

export function isTextFile(fileData) {
  if (!fileData) return false;
  const ext = fileData.name?.toLowerCase().split('.').pop() || '';
  return fileData.type === FILE_TYPES.TEXT ||
         fileData.type === 'text' ||
         fileData.type === 'text/plain' ||
         ext === 'txt';
}

export function isArchiveFile(fileData) {
  if (!fileData) return false;
  const ext = fileData.name?.toLowerCase().split('.').pop() || '';
  return fileData.type === FILE_TYPES.ARCHIVE ||
         fileData.type === 'archive' ||
         ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);
}

export const APP_CONSTANTS = {
  DEFAULT_SCALE: 2.0,
  MIN_SCALE: 0.25,
  MAX_SCALE: 5.0,

  // High-res capture thresholds (matches D-index_WebApp.html)
  HIGH_RES: {
    MIN_WIDTH: 150,
    MIN_HEIGHT: 100,
    MIN_AREA: 12000,
    SMALL_AREA_SCALE: 6.0,    // For small selections (<10,000 px²)
    MEDIUM_AREA_SCALE: 4.0,   // For medium selections (<50,000 px²)
    LARGE_AREA_SCALE: 3.0,    // For large selections
    AREA_THRESHOLDS: {
      SMALL: 10000,
      MEDIUM: 50000
    }
  },

  // PNG quality for exports
  PNG_QUALITY: 0.95,

  // Zoom factor for zoom buttons
  ZOOM_FACTOR: 1.2,

  // Render quality settings (matches D-index_WebApp.html)
  RENDER_QUALITY: {
    FALLBACK_SCALE: 6.0,      // High-res fallback for small selections
    COMPOSITE_SCALE: 2.0,     // 144 DPI for composite images (72 * 2.0)
    BASE_SCALE: 2.0,          // Baseline scale for calculations (100% reference)
    TARGET_DPI: 144,          // Standard print DPI
    THUMBNAIL_SCALE: 0.2,
    PREVIEW_SCALE: 0.5
  },

  // Memory management
  MEMORY_LIMITS: {
    MAX_CANVAS_MEMORY: 100 * 1024 * 1024,  // 100MB canvas limit
    MAX_FILE_SIZE: 100 * 1024 * 1024,      // 100MB file upload limit
    CANVAS_SAFETY_FACTOR: 4                // 4 bytes per pixel (RGBA)
  },

  // UI timing constants
  UI_TIMING: {
    BUTTON_FEEDBACK_DURATION: 2000,        // 2 giây feedback trên button
    URL_CLEANUP_DELAY: 1000,               // 1 giây trước khi xóa URL param
    LOADING_DEBOUNCE: 300,                 // 300ms debounce loading states
    SYNC_FLAG_DELAY: 100,                  // 100ms chờ sync flag cleanup
    SAVE_OPERATION_DELAY: 200,             // 200ms chờ tag/preset save xong
    INIT_RETRY_DELAY: 1500,               // 1.5 giây retry khi init chưa sẵn sàng
    DEBOUNCE_TYPING: 500,                 // 500ms debounce cho typing input
    STATUS_DISPLAY_DURATION: 2000          // 2 giây hiện status message
  },

  // AI processing
  AI: {
    PROCESSING_TIMEOUT: 180000,            // 3 phút timeout cho Gemini API
    BUTTON_RESET_DELAY: 4000               // 4 giây reset button sau khi AI xong
  },

  // Thumbnail
  THUMBNAIL: {
    MAX_SIZE: 60,                          // 60px max kích thước thumbnail
    PDF_VIEWPORT_SCALE: 0.5,              // Scale viewport khi render PDF thumbnail
    ROTATE_SCALE: 0.85                    // Scale khi xoay 90/270 để fit container
  },

  // File switch
  FILE_SWITCH_DEBOUNCE: 150               // 150ms debounce chuyển file
};

// ============================================
// COORDINATE TRANSFORMATION FUNCTIONS
// ============================================

/**
 * Get rotation key for storing page rotations
 * Uses fileId (UUID) instead of fileName to avoid encoding issues
 * @param {string} fileId - File ID (UUID)
 * @param {number} pageNum - Page number
 * @returns {string} Rotation key in format "fileId_pageNum"
 */
export function getRotationKey(fileId, pageNum) {
  return `${fileId}_${pageNum}`;
}

/**
 * Validate scale within bounds
 */
export function validateScale(inputScale) {
  return Math.max(APP_CONSTANTS.MIN_SCALE, Math.min(inputScale, APP_CONSTANTS.MAX_SCALE));
}


// ============================================
// UUID GENERATOR (for realtime sync)
// ============================================

/**
 * Generate a UUID v4
 * Used for selections, overlays, and local files to ensure unique IDs across sessions
 * This is critical for Firebase Realtime sync to avoid ID conflicts between users
 */
export function generateUUID() {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape HTML special characters
 */
export function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Debounce function to limit the rate of function execution
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Cleans up canvas and context to prevent memory leaks
 */
export function cleanupCanvas(canvas, ctx = null) {
  if (!canvas) return;

  try {
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx = null;
    }

    canvas.width = 1;
    canvas.height = 1;

    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }

    canvas = null;
  } catch (e) {
    console.warn('[Utils] Canvas cleanup failed:', e.message);
  }
}

/**
 * Check if canvas size is within memory limits
 */
export function isCanvasSizeValid(width, height) {
  const pixelMemory = width * height * 4;
  return pixelMemory <= APP_CONSTANTS.MEMORY_LIMITS.MAX_CANVAS_MEMORY;
}

/**
 * Safe canvas creation with size validation
 */
export function createSafeCanvas(width, height) {
  if (!isCanvasSizeValid(width, height)) {
    const maxSize = Math.floor(Math.sqrt(APP_CONSTANTS.MEMORY_LIMITS.MAX_CANVAS_MEMORY / APP_CONSTANTS.MEMORY_LIMITS.CANVAS_SAFETY_FACTOR));
    throw new Error(`Canvas too large (${width}x${height}). Maximum safe size: ${maxSize}x${maxSize}`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Creates canvas with context and applies rendering options
 */
export function createCanvasWithContext(width, height, options = {}) {
  const canvas = createSafeCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (options.smoothing !== undefined) {
    ctx.imageSmoothingEnabled = options.smoothing;
  }
  if (options.quality) {
    ctx.imageSmoothingQuality = options.quality;
  }

  return { canvas, ctx };
}

/**
 * Convert base64 to Blob
 */
export async function base64ToBlob(base64) {
  try {
    const response = await fetch(base64);
    return await response.blob();
  } catch (error) {
    console.error('[Utils] Failed to convert base64 to blob:', error);
    throw error;
  }
}

/**
 * Download blob as file
 */
export function downloadBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), APP_CONSTANTS.UI_TIMING.URL_CLEANUP_DELAY);
  } catch (error) {
    console.error('[Utils] Failed to download blob:', error);
    throw error;
  }
}

/**
 * Show button feedback message
 */
export function showButtonFeedback(button, message, backgroundColor, duration = APP_CONSTANTS.UI_TIMING.BUTTON_FEEDBACK_DURATION) {
  if (!button) return;

  const originalText = button.textContent;
  const originalBackground = button.style.background;

  button.textContent = message;
  button.style.background = backgroundColor;

  setTimeout(() => {
    button.textContent = originalText;
    button.style.background = originalBackground;
  }, duration);
}

/**
 * Apply rotation transformation to canvas context
 * Dùng chung cho renderImageOnCanvas() và captureFromImageSource()
 */
export function applyCanvasRotation(ctx, rotation, canvasWidth, canvasHeight) {
  if (rotation === 90) {
    ctx.translate(canvasWidth, 0);
  } else if (rotation === 180) {
    ctx.translate(canvasWidth, canvasHeight);
  } else if (rotation === 270) {
    ctx.translate(0, canvasHeight);
  }
  if (rotation) {
    ctx.rotate(rotation * Math.PI / 180);
  }
}

// ============================================
// BINARY CONVERSION
// ============================================

/** Chuyển base64 string → Uint8Array (dùng cho PDF bytes, image binary) */
export function base64ToUint8Array(base64) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// ============================================
// AUTH HELPERS
// ============================================

/** Lấy email user hiện tại từ Firebase Auth */
export function getCurrentEmail() {
  return window.firebaseAuth?.currentUser?.email || null;
}

// ============================================
// EXPORT TO GLOBAL SCOPE
// ============================================

window.FILE_TYPES = FILE_TYPES;
window.isImageFile = isImageFile;
window.isPdfFile = isPdfFile;
window.isTextFile = isTextFile;
window.isArchiveFile = isArchiveFile;
window.APP_CONSTANTS = APP_CONSTANTS;
window.getRotationKey = getRotationKey;
window.validateScale = validateScale;
window.applyCanvasRotation = applyCanvasRotation;
window.generateUUID = generateUUID;  // UUID for realtime sync compatibility

window.base64ToUint8Array = base64ToUint8Array;
window.getCurrentEmail = getCurrentEmail;
window.escapeHTML = escapeHTML;
window.debounce = debounce;
window.cleanupCanvas = cleanupCanvas;
window.isCanvasSizeValid = isCanvasSizeValid;
window.createSafeCanvas = createSafeCanvas;
window.createCanvasWithContext = createCanvasWithContext;
window.base64ToBlob = base64ToBlob;
window.downloadBlob = downloadBlob;
window.showButtonFeedback = showButtonFeedback;

// ==================== TEXTAREA SYNC ====================

/**
 * Sync all textarea values to selection objects
 */
export function syncAllTextareaValues(force = false) {
  if (!window.selections) return;

  window.selections.forEach(selection => {
    const selectionId = selection.name || selection.id;

    const el = document.getElementById(`sidebar-vietnamese-${selectionId}`);
    if (!el) {
      console.warn(`[syncAllTextareaValues] Element #sidebar-vietnamese-${selectionId} not found`);
      return;
    }
    selection.translation = el.value;

    const noteTextarea = document.getElementById(`sidebar-note-${selectionId}`);
    if (noteTextarea) {
      selection.note = noteTextarea.value;
    }
  });
}

window.syncAllTextareaValues = syncAllTextareaValues;

// ==================== DOM HELPERS ====================

/**
 * Reset pdfWrapper inline styles về mặc định
 * Dùng khi chuyển file để xóa styles do archive placeholder hoặc text editor đã set
 */
export function resetPdfWrapperStyles() {
  const pdfWrapper = document.getElementById('pdfWrapper');
  if (pdfWrapper) {
    pdfWrapper.style.alignItems = '';
    pdfWrapper.style.justifyContent = '';
    pdfWrapper.style.minHeight = '';
    pdfWrapper.style.width = '';
    pdfWrapper.style.height = '';
    pdfWrapper.style.position = '';
  }
  return pdfWrapper;
}

window.resetPdfWrapperStyles = resetPdfWrapperStyles;
