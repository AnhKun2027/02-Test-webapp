/**
 * Selection Search - Keyword search/filter for selections in sidebar
 */

let noResultsEl = null;

/**
 * Apply the current search filter to all selection items in the sidebar.
 * Called on input change and after re-renders.
 */
export function applySelectionSearchFilter() {
  const searchInput = document.getElementById('selectionSearch');
  const selectionList = document.getElementById('selectionList');
  const clearBtn = document.getElementById('selectionSearchClear');
  if (!searchInput || !selectionList) return;

  const keyword = searchInput.value.trim().toLowerCase();

  // Toggle clear button visibility
  if (clearBtn) {
    clearBtn.style.display = keyword ? 'block' : 'none';
  }

  const items = selectionList.querySelectorAll('.selection-item');
  let visibleCount = 0;

  items.forEach(item => {
    if (!keyword) {
      item.style.display = '';
      visibleCount++;
      return;
    }

    // Collect searchable text from all textareas and text content in the item
    const textareas = item.querySelectorAll('textarea');
    let searchableText = '';
    textareas.forEach(ta => {
      searchableText += ' ' + ta.value;
    });
    // Also include any other text content (e.g. OCR accuracy badge)
    searchableText += ' ' + item.textContent;

    if (searchableText.toLowerCase().includes(keyword)) {
      item.style.display = '';
      visibleCount++;
    } else {
      item.style.display = 'none';
    }
  });

  // Handle no-results message
  if (noResultsEl) {
    noResultsEl.remove();
    noResultsEl = null;
  }

  if (keyword && visibleCount === 0) {
    noResultsEl = document.createElement('div');
    noResultsEl.className = 'selection-search-no-results';
    noResultsEl.textContent = 'Không tìm thấy';
    selectionList.appendChild(noResultsEl);
  }
}

/**
 * Initialize the selection search functionality.
 * Sets up event listeners for the search input and clear button.
 */
export function initSelectionSearch() {
  const searchInput = document.getElementById('selectionSearch');
  const clearBtn = document.getElementById('selectionSearchClear');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    applySelectionSearchFilter();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      applySelectionSearchFilter();
      searchInput.focus();
    });
  }
}
