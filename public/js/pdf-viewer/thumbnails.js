/** Thumbnails — Render và quản lý sidebar page thumbnails */

import {
  thumbnailDomCache, THUMBNAIL_CACHE_MAX_FILES,
  destroyCachedThumbnailCanvases,
} from './cache.js';

// ============================================
// STATE
// ============================================

// Thumbnail render abort controller - cancel khi chuyển file
let thumbnailAbortController = null;

// ============================================
// RENDER THUMBNAILS
// ============================================

export async function renderThumbnails() {
  // Skip for image files - they don't have pdfDoc
  if (!appState.pdfDoc) {
    return;
  }

  const thumbnailList = document.getElementById('thumbnailList');

  // Ensure thumbnailList is valid before proceeding
  if (!thumbnailList) {
    console.error('[PDF-Viewer] Cannot find #thumbnailList element — thumbnails will not render');
    return;
  }

  // CANCEL MECHANISM: Abort any ongoing thumbnail render
  if (thumbnailAbortController) {
    thumbnailAbortController.abort();
  }
  thumbnailAbortController = new AbortController();
  const signal = thumbnailAbortController.signal;

  // Lưu fileId hiện tại để verify sau mỗi batch (double-check)
  const currentFileId = appState.currentFile?.id;

  // === CACHE CHECK: Nếu đã render trước đó, gắn lại DOM thay vì render lại ===
  const cached = currentFileId ? thumbnailDomCache.get(currentFileId) : null;
  if (cached) {
    // Chỉ detach thumbnails cũ (KHÔNG destroy canvas — chúng nằm trong cache)
    thumbnailList.replaceChildren();
    // Gắn lại DOM elements đã cache (~0ms thay vì render lại ~200ms)
    cached.forEach(node => thumbnailList.appendChild(node));
    // Cập nhật active thumbnail cho trang hiện tại
    updateActiveThumbnail();
    return;
  }

  // Không có cache → detach thumbnails cũ (KHÔNG destroy canvas nếu chúng đang cached)
  // Chỉ destroy canvas nếu file cũ KHÔNG nằm trong cache
  const prevFileId = thumbnailList.dataset.fileId;
  if (prevFileId && !thumbnailDomCache.has(prevFileId)) {
    cleanupThumbnails(); // Destroy canvas vì không ai cần nữa
  }
  thumbnailList.replaceChildren();
  thumbnailList.dataset.fileId = currentFileId; // Track file đang hiển thị

  // OPTIMIZED: Batch rendering to prevent UI freeze
  // Process 5 pages at a time, yielding control to browser between batches
  const BATCH_SIZE = 5;

  for (let batchStart = 1; batchStart <= appState.totalPages; batchStart += BATCH_SIZE) {
    // CHECK ABORT: Stop nếu user đã chuyển file
    if (signal.aborted || appState.currentFile?.id !== currentFileId) {
      return;
    }

    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, appState.totalPages);

    // Process current batch
    for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
      // Check abort trước mỗi thumbnail
      if (signal.aborted || appState.currentFile?.id !== currentFileId) {
        return;
      }
      await _renderSingleThumbnail(pageNum);
    }

    // Yield control to browser after each batch to prevent UI freeze
    // Uses setTimeout(0) to allow browser to process events, reflow, repaint
    if (batchEnd < appState.totalPages) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // === LƯU VÀO CACHE sau khi render xong ===
  if (currentFileId && thumbnailList.children.length > 0) {
    // Lưu bản copy DOM nodes (không phải reference — vì replaceChildren sẽ detach)
    const nodes = Array.from(thumbnailList.children);
    thumbnailDomCache.set(currentFileId, nodes);

    // LRU eviction: xóa file cũ nhất nếu cache đầy (destroy canvas trước)
    if (thumbnailDomCache.size > THUMBNAIL_CACHE_MAX_FILES) {
      const firstKey = thumbnailDomCache.keys().next().value;
      destroyCachedThumbnailCanvases(thumbnailDomCache.get(firstKey));
      thumbnailDomCache.delete(firstKey);
    }
  }
}

/**
 * Abort ongoing thumbnail render
 * Call this before switching files to prevent race conditions
 */
export function abortThumbnailRender() {
  if (thumbnailAbortController) {
    thumbnailAbortController.abort();
    thumbnailAbortController = null;
  }
}

// ============================================
// RENDER SINGLE THUMBNAIL (private)
// ============================================

/**
 * Render a single thumbnail page
 * Extracted from renderThumbnails() for batch processing
 */
