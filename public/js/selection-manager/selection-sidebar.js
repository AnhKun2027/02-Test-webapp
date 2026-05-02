/**
 * Selection Sidebar - Sidebar element creation and text sync for selections
 */
import { escapeHTML } from '../core-utils.js';

import { getSelectionFields } from './selection-actions.js';
import { updateAiBadge } from './selection-badges.js';

export function calculateAutoFontSize(boxWidth, boxHeight, textLength) {
  const padX = 10, padY = 6;
  const usableArea = (boxWidth - padX) * (boxHeight - padY);
  if (usableArea <= 0) return 6;
  const charCount = textLength || 1;
  const fillRatio = 0.8;
  return Math.max(6, Math.min(28, Math.sqrt((usableArea * fillRatio) / (charCount * 0.6))));
}

export function createSelectionSidebarElement(selection) {
  const item = document.createElement('div');
  item.className = 'selection-item';
  item.setAttribute('data-item-id', selection.id);

  const imageSrc = selection.url ?? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="100"%3E%3Crect fill="%23f0f0f0" width="200" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23666" font-family="Arial" font-size="14"%3ELoading...%3C/text%3E%3C/svg%3E';

  const uniqueId = selection.id;
  const fields = getSelectionFields(selection);

  const hasAiData = !!(fields.corrected_text || fields.translation);
  const hasNote = !!(selection.note && selection.note.trim());
  const shouldShowAiBlock = hasAiData && !hasNote;
  const shouldShowNoteBlock = !shouldShowAiBlock;

  item.innerHTML = `
    <div class="selection-preview">
      <img src="${imageSrc}" alt="Selection">
    </div>
    ${fields.ocr_accuracy ? `<div class="selection-ocr-accuracy">ocr_accuracy : ${escapeHTML(fields.ocr_accuracy)}</div>` : ''}
    <textarea class="selection-japanese-textarea"
              id="sidebar-japanese-${uniqueId}"
              data-field="corrected_text"
              style="${shouldShowAiBlock ? 'display:block' : ''}"
              placeholder="Tiếng Nhật...">${escapeHTML(fields.corrected_text)}</textarea>
    <textarea class="selection-vietnamese-textarea"
              id="sidebar-vietnamese-${uniqueId}"
              data-field="translation"
              style="${shouldShowAiBlock ? 'display:block' : ''}"
              placeholder="Bản dịch tiếng Việt...">${escapeHTML(fields.translation)}</textarea>
    <textarea class="selection-note-textarea"
              id="sidebar-note-${uniqueId}"
              data-field="note"
              style="${shouldShowNoteBlock ? 'display:block' : ''}"
              placeholder="Ghi chú...">${escapeHTML(selection.note ?? '')}</textarea>
  `;

  const japaneseTextarea = item.querySelector(`#sidebar-japanese-${uniqueId}`);
  const vietnameseTextarea = item.querySelector(`#sidebar-vietnamese-${uniqueId}`);

  const setupLocalSync = (textarea, fieldName) => {
    if (!textarea) return;

    textarea.addEventListener('input', () => {
      selection[fieldName] = textarea.value;
      updateAiBadge();

      if (fieldName === 'translation') {
        const selBox = document.querySelector(`.selection-box[data-selection-id="${selection.id}"]`);
        if (selBox) {
          let vnOverlay = selBox.querySelector('.vn-overlay-text');
          if (textarea.value) {
            if (!vnOverlay) {
              vnOverlay = document.createElement('div');
              vnOverlay.className = 'vn-overlay-text';
              if (!window.isVnOverlayVisible) vnOverlay.style.display = 'none';
              selBox.appendChild(vnOverlay);
            }
            vnOverlay.textContent = textarea.value;
            const fontSize = calculateAutoFontSize(selBox.offsetWidth, selBox.offsetHeight, textarea.value.length);
            vnOverlay.style.fontSize = fontSize + 'px';
            vnOverlay.style.lineHeight = (fontSize * 1.2) + 'px';
          } else if (vnOverlay) {
            vnOverlay.remove();
          }
        }
      }
    });
  };

  const noteTextarea = item.querySelector('.selection-note-textarea');
  setupLocalSync(japaneseTextarea, 'corrected_text');
  setupLocalSync(vietnameseTextarea, 'translation');
  setupLocalSync(noteTextarea, 'note');

  return item;
}
