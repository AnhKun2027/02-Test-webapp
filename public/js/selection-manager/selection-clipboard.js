/**
 * Selection Clipboard - Image capture, copy to clipboard, and download functions
 */

import { base64ToBlob, showButtonFeedback, downloadBlob } from '../core-utils.js';

export function getSelectionImageData(selection) {
  const canvas = document.getElementById('pdfCanvas');
  if (!canvas) return null;

  let tempCanvas = null;
  try {
    tempCanvas = document.createElement('canvas');
    tempCanvas.width = selection.width;
    tempCanvas.height = selection.height;

    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(
      canvas,
      selection.x, selection.y, selection.width, selection.height,
      0, 0, selection.width, selection.height
    );

    return tempCanvas.toDataURL('image/png').split(',')[1];
  } finally {
    if (tempCanvas) {
      tempCanvas.width = 0;
      tempCanvas.height = 0;
      tempCanvas = null;
    }
  }
}

export async function getSelectionBlob(selectionId, errorMessage) {
  selectionId = String(selectionId);
  const selection = window.selections.find(s => s.id === selectionId);

  if (!selection) {
    alert(errorMessage || 'ERROR: Không tìm thấy vùng chọn!');
    return null;
  }

  if (!selection.url) {
    const imageData = getSelectionImageData(selection);
    if (imageData) {
      selection.url = 'data:image/png;base64,' + imageData;
    } else {
      alert(errorMessage || 'ERROR: Không tìm thấy hình ảnh!');
      return null;
    }
  }

  const blob = await base64ToBlob(selection.url);
  return { blob, selection };
}

export async function copySelection(selectionId, event) {
  try {
    const result = await getSelectionBlob(selectionId, 'ERROR: Không tìm thấy hình ảnh để copy!');
    if (!result) return;

    await navigator.clipboard.write([
      new ClipboardItem({
        [result.blob.type]: result.blob
      })
    ]);

    if (event && event.target) {
      showButtonFeedback(event.target, 'Copied!', '#28a745');
    }
  } catch (error) {
    console.error('[Selection] Copy to clipboard failed:', error);
    alert('ERROR: Không thể copy hình ảnh. Trình duyệt có thể không hỗ trợ tính năng này.');
  }
}

export async function downloadSelection(selectionId, event) {
  try {
    const result = await getSelectionBlob(selectionId, 'ERROR: Không tìm thấy hình ảnh để tải về!');
    if (!result) return;

    const filename = `${selectionId}.png`;
    downloadBlob(result.blob, filename);

    if (event && event.target) {
      showButtonFeedback(event.target, 'Downloaded!', '#17a2b8');
    }
  } catch (error) {
    console.error('[Selection] Download failed:', error);
    alert('ERROR: Không thể tải về hình ảnh!');
  }
}