/** Helper: tạo UI tags (combo pills + nút "+ Tag") cho thumbnail */
function _createTagsUI(pageNum) {
  const pageTagsDiv = document.createElement('div');
  pageTagsDiv.className = 'page-tags';
  const pageTags = appState.currentFile?.pageTags?.[pageNum] || [];

  pageTags.forEach(comboStr => {
    pageTagsDiv.appendChild(createComboPill(comboStr));
  });

  const addTagBtn = document.createElement('button');
  addTagBtn.className = 'add-tag-btn';
  addTagBtn.textContent = '+ Tag';
  addTagBtn.onclick = (e) => {
    e.stopPropagation();
    const currentPageTags = appState.currentFile?.pageTags?.[pageNum] || [];
    if (typeof showComboTagDropdown === 'function') {
      showComboTagDropdown(addTagBtn, currentPageTags, (comboStr, isSelected) => {
        if (isSelected) {
          if (typeof addTagToPage === 'function') addTagToPage(pageNum, comboStr);
        } else {
          if (typeof removeTagFromPage === 'function') removeTagFromPage(pageNum, comboStr);
        }
      });
    }
  };
  pageTagsDiv.appendChild(addTagBtn);

  return pageTagsDiv;
}

/** Helper: gắn click handler cho thumbnail — chuyển trang + render */
function _setupThumbnailClick(div, pageNum) {
  div.onclick = async () => {
    appState.currentPage = pageNum;
    await window.renderPage(false);
    if (typeof renderSelectionsForCurrentPage === 'function') {
      renderSelectionsForCurrentPage();
    }
    if (typeof updateRotateButtonState === 'function') {
      updateRotateButtonState();
    }
  };
}

async function _renderSingleThumbnail(pageNum) {
  const page = await appState.pdfDoc.getPage(pageNum);

  const rotationKey = getRotationKey(appState.currentFile.id, pageNum);
  const rotation = window.pageRotations[rotationKey] ?? 0;
  const viewport = page.getViewport({scale: 0.3, rotation: rotation});

  const thumbnailDiv = document.createElement('div');
  thumbnailDiv.className = 'page-thumbnail';
  if (pageNum === appState.currentPage) thumbnailDiv.classList.add('active');
  thumbnailDiv.setAttribute('data-page', pageNum);

  const thumbnailCanvas = createSafeCanvas(viewport.width, viewport.height);
  const thumbnailCtx = thumbnailCanvas.getContext('2d');

  await page.render({
    canvasContext: thumbnailCtx,
    viewport: viewport,
    annotationMode: 0
  }).promise;

  thumbnailDiv.appendChild(thumbnailCanvas);

  const pageNumber = document.createElement('div');
  pageNumber.className = 'page-number';
  pageNumber.textContent = pageNum;
  thumbnailDiv.appendChild(pageNumber);

  thumbnailDiv.appendChild(_createTagsUI(pageNum));

  // Apply tag filter - hide pages that don't match
  if (!pageMatchesFilter(pageNum)) {
    thumbnailDiv.style.opacity = '0.3';
    thumbnailDiv.style.pointerEvents = 'none';
  }

  _setupThumbnailClick(thumbnailDiv, pageNum);

  document.getElementById('thumbnailList').appendChild(thumbnailDiv);
}

// ============================================
// UPDATE ACTIVE THUMBNAIL
// ============================================

export function updateActiveThumbnail() {
  const activeThumb = document.querySelector(`.page-thumbnail[data-page="${appState.currentPage}"]`);
  if (!activeThumb) return;
  // Skip scrollIntoView nếu đã active sẵn → tránh re-scroll khi update không đổi page
  const wasActive = activeThumb.classList.contains('active');
  document.querySelectorAll('.page-thumbnail.active').forEach(t => t.classList.remove('active'));
  activeThumb.classList.add('active');
  if (!wasActive) activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================
// CLEANUP THUMBNAILS
// ============================================

/** Cleanup toàn bộ thumbnail state + cache — gọi khi destroy module */
export function destroy() {
  abortThumbnailRender();
  cleanupThumbnails();
}

export function cleanupThumbnails() {
  const thumbnailList = document.getElementById('thumbnailList');
  if (!thumbnailList) return;

  try {
    // Find all canvas elements in thumbnails
    const canvases = thumbnailList.querySelectorAll('canvas');
    canvases.forEach(canvas => {
      const ctx = canvas.getContext('2d');
      cleanupCanvas(canvas, ctx);
    });
  } catch (e) {
    console.warn('[PDF-Viewer] Thumbnail cleanup failed (may cause memory leak):', e.message || e,
      '| canvases:', thumbnailList?.querySelectorAll('canvas')?.length || 0);
  }
}
