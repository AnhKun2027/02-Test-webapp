/**
 * Selection Core Module
 * Core: init, mouse handlers, selection box rendering, page rendering
 */

import { generateUUID } from '../core-utils.js';
import { updateRotateButtonState } from '../page-utils.js';
import { getSelectionFields, queueSelection, showOnlySelection, showAllSelections, getCurrentFileId } from './selection-actions.js';
import { createSelectionSidebarElement, calculateAutoFontSize } from './selection-sidebar.js';
import { updateSelectionCount, updateAiBadge } from './selection-badges.js';
import { showSelectionContextMenu } from './selection-context-menu.js';

// Constants
const SELECTION_CONSTANTS = Object.freeze({
  MIN_SIZE: 10,        // px tối thiểu để tính là selection (loại click nhầm)
  MIN_RESIZE: 20,      // px tối thiểu khi resize
  HANDLE_SIZE: 8,      // px kích thước handle
  HANDLE_OFFSET: 4,    // px offset handle (= -SIZE/2)
  ACTIVE_Z_INDEX: '200',
});

// Selection state
let isSelecting = false;
let startPos = null;
let currentSelection = null;
let cachedCanvasRect = null;
let isSelectionManagerInitialized = false;

function handleSelectionBoxClick(e, selectionId) {
  e.stopPropagation();
  document.querySelectorAll('.selection-box').forEach(el => {
    el.style.zIndex = '';
  });
  e.currentTarget.style.zIndex = SELECTION_CONSTANTS.ACTIVE_Z_INDEX;

  document.querySelectorAll('.image-overlay-item.selected').forEach(el => {
    el.classList.remove('selected');
  });
  document.querySelectorAll('.text-overlay-item.selected').forEach(el => {
    el.classList.remove('selected');
  });
  showOnlySelection(selectionId);
}


export function initSelectionManager() {
  if (isSelectionManagerInitialized) return;

  const canvas = document.getElementById('pdfCanvas');
  const selectionOverlay = document.getElementById('selectionOverlay');

  if (!canvas || !selectionOverlay) {
    console.warn('[Selection] Canvas or overlay not found');
    return;
  }

  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  selectionOverlay.addEventListener('click', (e) => {
    if (e.target === selectionOverlay) showAllSelections();
  });

  isSelectionManagerInitialized = true;
  console.log('[Selection] Selection manager initialized');
}

function handleMouseDown(e) {
  if (!appState.isSelectMode) return;

  const canvas = document.getElementById('pdfCanvas');
  cachedCanvasRect = canvas.getBoundingClientRect();

  startPos = {
    x: e.clientX - cachedCanvasRect.left,
    y: e.clientY - cachedCanvasRect.top
  };

  isSelecting = true;

  currentSelection = document.createElement('div');
  currentSelection.className = 'selection-box';
  currentSelection.style.left = startPos.x + 'px';
  currentSelection.style.top = startPos.y + 'px';
  currentSelection.style.width = '0px';
  currentSelection.style.height = '0px';

  const overlay = document.getElementById('selectionOverlay');
  if (overlay) {
    overlay.appendChild(currentSelection);
  }
}

function handleMouseMove(e) {
  if (!isSelecting || !currentSelection) return;

  const currentPos = {
    x: e.clientX - cachedCanvasRect.left,
    y: e.clientY - cachedCanvasRect.top
  };

  const width = Math.abs(currentPos.x - startPos.x);
  const height = Math.abs(currentPos.y - startPos.y);
  const left = Math.min(currentPos.x, startPos.x);
  const top = Math.min(currentPos.y, startPos.y);

  currentSelection.style.left = left + 'px';
  currentSelection.style.top = top + 'px';
  currentSelection.style.width = width + 'px';
  currentSelection.style.height = height + 'px';
}

function handleMouseUp(e) {
  if (!isSelecting || !currentSelection) return;

  isSelecting = false;

  const endPos = {
    x: e.clientX - cachedCanvasRect.left,
    y: e.clientY - cachedCanvasRect.top
  };

  cachedCanvasRect = null;

  const width = Math.abs(endPos.x - startPos.x);
  const height = Math.abs(endPos.y - startPos.y);

  if (width > SELECTION_CONSTANTS.MIN_SIZE && height > SELECTION_CONSTANTS.MIN_SIZE) {
    const selection = {
      id: generateUUID(),
      x: Math.min(startPos.x, endPos.x),
      y: Math.min(startPos.y, endPos.y),
      width: width,
      height: height,
      page: appState.currentPage,
      scale: appState.scale,
      fileId: getCurrentFileId()
    };

    setupSelectionBox(currentSelection, selection);
    queueSelection(selection);

  } else {
    removeSelectionBox(currentSelection);
  }

  currentSelection = null;
}

function setupSelectionBox(box, selection) {
  box.setAttribute('data-selection-id', selection.id);
  box.style.pointerEvents = 'auto';
  box.style.cursor = 'pointer';

  box.onclick = (e) => handleSelectionBoxClick(e, selection.id);
  box.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    showSelectionContextMenu(e, selection.id);
  };

  addResizeHandles(box, selection);
}

