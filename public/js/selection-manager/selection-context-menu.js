/**
 * Selection Context Menu - Right-click context menu for selection boxes
 */

import { copySelection, downloadSelection } from './selection-clipboard.js';
import { deleteSelection } from './selection-actions.js';

// Context menu state
let selectionContextMenu = null;
let currentContextSelectionId = null;

export function showSelectionContextMenu(event, selectionId) {
  hideSelectionContextMenu();
  currentContextSelectionId = selectionId;

  selectionContextMenu = document.createElement('div');
  selectionContextMenu.className = 'file-context-menu show';
  selectionContextMenu.innerHTML = `
    <div class="context-menu-item" data-action="copy">
      <span class="context-menu-icon">📋</span>
      <span>Copy</span>
    </div>
    <div class="context-menu-item" data-action="download">
      <span class="context-menu-icon">💾</span>
      <span>Download</span>
    </div>
    <div class="context-menu-item delete" data-action="delete">
      <span class="context-menu-icon">🗑️</span>
      <span>Xóa</span>
    </div>
  `;

  document.body.appendChild(selectionContextMenu);

  const menuWidth = selectionContextMenu.offsetWidth || 180;
  const menuHeight = selectionContextMenu.offsetHeight || 120;

  let left = event.pageX;
  let top = event.pageY;

  if (left + menuWidth > window.innerWidth + window.pageXOffset) {
    left = event.pageX - menuWidth;
  }
  if (top + menuHeight > window.innerHeight + window.pageYOffset) {
    top = event.pageY - menuHeight;
  }
  left = Math.max(0, left);
  top = Math.max(0, top);

  selectionContextMenu.style.left = left + 'px';
  selectionContextMenu.style.top = top + 'px';

  selectionContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      handleSelectionContextMenuAction(action, currentContextSelectionId);
      hideSelectionContextMenu();
    });
  });

  setTimeout(() => {
    document.addEventListener('click', hideSelectionContextMenu, { once: true });
  }, 0);
}

export function hideSelectionContextMenu() {
  if (selectionContextMenu) {
    selectionContextMenu.remove();
    selectionContextMenu = null;
  }
  document.removeEventListener('click', hideSelectionContextMenu);
}

function handleSelectionContextMenuAction(action, selectionId) {
  switch (action) {
    case 'copy':
      copySelection(selectionId, null);
      break;
    case 'download':
      downloadSelection(selectionId, null);
      break;
    case 'delete':
      deleteSelection(selectionId);
      break;
  }
}
