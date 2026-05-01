/**
 * Tag System — Toolbar actions
 *
 * Các hàm xử lý toolbar liên quan đến tag:
 * - toggleTagsVisibility: ẩn/hiện tag pills trên toàn trang
 * - initToolbarAddTagButton: gắn listener cho nút "+Tag" trên toolbar
 */

import { showComboTagDropdown } from './tag-ui.js';
import { addTagToPage, removeTagFromPage } from './tag-crud.js';

// ── Constants ────────────────────────────────────────────────
const CSS_CLASS = {
  HIDE_TAGS: 'hide-tags',
  ACTIVE:    'active',
};
const SELECTOR = {
  ADD_TAG_BTN: '.toolbar .add-tag-btn',
};
const ATTR = {
  LISTENER_INIT: 'data-listener-initialized',
};
const MSG = {
  NO_PDF: 'Vui lòng mở file PDF trước!',
};
// ─────────────────────────────────────────────────────────────

/**
 * Toggle tags visibility (ẩn/hiện tag pills)
 */
export function toggleTagsVisibility() {
  document.body.classList.toggle(CSS_CLASS.HIDE_TAGS);
  const btn = document.getElementById('toggleTagsBtn');
  if (btn) btn.classList.toggle(CSS_CLASS.ACTIVE, document.body.classList.contains(CSS_CLASS.HIDE_TAGS));
}

/**
 * Initialize toolbar add-tag button for current page
 * Matches original D-index_WebApp.html behavior
 */
export function initToolbarAddTagButton() {
  const toolbarAddTagBtn = document.querySelector(SELECTOR.ADD_TAG_BTN);
  if (toolbarAddTagBtn && !toolbarAddTagBtn.hasAttribute(ATTR.LISTENER_INIT)) {
    toolbarAddTagBtn.addEventListener('click', () => {
      if (!appState.currentFile || !appState.pdfDoc) {
        alert(MSG.NO_PDF);
        return;
      }

      const pageTags = appState.currentFile?.pageTags?.[appState.currentPage] || [];
      showComboTagDropdown(toolbarAddTagBtn, pageTags, (comboStr, isSelected) => {
        if (isSelected) {
          addTagToPage(appState.currentPage, comboStr);
        } else {
          removeTagFromPage(appState.currentPage, comboStr);
        }
      });
    });
    toolbarAddTagBtn.setAttribute(ATTR.LISTENER_INIT, 'true');
  }
}
