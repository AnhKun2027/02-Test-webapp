
/**
 * B1 Form UI — Toast/notification, button state, validation helpers
 */

// =============================================
// VALIDATION STATE (merged from b1-form-validation.js)
// =============================================

/**
 * Set validation state cho element mà không mất margin classes (mb-2, mt-2, etc.)
 * @param {HTMLElement} element - Element cần set class
 * @param {string} state - 'valid', 'invalid', hoặc 'reset'
 * @param {string} [message] - Nếu có, đổi nội dung feedback text tương ứng
 */
export function setValidationState(element, state, message) {
  if (!element) return;

  element.classList.remove('is-valid', 'is-invalid');

  if (state === 'valid') {
    element.classList.add('is-valid');
  } else if (state === 'invalid') {
    element.classList.add('is-invalid');
  }

  if (message) {
    const feedbackClass = (state === 'valid') ? '.valid-feedback' : '.invalid-feedback';
    const feedbackDiv = element.parentNode.querySelector(feedbackClass);
    if (feedbackDiv) feedbackDiv.textContent = message;
  }
}

// =============================================
// BUTTON STATE MANAGEMENT
// =============================================

function markButtonState(elementId, isDirty, label) {
  const btn = document.getElementById(elementId);
  if (!btn) return;
  btn.disabled = !isDirty;
  btn.style.background = isDirty ? '#fd7e14' : '';
  btn.style.borderColor = isDirty ? '#fd7e14' : '';
  btn.style.color = isDirty ? 'white' : '';
  btn.textContent = label;
}

/** Đánh dấu button Save chưa lưu (cam, enabled) */
export function markSaveButtonDirty()  { markButtonState('b1_N_ButtonSaveRowPhienDich', true,  '⚠ Chưa lưu (Ctrl+S)'); }
/** Đánh dấu button Save đã lưu (mặc định, disabled) */
export function markSaveButtonClean()  { markButtonState('b1_N_ButtonSaveRowPhienDich', false, '✓ Đã lưu'); }
/** Đánh dấu button Danh Bạ chưa lưu */
export function markDanhBaButtonDirty() { markButtonState('b1_N_SaveDanhBa', true,  'Save Danh Ba'); }
/** Đánh dấu button Danh Bạ đã lưu */
export function markDanhBaButtonClean() { markButtonState('b1_N_SaveDanhBa', false, 'Save Danh Ba'); }

/** Chuyển button sang trạng thái "Saving..." (xanh, disabled) */
export function markButtonSaving(elementId) {
  const btn = document.getElementById(elementId);
  if (!btn) return;
  btn.disabled = true;
  btn.style.background = '#28a745';
  btn.style.borderColor = '#28a745';
  btn.style.color = 'white';
  btn.textContent = 'Saving...';
}

// =============================================
// TOAST NOTIFICATIONS
// =============================================

/** Hiện toast notification (success hoặc error) trong 2 giây
 * @param {string} type - 'success' hoặc 'error'
 * @param {string} message - Nội dung hiển thị */
export function showToast(type, message) {
  const toastEl = document.getElementById(type === 'success' ? 'b1_successNotifications' : 'b1_errorNotifications');
  if (toastEl) {
    const toastBody = toastEl.querySelector('.toast-body');
    if (toastBody) toastBody.textContent = message;

    toastEl.style.display = 'block';
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
      toastEl.style.display = 'none';
    }, 2000);
  }
}

/** Enable button "Gửi Thông Báo" khi user gõ text trong textarea */
export function setupGuiThongBaoListener() {
  const textarea = document.getElementById('b1_O_GhiChuGuiNV');
  const btn = document.getElementById('b1_N_ButtonGuiThongBao');
  if (!textarea || !btn) return;

  textarea.addEventListener('input', () => {
    if (window.FirebaseSync?.isB1FormSyncing) return;
    btn.disabled = textarea.value.trim() === '';
  });
}
