/** App Text Editor — Editable text viewer (textarea + save to Cloud Storage) */

import { appState, showLoading, hideLoading } from './app-core.js';

let _statusTimer = null;
let _isSavingText = false;
// Promise của lần save đang chạy — caller đến trong khi save sẽ chờ chung promise này
// thay vì silent return (semantic queue: lần save đầu tiên thắng, các lần sau cùng kết quả).
let _pendingSavePromise = null;

/** Helper: Tạo DOM elements cho text editor (toolbar + textarea + container) */
function _createTextEditorDOM(container) {
  const textEditorContainer = document.createElement('div');
  textEditorContainer.id = 'textEditorContainer';
  textEditorContainer.style.cssText = `
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: white;
  `;

  // Toolbar with Save button - at BOTTOM with border-top, centered
  const toolbar = document.createElement('div');
  toolbar.id = 'textEditorToolbar';
  toolbar.style.cssText = `
    padding: 8px 12px;
    background: #f5f5f5;
    border-top: 1px solid #ddd;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  `;

  // Save button - toolbar-consistent style
  const saveBtn = document.createElement('button');
  saveBtn.id = 'saveTextBtn';
  saveBtn.innerHTML = '💾 Save Text';
  saveBtn.style.cssText = `
    padding: 4px 8px;
    background: #f8f9fa;
    color: #333;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: normal;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: background-color 0.2s;
  `;
  saveBtn.onclick = saveTextFile;
  saveBtn.onmouseenter = () => { saveBtn.style.background = '#e9ecef'; };
  saveBtn.onmouseleave = () => { saveBtn.style.background = '#f8f9fa'; };

  const statusSpan = document.createElement('span');
  statusSpan.id = 'textEditorStatus';
  statusSpan.style.cssText = 'color: #666; font-size: 13px;';

  toolbar.appendChild(saveBtn);
  toolbar.appendChild(statusSpan);

  // Textarea (editable area) - with Google Fonts and improved styling
  const textarea = document.createElement('textarea');
  textarea.id = 'textEditor';
  textarea.style.cssText = `
    flex: 1;
    width: 100%;
    padding: 32px 40px;
    border: none;
    outline: none;
    resize: none;
    font-family: "Noto Sans", "Noto Sans JP", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Yu Gothic", sans-serif;
    font-size: 24px;
    line-height: 2.0;
    white-space: pre-wrap;
    word-wrap: break-word;
    box-sizing: border-box;
  `;

  // Track changes with Ctrl+S hint
  textarea.oninput = () => {
    const currentFile = appState.currentFile;
    if (!currentFile) return;
    const hasChanges = textarea.value !== currentFile.originalTextContent;
    const statusEl = document.getElementById('textEditorStatus');
    statusEl.textContent = hasChanges ? '● Chưa lưu (Ctrl+S để lưu)' : '';
    statusEl.style.color = hasChanges ? '#e67e22' : '#666';
    currentFile.textContent = textarea.value;
  };

  textEditorContainer.appendChild(textarea);
  textEditorContainer.appendChild(toolbar);
  container.appendChild(textEditorContainer);

  return textEditorContainer;
}

/**
 * Render editable text editor (like Notepad)
 * Updated with Google Fonts, toolbar-consistent button style, Ctrl+S shortcut
 */
export function renderTextEditor(textContent, file) {
  const canvas = document.getElementById('pdfCanvas');
  const container = document.getElementById('pdfWrapper');
  const pdfArea = document.querySelector('.pdf-area');

  // Hide canvas
  canvas.style.display = 'none';

  // Make text editor full .pdf-area (no padding)
  if (pdfArea) {
    pdfArea.style.padding = '0';
  }
  if (container) {
    container.style.cssText = 'width: 100%; height: 100%; position: relative;';
  }

  // Tạo DOM lần đầu, hoặc lấy container đã có
  let textEditorContainer = document.getElementById('textEditorContainer');
  if (!textEditorContainer) {
    textEditorContainer = _createTextEditorDOM(container);
  }

  textEditorContainer.style.display = 'flex';
  document.getElementById('textEditor').value = textContent;
  const statusEl = document.getElementById('textEditorStatus');
  statusEl.textContent = '';
  statusEl.style.color = '#666';
}

/**
 * Save text file to Cloud Storage.
 * Queue-pattern: nếu đang save (vd user vừa click Save Text rồi Ctrl+S nhanh),
 * caller mới CHỜ promise đang chạy thay vì silent return → saveAndSyncAll
 * không snapshot text chưa save xong.
 */
export async function saveTextFile() {
  if (_isSavingText && _pendingSavePromise) return _pendingSavePromise;

  const file = appState.currentFile;
  if (!file || (file.type !== 'text' && file.type !== 'text/plain')) return;

  const textarea = document.getElementById('textEditor');
  const statusEl = document.getElementById('textEditorStatus');
  const newContent = textarea.value;

  // No changes
  if (newContent === file.originalTextContent) {
    statusEl.textContent = 'Không có thay đổi';
    statusEl.style.color = '#666';
    return;
  }

  _isSavingText = true;
  _pendingSavePromise = (async () => {
    try {
      statusEl.textContent = 'Đang lưu...';
      statusEl.style.color = '#3498db';

      // Create Blob with UTF-8 charset (proper encoding for Vietnamese/Japanese/etc)
      const textBlob = new Blob([newContent], { type: 'text/plain;charset=utf-8' });
      file.textBlob = textBlob;  // Store for upload

      // Upload to Firebase Storage
      if (window.FirebaseSync && FirebaseSync.sessionId) {
        const storageInfo = await FirebaseSync.uploadFileToStorage(file);
        file.downloadUrl = storageInfo.downloadUrl;
        file.storagePath = storageInfo.storagePath;
        // Metadata se duoc saveSessionSnapshot() ghi chung khi Ctrl+S
      }

      // Update original content (no more unsaved changes)
      file.originalTextContent = newContent;
      file.textContent = newContent;
      statusEl.textContent = '✓ Đã lưu';
      statusEl.style.color = '#27ae60';

      clearTimeout(_statusTimer);
      _statusTimer = setTimeout(() => {
        statusEl.textContent = '';
        statusEl.style.color = '#666';
      }, 2000);
    } catch (error) {
      console.error('[App] Failed to save text file:', appState.currentFile?.name, error);
      statusEl.textContent = '✗ Lưu thất bại: ' + error.message;
      statusEl.style.color = '#e74c3c';
    } finally {
      _isSavingText = false;
    }
  })();

  try {
    return await _pendingSavePromise;
  } finally {
    _pendingSavePromise = null;
  }
}

console.log('[AppTextEditor] Module loaded');
