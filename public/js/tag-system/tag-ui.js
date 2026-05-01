/**
 * Tag System — UI helpers
 *
 * Chứa các hàm tạo/render UI cho tag system:
 * - createComboPill: tạo pill hiển thị combo trên thumbnail
 * - showComboTagDropdown: mở dropdown chọn tag cho file/page
 * - updatePageThumbnailTags: refresh tag pills trên 1 thumbnail
 */

import { tagState } from './tag-state.js';
import { TAG_CONSTANTS } from './tag-constants.js';

const { CSS, RESERVED, MSG } = TAG_CONSTANTS;

/**
 * Create a combo pill element for display on thumbnails
 * @param {string} comboStr - Combo string (e.g., "_1", "_2")
 */
export function createComboPill(comboStr) {
  const pill = document.createElement('span');
  pill.className = CSS.PILL;
  if (comboStr === RESERVED.CHECK) pill.classList.add(CSS.PILL_CHECK);
  if (comboStr === RESERVED.SEND) pill.classList.add(CSS.PILL_SEND);
  pill.textContent = comboStr;
  return pill;
}

/**
 * Tạo 1 item trong dropdown (checkbox + label)
 * @param {string|Object} combo - Combo value (string hoặc {value})
 * @param {Array} currentTags - Tags đang được chọn
 * @param {function} onComboToggle - Callback khi toggle
 */
function createDropdownItem(combo, currentTags, onComboToggle) {
  const comboValue = typeof combo === 'string' ? combo : combo.value;
  const isSelected = currentTags.includes(comboValue);

  const item = document.createElement('div');
  item.className = CSS.DROPDOWN_ITEM + (isSelected ? ' selected' : '');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = isSelected;
  checkbox.onchange = () => {
    onComboToggle(comboValue, checkbox.checked);
    item.classList.toggle('selected', checkbox.checked);
  };

  const label = document.createElement('span');
  label.textContent = comboValue;
  label.style.flex = '1';
  label.onclick = () => checkbox.click();

  item.appendChild(checkbox);
  item.appendChild(label);
  return item;
}

/**
 * Show combo tag dropdown menu (for file manager and page thumbnails)
 * @param {HTMLElement} targetElement - Element to position near
 * @param {Array} currentTags - Currently selected tags on the file/page
 * @param {function} onComboToggle - Callback (comboStr, isSelected) when toggled
 */
export function showComboTagDropdown(targetElement, currentTags = [], onComboToggle) {
  // Cleanup previous dropdown listener
  if (tagState.dropdownController) {
    tagState.dropdownController.abort();
    tagState.dropdownController = null;
  }

  // Remove existing dropdown
  const existing = document.querySelector('.' + CSS.DROPDOWN);
  if (existing) existing.remove();

  const dropdown = document.createElement('div');
  dropdown.className = CSS.DROPDOWN;

  // Handle empty presets
  if (!tagState.tagFilterCombos || tagState.tagFilterCombos.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = CSS.DROPDOWN_EMPTY;
    emptyMsg.textContent = MSG.NO_PRESET;
    dropdown.appendChild(emptyMsg);
  } else {
    tagState.tagFilterCombos.forEach(combo => {
      dropdown.appendChild(createDropdownItem(combo, currentTags, onComboToggle));
    });
  }

  // Position dropdown near target
  const rect = targetElement.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.left = rect.left + 'px';

  const viewportHeight = window.innerHeight;
  if (rect.bottom > viewportHeight / 2) {
    dropdown.style.bottom = (viewportHeight - rect.top + 5) + 'px';
  } else {
    dropdown.style.top = (rect.bottom + 5) + 'px';
  }

  document.body.appendChild(dropdown);

  // Close on click outside — defer 1 tick để tránh bắt chính click mở dropdown.
  // Dùng targetElement.contains(e.target) để cover descendant (vd icon con trong nút).
  tagState.dropdownController = new AbortController();
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !targetElement.contains(e.target)) {
        dropdown.remove();
        tagState.dropdownController?.abort();
        tagState.dropdownController = null;
      }
    }, { signal: tagState.dropdownController.signal });
  }, 0);

  return dropdown;
}

/**
 * Update tag pills on a single page thumbnail (lightweight, no re-render)
 * @param {number} pageNum - Page number to update
 */
export function updatePageThumbnailTags(pageNum) {
  const thumbnailList = document.getElementById('thumbnailList');
  if (!thumbnailList) return;
  const thumbnailDiv = thumbnailList.querySelector(`[data-page="${pageNum}"]`);
  if (!thumbnailDiv) return;
  const pageTagsDiv = thumbnailDiv.querySelector('.page-tags');
  if (!pageTagsDiv) return;

  // Xóa chỉ tag pills, giữ nguyên addTagBtn
  pageTagsDiv.querySelectorAll('.' + CSS.PILL).forEach(p => p.remove());

  const addTagBtn = pageTagsDiv.querySelector('.' + CSS.ADD_TAG_BTN);
  const pageTags = appState.currentFile?.pageTags?.[pageNum] || [];
  pageTags.forEach(comboStr => {
    // Chèn pill trước addTagBtn (nếu có), không sau
    if (addTagBtn) {
      pageTagsDiv.insertBefore(createComboPill(comboStr), addTagBtn);
    } else {
      pageTagsDiv.appendChild(createComboPill(comboStr));
    }
  });
}
