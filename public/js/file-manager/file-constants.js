/**
 * File Manager Constants & Shared Utilities
 * Tách riêng để tránh circular import giữa index.js ↔ file con
 */

// ============================================
// SHARED STATE
// ============================================

// Track file đã xóa khỏi RAM nhưng chưa xóa trên Storage (đợi Ctrl+S)
export const pendingFileDeletes = [];

// ============================================
// SUPPORTED FILE TYPES FOR LOCAL UPLOAD
// ============================================

export const SUPPORTED_FILE_TYPES = {
  pdf: ['application/pdf'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
  text: ['text/plain'],
  archive: [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/vnd.rar',
    'application/x-7z-compressed'
  ]
};

// Archive file extensions (for extension-based detection)
export const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z'];

// ============================================
// SHARED HELPERS
// ============================================

// Fetch có auth token — dùng firebaseAuthFetch nếu có, fallback fetch thường
export function getAuthFetch() {
  return window.firebaseAuthFetch ?? fetch;
}
