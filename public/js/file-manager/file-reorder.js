/** File Reorder — drag-to-reorder file trong sidebar */

import { displayLocalFileList } from './file-core.js';

// ============================================
// DRAG & DROP REORDER FILES
// ============================================

/**
 * Di chuyển file từ vị trí fromIndex sang toIndex trong appState.files
 * Cập nhật currentFileIndex và re-render file list
 */
export function reorderFile(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= appState.files.length) return;
  if (toIndex < 0 || toIndex > appState.files.length) return;

  // Remove file from old position, insert at new position
  const [movedFile] = appState.files.splice(fromIndex, 1);
  appState.files.splice(toIndex, 0, movedFile);

  // Update currentFileIndex to follow the active file
  const currentFileId = appState.currentFile?.id;
  if (currentFileId) {
    appState.currentFileIndex = appState.files.findIndex(f => f.id === currentFileId);
  }

  // Re-render file list
  displayLocalFileList();

  // Thứ tự file chỉ lưu RAM, đợi Ctrl+S mới ghi RTDB
}

/**
 * Gắn drag & drop handlers cho file item (kéo thả sắp xếp)
 */
export function setupFileItemDragHandlers(fileItem, index, fileListContainer) {
  fileItem.ondragstart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    fileItem.classList.add('dragging');
  };
  fileItem.ondragend = () => {
    fileItem.classList.remove('dragging');
    fileListContainer.querySelectorAll('.drag-over-left, .drag-over-right').forEach(el => {
      el.classList.remove('drag-over-left', 'drag-over-right');
    });
  };
  fileItem.ondragover = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = fileItem.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    fileItem.classList.remove('drag-over-left', 'drag-over-right');
    fileItem.classList.add(e.clientX < midX ? 'drag-over-left' : 'drag-over-right');
  };
  fileItem.ondragleave = () => {
    fileItem.classList.remove('drag-over-left', 'drag-over-right');
  };
  fileItem.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileItem.classList.remove('drag-over-left', 'drag-over-right');
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(fromIndex)) return;
    const rect = fileItem.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    let toIndex = e.clientX < midX ? index : index + 1;
    if (fromIndex < toIndex) toIndex--;
    if (fromIndex === toIndex) return;
    reorderFile(fromIndex, toIndex);
  };
}
