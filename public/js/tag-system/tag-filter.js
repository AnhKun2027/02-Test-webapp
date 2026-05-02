/**
 * Tag System — Filter logic
 *
 * Lọc file và page theo activeTagFilters (AND logic nếu nhiều filter).
 * File/page được hiển thị khi chứa TẤT CẢ filter tags đang chọn.
 */

import { tagState, syncWindowActiveFilters } from './tag-state.js';

/**
 * Set active filters và refresh UI
 * @param {Array<string>} tagsArray - Mảng tag đang lọc
 */
export function filterByTags(tagsArray) {
  tagState.activeTagFilters = tagsArray || [];
  syncWindowActiveFilters();

  // Refresh file manager
  if (typeof window.displayFiles === 'function') window.displayFiles(appState.files);

  // Refresh pages sidebar
  if (appState.pdfDoc && typeof window.renderThumbnails === 'function') {
    window.renderThumbnails();
  }
}

// Combo format hiện tại là "_N" đơn giản → so sánh trực tiếp bằng includes

/**
 * Check if file matches current tag filters (AND logic)
 * @param {Object} file - File object có .tags và .pageTags
 */
export function fileMatchesFilter(file) {
  if (tagState.activeTagFilters.length === 0) return true; // Không filter = show all

  // AND logic: TẤT CẢ filter tags phải có mặt — ở file.tags HOẶC bất kỳ page nào
  return tagState.activeTagFilters.every(filterTag =>
    (file.tags || []).includes(filterTag) ||
    Object.values(file.pageTags || {}).some(pageTags =>
      (pageTags || []).includes(filterTag)
    )
  );
}

/**
 * Check if page matches current tag filters (AND logic)
 * @param {number} pageNum - Page number
 */
export function pageMatchesFilter(pageNum) {
  if (tagState.activeTagFilters.length === 0) return true;
  if (!appState.currentFile) return true;

  // AND logic: TẤT CẢ filter tags phải có — ở file.tags HOẶC đúng page này
  return tagState.activeTagFilters.every(filterTag =>
    (appState.currentFile.tags || []).includes(filterTag) ||
    (appState.currentFile.pageTags?.[pageNum] || []).includes(filterTag)
  );
}
