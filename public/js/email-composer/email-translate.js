/**
 * Email Translate — AI translation, apply-instructions, VN highlight, language toggle
 */

import { EMAIL_TEXTAREA_IDS } from './email-constants.js';
import { triggerAutosave } from '../dom-utils.js';

/**
 * Translate email content using AI (Gemini)
 */
export async function translateEmailWithAI(baseId, forcedTargetLang = null) {
  const jpEl = document.getElementById(baseId + '_jp');
  const vnEl = document.getElementById(baseId + '_vn');
  if (!jpEl || !vnEl) return;

  const jpContent = jpEl.value.trim();
  const vnContent = vnEl.value.trim();

  let sourceLang, targetLang;
  if (baseId === 'email_customer') {
    sourceLang = 'jp'; targetLang = 'vn';
  } else if (forcedTargetLang) {
    targetLang = forcedTargetLang;
    sourceLang = forcedTargetLang === 'jp' ? 'vn' : 'jp';
  } else if (jpContent && !vnContent) {
    sourceLang = 'jp'; targetLang = 'vn';
  } else if (vnContent && !jpContent) {
    sourceLang = 'vn'; targetLang = 'jp';
  } else {
    sourceLang = 'jp'; targetLang = 'vn';
  }

  const sourceEl = sourceLang === 'jp' ? jpEl : vnEl;
  const targetEl = targetLang === 'jp' ? jpEl : vnEl;
  const sourceContent = sourceEl.value.trim();

  if (!sourceContent) {
    const langName = sourceLang === 'jp' ? 'tiếng Nhật' : 'tiếng Việt';
    alert(`Không có nội dung ${langName} để dịch.`);
    return;
  }

  const sourceName = sourceLang === 'jp' ? '🇯🇵 JP' : '🇻🇳 VN';
  const targetName = targetLang === 'jp' ? '🇯🇵 JP' : '🇻🇳 VN';

  try {
    showLoading(`Đang dịch ${sourceName} → ${targetName}...`);

    if (baseId === 'email_customer') {
      const subJpEl = document.getElementById('subject_email_customer_jp');
      const subVnEl = document.getElementById('subject_email_customer_vn');
      const subjectJp = subJpEl ? subJpEl.value.trim() : '';

      const [subResult, bodyResult] = await Promise.all([
        subjectJp
          ? ApiClient.callCloudFunction('translateText', { text: subjectJp, sourceLang: 'jp', targetLang: 'vn' })
          : Promise.resolve(null),
        sourceContent
          ? ApiClient.callCloudFunction('translateEmailCustomerEndpoint', { body: sourceContent })
          : Promise.resolve(null),
      ]);

      if (subResult?.success && subResult.translatedText && subVnEl) {
        subVnEl.value = subResult.translatedText;
      }

      if (bodyResult?.success && bodyResult.translatedText) {
        targetEl.value = bodyResult.translatedText;
        triggerAutosave(targetEl);
      }

      const subOk = !subjectJp || (subResult?.success && subResult.translatedText);
      const bodyOk = !sourceContent || (bodyResult?.success && bodyResult.translatedText);
      if (!subOk && !bodyOk) {
        alert('Lỗi dịch: không dịch được tiêu đề lẫn nội dung');
      }

    } else {
      const result = await ApiClient.callCloudFunction('translateText', {
        text: sourceContent,
        sourceLang: sourceLang,
        targetLang: targetLang
      });

      if (result.success && result.translatedText) {
        targetEl.value = result.translatedText;
        triggerAutosave(targetEl);
      } else {
        alert('Lỗi dịch: ' + (result.error || 'Unknown error'));
      }
    }

  } catch (error) {
    console.error('[Email] Translation error:', error);
    alert('Lỗi khi dịch: ' + error.message);
  } finally {
    hideLoading();
  }
}

/**
 * Chỉ chạy /apply-instructions: JP gốc + // instructions từ ô VN
 */