function addResizeHandles(box, selection) {
  const handle = document.createElement('div');
  handle.className = 'selection-resize-handle';
  const size = SELECTION_CONSTANTS.HANDLE_SIZE;
  const offset = SELECTION_CONSTANTS.HANDLE_OFFSET;
  handle.style.cssText = `
    position: absolute;
    right: -${offset}px;
    bottom: -${offset}px;
    width: ${size}px;
    height: ${size}px;
    background: #007bff;
    cursor: se-resize;
    border-radius: 2px;
  `;

  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    startResize(e, box, selection);
  });

  box.appendChild(handle);
}

function startResize(e, box, selection) {
  e.preventDefault();

  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = parseInt(box.style.width, 10);
  const startHeight = parseInt(box.style.height, 10);
  const ctrl = new AbortController();

  function doResize(ev) {
    const newWidth = Math.max(SELECTION_CONSTANTS.MIN_RESIZE, startWidth + (ev.clientX - startX));
    const newHeight = Math.max(SELECTION_CONSTANTS.MIN_RESIZE, startHeight + (ev.clientY - startY));

    box.style.width = newWidth + 'px';
    box.style.height = newHeight + 'px';

    selection.width = newWidth;
    selection.height = newHeight;
  }

  function stopResize() {
    selection.scale = appState.scale;
    ctrl.abort(); // remove cả mousemove + mouseup + blur
  }

  // AbortController gom cleanup — fallback 'blur' bắt trường hợp user release ngoài window
  document.addEventListener('mousemove', doResize, { signal: ctrl.signal });
  document.addEventListener('mouseup', stopResize, { signal: ctrl.signal });
  window.addEventListener('blur', stopResize, { signal: ctrl.signal });
}

function removeSelectionBox(box) {
  box?.remove();
}

export function createSelectionBoxElement(selection) {
  const scaleRatio = appState.scale / (selection.scale ?? 1);
  const newX = selection.x * scaleRatio;
  const newY = selection.y * scaleRatio;
  const newWidth = selection.width * scaleRatio;
  const newHeight = selection.height * scaleRatio;

  const selectionBox = document.createElement('div');
  selectionBox.className = 'selection-box';
  if (!window.isSelBoxesVisible) selectionBox.style.display = 'none';
  selectionBox.style.left = newX + 'px';
  selectionBox.style.top = newY + 'px';
  selectionBox.style.width = newWidth + 'px';
  selectionBox.style.height = newHeight + 'px';
  selectionBox.setAttribute('data-selection-id', selection.id);
  selectionBox.style.pointerEvents = 'auto';
  selectionBox.style.cursor = 'pointer';

  const fields = getSelectionFields(selection);
  if (fields.translation) {
    const vnOverlay = document.createElement('div');
    vnOverlay.className = 'vn-overlay-text';
    vnOverlay.textContent = fields.translation;
    const fontSize = calculateAutoFontSize(newWidth, newHeight, fields.translation.length);
    vnOverlay.style.fontSize = fontSize + 'px';
    vnOverlay.style.lineHeight = (fontSize * 1.2) + 'px';
    if (!window.isVnOverlayVisible) vnOverlay.style.display = 'none';
    selectionBox.appendChild(vnOverlay);
  }

  selectionBox.onclick = (e) => handleSelectionBoxClick(e, selection.id);
  selectionBox.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    showSelectionContextMenu(e, selection.id);
  };

  addResizeHandles(selectionBox, selection);

  return selectionBox;
}

export function renderSelectionsForCurrentPage() {
  const selectionOverlay = document.getElementById('selectionOverlay');
  const selectionList = document.getElementById('selectionList');

  if (!selectionOverlay) return;

  selectionOverlay.querySelectorAll('.selection-box').forEach(el => el.remove());

  if (selectionList) {
    selectionList.replaceChildren();
  }

  const currentFileId = getCurrentFileId();

  const currentFileSelections = !currentFileId
    ? window.selections
    : window.selections.filter(s => s.fileId === currentFileId);

  const sidebarFragment = document.createDocumentFragment();
  currentFileSelections.forEach(selection => {
    sidebarFragment.appendChild(createSelectionSidebarElement(selection));
  });
  if (selectionList) {
    selectionList.appendChild(sidebarFragment);
  }

  const pageSelections = currentFileSelections.filter(s => s.page === appState.currentPage);
  const overlayFragment = document.createDocumentFragment();
  pageSelections.forEach(selection => {
    overlayFragment.appendChild(createSelectionBoxElement(selection));
  });
  selectionOverlay.appendChild(overlayFragment);

  if (typeof renderOverlaysForCurrentPage === 'function') {
    renderOverlaysForCurrentPage();
  }

  updateSelectionCount();
  updateRotateButtonState();
  updateAiBadge();

  requestAnimationFrame(() => {
    const activeId = window.activeSelectionId;
    if (!activeId) return;

    const stillExists = window.selections.some(s =>
      s.id === activeId && s.fileId === currentFileId
    );

    if (stillExists) {
      showOnlySelection(activeId);
    } else {
      window.activeSelectionId = null;
    }
  });
}
