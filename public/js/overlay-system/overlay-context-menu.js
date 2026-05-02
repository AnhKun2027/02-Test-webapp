/** Overlay System - Context menu (right-click) for overlays */

import { generateUUID } from '../core-utils.js';
import { updateRotateButtonState } from '../page-utils.js';
import {
  copiedOverlay, setCopiedOverlay,
  overlayContextMenu, setOverlayContextMenu,
  getOverlayKey,
  deselectAllOverlays,
  OVERLAY_CONSTANTS
} from './overlay-shared.js';

// ============================================
// CLIPBOARD HELPER (private)
// ============================================

async function copyOverlayToClipboard(overlayData, type) {
  try {
    if (type === 'image') {
      const src = overlayData.imageUrl || overlayData.dataUrl || overlayData.url;
      if (!src) return;

      let blob;
      if (src.startsWith('data:')) {
        const arr = src.split(',');
        const u8arr = window.base64ToUint8Array(arr[1]);
        blob = new Blob([u8arr], { type: 'image/png' });
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          const fetchFn = window.firebaseAuthFetch || fetch;
          const response = await fetchFn(src, { signal: controller.signal });
          const buffer = await response.arrayBuffer();
          blob = new Blob([buffer], { type: 'image/png' });
        } finally {
          clearTimeout(timeoutId);
        }
      }

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      console.log('[Overlay] Đã copy ảnh vào clipboard Windows');
    } else if (type === 'text') {
      const text = overlayData.text || '';
      if (text.trim()) {
        await navigator.clipboard.writeText(text);
        console.log('[Overlay] Đã copy text vào clipboard Windows');
      }
    }
  } catch (err) {
    console.warn('[Overlay] Không thể copy vào clipboard Windows:', err.message);
  }
}

export { copyOverlayToClipboard };

/**
 * Hiện context menu (chuột phải) cho overlay
 */
/** Helper: tạo HTML cho context menu dựa trên type overlay */
function _createMenuHTML(type) {
  let menuHTML = `
    <div class="context-menu-item" data-action="copy">
      <span class="context-menu-icon">📋</span>
      <span>Copy</span>
    </div>`;

  if (copiedOverlay) {
    menuHTML += `
    <div class="context-menu-item" data-action="paste">
      <span class="context-menu-icon">📌</span>
      <span>Paste</span>
    </div>`;
  }

  if (type === 'text') {
    menuHTML += `
    <div class="context-menu-item" data-action="edit">
      <span class="context-menu-icon">✏️</span>
      <span>Sửa text</span>
    </div>`;
  }

  menuHTML += `
    <div class="context-menu-item delete" data-action="delete">
      <span class="context-menu-icon">🗑️</span>
      <span>Xóa</span>
    </div>`;

  return menuHTML;
}

/** Helper: xử lý action khi user click vào menu item */
function _handleMenuAction(action, type, overlayData, container) {
  const { renderImageOverlay, removeImageOverlay } = await_imports._image;
  const { renderTextOverlay, removeTextOverlay } = await_imports._text;

  if (action === 'copy') {
    setCopiedOverlay({ type, data: { ...overlayData } });
    void copyOverlayToClipboard(overlayData, type).catch(err => console.error('[Overlay] Copy failed:', err));
  } else if (action === 'paste') {
    if (copiedOverlay) {
      const newData = {
        ...copiedOverlay.data,
        id: generateUUID(),
        x: copiedOverlay.data.x + OVERLAY_CONSTANTS.PASTE_OFFSET,
        y: copiedOverlay.data.y + OVERLAY_CONSTANTS.PASTE_OFFSET,
        fileId: window.appState.currentFile.id,
        page: window.appState.currentPage,
        scale: window.appState.scale,
      };
      const key = getOverlayKey();
      if (copiedOverlay.type === 'image') {
        newData._pending = true;
        if (!window.imageOverlays[key]) window.imageOverlays[key] = [];
        window.imageOverlays[key].push(newData);
        renderImageOverlay(newData);
      } else {
        if (!window.textOverlays[key]) window.textOverlays[key] = [];
        window.textOverlays[key].push(newData);
        renderTextOverlay(newData);
      }
      updateRotateButtonState();
    }
  } else if (action === 'edit') {
    const textEl = container.querySelector('.text-overlay-content');
    if (textEl) {
      container.classList.add('editing');
      textEl.focus();
    }
  } else if (action === 'delete') {
    if (type === 'image') {
      removeImageOverlay(overlayData.id);
    } else {
      removeTextOverlay(overlayData.id);
    }
  }
}

/** Helper: đặt vị trí menu, điều chỉnh nếu tràn viewport */
function _positionMenu(menu, x, y) {
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  document.body.appendChild(menu);
  setOverlayContextMenu(menu);

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${x - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${y - rect.height}px`;
  }
}

export function showOverlayContextMenu(e, type, overlayData, container) {
  e.preventDefault();
  e.stopPropagation();

  // Xóa menu cũ nếu có
  if (overlayContextMenu) {
    overlayContextMenu.remove();
    setOverlayContextMenu(null);
  }

  // Select overlay này
  deselectAllOverlays();
  container.classList.add('selected');

  // Tạo menu mới
  const menu = document.createElement('div');
  menu.className = 'file-context-menu show';
  menu.innerHTML = _createMenuHTML(type);

  _positionMenu(menu, e.clientX, e.clientY);

  menu.onclick = (ev) => {
    const action = ev.target.closest('.context-menu-item')?.dataset.action;
    if (!action) return;

    _handleMenuAction(action, type, overlayData, container);

    if (overlayContextMenu) {
      overlayContextMenu.remove();
      setOverlayContextMenu(null);
    }
  };

  const closeMenu = (ev) => {
    if (overlayContextMenu && !overlayContextMenu.contains(ev.target)) {
      overlayContextMenu.remove();
      setOverlayContextMenu(null);
      document.removeEventListener('mousedown', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
}

// Store references for context menu (avoids circular import issues)
// Set by index.js after all imports are resolved
export const await_imports = {
  _image: { renderImageOverlay: null, removeImageOverlay: null },
  _text: { renderTextOverlay: null, removeTextOverlay: null }
};