export async function applyInstructionsOnly(baseId) {
  const jpEl = document.getElementById(baseId + '_jp');
  const vnEl = document.getElementById(baseId + '_vn');
  if (!jpEl || !vnEl) return;

  const jpContent = jpEl.value.trim();
  const vnContent = vnEl.value.trim();

  if (!jpContent) {
    alert('Không có nội dung tiếng Nhật để chỉnh sửa.');
    return;
  }
  if (!vnContent) {
    alert('Vui lòng nhập yêu cầu chỉnh sửa (dòng //) vào ô tiếng Việt.');
    return;
  }

  const hasInstructions = vnContent.split('\n').some(line => line.trimStart().startsWith('//') || line.trimStart().startsWith('--'));
  if (!hasInstructions) {
    alert('Không tìm thấy dòng // hoặc --\nVí dụ:\n// thêm câu xin lỗi vì trễ deadline\n-- xóa đoạn chào hỏi');
    return;
  }

  try {
    showLoading('Đang áp dụng chỉnh sửa vào email JP...');

    const result = await ApiClient.callCloudFunction('applyInstructionsEndpoint', {
      text: jpContent,
      instructions: vnContent
    });

    if (result.success && result.editedText) {
      jpEl.value = result.editedText;
    } else {
      alert('Lỗi áp dụng chỉnh sửa: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('[Email] applyInstructionsOnly error:', err);
    alert('Lỗi: ' + err.message);
  } finally {
    hideLoading();
  }
}

// ============================================
// VN HIGHLIGHT — syntax highlight cho ô tiếng Việt
// ============================================

/**
 * Khởi tạo syntax highlight cho ô VN (overlay div pattern)
 */
export function initVnHighlight() {
  function buildHighlightHTML(text) {
    return text.split('\n').map(line => {
      const trimmed = line.trimStart();
      const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      if (trimmed.startsWith('--')) return `<span class="hl-delete">${escaped}\n</span>`;
      if (trimmed.startsWith('//')) return `<span class="hl-add">${escaped}\n</span>`;
      return `<span class="hl-normal">${escaped}\n</span>`;
    }).join('');
  }

  EMAIL_TEXTAREA_IDS.VN_HIGHLIGHT.forEach(id => {
    const ta = document.getElementById(id);
    if (!ta || ta.dataset.highlightInit) return;

    const layer = document.createElement('div');
    layer.className = 'vn-highlight-layer';
    layer.id = id + '_highlight';
    ta.parentElement.insertBefore(layer, ta);

    function syncStyles() {
      const cs = window.getComputedStyle(ta);
      layer.style.fontFamily    = cs.fontFamily;
      layer.style.fontSize      = cs.fontSize;
      layer.style.fontWeight    = cs.fontWeight;
      layer.style.lineHeight    = cs.lineHeight;
      layer.style.padding       = cs.padding;
      layer.style.border        = cs.border;
      layer.style.boxSizing     = cs.boxSizing;
      layer.style.letterSpacing = cs.letterSpacing;
      layer.style.wordSpacing   = cs.wordSpacing;
    }
    syncStyles();

    ta.classList.add('vn-highlight-active');
    ta.dataset.highlightInit = 'true';

    function sync() {
      layer.innerHTML = buildHighlightHTML(ta.value);
      layer.scrollTop = ta.scrollTop;
    }
    ta.addEventListener('input', sync);
    let _scrollRAF = null;
    ta.addEventListener('scroll', () => {
      if (_scrollRAF) return;
      _scrollRAF = requestAnimationFrame(() => {
        layer.scrollTop = ta.scrollTop;
        _scrollRAF = null;
      });
    });

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => syncStyles());
    });
    ro.observe(ta);
    // Lưu reference để destroy() có thể disconnect
    ta._vnHighlightObserver = ro;
    sync();
  });
}

/** Cleanup VN highlight observers */
export function destroyVnHighlight() {
  EMAIL_TEXTAREA_IDS.VN_HIGHLIGHT.forEach(id => {
    const ta = document.getElementById(id);
    if (ta && ta._vnHighlightObserver) {
      ta._vnHighlightObserver.disconnect();
      ta._vnHighlightObserver = null;
    }
  });
}

/**
 * Initialize overlay buttons (translate + apply-instructions)
 */
export function initLanguageToggle() {
  initVnHighlight();

  document.querySelectorAll('.lang-btn-overlay').forEach(btn => {
    if (btn.hasAttribute('data-overlay-initialized')) return;
    btn.addEventListener('click', function() {
      const action = this.dataset.action;
      const baseId = this.dataset.base;
      if (!baseId) return;
      if (action === 'apply-instructions') {
        applyInstructionsOnly(baseId);
      } else if (action === 'translate-vn') {
        translateEmailWithAI(baseId, 'vn');
      }
    });
    btn.setAttribute('data-overlay-initialized', 'true');
  });
}

/**
 * Double-click to enable editing on readonly textareas
 */
export function initReadonlyDoubleClick() {
  EMAIL_TEXTAREA_IDS.READONLY_EDITABLE.forEach(id => {
    const textarea = document.getElementById(id);
    if (!textarea) return;
    textarea.addEventListener('dblclick', function() {
      this.readOnly = false;
      this.classList.remove('sbs-textarea-readonly');
      this.style.cursor = 'text';
      this.style.backgroundColor = '#fff3e0';
      const backdrop = this.parentElement?.querySelector('.vn-highlight-layer');
      if (backdrop) backdrop.style.backgroundColor = '#fff3e0';
      this.focus();
    });
  });
}
