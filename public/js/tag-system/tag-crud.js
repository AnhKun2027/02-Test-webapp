/**
 * Tag System — CRUD
 *
 * Thêm/xoá tag trên file và page.
 * Chỉ update RAM + UI — save lên Firebase chờ Ctrl+S.
 */

import { updatePageThumbnailTags } from './tag-ui.js';

/**
 * Add tag to file
 */
export function addTagToFile(fileId, comboStr) {
  const file = appState.files.find(f => f.id === fileId);
  if (!file) return;
  file.tags ??= [];

  if (!file.tags.includes(comboStr)) {
    file.tags.push(comboStr);
    if (typeof window.displayFiles === 'function') window.displayFiles(appState.files);
  }
}

/**
 * Remove tag from file
 */
export function removeTagFromFile(fileId, comboStr) {
  const file = appState.files.find(f => f.id === fileId);
  if (!file || !file.tags) return;
  file.tags = file.tags.filter(t => t !== comboStr);
  if (typeof window.displayFiles === 'function') window.displayFiles(appState.files);
}

/**
 * Add tag (combo string) to page
 */
export function addTagToPage(pageNum, comboStr) {
  if (!appState.currentFile) return;

  appState.currentFile.pageTags ??= {};
  appState.currentFile.pageTags[pageNum] ??= [];

  if (!appState.currentFile.pageTags[pageNum].includes(comboStr)) {
    appState.currentFile.pageTags[pageNum].push(comboStr);
    updatePageThumbnailTags(pageNum);
  }
}

/**
 * Remove tag (combo string) from page
 */
export function removeTagFromPage(pageNum, comboStr) {
  if (!appState.currentFile?.pageTags?.[pageNum]) return;

  appState.currentFile.pageTags[pageNum] = appState.currentFile.pageTags[pageNum].filter(t => t !== comboStr);
  // Clean up empty arrays
  if (appState.currentFile.pageTags[pageNum].length === 0) {
    delete appState.currentFile.pageTags[pageNum];
  }

  updatePageThumbnailTags(pageNum);
}
