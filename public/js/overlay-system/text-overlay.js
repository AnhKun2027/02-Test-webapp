/**
 * Text Overlay Module
 * Handles text overlays: add, render, remove, font/color controls
 */

import { generateUUID } from '../core-utils.js';
import { updateRotateButtonState } from '../page-utils.js';
import {
  ensureOverlaysVisible,
  getOverlayKey,
  deselectAllOverlays,
  calcOverlayCenterPosition,
  OVERLAY_CONSTANTS
} from './overlay-shared.js';
import { makeOverlayDraggable, makeOverlayResizable } from './overlay-drag-resize.js';
import { showOverlayContextMenu } from './overlay-context-menu.js';

// ============================================
// TEXT OVERLAY FUNCTIONS
// ============================================

/** Tạo overlayData mặc định cho text overlay (dùng style/scale hiện tại của appState) */
function _createTextOverlayData(text) {
  const appState = window.appState;
  return {
    id: generateUUID(),
    fileId: appState.currentFile.id,
    text,
    x: 0, y: 0, // caller set sau qua calcOverlayCenterPosition
    width: OVERLAY_CONSTANTS.TEXT_DEFAULT_WIDTH,
    fontSize: OVERLAY_CONSTANTS.TEXT_DEFAULT_FONT_SIZE * appState.scale,
    color: OVERLAY_CONSTANTS.TEXT_DEFAULT_COLOR,
    backgroundColor: OVERLAY_CONSTANTS.TEXT_DEFAULT_BG,
    scale: appState.scale,
    page: appState.currentPage,
  };
}

/** Push overlayData vào shared state + render. Tách ra để dùng chung 2 entry tạo text overlay. */
function _pushAndRenderText(overlayData) {
  const key = getOverlayKey();
  if (!window.textOverlays[key]) window.textOverlays[key] = [];
  window.textOverlays[key].push(overlayData);

  ensureOverlaysVisible();
  renderTextOverlay(overlayData);
  updateRotateButtonState();
}

/**
 * Tạo text overlay trống
 * User tự gõ text vào, giống "Add Text" trong PDF reader
 */
export function addEmptyTextOverlay() {
  const appState = window.appState;
  if (!appState.currentFile) {
    alert('Vui lòng mở file PDF/ảnh trước khi thêm text!');
    return false;
  }

  const { x, y } = calcOverlayCenterPosition(OVERLAY_CONSTANTS.TEXT_DEFAULT_WIDTH, OVERLAY_CONSTANTS.TEXT_DEFAULT_HEIGHT);
  const overlayData = { ..._createTextOverlayData(''), x, y };
  _pushAndRenderText(overlayData);

  // Auto focus — chờ DOM commit (rAF) thay vì setTimeout magic 100ms; check race file switch
  requestAnimationFrame(() => {
    if (window.appState.currentFile?.id !== overlayData.fileId) return;
    const el = document.getElementById(`text-overlay-${overlayData.id}`);
    if (!el) return;
    const content = el.querySelector('.text-overlay-content');
    if (!content) return;
    content.focus();
    el.classList.add('selected');
  });

  return true;
}

/**
 * Add text overlay from clipboard
 */
export async function addTextOverlayFromClipboard(text) {
  const appState = window.appState;
  if (!appState.currentFile) {
    return false;
  }

  if (!text || text.trim() === '') {
    return false;
  }

  const { x, y } = calcOverlayCenterPosition(OVERLAY_CONSTANTS.TEXT_DEFAULT_WIDTH, OVERLAY_CONSTANTS.TEXT_DEFAULT_HEIGHT);
  // Staging: CHƯA lưu RTDB
  const overlayData = { ..._createTextOverlayData(text.trim()), x, y };
  _pushAndRenderText(overlayData);

  return true;
}

/**
 * Render a text overlay element
 * Luôn tạo mới — DOM cũ đã được xóa bởi renderOverlaysForCurrentPage()
 */
export function renderTextOverlay(overlayData) {
  const selectionOverlay = document.getElementById('selectionOverlay');
  if (!selectionOverlay) return;

  const appState = window.appState;
  const scaleRatio = appState.scale / (overlayData.scale || appState.scale);

  const container = document.createElement('div');
  container.className = 'text-overlay-item';
  if (!window.isSelBoxesVisible) container.style.display = 'none';
  container.id = `text-overlay-${overlayData.id}`;

  container.setAttribute('data-file-id', overlayData.fileId || '');
  container.setAttribute('data-page', overlayData.page);

  container.style.left = `${overlayData.x * scaleRatio}px`;
  container.style.top = `${overlayData.y * scaleRatio}px`;
  container.style.width = `${overlayData.width * scaleRatio}px`;
  container.style.backgroundColor = overlayData.backgroundColor;

  // Create text content (editable)
  const textContent = document.createElement('div');
  textContent.className = 'text-overlay-content';
  textContent.contentEditable = 'true';
  textContent.innerText = overlayData.text;
  textContent.style.color = overlayData.color;
  textContent.style.fontSize = `${overlayData.fontSize * scaleRatio}px`;

  // Blur → lưu text vào memory + xóa editing class
  textContent.onblur = () => {
    overlayData.text = textContent.innerText;
    container.classList.remove('editing');
  };

  // Prevent drag when editing text
  textContent.onmousedown = (e) => {
    if (document.activeElement === textContent || container.classList.contains('editing')) {
      e.stopPropagation();
    }
  };

  // Double-click to edit
  textContent.ondblclick = () => {
    container.classList.add('editing');
    textContent.focus();
  };

  // Create resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'text-overlay-resize';

  // Append to container
  container.appendChild(textContent);
  container.appendChild(resizeHandle);
  selectionOverlay.appendChild(container);

  makeOverlayDraggable(container, overlayData, true, textContent);
  makeOverlayResizable(container, resizeHandle, overlayData, true);

  // Click to select
  container.onmousedown = (e) => {
    if (e.target === resizeHandle) return;

    deselectAllOverlays();

    container.classList.add('selected');
  };

  // Right-click context menu
  container.oncontextmenu = (e) => {
    showOverlayContextMenu(e, 'text', overlayData, container);
  };

}

/**
 * Remove a text overlay
 */
export function removeTextOverlay(overlayId) {
  const element = document.getElementById(`text-overlay-${overlayId}`);
  if (element) {
    element.remove();
  }

  const key = getOverlayKey();
  if (window.textOverlays[key]) {
    window.textOverlays[key] = window.textOverlays[key].filter(o => o.id !== overlayId);
  }

  updateRotateButtonState();

  // [REMOVED] deleteSingleTextOverlay — chờ Ctrl+S để sync

}
