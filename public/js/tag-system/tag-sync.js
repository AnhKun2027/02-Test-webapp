/**
 * Tag System — Remote sync
 *
 * Nhận tag từ Firebase listener và apply vào appState.
 * Xử lý cả trường hợp tag bị XOÁ ở remote → clear tag local tương ứng.
 *
 * Được gọi bởi sync-core.js qua window.applyRemoteFileTags / applyRemotePageTags.
 */

/** So sánh 2 mảng (không sort): độ dài + giá trị từng phần tử */
function _arraysEqualOrdered(a, b) {
  if (a === b) return true;
  if (!a || !b) return (!a || a.length === 0) && (!b || b.length === 0);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Apply remote file tags from Firebase to appState
 * @param {Object} remoteData - {fileId: {fileId, fileName, tags[], ...}} hoặc {} nếu bị clear hết
 */
export function applyRemoteFileTags(remoteData) {
  if (!appState?.files) return;

  // Xử lý null/undefined như object rỗng (đã clear hết)
  remoteData = remoteData || {};

  let hasChanges = false;

  const remoteFileIds = new Set(Object.keys(remoteData));

  appState.files.forEach(file => {
    if (!file.id) return;

    const remoteTagData = remoteData[file.id];

    if (remoteTagData && remoteTagData.tags) {
      // Remote có tag → update local
      if (!_arraysEqualOrdered(file.tags, remoteTagData.tags)) {
        file.tags = remoteTagData.tags;
        hasChanges = true;
      }
    } else if (!remoteFileIds.has(file.id) && file.tags && file.tags.length > 0) {
      // Remote KHÔNG có nhưng local có → clear
      file.tags = [];
      hasChanges = true;
    }
  });

  // Refresh UI khi có thay đổi
  if (hasChanges && typeof window.displayFiles === 'function') {
    window.displayFiles(appState.files);
  }
}

/**
 * Apply remote page tags from Firebase to appState
 * @param {Object} remoteData - {fileId_page: {fileId, fileName, pageNum, tags[], ...}} hoặc {} nếu bị clear hết
 */
export function applyRemotePageTags(remoteData) {
  if (!appState?.files) return;

  remoteData = remoteData || {};

  let hasChanges = false;

  const remoteKeys = new Set(Object.keys(remoteData));

  // 1. Update tags đang có ở remote
  Object.values(remoteData).forEach(tagData => {
    const file = appState.files.find(f => f.id === tagData.fileId);
    if (file && tagData.tags) {
      if (!file.pageTags) file.pageTags = {};

      if (!_arraysEqualOrdered(file.pageTags[tagData.pageNum], tagData.tags)) {
        file.pageTags[tagData.pageNum] = tagData.tags;
        hasChanges = true;
      }
    }
  });

  // 2. Clear local page tags KHÔNG còn ở remote
  appState.files.forEach(file => {
    if (!file.id || !file.pageTags) return;

    Object.keys(file.pageTags).forEach(pageNum => {
      const key = `${file.id}_${pageNum}`;
      if (!remoteKeys.has(key) && file.pageTags[pageNum] && file.pageTags[pageNum].length > 0) {
        // Xoá key (không chỉ set array rỗng) — nhất quán với removeTagFromPage
        delete file.pageTags[pageNum];
        hasChanges = true;
      }
    });
  });

  // Refresh thumbnails khi đang xem PDF
  if (hasChanges && typeof window.renderThumbnails === 'function' && appState.pdfDoc) {
    window.renderThumbnails();
  }
}
